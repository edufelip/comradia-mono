import { useEffect, useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { DsFontFamily, getDsTheme, type DsColorScheme } from '@/constants/design-system';

const RAY_ANGLES = Array.from({ length: 16 }, (_, index) => index * 22.5);

const TOPO_PATHS = [
  ['M125 165c0-32 20-40 40-38s38 12 40 38-16 42-40 40-40-12-40-40z', 0.5],
  ['M95 165c0-56 35-70 70-66.5s66.5 21 70 66.5-28 73.5-70 70-70-21-70-70z', 0.44],
  ['M65 165c0-80 50-100 100-95s95 30 100 95-40 105-100 100-100-30-100-100z', 0.38],
  ['M35 165c0-104 65-130 130-123.5s123.5 39 130 123.5-52 136.5-130 130-130-39-130-130z', 0.32],
  ['M5 165c0-128 80-160 160-152s152 48 160 152-64 168-160 160-160-48-160-160z', 0.26],
] as const;

const ROAD_PATHS = [
  'M-10 52C60 40 130 76 330 56',
  'M70 -10C80 46 100 92 92 140',
  'M184 -10C194 56 172 100 202 140',
  'M-10 108C80 98 200 116 330 104',
] as const;

const MAP_PINS = [
  { cx: 44, cy: 74 },
  { cx: 128, cy: 36 },
  { cx: 150, cy: 96 },
  { cx: 226, cy: 64 },
  { cx: 270, cy: 100 },
  { cx: 98, cy: 116 },
] as const;

const HEART_PATH =
  'M0 7s-8-5-8-10.5C-8-7-5-9-3-9c1.4 0 2.3.7 3 1.8.7-1.1 1.6-1.8 3-1.8 2 0 5 2 5 5.5C8 2 0 7 0 7z';

const THUMB_DRESS = 'M16 22c-6.6 0-12 4.3-12 10h24c0-5.7-5.4-10-12-10z';

const FACES = [
  { background: '#F5B08F', shirt: '#D92D3A', skin: '#8D5524' },
  { background: '#FCE8E9', shirt: '#231214', skin: '#E0AC69' },
  { background: '#FFD9C7', shirt: '#E05A47', skin: '#C68642' },
] as const;

export function SunBurst({ size = 280 }: { size?: number }) {
  // useId() emits colons, which break the url(#…) reference inside SVG.
  const gradientId = `sun-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const reduceMotion = useReducedMotion();
  const spin = useSharedValue(0);

  const raysStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  useEffect(() => {
    if (reduceMotion) {
      spin.value = 0;
      return;
    }

    spin.value = withRepeat(withTiming(360, { duration: 60000, easing: Easing.linear }), -1);
  }, [reduceMotion, spin]);

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.sunRoot, { height: size, width: size }]}
    >
      <Svg height="100%" viewBox="0 0 280 280" width="100%">
        <Defs>
          <RadialGradient cx="35%" cy="35%" id={gradientId} r="50%">
            <Stop offset="0" stopColor="#FFD9C7" />
            <Stop offset="1" stopColor="#E05A47" />
          </RadialGradient>
        </Defs>
        <Circle cx={140} cy={140} fill={`url(#${gradientId})`} r={78} />
      </Svg>
      <Animated.View style={[styles.rays, raysStyle]}>
        <Svg height="100%" viewBox="0 0 280 280" width="100%">
          {RAY_ANGLES.map((angle) => (
            <Rect
              fill="#E05A47"
              height={34}
              key={angle}
              opacity={0.45}
              rx={4}
              transform={`rotate(${angle} 140 140)`}
              width={8}
              x={136}
              y={6}
            />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
}

export function TopoRings({ scheme, size = 330 }: { scheme: DsColorScheme; size?: number }) {
  const { color } = getDsTheme(scheme);

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.topoRoot, { height: size, width: size }]}
    >
      <Svg
        fill="none"
        height="100%"
        stroke={color.accentPrimary}
        strokeWidth={1.2}
        viewBox="0 0 330 330"
        width="100%"
      >
        {TOPO_PATHS.map(([d, opacity]) => (
          <Path d={d} key={d} opacity={opacity} />
        ))}
      </Svg>
    </View>
  );
}

export function DateMapCard({
  scheme,
  caption,
  places,
}: {
  scheme: DsColorScheme;
  caption: string;
  places: string;
}) {
  const { color } = getDsTheme(scheme);

  return (
    <View style={[styles.card, { backgroundColor: color.surface, shadowColor: color.textPrimary }]}>
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={styles.mapFrame}
      >
        <Svg height="100%" viewBox="0 0 320 130" width="100%">
          <Rect fill={color.accentPrimarySoft} height={130} width={320} />
          <Ellipse cx={240} cy={92} fill={color.canvas} rx={62} ry={30} />
          <Ellipse cx={58} cy={24} fill={color.canvas} rx={44} ry={20} />
          <G fill="none" stroke={color.surface} strokeLinecap="round" strokeWidth={9}>
            {ROAD_PATHS.map((d) => (
              <Path d={d} key={d} />
            ))}
          </G>
          {MAP_PINS.map((pin, index) => (
            <Circle
              cx={pin.cx}
              cy={pin.cy}
              fill={index % 2 === 0 ? color.accentPrimary : color.accentWarm}
              key={`${pin.cx}-${pin.cy}`}
              r={6}
              stroke={color.surface}
              strokeWidth={2.5}
            />
          ))}
          <G transform="translate(178 60)">
            <Circle fill={color.accentPrimary} opacity={0.15} r={16} />
            <Path d={HEART_PATH} fill={color.accentPrimary} />
          </G>
        </Svg>
      </View>
      <View style={styles.metaRow}>
        <Text style={[styles.caption, { color: color.textPrimary }]}>{caption}</Text>
        <Text style={[styles.places, { color: color.textSecondary }]}>{places}</Text>
      </View>
    </View>
  );
}

export function FaceStack({ scheme }: { scheme: DsColorScheme }) {
  const { color } = getDsTheme(scheme);

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.faces}
    >
      {FACES.map((face, index) => (
        <View
          key={face.background}
          style={[
            styles.face,
            {
              borderColor: color.canvas,
              marginLeft: index === 0 ? 0 : -9,
            },
          ]}
        >
          <Svg height="100%" viewBox="0 0 32 32" width="100%">
            <Circle cx={16} cy={16} fill={face.background} r={16} />
            <Path d={THUMB_DRESS} fill={face.shirt} />
            <Circle cx={16} cy={12.5} fill={face.skin} r={5.8} />
          </Svg>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sunRoot: {
    position: 'relative',
  },
  rays: {
    ...StyleSheet.absoluteFillObject,
  },
  topoRoot: {
    position: 'relative',
  },
  card: {
    borderRadius: 24,
    elevation: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  mapFrame: {
    aspectRatio: 320 / 130,
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
  },
  metaRow: {
    alignItems: 'center',
    columnGap: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 2,
    paddingBottom: 2,
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  caption: {
    fontFamily: DsFontFamily.medium,
    fontSize: 13,
    fontWeight: '500',
  },
  places: {
    flexShrink: 0,
    fontFamily: DsFontFamily.mono,
    fontSize: 9.5,
    letterSpacing: 0.8,
  },
  faces: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  face: {
    borderRadius: 999,
    borderWidth: 2.5,
    height: 32,
    overflow: 'hidden',
    width: 32,
  },
});
