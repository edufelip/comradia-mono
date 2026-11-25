import { MaterialIcons } from '@expo/vector-icons';
import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import {
  DsAchievementTier,
  type DsAchievementTierKey,
  type DsColorScheme,
} from '@/constants/design-system';

type IconName = keyof typeof MaterialIcons.glyphMap;

/** The medal drawing's coordinate space; all radii below are in these units. */
const VIEWBOX = 132;
/** The glyph the prototype centres on the face, as a share of the medal size. */
const GLYPH_SCALE = 52 / VIEWBOX;

type DsMedalProps = {
  scheme: DsColorScheme;
  tier: DsAchievementTierKey;
  /** MaterialIcons glyph drawn on the face; never text, per the conquistas spec. */
  icon: IconName;
  size?: number;
  /** Rests the medal at 40% opacity; the copy around it carries the state. */
  locked?: boolean;
  testID?: string;
};

/**
 * The bevelled achievement medal: a metal rim (light to dark across the diagonal), an inner
 * bevel, a tier-tinted face on the card surface, a highlight arc and the centered glyph.
 * Decorative art like the welcome illustrations: give the surrounding element the spoken name.
 */
export function DsMedal({ scheme, tier, icon, size = 64, locked = false, testID }: DsMedalProps) {
  const shades = DsAchievementTier[tier];
  // useId() emits colons, which break the url(#…) reference inside SVG.
  const rimId = `ds-medal-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const bevelId = `${rimId}-bevel`;

  return (
    <View
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.medal, { width: size, height: size }, locked ? styles.locked : null]}
      testID={testID}
    >
      <Svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
        <Defs>
          <LinearGradient id={rimId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={shades.rimLight} />
            <Stop offset="0.5" stopColor={shades.base} />
            <Stop offset="1" stopColor={shades.rimDark} />
          </LinearGradient>
          <LinearGradient id={bevelId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={shades.rimDark} />
            <Stop offset="1" stopColor={shades.rimLight} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={66}
          cy={66}
          fill={`url(#${rimId})`}
          r={62}
          testID={testID ? `${testID}-rim` : undefined}
        />
        <Circle
          cx={66}
          cy={66}
          fill={`url(#${bevelId})`}
          r={51}
          testID={testID ? `${testID}-bevel` : undefined}
        />
        <Circle
          cx={66}
          cy={66}
          fill={shades.face[scheme]}
          r={48}
          testID={testID ? `${testID}-face` : undefined}
        />
        <Path
          d="M30 44 A42 42 0 0 1 88 24"
          fill="none"
          stroke={shades.highlightArc}
          strokeLinecap="round"
          strokeOpacity={scheme === 'dark' ? 0.12 : 0.5}
          strokeWidth={3}
          testID={testID ? `${testID}-arc` : undefined}
        />
      </Svg>
      <View pointerEvents="none" style={styles.glyph}>
        <MaterialIcons
          color={shades.glyphInk[scheme]}
          name={icon}
          size={Math.round(size * GLYPH_SCALE)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  medal: {
    position: 'relative',
  },
  locked: {
    opacity: 0.4,
  },
  glyph: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
