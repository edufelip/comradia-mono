import { Stack } from 'expo-router';
import { useReducedMotion } from 'react-native-reanimated';
import { DS_MOTION } from '@/constants/motion';

export default function AuthLayout() {
  const reduceMotion = useReducedMotion();

  return (
    <Stack
      screenOptions={{
        animation: reduceMotion ? 'none' : 'slide_from_right',
        animationDuration: DS_MOTION.duration.standard,
        headerShown: false,
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="register" />
      <Stack.Screen name="verify-phone" />
    </Stack>
  );
}
