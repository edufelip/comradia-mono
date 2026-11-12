import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import { MatchCelebration } from '@/features/matches/MatchCelebration';

function mockMotionInterpolation() {
  return jest
    .spyOn(Reanimated, 'interpolate')
    .mockImplementation((value, _inputRange, outputRange) =>
      value <= 0 ? outputRange[0]! : outputRange[outputRange.length - 1]!,
    );
}

describe('MatchCelebration', () => {
  afterEach(() => jest.restoreAllMocks());

  it('plays its finite portrait meet only for a focused match from a like action', async () => {
    const timing = jest.spyOn(Reanimated, 'withTiming');

    await render(
      <MatchCelebration
        active
        focused
        first={<Text>Ana</Text>}
        scheme="light"
        second={<Text>Maya</Text>}
        testID="match-celebration"
      />,
    );

    expect(screen.getByTestId('match-celebration')).toBeOnTheScreen();
    expect(screen.getByText('Ana')).toBeOnTheScreen();
    expect(screen.getByText('Maya')).toBeOnTheScreen();
    expect(timing).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 360 }));
  });

  it('keeps the static celebration when it is not focused', async () => {
    const timing = jest.spyOn(Reanimated, 'withTiming');

    await render(
      <MatchCelebration
        active
        focused={false}
        first={<Text>Ana</Text>}
        scheme="dark"
        second={<Text>Maya</Text>}
        testID="match-celebration"
      />,
    );

    expect(screen.getByTestId('match-celebration')).toBeOnTheScreen();
    expect(screen.getByText('Ana')).toBeOnTheScreen();
    expect(screen.getByText('Maya')).toBeOnTheScreen();
    expect(timing).not.toHaveBeenCalled();
  });

  it('stops on blur and does not replay the celebration on return', async () => {
    const timing = jest.spyOn(Reanimated, 'withTiming');
    const first = <Text>Ana</Text>;
    const second = <Text>Maya</Text>;
    const view = await render(
      <MatchCelebration
        active
        focused
        first={first}
        scheme="light"
        second={second}
        testID="match-celebration"
      />,
    );

    expect(timing).toHaveBeenCalledTimes(1);
    await view.rerender(
      <MatchCelebration
        active
        focused={false}
        first={first}
        scheme="light"
        second={second}
        testID="match-celebration"
      />,
    );
    await view.rerender(
      <MatchCelebration
        active
        focused
        first={first}
        scheme="light"
        second={second}
        testID="match-celebration"
      />,
    );

    expect(timing).toHaveBeenCalledTimes(1);
  });

  it('keeps the static celebration when reduced motion is enabled', async () => {
    const timing = jest.spyOn(Reanimated, 'withTiming');
    const interpolate = mockMotionInterpolation();
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);

    await render(
      <MatchCelebration
        active
        focused
        first={<Text>Ana</Text>}
        scheme="dark"
        second={<Text>Maya</Text>}
        testID="match-celebration"
      />,
    );

    expect(screen.getByTestId('match-celebration')).toBeOnTheScreen();
    expect(screen.getByText('Ana')).toBeOnTheScreen();
    expect(screen.getByText('Maya')).toBeOnTheScreen();
    expect(timing).not.toHaveBeenCalled();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('match-celebration-emblem', { includeHiddenElements: true }).props.style,
      ),
    ).toMatchObject({
      opacity: 1,
      transform: [{ translateY: 0 }, { scale: 1 }],
    });
    interpolate.mockRestore();
  });

  it('cancels its running motion when the screen unmounts', async () => {
    const cancel = jest.spyOn(Reanimated, 'cancelAnimation');
    const view = await render(
      <MatchCelebration
        active
        focused
        first={<Text>Ana</Text>}
        scheme="light"
        second={<Text>Maya</Text>}
        testID="match-celebration"
      />,
    );

    await view.unmount();

    expect(cancel).toHaveBeenCalled();
  });
});
