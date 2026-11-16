import { render, screen } from '@testing-library/react-native';
import { OnboardingChip } from '@/features/onboarding/components/OnboardingChip';

it('classifies a user selection before passive effects so its first visible frame is the entrance', async () => {
  // Hold the passive phase to inspect what can be painted before it runs.
  const react = jest.requireActual<typeof import('react')>('react');
  jest.spyOn(react, 'useEffect').mockImplementation(() => undefined);
  const props = {
    label: 'Cycling',
    scheme: 'light' as const,
    testID: 'prepaint',
    onPress: jest.fn(),
  };
  const view = await render(<OnboardingChip {...props} selected={false} />);
  await view.rerender(<OnboardingChip {...props} selected />);
  expect(screen.getByRole('checkbox', { name: 'Cycling' })).toBeChecked();
  expect(screen.getByTestId('prepaint-selected-motion')).toBeOnTheScreen();
});
