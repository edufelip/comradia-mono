import { NOTIFICATION_LOCALES, notificationCopy, notificationLocale, type NotificationLocale } from './notification-locale';
import { createHash } from 'node:crypto';
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { MulticastMessage } from 'firebase-admin/messaging';

export const MAX_TOKENS_PER_FCM_CALL = 500;
const MAX_DEVICES_PER_USER = 20;
const PUSH_TOKEN_ID_PATTERN = /^[0-9a-f]{64}$/;
const INVALID_TOKEN_CODES = new Set([
  'invalid-registration-token',
  'registration-token-not-registered',
]);

export type NotificationType = 'match' | 'message';

export interface CreatedNotificationEvent {
  eventId: string;
  type: NotificationType;
  matchId: string;
  /** Present only for messages; it is validated and never placed in the push payload. */
  senderUid?: unknown;
  /** Accepted only to make the privacy boundary explicit; this value is never read. */
  messageText?: unknown;
}

export interface MatchContext {
  users: [string, string];
}

export interface PushTokenRegistration {
  id: string;
  token: string;
  locale?: NotificationLocale;
}

export interface FcmSendResult {
  responses: Array<{
    success: boolean;
    error?: { code?: string };
  }>;
}

export interface FcmSender {
  sendEachForMulticast(message: MulticastMessage): Promise<FcmSendResult>;
}

export type DispatchClaimResult = 'claimed' | 'suppressed' | 'duplicate';

export interface DispatchClaim {
  eventId: string;
  type: NotificationType;
  matchId: string;
  users: [string, string];
  recipientUid: string;
  senderUid?: string;
}

export interface NotificationStore {
  getMatchContext(matchId: string): Promise<MatchContext | null>;
  listPushTokens(uid: string): Promise<PushTokenRegistration[]>;
  claimDispatch(input: DispatchClaim): Promise<DispatchClaimResult>;
  isDispatchAllowed(input: DispatchClaim): Promise<boolean>;
  deletePushToken(uid: string, tokenId: string): Promise<void>;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function parseMatchUsers(matchId: string, data: FirebaseFirestore.DocumentData | undefined): [string, string] | null {
  if (!data || !Array.isArray(data.users) || data.users.length !== 2) return null;
  const [first, second] = data.users;
  if (
    typeof first !== 'string' ||
    typeof second !== 'string' ||
    first.length === 0 ||
    second.length === 0 ||
    first >= second ||
    matchId !== `${first}_${second}`
  ) {
    return null;
  }
  return [first, second];
}

function validTokenData(id: string, data: FirebaseFirestore.DocumentData): data is {
  token: string;
  platform: 'ios' | 'android';
  locale?: unknown;
} {
  return (
    PUSH_TOKEN_ID_PATTERN.test(id) &&
    typeof data.token === 'string' &&
    data.token.length >= 1 &&
    data.token.length <= 4096 &&
    digest(data.token) === id &&
    (data.platform === 'ios' || data.platform === 'android')
  );
}

/**
 * The Admin Firestore adapter reads the live match, private account and profile documents,
 * mirrored blocks, and owner-private push registrations. Its dispatch transactions recheck
 * deletion, membership and both block directions before claiming and sending the event.
 */
export class FirestoreNotificationStore implements NotificationStore {
  constructor(private readonly firestore: Firestore) {}

  async getMatchContext(matchId: string): Promise<MatchContext | null> {
    const matchRef = this.firestore.doc(`matches/${matchId}`);
    const matchSnapshot = await matchRef.get();
    if (!matchSnapshot.exists) return null;

    const users = parseMatchUsers(matchId, matchSnapshot.data());
    if (!users) return null;
    const [first, second] = users;
    const documents = await this.firestore.getAll(
      this.firestore.doc(`users/${first}`),
      this.firestore.doc(`users/${second}`),
      this.firestore.doc(`profiles/${first}`),
      this.firestore.doc(`profiles/${second}`),
    );
    if (documents.some((document) => !document.exists)) return null;
    return { users };
  }

