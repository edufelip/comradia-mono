import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {
  DsIconSize,
  DsRadius,
  DsSpace,
  DsTypography,
  type DsColorScheme,
  getDsTheme,
} from '@/constants/design-system';
import { DS_MOTION } from '@/constants/motion';
import { DsCountUp } from './DsCountUp';
import { DsNotice, DS_NOTICE_MIN_VISIBLE_MS } from './DsNotice';

/** Cravos spec §2: ten petals leave the flower over 700 ms, 200 ms after the toast appears. */
const PETALS_MS = 700;
const PETAL_COUNT = 10;

/** Deterministic per-petal values, so a render never jumps around between frames. */
function randomFor(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

type PetalSpec = { angle: number; distance: number };

const PETALS: PetalSpec[] = Array.from({ length: PETAL_COUNT }, (_, index) => ({
  angle: ((index * 36 + randomFor(index, 1) * 14) * Math.PI) / 180,
  distance: 20 + randomFor(index, 2) * 16,
}));

type RewardPetalProps = {
  progress: { value: number };
  spec: PetalSpec;
  color: string;
  testID?: string;
};

function RewardPetal({ progress, spec, color, testID }: RewardPetalProps) {
  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateX: Math.cos(spec.angle) * spec.distance * progress.value },
      { translateY: Math.sin(spec.angle) * spec.distance * progress.value },
      { scale: 1 - 0.6 * progress.value },
    ],
  }));

  return (
    <Animated.View style={[styles.petal, { backgroundColor: color }, style]} testID={testID} />
  );
}

type DsRewardToastProps = {
  scheme: DsColorScheme;
  /** Cravos earned; the title counts up from 0 to it. */
  amount: number;
  /** Builds the visible title from the counting amount (already localized), e.g. `+30 Cravos`. */
  formatAmount: (amount: number) => string;
  /** Already-localized body, e.g. "Conversa iniciada com Maya". */
  body: string;
  /** Adds the close button; spoken name comes from `closeLabel` (required with it). */
  onClose?: () => void;
  closeLabel?: string;
  /** Auto-dismisses after 5 s (the `DsNotice` minimum); the caller then plays the exit. */
  onDismiss?: () => void;
  closing?: boolean;
  onExitComplete?: () => void;
  testID?: string;
};

/**
 * The floating "Cravos ganhos" toast over a chat or a list: a `DsNotice` overlay with the
 * flower glyph, a counting amount in the title, the body line, a close button on the title
 * line and ten petals leaving the flower. Place it where `ForegroundNotification` sits
 * (16 pt from the sides, 8 pt below the safe area). No actions, so it auto-dismisses.
 */
export function DsRewardToast({
  scheme,
  amount,
  formatAmount,
  body,
  onDismiss,
  closing = false,
  onExitComplete,
  onClose,
  closeLabel,
  testID,
}: DsRewardToastProps) {
  const ds = getDsTheme(scheme);
  const reduceMotion = useReducedMotion();
  const petalProgress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    petalProgress.value = withDelay(
      DS_MOTION.duration.standard,
      withTiming(1, {
        duration: PETALS_MS,
        easing: Easing.bezier(...DS_MOTION.easing.easeOut),
      }),
    );
    return () => cancelAnimation(petalProgress);
  }, [petalProgress, reduceMotion]);

  return (
    <View style={styles.wrap}>
      <DsNotice
        autoDismissMs={DS_NOTICE_MIN_VISIBLE_MS}
        body={body}
        closing={closing}
        closeLabel={closeLabel}
        icon="local-florist"
        onClose={onClose}
        onDismiss={onDismiss}
        onExitComplete={onExitComplete}
        overlay
        scheme={scheme}
        testID={testID}
        title={
          <DsCountUp format={formatAmount} textStyle={[DsTypography.cardTitle]} value={amount} />
        }
      />
      {reduceMotion ? null : (
        <View
          aria-hidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={styles.petals}
          testID={testID ? `${testID}-petals` : undefined}
        >
          {PETALS.map((spec, index) => (
            <RewardPetal
              color={index % 2 === 0 ? ds.color.accentPrimary : ds.color.accentWarm}
              key={index}
              progress={petalProgress}
              spec={spec}
              testID={testID ? `${testID}-petal` : undefined}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  // The flower's centre: card padding (lg 20) plus half the 24 pt glyph.
  petals: {
    left: DsSpace.lg + DsIconSize.lg / 2,
    position: 'absolute',
    top: DsSpace.lg + DsIconSize.lg / 2,
  },
  petal: {
    borderRadius: DsRadius.pill,
    height: 6,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 6,
  },
});
