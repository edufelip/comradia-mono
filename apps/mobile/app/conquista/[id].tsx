import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { DsScreen } from '@/components/ds/primitives/DsScreen';
import { DsSpace } from '@/constants/design-system';
import { BadgeMoment } from '@/features/gamification/BadgeMoment';
import { useGamification } from '@/features/gamification/provider';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function CravosCelebrationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { uid, client, celebrations } = useGamification();
  const router = useRouter();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const event = celebrations.find((celebration) => celebration.id === id);
  if (uid === null || event === undefined) return <Redirect href="/matches" />;

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/matches');
    void client.markSeen(uid, event.id).catch(() => {});
  };
  return (
    <DsScreen
      scheme={scheme}
      scrollable={false}
      contentContainerStyle={{ padding: DsSpace.lg }}
      testID="gam-celebration"
    >
      <BadgeMoment scheme={scheme} celebration={event} close={close} />
    </DsScreen>
  );
}
