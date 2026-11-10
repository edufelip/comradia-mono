import Svg, { Path } from 'react-native-svg';
import type { ColorValue } from 'react-native';

// Line icons copied from the C ("Night training") mockup: 24-unit grid, 1.5 stroke.
const PATHS = {
  dashboard: [
    'M4 4h6.5v6.5H4z',
    'M13.5 4H20v6.5h-6.5z',
    'M4 13.5h6.5V20H4z',
    'M13.5 13.5H20V20h-6.5z',
  ],
  home: ['M4 11l8-6.5 8 6.5v8.5a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z'],
  students: [
    'M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    'M2.5 19.5c.7-3.2 3.2-4.8 6.5-4.8s5.8 1.6 6.5 4.8',
    'M16 4.8a3.5 3.5 0 0 1 0 6.4',
    'M18 14.9c1.8.6 3 2 3.5 4.6',
  ],
  nutrition: [
    'M3.5 11h17a8.5 8.5 0 0 1-17 0z',
    'M8 7.5c0-1.2.8-1.8.8-3',
    'M12 7.5c0-1.2.8-1.8.8-3',
    'M16 7.5c0-1.2.8-1.8.8-3',
  ],
  training: ['M9 4.5h6v3H9z', 'M15 6h2a1 1 0 0 1 1 1v13H6V7a1 1 0 0 1 1-1h2', 'M9 12h6', 'M9 16h4'],
  exercise: ['M6.5 7.5v9', 'M17.5 7.5v9', 'M3.5 10v4', 'M20.5 10v4', 'M6.5 12h11'],
  recipes: ['M5 4.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z', 'M5 17a3 3 0 0 1 3-3h10'],
  account: [
    'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5',
  ],
} as const;

export type TabIconName = keyof typeof PATHS;

export function TabIcon({
  name,
  color,
  size = 22,
}: {
  name: TabIconName;
  color: ColorValue;
  size?: number;
}) {
  return (
    <Svg
      fill="none"
      height={size}
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
      width={size}
    >
      {PATHS[name].map((d) => (
        <Path d={d} key={d} />
      ))}
    </Svg>
  );
}
