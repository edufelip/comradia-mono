import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  DsIconSize,
  DsRadius,
  DsShadow,
  DsSpace,
  DsTypography,
  type DsColorScheme,
  getDsTheme,
} from '@/constants/design-system';
import { DS_MOTION } from '@/constants/motion';
import { DsCard } from './DsCard';
import { DsMotionView } from '../motion/DsMotionView';

export type DsNoticeTone = 'info' | 'success' | 'warning' | 'danger';

type IconName = keyof typeof MaterialIcons.glyphMap;

const TONE_ICON: Record<DsNoticeTone, IconName> = {
  info: 'info-outline',
  success: 'check-circle-outline',
  warning: 'warning-amber',
  danger: 'error-outline',
};

/** A notice that carries an action stays until the person acts; this is the shortest stay. */
export const DS_NOTICE_MIN_VISIBLE_MS = 5000;

type DsNoticeProps = {
  scheme: DsColorScheme;
  tone?: DsNoticeTone;
  title: string;
  body?: string;
  /** Buttons (e.g. `DsPillButton size="sm"`), laid out in a row under the copy. */
  actions?: ReactNode;
  /** `alert` interrupts (errors, matches); `status` is polite. */
  urgency?: 'alert' | 'status';
  /** Adds the floating shadow for a notice laid over content. */
  overlay?: boolean;
  /** Plays the exit and blocks input. `onExitComplete` fires when it ends. */
  closing?: boolean;
  onExitComplete?: () => void;
  /**
   * Dismisses by itself after this many ms (never less than 5 s), but only when the notice has
   * no actions. Needs `onDismiss`.
   */
  autoDismissMs?: number;
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
  /** The card. The entrance wrapper is `${testID}-motion`. */
  testID?: string;
};

/**
 * Card with a tone icon, a title, optional body and actions. Enters with a short reveal and
 * leaves with a short fade; both are instant with Reduce Motion.
 */
export function DsNotice({
  scheme,
  tone = 'info',
  title,
  body,
  actions,
  urgency = 'status',
  overlay = false,
  closing = false,
  onExitComplete,
  autoDismissMs,
  onDismiss,
  style,
  testID,
}: DsNoticeProps) {
  const ds = getDsTheme(scheme);
  const reduceMotion = useReducedMotion();
  const exit = useSharedValue(1);
  const exitComplete = useRef(onExitComplete);
  exitComplete.current = onExitComplete;
  const completeExit = useCallback(() => exitComplete.current?.(), []);
  const exitStyle = useAnimatedStyle(() => ({
    opacity: exit.value,
    transform: [{ translateY: -DsSpace.xs * (1 - exit.value) }],
  }));
  const hasActions = actions !== undefined && actions !== null && actions !== false;

  useEffect(() => {
    if (!closing) {
      exit.value = 1;
      return;
    }
    if (reduceMotion) {
      exit.value = 0;
      exitComplete.current?.();
      return;
    }
    exit.value = withTiming(
      0,
      { duration: DS_MOTION.duration.fast, easing: Easing.bezier(...DS_MOTION.easing.easeOut) },
      (finished) => {
        if (finished) runOnJS(completeExit)();
      },
    );
    return () => cancelAnimation(exit);
  }, [closing, completeExit, exit, reduceMotion]);

  useEffect(() => {
    if (hasActions || closing || !autoDismissMs || !onDismiss) return;
    const timer = setTimeout(onDismiss, Math.max(autoDismissMs, DS_NOTICE_MIN_VISIBLE_MS));
    return () => clearTimeout(timer);
  }, [autoDismissMs, closing, hasActions, onDismiss]);

  const toneColor = {
    info: ds.color.accentText,
    success: ds.color.success,
    warning: ds.color.warning,
    danger: ds.color.danger,
  }[tone];
  const toneSoft = {
    info: ds.color.accentPrimarySoft,
    success: ds.color.successSoft,
    warning: ds.color.warningSoft,
    danger: ds.color.dangerSoft,
  }[tone];

  return (
    <Animated.View
      accessibilityElementsHidden={closing}
      importantForAccessibility={closing ? 'no-hide-descendants' : 'auto'}
      pointerEvents={closing ? 'none' : 'auto'}
      style={exitStyle}
    >
      <DsMotionView testID={testID ? `${testID}-motion` : undefined} variant="reveal">
        <DsCard
          scheme={scheme}
          style={[styles.card, overlay ? DsShadow.floating : null, style]}
          testID={testID}
        >
          {/* The soft tint is translucent in the dark theme, so it sits on the opaque surface of
              the card instead of replacing it; a floating notice must not show the screen behind. */}
          <View
            pointerEvents="none"
            style={[styles.tint, { backgroundColor: toneSoft }]}
            testID={testID ? `${testID}-tint` : undefined}
          />
          <MaterialIcons
            accessibilityElementsHidden
            aria-hidden
            color={toneColor}
            importantForAccessibility="no-hide-descendants"
            name={TONE_ICON[tone]}
            size={DsIconSize.lg}
            testID={testID ? `${testID}-icon` : undefined}
          />
          <View style={styles.content}>
            <Text
              role={urgency === 'alert' ? 'alert' : 'status'}
              style={[DsTypography.cardTitle, { color: ds.color.textPrimary }]}
              testID={testID ? `${testID}-title` : undefined}
            >
              {title}
            </Text>
            {body ? (
              <Text style={[DsTypography.body, { color: ds.color.textPrimary }]}>{body}</Text>
            ) : null}
            {hasActions ? <View style={styles.actions}>{actions}</View> : null}
          </View>
        </DsCard>
      </DsMotionView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tint: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: DsRadius.lg,
  },
  card: {
    flexDirection: 'row',
    gap: DsSpace.sm,
  },
  content: {
    flex: 1,
    gap: DsSpace.xs,
    minWidth: 0,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DsSpace.xs,
  },
});
