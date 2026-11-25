import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Reanimated from 'react-native-reanimated';
import { DsConfetti } from '@/components/ds/primitives/DsConfetti';
import { DsCountUp } from '@/components/ds/primitives/DsCountUp';
import { DsMedal } from '@/components/ds/primitives/DsMedal';
import { DsProgressBar } from '@/components/ds/primitives/DsProgressBar';
import { DsProgressRing } from '@/components/ds/primitives/DsProgressRing';
import { DsRewardToast } from '@/components/ds/primitives/DsRewardToast';
import { DsAchievementTier, DsTypography, getDsTheme } from '@/constants/design-system';
import { DS_MOTION } from '@/constants/motion';
import { collectHostTypes } from './support/host-tree';

const light = getDsTheme('light');
const dark = getDsTheme('dark');

/** The medal and the ring are decorative art; their shapes stay out of the accessibility tree. */
const HIDDEN = { includeHiddenElements: true };

/** The vector-icons glyph map types its values as `number | string`; they are codepoints. */
const glyph = (name: keyof typeof MaterialIcons.glyphMap) =>
  String.fromCodePoint(Number(MaterialIcons.glyphMap[name]));

/** react-native-svg hands colors to its host shapes as processed ints (0xAARRGGBB). */
function processedColor(hex: string): number {
  return Number.parseInt(`ff${hex.slice(1)}`, 16);
}

function reducedMotion(on: boolean) {
  return jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(on);
}

describe('DsProgressBar', () => {
  it('is a named progressbar with min, max and now on a muted track', async () => {
    await render(
      <DsProgressBar
        accessibilityLabel="Progresso até Jardim"
        max={2500}
        scheme="light"
        testID="bar"
        value={1240}
      />,
    );

    const bar = screen.getByRole('progressbar', { name: 'Progresso até Jardim' });
    expect(bar).toHaveProp('accessibilityValue', { min: 0, max: 2500, now: 1240 });
    expect(bar).toHaveStyle({
      height: 8,
      borderRadius: 9999,
      backgroundColor: light.color.surfaceMuted,
    });
  });

  it('fills with the accent and eases the fill in over slow', async () => {
    const timing = jest.spyOn(Reanimated, 'withTiming');
    await render(
      <DsProgressBar accessibilityLabel="Level" max={100} scheme="dark" testID="bar" value={60} />,
    );

    expect(timing).toHaveBeenCalledWith(
      0.6,
      expect.objectContaining({ duration: DS_MOTION.duration.slow }),
    );
    expect(screen.getByTestId('bar-fill', HIDDEN)).toHaveStyle({
      backgroundColor: dark.color.accentPrimary,
    });
  });

  it('takes a color role for the fill', async () => {
    await render(
      <DsProgressBar
        accessibilityLabel="Level"
        fill="success"
        max={100}
        scheme="light"
        testID="bar"
        value={60}
      />,
    );

    expect(screen.getByTestId('bar-fill', HIDDEN)).toHaveStyle({
      backgroundColor: light.color.success,
    });
  });

  it('clamps the fill to the track', async () => {
    const timing = jest.spyOn(Reanimated, 'withTiming');
    const view = await render(
      <DsProgressBar
        accessibilityLabel="Level"
        max={100}
        scheme="light"
        testID="bar"
        value={3000}
      />,
    );

    expect(timing).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ duration: DS_MOTION.duration.slow }),
    );

    await view.rerender(
      <DsProgressBar
        accessibilityLabel="Level"
        max={100}
        scheme="light"
        testID="bar"
        value={-50}
      />,
    );

    expect(timing).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ duration: DS_MOTION.duration.slow }),
    );
  });

  it('shows the final width at once with reduced motion', async () => {
    reducedMotion(true);
    const timing = jest.spyOn(Reanimated, 'withTiming');
    await render(
      <DsProgressBar accessibilityLabel="Level" max={100} scheme="light" testID="bar" value={60} />,
    );

    expect(timing).not.toHaveBeenCalled();
    expect(screen.getByTestId('bar-fill', HIDDEN)).toHaveStyle({
      transform: [{ scaleX: 0.6 }],
    });
  });
});