  async listPushTokens(uid: string): Promise<PushTokenRegistration[]> {
    const snapshot = await this.firestore
      .collection(`users/${uid}/pushTokens`)
      .orderBy('updatedAt', 'desc')
      .limit(MAX_DEVICES_PER_USER)
      .get();
    return snapshot.docs.flatMap((document) => {
      const data = document.data();
      return validTokenData(document.id, data)
        ? [{ id: document.id, token: data.token, locale: notificationLocale(data.locale) }]
        : [];
    });
  }

  async claimDispatch(input: DispatchClaim): Promise<DispatchClaimResult> {
    // The event id may contain path separators, so only its digest is used as a document id.
    const markerId = digest(`${input.type}\0${input.eventId}\0${input.recipientUid}`);
    const markerRef = this.firestore.doc(`notificationDispatches/${markerId}`);
    return this.firestore.runTransaction(async (transaction) => {
      const marker = await transaction.get(markerRef);
      if (marker.exists) return 'duplicate';
      const allowed = await this.readDispatchSafety(transaction, input);

      // Claim even suppressed events. If a block is later removed or an account is restored,
      // a duplicate delivery must not turn an old event into a new notification.
      transaction.create(markerRef, {
        createdAt: FieldValue.serverTimestamp(),
        expireAt: Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      return allowed ? 'claimed' : 'suppressed';
    });
  }

  /** One owner alert per report: same marker collection as match and message claims. */
  async claimReportAlert(reportId: string, recipientUid: string): Promise<boolean> {
    const markerRef = this.firestore.doc(`notificationDispatches/${digest(`report\0${reportId}\0${recipientUid}`)}`);
    return this.firestore.runTransaction(async (transaction) => {
      if ((await transaction.get(markerRef)).exists) return false;
      transaction.create(markerRef, {
        createdAt: FieldValue.serverTimestamp(),
        expireAt: Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      return true;
    });
  }

  async isDispatchAllowed(input: DispatchClaim): Promise<boolean> {
    return this.firestore.runTransaction((transaction) => this.readDispatchSafety(transaction, input));
  }

  private async readDispatchSafety(
    transaction: FirebaseFirestore.Transaction,
    input: DispatchClaim,
  ): Promise<boolean> {
    const [first, second] = input.users;
    const refs = [
      this.firestore.doc(`matches/${input.matchId}`),
      this.firestore.doc(`users/${first}`),
      this.firestore.doc(`users/${second}`),
      this.firestore.doc(`profiles/${first}`),
      this.firestore.doc(`profiles/${second}`),
      this.firestore.doc(`blocks/${first}/by/${second}`),
      this.firestore.doc(`blocks/${second}/by/${first}`),
    ];
    const [
      matchSnapshot,
      firstAccount,
      secondAccount,
      firstProfile,
      secondProfile,
      firstBlockedSecond,
      secondBlockedFirst,
    ] = await transaction.getAll(...refs);
    const liveUsers = parseMatchUsers(input.matchId, matchSnapshot.data());
    const validEventState =
      matchSnapshot.exists &&
      liveUsers !== null &&
      liveUsers[0] === first &&
      liveUsers[1] === second &&
      firstAccount.exists &&
      secondAccount.exists &&
      firstProfile.exists &&
      secondProfile.exists &&
      input.users.includes(input.recipientUid) &&
      (input.type === 'match' ||
        (typeof input.senderUid === 'string' &&
          input.users.includes(input.senderUid) &&
          input.senderUid !== input.recipientUid));
    const isBlocked = firstBlockedSecond.exists || secondBlockedFirst.exists;
    return validEventState && !isBlocked;
  }

  async deletePushToken(uid: string, tokenId: string): Promise<void> {
    await this.firestore.doc(`users/${uid}/pushTokens/${tokenId}`).delete();
  }
}

export function isInvalidTokenError(code: string | undefined): boolean {
  if (!code) return false;
  const shortCode = code.startsWith('messaging/') ? code.slice('messaging/'.length) : code;
  return INVALID_TOKEN_CODES.has(shortCode);
}

function payload(type: NotificationType, matchId: string, recipientUid: string, locale: NotificationLocale): Omit<MulticastMessage, 'tokens'> {
  return {
    notification: notificationCopy(locale, type),
    data: { type, matchId, recipientUid },
    android: { notification: { channelId: 'matches-messages' } },
    apns: { payload: { aps: { sound: 'default' } } },
  };
}

export function createNotificationDispatcher(
  store: NotificationStore,
  sender: FcmSender,
  onSendFailure: (type: NotificationType) => void = () => undefined,
): (event: CreatedNotificationEvent) => Promise<void> {
  return async (event) => {
    if (!event.eventId || !event.matchId) return;
    const context = await store.getMatchContext(event.matchId);
    if (!context) return;

    if (event.type === 'message' &&
      (typeof event.senderUid !== 'string' || !context.users.includes(event.senderUid))) {
      return;
    }

    const recipients = event.type === 'match'
      ? context.users
      : context.users.filter((uid) => uid !== event.senderUid);

    for (const recipientUid of recipients) {
      const claimInput: DispatchClaim = {
        eventId: event.eventId,
        type: event.type,
        matchId: event.matchId,
        users: context.users,
        recipientUid,
        ...(event.type === 'message' && { senderUid: event.senderUid as string }),
      };
      const claim = await store.claimDispatch(claimInput);
      if (claim !== 'claimed') continue;

      // A failure after this claim (including a token lookup failure) can lose this push;
      // retries see the marker and stop. This is the at-most-once duplicate-delivery tradeoff.
      const tokens = await store.listPushTokens(recipientUid);
      if (tokens.length === 0) continue;

      // Keep one pre-send registration refresh: it closes the revocation window between the
      // initial lookup and sending, without repeating the same collection query per locale.
      const currentTokens = await store.listPushTokens(recipientUid);
      const currentById = new Map(currentTokens.map((token) => [token.id, token]));
      const activeTokens = tokens.flatMap(({ id, token }) => {
        const current = currentById.get(id);
        return current?.token === token ? [current] : [];
      });
      if (activeTokens.length === 0) continue;

      const tokensByLocale = new Map<NotificationLocale, PushTokenRegistration[]>(
        NOTIFICATION_LOCALES.map((locale) => [locale, []]),
      );
      for (const token of activeTokens) tokensByLocale.get(notificationLocale(token.locale))?.push(token);

      let safetyChecked = false;
      chunks: for (const locale of NOTIFICATION_LOCALES) {
        const localeTokens = tokensByLocale.get(locale) ?? [];
        for (let start = 0; start < localeTokens.length; start += MAX_TOKENS_PER_FCM_CALL) {
          const chunk = localeTokens.slice(start, start + MAX_TOKENS_PER_FCM_CALL);
          // The marker was claimed before reads. Recheck live membership, account and block
          // state once immediately before this recipient's first external send.
          if (!safetyChecked) {
            safetyChecked = true;
            if (!await store.isDispatchAllowed(claimInput)) break chunks;
          }
          let result: FcmSendResult;
          try {
            result = await sender.sendEachForMulticast({
              ...payload(event.type, event.matchId, recipientUid, locale),
              tokens: chunk.map(({ token }) => token),
            });
          } catch {
            // Keep the existing at-most-once loss window; no retry after claiming FCM.
            onSendFailure(event.type);
            continue;
          }
          const invalidTokens = chunk.filter((_, index) =>
            isInvalidTokenError(result.responses[index]?.error?.code),
          );
          await Promise.allSettled(
            invalidTokens.map(({ id }) => store.deletePushToken(recipientUid, id)),
          );
        }
      }
    }
  };
}
