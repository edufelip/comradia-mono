import { isHiddenFromAccessibility, render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { DS_MOTION } from '@/constants/motion';
import { DateMapCard, FaceStack, SunBurst, TopoRings } from '@/features/welcome/welcome-art';
import { collectHostTypes, countHiddenHostChildren } from './support/host-tree';

function countOf(type: string) {
  return collectHostTypes().filter((hostType) => hostType === type).length;
}

describe('welcome artwork', () => {
  it('SunBurst draws the sun and its rays but stays out of the accessibility tree', async () => {
    await render(<SunBurst />);

    expect(countOf('RNSVGSvgView')).toBe(2);
    expect(countOf('RNSVGCircle')).toBe(1);
    expect(countOf('RNSVGRect')).toBe(16);
    expect(isHiddenFromAccessibility(screen.root)).toBe(true);
  });

  it('SunBurst stops rotating when reduced motion is on', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    const withTiming = jest.spyOn(Reanimated, 'withTiming');

    await render(<SunBurst />);

    expect(countOf('RNSVGRect')).toBe(16);
    expect(withTiming).not.toHaveBeenCalled();
  });

  it('SunBurst makes one shared-duration turn instead of looping offscreen', async () => {
    const withRepeat = jest.spyOn(Reanimated, 'withRepeat');
    const withTiming = jest.spyOn(Reanimated, 'withTiming');

    await render(<SunBurst />);

    expect(withRepeat).not.toHaveBeenCalled();
    expect(withTiming).toHaveBeenCalledTimes(1);
    const timingCall = withTiming.mock.calls[0];
    expect(timingCall?.[0]).toBe(360);
    expect(timingCall?.[1]?.duration).toBe(DS_MOTION.duration.slow * 8);
    expect(timingCall?.[1]?.easing).toBeInstanceOf(Function);
  });

  it('TopoRings draws five contour rings and stays hidden', async () => {
    await render(<TopoRings scheme="light" />);

    expect(countOf('RNSVGPath')).toBe(5);
    expect(isHiddenFromAccessibility(screen.root)).toBe(true);
  });

  it('FaceStack draws three faces and stays hidden', async () => {
    await render(<FaceStack scheme="dark" />);

    expect(countOf('RNSVGCircle')).toBe(6);
    expect(isHiddenFromAccessibility(screen.root)).toBe(true);
  });

  it('DateMapCard shows its caption and places above the decorative map', async () => {
    await render(
      <DateMapCard
        caption="214 first dates this week"
        places="PINHEIROS · VILA MADÁ"
        scheme="light"
      />,
    );

    expect(screen.getByText('214 first dates this week')).toBeOnTheScreen();
    expect(screen.getByText('PINHEIROS · VILA MADÁ')).toBeOnTheScreen();

    // Only the map drawing is hidden; the caption row stays readable.
    expect(countHiddenHostChildren()).toBe(1);
    expect(countOf('RNSVGPath')).toBeGreaterThan(0);
  });

  it('renders the map in dark scheme', async () => {
    await render(<DateMapCard caption="Tonight" places="CENTRO" scheme="dark" />);

    expect(screen.getByText('Tonight')).toBeOnTheScreen();
  });
});