describe('DsProgressRing', () => {
  it('draws a decorative 64 pt ring with a counter inside', async () => {
    await render(<DsProgressRing label="1/1" progress={0.75} scheme="light" testID="ring" />);

    expect(screen.getByTestId('ring', HIDDEN)).toHaveStyle({ width: 64, height: 64 });
    expect(screen.queryByTestId('ring')).toBeNull();
    expect(screen.getByText('1/1', HIDDEN)).toHaveStyle({ color: light.color.textPrimary });
    expect(collectHostTypes().filter((type) => type === 'RNSVGCircle')).toHaveLength(2);
    expect(screen.getByTestId('ring-track', HIDDEN).props.stroke).toMatchObject({
      payload: processedColor(light.color.surfaceMuted),
    });
    expect(screen.getByTestId('ring-arc', HIDDEN).props.stroke).toMatchObject({
      payload: processedColor(light.color.accentPrimary),
    });
    expect(screen.getByTestId('ring-arc', HIDDEN)).toHaveProp('strokeWidth', 6);
  });

  it('eases the arc in over slow from the week that just counted', async () => {
    const timing = jest.spyOn(Reanimated, 'withTiming');
    await render(<DsProgressRing progress={0.75} scheme="light" testID="ring" />);

    expect(timing).toHaveBeenCalledWith(
      0.75,
      expect.objectContaining({ duration: DS_MOTION.duration.slow }),
    );
  });

  it('shows the closed ring at once with reduced motion', async () => {
    reducedMotion(true);
    const timing = jest.spyOn(Reanimated, 'withTiming');
    // The shared-value mock applies no animation, so read what the arc's props factory computed.
    const animatedProps = jest.spyOn(Reanimated, 'useAnimatedProps');
    await render(<DsProgressRing progress={1} scheme="light" testID="ring" />);

    expect(timing).not.toHaveBeenCalled();
    expect(animatedProps).toHaveBeenCalledTimes(1);
    expect(animatedProps.mock.results[0]?.value).toEqual({ strokeDashoffset: 0 });
  });
});

describe('DsCountUp', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('counts from the previous value with locale grouping, landing on the final value', async () => {
    await render(
      <DsCountUp from={1210} locale="pt-BR" textStyle={DsTypography.figure} value={1240} />,
    );

    expect(screen.getByText('1.210')).toBeOnTheScreen();

    await act(async () => jest.advanceTimersByTime(DS_MOTION.duration.countUp + 100));

    expect(screen.getByText('1.240')).toBeOnTheScreen();
  });

  it('exposes only the final value to assistive tech', async () => {
    await render(
      <DsCountUp
        from={0}
        locale="pt-BR"
        testID="count"
        textStyle={DsTypography.figure}
        value={1240}
      />,
    );

    expect(screen.getByTestId('count')).toHaveProp('accessibilityLabel', '1.240');
  });

  it('renders the final value at once with reduced motion', async () => {
    reducedMotion(true);
    const frame = jest.spyOn(global, 'requestAnimationFrame');
    await render(<DsCountUp from={0} locale="pt-BR" textStyle={DsTypography.figure} value={30} />);

    expect(screen.getByText('30')).toBeOnTheScreen();
    expect(frame).not.toHaveBeenCalled();

    await act(async () => jest.advanceTimersByTime(1000));

    expect(screen.getByText('30')).toBeOnTheScreen();
  });

  it('formats every frame through a passed formatter', async () => {
    await render(
      <DsCountUp
        format={(amount) => `+${new Intl.NumberFormat('pt-BR').format(amount)} Cravos`}
        from={0}
        testID="count"
        textStyle={DsTypography.cardTitle}
        value={30}
      />,
    );

    expect(screen.getByText('+0 Cravos')).toBeOnTheScreen();

    await act(async () => jest.advanceTimersByTime(DS_MOTION.duration.countUp + 100));

    expect(screen.getByText('+30 Cravos')).toBeOnTheScreen();
    expect(screen.getByTestId('count')).toHaveProp('accessibilityLabel', '+30 Cravos');
  });

  it('keeps its digits tabular so the line does not jitter', async () => {
    await render(<DsCountUp locale="pt-BR" textStyle={DsTypography.figure} value={30} />);

    await act(async () => jest.advanceTimersByTime(DS_MOTION.duration.countUp + 100));

    expect(screen.getByText('30')).toHaveStyle({ fontVariant: ['tabular-nums'] });
  });
});

