import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';
import { DsBackButton } from '@/components/ds/primitives/DsBackButton';
import { DsBlobBackground } from '@/components/ds/primitives/DsBlobBackground';
import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsIconButton } from '@/components/ds/primitives/DsIconButton';
import { DsOfflineBanner } from '@/components/ds/primitives/DsOfflineBanner';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsScreen } from '@/components/ds/primitives/DsScreen';
import { DsSkeletonCard } from '@/components/ds/primitives/DsSkeletonCard';
import { collectHostTypes, countHostChildren } from './support/host-tree';

describe('DsPillButton', () => {
  it('calls onPress and exposes a labelled button role', async () => {
    const onPress = jest.fn();
    await render(<DsPillButton label="Reset Deck" onPress={onPress} scheme="light" />);

    const button = screen.getByRole('button');
    expect(button).toHaveAccessibleName('Reset Deck');
    expect(button).toBeEnabled();

    await fireEvent.press(button);

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', async () => {
    const onPress = jest.fn();
    await render(<DsPillButton disabled label="Reset Deck" onPress={onPress} scheme="light" />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();

    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows a spinner instead of the label while loading and blocks presses', async () => {
    const onPress = jest.fn();
    await render(
      <DsPillButton label="Reset Deck" loading onPress={onPress} scheme="light" testID="cta" />,
    );

    expect(collectHostTypes()).toContain('ActivityIndicator');
    expect(screen.queryByText('Reset Deck')).not.toBeOnTheScreen();
    expect(screen.getByTestId('cta')).toBeBusy();
    expect(screen.getByTestId('cta')).toBeDisabled();

    await fireEvent.press(screen.getByTestId('cta'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('keeps its accessible name while loading', async () => {
    await render(<DsPillButton label="Reset Deck" loading onPress={jest.fn()} scheme="light" />);

    expect(screen.getByRole('button')).toHaveAccessibleName('Reset Deck');
  });

  it('lets an explicit accessibilityLabel override the visible label', async () => {
    await render(
      <DsPillButton
        accessibilityLabel="Send solidarity to Maya"
        label="Like"
        onPress={jest.fn()}
        scheme="light"
      />,
    );

    expect(screen.getByRole('button')).toHaveAccessibleName('Send solidarity to Maya');
  });

  it('renders every variant and size', async () => {
    await render(
      <>
        <DsPillButton label="Primary" onPress={jest.fn()} scheme="light" variant="primary" />
        <DsPillButton label="Secondary" onPress={jest.fn()} scheme="light" variant="secondary" />
        <DsPillButton label="Outline" onPress={jest.fn()} scheme="light" variant="outline" />
        <DsPillButton label="Ghost" onPress={jest.fn()} scheme="light" variant="ghost" />
        <DsPillButton label="Extra small" onPress={jest.fn()} scheme="light" size="xs" />
        <DsPillButton label="Small" onPress={jest.fn()} scheme="light" size="sm" />
        <DsPillButton
          disabled
          label="Disabled ghost"
          onPress={jest.fn()}
          scheme="dark"
          variant="ghost"
        />
      </>,
    );

    expect(screen.getAllByRole('button')).toHaveLength(7);
    expect(screen.getByRole('button', { name: 'Ghost' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Disabled ghost' })).toBeDisabled();
  });
});

describe('DsCard', () => {
  it('renders its children in every variant', async () => {
    await render(
      <>
        <DsCard scheme="light">
          <Text>Default card</Text>
        </DsCard>
        <DsCard scheme="light" variant="warning">
          <Text>Warning card</Text>
        </DsCard>
        <DsCard scheme="dark" testID="muted-card" variant="muted">
          <Text>Muted card</Text>
        </DsCard>
      </>,
    );

    expect(screen.getByText('Default card')).toBeOnTheScreen();
    expect(screen.getByText('Warning card')).toBeOnTheScreen();
    expect(screen.getByTestId('muted-card')).toContainElement(screen.getByText('Muted card'));
  });
});

describe('DsScreen', () => {
  it('renders scrollable content', async () => {
    await render(
      <DsScreen scheme="light" testID="screen">
        <Text>Screen body</Text>
      </DsScreen>,
    );

    expect(screen.getByTestId('screen')).toBeOnTheScreen();
    expect(screen.getByText('Screen body')).toBeOnTheScreen();
  });

  it('renders keyboard-aware scrollable content', async () => {
    await render(
      <DsScreen keyboardAware scheme="light" testID="keyboard-screen">
        <Text>Form body</Text>
      </DsScreen>,
    );

    expect(screen.getByTestId('keyboard-screen')).toBeOnTheScreen();
    expect(screen.getByText('Form body')).toBeOnTheScreen();
  });

  it('renders fixed content with the decorative blobs', async () => {
    await render(
      <DsScreen scheme="dark" scrollable={false} testID="fixed-screen" withBlobs>
        <Text>Fixed body</Text>
      </DsScreen>,
    );

    expect(screen.getByTestId('fixed-screen')).toBeOnTheScreen();
    expect(screen.getByText('Fixed body')).toBeOnTheScreen();
  });
});

describe('DsIconButton', () => {
  it('calls onPress and is labelled for screen readers', async () => {
    const onPress = jest.fn();
    await render(
      <DsIconButton accessibilityLabel="Close" icon="close" onPress={onPress} scheme="light" />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('DsBackButton', () => {
  it('calls onPress', async () => {
    const onPress = jest.fn();
    await render(<DsBackButton accessibilityLabel="Go back" onPress={onPress} scheme="light" />);

    await fireEvent.press(screen.getByRole('button', { name: 'Go back' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('DsOfflineBanner', () => {
  it('renders the offline message', async () => {
    await render(<DsOfflineBanner scheme="light" text="You are offline" />);

    expect(screen.getByText('You are offline')).toBeOnTheScreen();
  });

  it('announces the offline message as an alert', async () => {
    await render(<DsOfflineBanner scheme="light" text="You are offline" />);

    expect(screen.getByRole('alert', { name: 'You are offline' })).toBeOnTheScreen();
  });
});

describe('DsSkeletonCard', () => {
  it('exposes a labelled progressbar placeholder', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

    await render(<DsSkeletonCard label="Loading matches" scheme="light" testID="skeleton" />);

    expect(screen.getByRole('progressbar')).toHaveAccessibleName('Loading matches');
    expect(screen.getByTestId('skeleton.title')).toBeOnTheScreen();
    expect(screen.getByTestId('skeleton.line1')).toBeOnTheScreen();
    expect(screen.getByTestId('skeleton.line2')).toBeOnTheScreen();

    await waitFor(() => expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalledTimes(1));
  });

  it('keeps rendering while it pulses when reduced motion is off', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);

    await render(<DsSkeletonCard label="Loading matches" scheme="dark" testID="pulsing" />);

    expect(screen.getByRole('progressbar')).toHaveAccessibleName('Loading matches');
    expect(screen.getByTestId('pulsing.title')).toBeOnTheScreen();
  });
});

describe('DsBlobBackground', () => {
  it('renders two decorative blobs', async () => {
    await render(<DsBlobBackground scheme="light" />);

    expect(countHostChildren()).toBe(2);
  });
});
