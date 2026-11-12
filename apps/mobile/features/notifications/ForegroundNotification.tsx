import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { DsMotionView } from '@/components/ds/motion/DsMotionView';
import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsSpace, DsTypography, getDsTheme } from '@/constants/design-system';
import { DS_MOTION } from '@/constants/motion';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';

type ForegroundNotificationProps = {
  type: 'match' | 'message';
  onView: () => void;
  onDismiss: () => void;
  closing?: boolean;
  noticeId?: number;
  onExitComplete?: (noticeId: number) => void;
};

/** Generic in-app notice for pushes received while Comradia is open. */
export function ForegroundNotification({
  type,
  onView,
  onDismiss,
  closing = false,
  noticeId = 0,
  onExitComplete,
}: ForegroundNotificationProps) {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const theme = getDsTheme(scheme);
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const exit = useSharedValue(1);
  const exitStyle = useAnimatedStyle(() => ({
    opacity: exit.value,
    transform: [{ translateY: -8 * (1 - exit.value) }],
  }));
  useEffect(() => {
    if (!closing) {
      exit.value = 1;
      return;
    }
    if (reduceMotion) {
      exit.value = 0;
      onExitComplete?.(noticeId);
      return;
    }
    exit.value = withTiming(
      0,
      {
        duration: DS_MOTION.duration.fast,
        easing: Easing.bezier(...DS_MOTION.easing.easeOut),
      },
      (finished) => {
        if (finished && onExitComplete) runOnJS(onExitComplete)(noticeId);
      },
    );
    return () => cancelAnimation(exit);
  }, [closing, exit, noticeId, onExitComplete, reduceMotion]);

  return (
    <Animated.View
      pointerEvents={closing ? 'none' : 'auto'}
      accessibilityElementsHidden={closing}
      importantForAccessibility={closing ? 'no-hide-descendants' : 'auto'}
      style={exitStyle}
    >
      <DsMotionView testID="notifications-foreground-motion" variant="reveal">
        <DsCard scheme={scheme} style={styles.card} testID="notifications-foreground">
          <Text
            accessibilityRole="alert"
            style={[DsTypography.cardTitle, { color: theme.color.textPrimary }]}
          >
            {t(
              type === 'match'
                ? 'notifications.foreground.match'
                : 'notifications.foreground.message',
            )}
          </Text>
          <View style={styles.actions}>
            <DsPillButton
              disabled={closing}
              label={t('notifications.view')}
              onPress={onView}
              scheme={scheme}
              size="sm"
              testID="notifications-foreground-view"
              variant="primary"
            />
            <DsPillButton
              disabled={closing}
              label={t('notifications.dismiss')}
              onPress={onDismiss}
              scheme={scheme}
              size="sm"
              testID="notifications-foreground-dismiss"
              variant="ghost"
            />
          </View>
        </DsCard>
      </DsMotionView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: DsSpace.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: DsSpace.xs,
  },
});