describe('DsMedal', () => {
  it('draws the bevelled rim, the tinted face and the centered glyph', async () => {
    await render(<DsMedal icon="forum" scheme="light" testID="medal" tier="gold" />);

    expect(screen.getByTestId('medal', HIDDEN)).toHaveStyle({ width: 64, height: 64 });
    expect(screen.queryByTestId('medal')).toBeNull();
    expect(collectHostTypes().filter((type) => type === 'RNSVGCircle')).toHaveLength(3);
    // The rim and the inner bevel carry the gradient brushes; the face is the tier tint.
    expect(screen.getByTestId('medal-rim', HIDDEN).props.fill).toMatchObject({
      type: 1,
      brushRef: expect.stringMatching(/^ds-medal-/),
    });
    expect(screen.getByTestId('medal-bevel', HIDDEN).props.fill).toMatchObject({
      type: 1,
      brushRef: expect.stringMatching(/^ds-medal-.*-bevel$/),
    });
    expect(screen.getByTestId('medal-face', HIDDEN).props.fill).toMatchObject({
      payload: processedColor(DsAchievementTier.gold.face.light),
    });
    expect(screen.getByTestId('medal-arc', HIDDEN)).toHaveProp('strokeOpacity', 0.5);

    const glyphText = screen.getByText(glyph('forum'), HIDDEN);
    expect(glyphText).toHaveStyle({ color: DsAchievementTier.gold.glyphInk.light });
  });

  it('tints the face and the glyph for the dark scheme', async () => {
    await render(<DsMedal icon="favorite" scheme="dark" testID="medal" tier="bronze" />);

    expect(screen.getByTestId('medal-face', HIDDEN).props.fill).toMatchObject({
      payload: processedColor(DsAchievementTier.bronze.face.dark),
    });
    expect(screen.getByTestId('medal-arc', HIDDEN)).toHaveProp('strokeOpacity', 0.12);
    expect(screen.getByText(glyph('favorite'), HIDDEN)).toHaveStyle({
      color: DsAchievementTier.bronze.glyphInk.dark,
    });
  });

  it('scales to the size its caller asks for', async () => {
    await render(
      <DsMedal icon="verified" scheme="light" size={120} testID="medal" tier="silver" />,
    );

    expect(screen.getByTestId('medal', HIDDEN)).toHaveStyle({ width: 120, height: 120 });
    expect(screen.getByText(glyph('verified'), HIDDEN)).toHaveStyle({
      fontSize: Math.round(120 * (52 / 132)),
    });
  });

  it('rests a locked medal at low opacity; the copy carries the state', async () => {
    await render(<DsMedal icon="forum" locked scheme="light" testID="medal" tier="bronze" />);

    expect(screen.getByTestId('medal', HIDDEN)).toHaveStyle({ opacity: 0.4 });
  });
});

