// The two redemption callables (docs/gamification/redemption.md). `redeem` is
// member-facing behind the gam_redemption flag, off by default in the Firebase Remote
// Config server template; `gamLiabilityReport` is the admin-only liability view used to
// review liability BEFORE the flag ever turns on, so it ignores the flag.

import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getRemoteConfig } from 'firebase-admin/remote-config';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { armFor } from '../engine/flags';
import type { CatalogItemDoc } from '../model';
import { liabilityReport, type LiabilityAssumptions } from './liability';
import {
  InvalidRedeemRequestError,
  RedeemError,
  readCatalogItem,
  readLot,
  redeemItem,
  type RedeemResult,
} from './redeem';

const DATABASE_REGION = 'southamerica-east1';
const GAM_REDEMPTION_FLAG = 'gam_redemption';

/**
 * Reads gam_redemption from the Remote Config server template. The template ships with
 * the parameter set to 'false', so a missing parameter means off. If Remote Config is
 * unreachable the flag fails closed to off — never to a silent open.
 */
async function isRedemptionEnabled(uid: string): Promise<boolean> {
  try {
    const template = await getRemoteConfig().getTemplate();
    const parameterValue = (key: string) => {
      const groups = Object.values(template.parameterGroups);
      const parameter = template.parameters[key] ?? groups.map((group) => group.parameters[key]).find(Boolean);
      const value = parameter?.defaultValue;
      return value !== undefined && 'value' in value ? value.value : undefined;
    };
    const percent = Number(parameterValue('gam_experiment_pct') ?? 0);
    return parameterValue(GAM_REDEMPTION_FLAG) === 'true' &&
      parameterValue('gam_ui_enabled') === 'true' &&
      parameterValue('gam_kill_switch') !== 'true' &&
      parameterValue('gam_shadow') !== 'true' &&
      armFor(uid, Number.isFinite(percent) ? Math.round(percent) : 0) === 'treatment';
  } catch (error) {
    logger.error(`Reading the ${GAM_REDEMPTION_FLAG} flag failed; treating redemption as off`, {
      error: String(error),
    });
    return false;
  }
}

export const redeem = onCall(
  {
    region: DATABASE_REGION,
    // The spec's launch blocker list keeps App Check enforcement a deploy-time decision;
    // this callable requires a token from day one, as section 10 demands.
    enforceAppCheck: true,
    minInstances: 0,
  },
  async (request): Promise<{ ok: true } & RedeemResult> => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in to redeem Cravos.');
    try {
      const result = await redeemItem(uid, request.data, {
        firestore: getFirestore(),
        isRedemptionEnabled: () => isRedemptionEnabled(uid),
      });
      return { ok: true, ...result };
    } catch (error) {
      if (error instanceof InvalidRedeemRequestError) {
        throw new HttpsError('invalid-argument', error.message);
      }
      if (error instanceof RedeemError) {
        // The details carry the reason code the app maps to member-facing copy.
        throw new HttpsError('failed-precondition', error.message, { reason: error.reason });
      }
      throw error;
    }
  },
);

// ---------------------------------------------------------------------------
// gamLiabilityReport: admin claim only, flag-independent.
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(message: string): never {
  throw new HttpsError('invalid-argument', message);
}

function parseLiabilityAssumptions(data: unknown, itemIds: Set<string>): LiabilityAssumptions | undefined {
  if (data === undefined || data === null) return undefined;
  if (!isRecord(data)) invalid('gamLiabilityReport expects { items?, breakageRate? }.');
  const rawItems = data.items;
  const items =
    rawItems === undefined
      ? []
      : (Array.isArray(rawItems) ? rawItems : invalid('items must be an array.')).flatMap((entry) => {
          if (!isRecord(entry)) invalid('each item must be { itemId, shareOfRedemptions, expectedCostPerUnit }.');
          const { itemId, shareOfRedemptions, expectedCostPerUnit } = entry;
          if (typeof itemId !== 'string' || !itemIds.has(itemId)) {
            invalid(`items.itemId must be an active catalog item id, got ${JSON.stringify(itemId)}.`);
          }
          if (typeof shareOfRedemptions !== 'number' || !Number.isFinite(shareOfRedemptions) || shareOfRedemptions < 0) {
            invalid('items.shareOfRedemptions must be a number >= 0.');
          }
          if (typeof expectedCostPerUnit !== 'number' || !Number.isFinite(expectedCostPerUnit) || expectedCostPerUnit < 0) {
            invalid('items.expectedCostPerUnit must be a number >= 0.');
          }
          return [{ itemId, shareOfRedemptions, expectedCostPerUnit }];
        });
  const shareSum = items.reduce((sum, item) => sum + item.shareOfRedemptions, 0);
  if (shareSum > 1 + 1e-9) invalid('items.shareOfRedemptions must sum to at most 1.');
  const breakageRateRaw = data.breakageRate;
  const breakageRate =
    breakageRateRaw === undefined
      ? 0
      : typeof breakageRateRaw === 'number' && Number.isFinite(breakageRateRaw) && breakageRateRaw >= 0 && breakageRateRaw <= 1
        ? breakageRateRaw
        : invalid('breakageRate must be a number between 0 and 1.');
  return { items, breakageRate };
}

export const gamLiabilityReport = onCall(
  { region: DATABASE_REGION, minInstances: 0, enforceAppCheck: true },
  async (request) => {
    // Custom claims arrive on the decoded token; only gamAdmin holders may call.
    const claims: Record<string, unknown> = request.auth?.token ?? {};
    if (claims['gamAdmin'] !== true) {
      throw new HttpsError('permission-denied', 'gamLiabilityReport requires the gamAdmin claim.');
    }

    const firestore = getFirestore();
    const [lotsSnapshot, catalogSnapshot] = await Promise.all([
      firestore.collectionGroup('lots').where('expiresAt', '>', Timestamp.now()).get(),
      firestore.collection('catalog').get(),
    ]);
    const lots = lotsSnapshot.docs.map(readLot);
    const catalog: CatalogItemDoc[] = catalogSnapshot.docs
      .filter((document) => document.get('active') === true)
      .map(readCatalogItem);
    const assumptions = parseLiabilityAssumptions(request.data, new Set(catalog.map((item) => item.id)));
    return liabilityReport(lots, catalog, Timestamp.now(), assumptions);
  },
);
