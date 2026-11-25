// Cravos liability (docs/gamification/README.md §10 money rules): outstanding unexpired
// Cravos × expected cost per Cravo by catalog mix, minus expected breakage. Pure math;
// the gamLiabilityReport callable reads Firestore and validates input at its boundary.
// Cravos never convert to money for members: this is the operator's internal planning
// view, and costs arrive in whatever unit the caller chooses (BRL cents, for example).

import type { CatalogItemDoc, GamLot, GamTimestamp } from '../model';

/** Operator assumptions per catalog item. Shares must be >= 0 and sum to <= 1, costs
 *  >= 0; partner_funded and give items are forced to zero cost regardless. */
export type LiabilityAssumptions = {
  items: Array<{ itemId: string; shareOfRedemptions: number; expectedCostPerUnit: number }>;
  /** Expected fraction (0..1) of outstanding Cravos that will expire unspent. */
  breakageRate: number;
};

export type LiabilityReportResult = {
  outstandingCravos: number;
  /** Outstanding Cravos by the UTC month their lots expire in, ascending. */
  byExpiryMonth: Array<{ month: string; cravos: number }>;
  /** Expected app cost per Cravo under the assumed mix; null without assumptions. */
  costPerCravo: number | null;
  grossLiability: number | null;
  /** Gross liability minus expected breakage; null without assumptions. */
  netLiability: number | null;
};

export function liabilityReport(
  lots: GamLot[],
  catalog: CatalogItemDoc[],
  now: GamTimestamp,
  assumptions?: LiabilityAssumptions,
): LiabilityReportResult {
  const live = lots.filter((lot) => lot.amount > 0 && lot.expiresAt.toMillis() > now.toMillis());
  const outstandingCravos = live.reduce((sum, lot) => sum + lot.amount, 0);

  const byMonth = new Map<string, number>();
  for (const lot of live) {
    const expires = lot.expiresAt.toDate();
    const month = `${expires.getUTCFullYear()}-${String(expires.getUTCMonth() + 1).padStart(2, '0')}`;
    byMonth.set(month, (byMonth.get(month) ?? 0) + lot.amount);
  }
  const byExpiryMonth = [...byMonth.entries()]
    .map(([month, cravos]) => ({ month, cravos }))
    .sort((a, b) => a.month.localeCompare(b.month));

  if (assumptions === undefined) {
    return { outstandingCravos, byExpiryMonth, costPerCravo: null, grossLiability: null, netLiability: null };
  }

  const priceByItem = new Map(catalog.map((item) => [item.id, item]));
  let costPerCravo = 0;
  for (const { itemId, shareOfRedemptions, expectedCostPerUnit } of assumptions.items) {
    const item = priceByItem.get(itemId);
    if (item === undefined) throw new Error(`liabilityReport: unknown catalog item ${itemId}`);
    // The partner pays for partner-funded and give items; the app never carries them.
    const cost = item.kind === 'partner_funded' || item.kind === 'give' ? 0 : expectedCostPerUnit;
    costPerCravo += shareOfRedemptions * (item.priceCravos > 0 ? cost / item.priceCravos : 0);
  }

  const grossLiability = outstandingCravos * costPerCravo;
  return {
    outstandingCravos,
    byExpiryMonth,
    costPerCravo,
    grossLiability,
    netLiability: grossLiability * (1 - assumptions.breakageRate),
  };
}