describe('DsConfetti', () => {
  it('renders nothing with reduced motion', async () => {
    reducedMotion(true);
    await render(<DsConfetti scheme="light" testID="confetti" />);

    expect(screen.queryByTestId('confetti', HIDDEN)).toBeNull();
  });

  it('throws 40 pieces from the origin, never takes a touch and stays out of a11y', async () => {
    const timing = jest.spyOn(Reanimated, 'withTiming');
    await render(<DsConfetti origin={{ x: 0.5, y: 0.3 }} scheme="light" testID="confetti" />);

    expect(timing).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ duration: DS_MOTION.duration.celebrate }),
    );

    const layer = screen.getByTestId('confetti', HIDDEN);
    expect(layer).toHaveProp('pointerEvents', 'none');

    await fireEvent(layer, 'layout', {
      nativeEvent: { layout: { width: 390, height: 844, x: 0, y: 0 } },
    });

    const pieces = screen.getAllByTestId('confetti-piece', HIDDEN);
    expect(pieces).toHaveLength(40);

    // Only the celebration palette: accent, warm, tier, success, cyan.
    const backgrounds = pieces.map((piece) => piece.props.style.backgroundColor);
    expect(backgrounds).toContain(light.color.accentPrimary);
    expect(backgrounds).toContain(DsAchievementTier.gold.base);
    expect(backgrounds).toContain(light.color.success);
    expect(backgrounds).toContain(light.color.accentCyan);
    expect(backgrounds).toContain(light.color.accentWarm);
  });

  it('lays its pieces out once it knows the container size', async () => {
    await render(<DsConfetti scheme="dark" testID="confetti" />);

    expect(screen.queryAllByTestId('confetti-piece', HIDDEN)).toHaveLength(0);

    await fireEvent(screen.getByTestId('confetti', HIDDEN), 'layout', {
      nativeEvent: { layout: { width: 390, height: 844, x: 0, y: 0 } },
    });

    expect(screen.getAllByTestId('confetti-piece', HIDDEN)).toHaveLength(40);
    expect(screen.getAllByTestId('confetti-piece', HIDDEN)[0].props.style.backgroundColor).toBe(
      dark.color.accentPrimary,
    );
  });
});

describe('DsRewardToast', () => {
  it('shows the flower notice with a counting title and the body', async () => {
    jest.useFakeTimers();
    await render(
      <DsRewardToast
        amount={30}
        body="Conversa iniciada com Maya"
        formatAmount={(n) => `+${n} Cravos`}
        scheme="light"
        testID="toast"
      />,
    );

    expect(screen.getByTestId('toast-icon', HIDDEN)).toHaveTextContent(glyph('local-florist'));
    expect(screen.getByText('+0 Cravos')).toBeOnTheScreen();
    expect(screen.getByText('Conversa iniciada com Maya')).toBeOnTheScreen();

    await act(async () => jest.advanceTimersByTime(DS_MOTION.duration.countUp + 100));

    expect(screen.getByText('+30 Cravos')).toBeOnTheScreen();
    jest.useRealTimers();
  });

  it('bursts ten petals from the flower unless reduced motion is on', async () => {
    const view = await render(
      <DsRewardToast
        amount={30}
        body="Body"
        formatAmount={(n) => `+${n}`}
        scheme="light"
        testID="toast"
      />,
    );

    const petals = screen.getAllByTestId('toast-petal', HIDDEN);
    expect(petals).toHaveLength(10);
    expect(petals[0].props.style.backgroundColor).toBe(light.color.accentPrimary);
    expect(petals[1].props.style.backgroundColor).toBe(light.color.accentWarm);
    expect(screen.getByTestId('toast-petals', HIDDEN)).toHaveProp('pointerEvents', 'none');

    reducedMotion(true);
    await view.rerender(
      <DsRewardToast
        amount={30}
        body="Body"
        formatAmount={(n) => `+${n}`}
        scheme="light"
        testID="toast"
      />,
    );

    expect(screen.queryAllByTestId('toast-petal', HIDDEN)).toHaveLength(0);
  });

  it('carries the close button and auto-dismisses after 5 s', async () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    const onDismiss = jest.fn();
    await render(
      <DsRewardToast
        amount={30}
        body="Body"
        closeLabel="Fechar aviso"
        formatAmount={(n) => `+${n}`}
        onClose={onClose}
        onDismiss={onDismiss}
        scheme="light"
        testID="toast"
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Fechar aviso' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await act(async () => jest.advanceTimersByTime(60000));
    expect(onDismiss).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('auto-dismisses after 5 s so the caller can play the exit', async () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();
    await render(
      <DsRewardToast
        amount={30}
        body="Body"
        formatAmount={(n) => `+${n}`}
        onDismiss={onDismiss}
        scheme="light"
        testID="toast"
      />,
    );

    await act(async () => jest.advanceTimersByTime(4900));
    expect(onDismiss).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(200));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
