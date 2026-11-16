import { useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  DsRadius,
  DsSpace,
  DsTypography,
  getDsTheme,
  type DsColorScheme,
} from '@/constants/design-system';
import { DS_MOTION } from '@/constants/motion';
import { DsBackButton } from './DsBackButton';

type DsStepProgressProps = {
  scheme: DsColorScheme;
  /** 1-based step being shown; the segments before it are filled. */
  step: number;
  /** Number of segments. */
  total: number;
  /** Already localized, e.g. "Step 2 of 3". It is the spoken progress; the bar is decorative. */
  label: string;
  onBack?: () => void;
  /** Localized name of the back button; required with `onBack`. */
  backLabel?: string;
  /** Test id of the label; the filling segment is `${testID}-motion`. */
  testID?: string;
  backTestID?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A step counter with one segment per step and an optional back button. The label is a
 * prop so the primitive has no i18n dependency.
 */
export function DsStepProgress({
  scheme,
  step,
  total,
  label,
  onBack,
  backLabel,
  testID,
  backTestID,
  style,
}: DsStepProgressProps) {
  const ds = getDsTheme(scheme);
  return (
    <View style={[styles.row, style]}>
      {onBack ? (
        <DsBackButton
          accessibilityLabel={backLabel}
          onPress={onBack}
          scheme={scheme}
          testID={backTestID}
        />
      ) : null}

      <View style={styles.track}>
        <Text style={[DsTypography.eyebrow, { color: ds.color.textTertiary }]} testID={testID}>
          {label}
        </Text>
        <View aria-hidden style={styles.segments}>
          {Array.from({ length: total }, (_, index) => (
            <View
              key={index}
              style={[
                styles.segment,
                {
                  backgroundColor:
                    index < step - 1 ? ds.color.accentPrimary : ds.color.surfaceMuted,
                },
              ]}
            >
              {index === step - 1 ? (
                <ProgressFill
                  color={ds.color.accentPrimary}
                  testID={testID ? `${testID}-motion` : undefined}
                />
              ) : null}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function ProgressFill({ color, testID }: { color: string; testID?: string }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  useEffect(() => {
    progress.value = reduceMotion
      ? 1
      : withTiming(1, {
          duration: DS_MOTION.duration.standard,
          easing: Easing.bezier(...DS_MOTION.easing.easeOut),
        });
  }, [progress, reduceMotion]);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, { transformOrigin: 'left center' }, animatedStyle]}
      testID={testID}
    >
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: color }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: DsSpace.sm,
  },
  track: {
    flex: 1,
    gap: DsSpace.xs,
  },
  segments: {
    flexDirection: 'row',
    gap: DsSpace.xs,
  },
  segment: {
    borderRadius: DsRadius.pill,
    flex: 1,
    height: 4,
    overflow: 'hidden',
    position: 'relative',
  },
});
