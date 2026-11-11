import { MaterialIcons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';

import { HapticTab } from '@/components/haptic-tab';
import { getDsTheme } from '@/constants/design-system';
import { useSessionStore } from '@/features/auth/session-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const ds = getDsTheme(scheme);
  const { t } = useTranslation();
  const signedIn = useSessionStore((s) => s.signedIn);

  if (!signedIn) {
    return <Redirect href="/welcome" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: ds.color.accentPrimary,
        tabBarInactiveTintColor: ds.color.textTertiary,
        tabBarStyle: {
          backgroundColor: ds.color.surface,
          borderTopColor: ds.color.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.discover'),
          tabBarIcon: ({ color }) => <MaterialIcons color={color} name="favorite" size={24} />,
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: t('tabs.matches'),
          tabBarIcon: ({ color }) => <MaterialIcons color={color} name="forum" size={24} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color }) => <MaterialIcons color={color} name="person" size={24} />,
        }}
      />
    </Tabs>
  );
}
