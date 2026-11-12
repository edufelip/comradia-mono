import { Geist_400Regular, Geist_500Medium, Geist_700Bold } from '@expo-google-fonts/geist';
import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { getDsTheme } from '@/constants/design-system';
import { DS_MOTION } from '@/constants/motion';
import { SessionErrorView } from '@/features/auth/session-error-view';
import { useSessionStore } from '@/features/auth/session-store';
import { useSessionSync } from '@/features/auth/use-session-sync';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { LocaleProvider } from '@/localization/locale-context';
import { PushNotificationBridge } from '@/features/notifications/PushNotificationBridge';

export default function RootLayout() {
  return (
    <LocaleProvider>
      <RootLayoutContent />
    </LocaleProvider>
  );
}

function RootLayoutContent() {
  const reduceMotion = useReducedMotion();
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const ds = getDsTheme(scheme);
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_700Bold,
    GeistMono_500Medium,
  });
  const [fontLoadTimedOut, setFontLoadTimedOut] = useState(false);
  useSessionSync();
  const status = useSessionStore((s) => s.status);

  useEffect(() => {
    if (fontsLoaded || fontError) return;
    const timer = setTimeout(() => setFontLoadTimedOut(true), 4000);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);

  if ((!fontsLoaded && !fontError && !fontLoadTimedOut) || status === 'loading') {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: ds.color.canvas,
        }}
      >
        <ActivityIndicator color={ds.color.accentPrimary} testID="session-loading" />
      </View>
    );
  }

  const navTheme = {
    ...(scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(scheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      primary: ds.color.accentPrimary,
      background: ds.color.canvas,
      card: ds.color.surface,
      text: ds.color.textPrimary,
      border: ds.color.border,
      notification: ds.color.accentPrimary,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      {status === 'error' ? (
        <SessionErrorView />
      ) : (
        // Exactly one group is reachable per session state; flipping the state moves the
        // user to that group's first screen (docs/architecture.md, "Routing").
        <Stack
          screenOptions={{
            headerShown: false,
            animation: reduceMotion ? 'none' : 'slide_from_right',
            animationDuration: DS_MOTION.duration.standard,
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Protected guard={status === 'signedOut'}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
          <Stack.Protected guard={status === 'needsOnboarding'}>
            <Stack.Screen name="(onboarding)" />
          </Stack.Protected>
          <Stack.Protected guard={status === 'ready'}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="match/[id]"
              options={{
                presentation: 'modal',
                animation: reduceMotion ? 'none' : 'slide_from_bottom',
              }}
            />
            <Stack.Screen name="chat/[id]" />
            <Stack.Screen
              name="safety/[uid]"
              options={{
                presentation: 'modal',
                animation: reduceMotion ? 'none' : 'slide_from_bottom',
              }}
            />
          </Stack.Protected>
        </Stack>
      )}
      <PushNotificationBridge />
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
