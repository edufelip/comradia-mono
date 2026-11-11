import { isHiddenFromAccessibility, render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
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

    await render(<SunBurst />);

    expect(countOf('RNSVGRect')).toBe(16);
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
