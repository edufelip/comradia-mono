/**
 * Global setup for the component-test layer (jest-expo already mocks most
 * native modules; only the gaps that component tests actually hit are patched
 * here).
 */
import { INITIAL_SESSION, useSessionStore } from '@/features/auth/session-store';

import { fakeBackend } from './mocks/backend';
import { INITIAL_DISCOVERY, useDiscoveryStore } from '@/features/discovery/discovery-store';

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

// Firebase never loads in this layer; every screen talks to the in-memory fake.
jest.mock('@/services/backend', () => ({
  backend: require('./mocks/backend').fakeBackend.backend,
}));

// The bridge is exercised in this component lane, but its native SDK edge is not available
// in Jest. Keep event delivery controllable so routing and privacy behavior still run live.
jest.mock('@/features/notifications/notifications', () => {
  return require('./mocks/notifications').notificationMockApi;
});

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
  fakeBackend.reset();
  useSessionStore.setState(INITIAL_SESSION);
  useDiscoveryStore.setState(INITIAL_DISCOVERY);
  require('./mocks/notifications').notificationMockApi.resetPushEvents();
});
