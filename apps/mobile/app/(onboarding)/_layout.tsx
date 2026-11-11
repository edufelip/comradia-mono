import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="vibe" />
      <Stack.Screen name="values" />
      <Stack.Screen name="starter" />
    </Stack>
  );
}
