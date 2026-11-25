import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';
import type { Firestore } from 'firebase-admin/firestore';
import { FirestoreNotificationStore, isInvalidTokenError } from '../../notification-handler';
import { velocityAlertBody, type VelocityKind } from './velocity';

const copy: Record<string, { title: string; body: string }> = {
  'pt-BR': { title: 'Comradia', body: 'Sua semana ainda está aberta.' },
  'en-US': { title: 'Comradia', body: 'Your week is still open.' },
  'es-ES': { title: 'Comradia', body: 'Tu semana sigue abierta.' },
  'fr-FR': { title: 'Comradia', body: 'Ta semaine est encore ouverte.' },
  'de-DE': { title: 'Comradia', body: 'Deine Woche läuft noch.' },
  'it-IT': { title: 'Comradia', body: 'La tua settimana è ancora aperta.' },
};

async function send(
  firestore: Firestore, uid: string, marker: string, alert?: VelocityKind,
): Promise<boolean> {
  const store = new FirestoreNotificationStore(firestore);
  const tokens = await store.listPushTokens(uid);
  if (tokens.length === 0 || !await store.claimReportAlert(marker, uid)) return false;
  const responses = await Promise.allSettled(tokens.map(async (entry) => {
    try {
      await getMessaging().send({
        token: entry.token,
        notification: alert ? { title: 'Cravos', body: velocityAlertBody(alert) } : copy[entry.locale ?? 'en-US'] ?? copy['en-US'],
      });
      return true;
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
        ? error.code : undefined;
      if (isInvalidTokenError(code)) await store.deletePushToken(uid, entry.id);
      else logger.warn('Cravos push delivery failed after claim', { code });
      return false;
    }
  }));
  return responses.some((result) => result.status === 'fulfilled' && result.value);
}

export function sendStreakPush(firestore: Firestore, uid: string, week: string) {
  return send(firestore, uid, `gam:streak:${week}`);
}

export async function alertCravosVelocity(firestore: Firestore, uid: string, kind: VelocityKind, day: string) {
  const owners = new Set((process.env.REPORT_ALERT_UIDS ?? '').split(',').map((entry) => entry.trim()).filter(Boolean));
  for (const owner of owners) await send(firestore, owner, `gam:velocity:${kind}:${uid}:${day}`, kind);
}
