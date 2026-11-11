/**
 * Global setup for the component-test layer (jest-expo already mocks most
 * native modules; only the gaps that component tests actually hit are patched
 * here).
 */
import { useSessionStore } from '@/features/auth/session-store';
import { INITIAL_COMRADES, useDiscoveryStore } from '@/features/discovery/discovery-store';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// expo-router/testing-library re-mocks reanimated through `react-native-reanimated/mock`,
// whose v4 build lacks `useReducedMotion` and cannot be loaded from node_modules here.
// Both entry points point at the local stand-in so routing utilities and the
// welcome artwork agree.
jest.mock('react-native-reanimated', () => require('./mocks/reanimated'));
jest.mock('react-native-reanimated/mock', () => require('./mocks/reanimated'));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// `renderRouter` switches to fake timers for its synchronous render hack; each
// test starts from real timers and pristine zustand stores so nothing leaks
// between suites.
beforeEach(() => {
  jest.useRealTimers();
  useSessionStore.setState({ signedIn: false });
  useDiscoveryStore.setState({ candidates: INITIAL_COMRADES, matches: [] });
});
