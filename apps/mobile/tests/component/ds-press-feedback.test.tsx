import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { DsBackButton } from '@/components/ds/primitives/DsBackButton';
import { DsIconButton } from '@/components/ds/primitives/DsIconButton';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DS_MOTION } from '@/constants/motion';

describe('shared press feedback', () => {
  afterEach(() => jest.restoreAllMocks());

  it('releases normal press feedback and dispatches the action once', async () => {
    const withTiming = jest.spyOn(Reanimated, 'withTiming');
    const onPress = jest.fn();
    await render(<DsPillButton label="Continue" onPress={onPress} scheme="light" />);
    const button = screen.getByRole('button', { name: 'Continue' });

    await fireEvent(button, 'pressIn');
    await fireEvent.press(button);
    await fireEvent(button, 'pressOut');

    expect(withTiming.mock.calls.map(([target]) => target)).toEqual([1, 0]);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(button).toBeEnabled();
  });

  it('uses the fast shared timing scale for every core button press', async () => {
    const withTiming = jest.spyOn(Reanimated, 'withTiming');

    await render(
      <>
        <DsPillButton label="Continue" onPress={jest.fn()} scheme="light" />
        <DsIconButton accessibilityLabel="Close" icon="close" onPress={jest.fn()} scheme="light" />
        <DsBackButton accessibilityLabel="Go back" onPress={jest.fn()} scheme="light" />
      </>,
    );

    for (const name of ['Continue', 'Close', 'Go back']) {
      await fireEvent(screen.getByRole('button', { name }), 'pressIn');
    }

    expect(withTiming).toHaveBeenCalledTimes(3);
    for (const [target, config] of withTiming.mock.calls) {
      expect(target).toBe(1);
      expect(config?.duration).toBe(DS_MOTION.duration.fast);
      expect(config?.easing).toBeInstanceOf(Function);
    }
  });

  it('exposes selected pill state to assistive technology', async () => {
    await render(
      <DsPillButton label="Selected value" onPress={jest.fn()} scheme="light" selected />,
    );

    expect(
      screen.getByRole('button', { name: 'Selected value' }).props.accessibilityState,
    ).toMatchObject({
      selected: true,
    });
  });

  it('leaves selection semantics off ordinary action buttons', async () => {
    await render(<DsPillButton label="Continue" onPress={jest.fn()} scheme="light" />);

    expect(screen.getByRole('button', { name: 'Continue' }).props.accessibilityState).toMatchObject(
      { selected: undefined },
    );
  });

  it('exposes an explicitly unselected selectable pill', async () => {
    await render(
      <DsPillButton label="Not chosen" onPress={jest.fn()} scheme="light" selected={false} />,
    );

    expect(
      screen.getByRole('button', { name: 'Not chosen' }).props.accessibilityState,
    ).toMatchObject({ selected: false });
  });

  it('keeps a 44-point minimum touch target for the shared buttons', async () => {
    await render(
      <>
        <DsPillButton label="Continue" onPress={jest.fn()} scheme="light" />
        <DsIconButton accessibilityLabel="Close" icon="close" onPress={jest.fn()} scheme="light" />
        <DsBackButton accessibilityLabel="Go back" onPress={jest.fn()} scheme="light" />
      </>,
    );

    expect(screen.getByRole('button', { name: 'Continue' }).props.hitSlop).toBe(1);
    expect(screen.getByRole('button', { name: 'Close' }).props.hitSlop).toBe(1);
    expect(screen.getByRole('button', { name: 'Go back' }).props.hitSlop).toBe(4);
  });

  it('does not animate a press when reduced motion is enabled', async () => {
    const useReducedMotion = jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    const withTiming = jest.spyOn(Reanimated, 'withTiming');

    await render(<DsPillButton label="Continue" onPress={jest.fn()} scheme="light" />);

    await fireEvent(screen.getByRole('button', { name: 'Continue' }), 'pressIn');

    expect(useReducedMotion).toHaveBeenCalled();
    expect(withTiming).not.toHaveBeenCalled();
  });

  it('clears an in-flight press when the button becomes disabled before release', async () => {
    const cancelAnimation = jest.spyOn(Reanimated, 'cancelAnimation');
    const view = await render(<DsPillButton label="Continue" onPress={jest.fn()} scheme="light" />);
    const button = screen.getByRole('button', { name: 'Continue' });

    await fireEvent(button, 'pressIn');
    await view.rerender(
      <DsPillButton disabled label="Continue" onPress={jest.fn()} scheme="light" />,
    );
    await fireEvent(screen.getByRole('button', { name: 'Continue' }), 'pressOut');

    expect(cancelAnimation).toHaveBeenCalled();
  });

  it('clears an in-flight press when reduced motion becomes active', async () => {
    const useReducedMotion = jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(false);
    const cancelAnimation = jest.spyOn(Reanimated, 'cancelAnimation');
    const view = await render(<DsPillButton label="Continue" onPress={jest.fn()} scheme="light" />);

    await fireEvent(screen.getByRole('button', { name: 'Continue' }), 'pressIn');
    useReducedMotion.mockReturnValue(true);
    await view.rerender(<DsPillButton label="Continue" onPress={jest.fn()} scheme="light" />);

    expect(cancelAnimation).toHaveBeenCalled();
  });

  it('cancels press feedback when the button unmounts', async () => {
    const cancelAnimation = jest.spyOn(Reanimated, 'cancelAnimation');
    const view = await render(<DsPillButton label="Continue" onPress={jest.fn()} scheme="light" />);

    await act(async () => view.unmount());

    expect(cancelAnimation).toHaveBeenCalled();
  });
});
