import { Stack } from 'expo-router';
import { useReducedMotion } from 'react-native-reanimated';
import { DS_MOTION } from '@/constants/motion';

export default function OnboardingLayout() {
  const reduceMotion = useReducedMotion();

  return (
    <Stack
      screenOptions={{
        animation: reduceMotion ? 'none' : 'slide_from_right',
        animationDuration: DS_MOTION.duration.standard,
        headerShown: false,
      }}
    >
      <Stack.Screen name="vibe" />
      <Stack.Screen name="values" />
      <Stack.Screen name="starter" />
    </Stack>
  );
}
