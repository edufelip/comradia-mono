import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { DsRadius, DsSpace, type DsColorScheme, getDsTheme } from '@/constants/design-system';
import { DsCard } from './DsCard';

type DsSkeletonCardProps = {
  scheme: DsColorScheme;
  /** Accessible loading label (e.g. t('a11y.loading.default')). */
  label: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Card-shaped loading placeholder: a title bar and two lines, pulsing unless reduced motion is on. */
export function DsSkeletonCard({ scheme, label, style, testID }: DsSkeletonCardProps) {
  const theme = getDsTheme(scheme);
  const opacity = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => active && setReduceMotion(enabled))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.5, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);

  const bar = [styles.bar, { backgroundColor: theme.color.surfaceMuted }];

  return (
    <DsCard scheme={scheme} style={style} testID={testID}>
      <View accessibilityLabel={label} accessibilityRole="progressbar" accessible>
        <Animated.View style={[styles.stack, { opacity }]}>
          <View style={[...bar, styles.title]} testID={testID ? `${testID}.title` : undefined} />
          <View style={[...bar, styles.line]} testID={testID ? `${testID}.line1` : undefined} />
          <View
            style={[...bar, styles.line, styles.lineShort]}
            testID={testID ? `${testID}.line2` : undefined}
          />
        </Animated.View>
      </View>
    </DsCard>
  );
}

const styles = StyleSheet.create({
  stack: { gap: DsSpace.sm },
  bar: { borderRadius: DsRadius.sm },
  title: { height: 20, width: '45%' },
  line: { height: 14, width: '100%' },
  lineShort: { width: '70%' },
});
