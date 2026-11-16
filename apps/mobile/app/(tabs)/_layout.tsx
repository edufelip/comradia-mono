import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Easing } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { HapticTab } from '@/components/haptic-tab';
import { getDsTheme } from '@/constants/design-system';
import { DS_MOTION } from '@/constants/motion';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const ds = getDsTheme(scheme);
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  return (
    <Tabs
      screenOptions={{
        animation: reduceMotion ? 'none' : 'fade',
        transitionSpec: {
          animation: 'timing',
          config: {
            duration: reduceMotion ? 0 : DS_MOTION.duration.standard,
            easing: Easing.bezier(...DS_MOTION.easing.easeOut),
          },
        },
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
        name="discover"
        options={{
          title: t('tabs.discover'),
          tabBarIcon: ({ color }) => (
            <MaterialIcons
              aria-hidden
              color={color}
              name="favorite"
              size={24}
              testID="tab-icon-discover"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: t('tabs.matches'),
          tabBarIcon: ({ color }) => (
            <MaterialIcons
              aria-hidden
              color={color}
              name="forum"
              size={24}
              testID="tab-icon-matches"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color }) => (
            <MaterialIcons
              aria-hidden
              color={color}
              name="person"
              size={24}
              testID="tab-icon-profile"
            />
          ),
        }}
      />
    </Tabs>
  );
}
