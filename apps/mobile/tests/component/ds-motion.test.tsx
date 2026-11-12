import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import { DsMotionView } from '@/components/ds/motion/DsMotionView';

describe('DsMotionView', () => {
  afterEach(() => jest.restoreAllMocks());

  it('renders hidden-screen updates static and does not replay them on focus', async () => {
    const timing = jest.spyOn(Reanimated, 'withTiming');
    const view = await render(
      <DsMotionView active={false} testID="hidden-motion">
        <Text>Current setting</Text>
      </DsMotionView>,
    );
    expect(screen.getByTestId('hidden-motion')).toHaveStyle({ opacity: 1 });
    expect(timing).not.toHaveBeenCalled();
    await view.rerender(
      <DsMotionView active testID="hidden-motion">
        <Text>Current setting</Text>
      </DsMotionView>,
    );
    expect(timing).not.toHaveBeenCalled();
  });

  it('renders its children immediately and delays the requested entrance', async () => {
    const withDelay = jest.spyOn(Reanimated, 'withDelay');

    await render(
      <DsMotionView delay={80} testID="entrance" variant="slide">
        <Text>Welcome to Comradia</Text>
      </DsMotionView>,
    );

    expect(screen.getByText('Welcome to Comradia')).toBeOnTheScreen();
    expect(screen.getByTestId('entrance')).toBeOnTheScreen();
    expect(withDelay).toHaveBeenCalledWith(80, expect.anything());
  });

  it('keeps content visible and skips entrance timing when reduced motion is enabled', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    const withTiming = jest.spyOn(Reanimated, 'withTiming');

    await render(
      <DsMotionView testID="reduced" variant="reveal">
        <Text>Still available</Text>
      </DsMotionView>,
    );

    expect(screen.getByText('Still available')).toBeOnTheScreen();
    expect(screen.getByTestId('reduced')).toBeOnTheScreen();
    expect(withTiming).not.toHaveBeenCalled();
  });

  it('cancels an entrance when the wrapper unmounts', async () => {
    const cancelAnimation = jest.spyOn(Reanimated, 'cancelAnimation');
    const view = await render(
      <DsMotionView>
        <Text>Leaving now</Text>
      </DsMotionView>,
    );

    await act(async () => view.unmount());

    expect(cancelAnimation).toHaveBeenCalled();
  });
});
