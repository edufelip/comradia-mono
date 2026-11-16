import { Redirect } from 'expo-router';

import { useSessionStore } from '@/features/auth/session-store';

/** `/` and every guard flip land here, then go to the screen for the session state. */
export default function Index() {
  const status = useSessionStore((s) => s.status);
  if (status === 'signedOut') return <Redirect href="/welcome" />;
  if (status === 'needsOnboarding') return <Redirect href="/vibe" />;
  return <Redirect href="/discover" />;
}
