import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export function createAdminClient() {
  const siteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
  if (Object.values(config).some((value) => typeof value !== 'string' || !value.trim()) ||
      typeof siteKey !== 'string' || !siteKey.trim()) throw new Error('Set Firebase and App Check values in .env.local.');
  const app = initializeApp(config);
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true });
  const auth = getAuth(app);
  const functions = getFunctions(app, 'southamerica-east1');
  return {
    auth,
    signIn: () => signInWithPopup(auth, new GoogleAuthProvider()),
    signOut: () => signOut(auth),
    async call<T>(name: string, input: Record<string, unknown> = {}): Promise<T> {
      return (await httpsCallable<Record<string, unknown>, T>(functions, name)(input)).data;
    },
  };
}

export type AdminClient = ReturnType<typeof createAdminClient>;
