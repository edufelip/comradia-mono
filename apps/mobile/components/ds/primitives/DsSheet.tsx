import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DsRadius,
  DsShadow,
  DsSpace,
  DsTypography,
  type DsColorScheme,
  getDsTheme,
} from '@/constants/design-system';
import { DS_MOTION } from '@/constants/motion';
import { DsIconButton } from './DsIconButton';
import { useDsKeyboardOverlap } from './useDsKeyboard';
import { useDsModalSheetLayout } from './useDsModalSheetLayout';

type DsSheetProps = {
  scheme: DsColorScheme;
  visible: boolean;
  /** Called by every way out: the close button, a scrim tap, Android back and Escape. */
  onClose: () => void;
  title: string;
  /** Localized name of the close button ("Close" or "Done"). */
  closeLabel: string;
  children: ReactNode;
  /** Pinned under the scrolling content, e.g. the primary `DsPillButton`. */
  footer?: ReactNode;
  testID?: string;
};

const ENTER_OFFSET = DsSpace.xxl;
const MAX_HEIGHT_RATIO = 0.9;
const GRAB_HANDLE_WIDTH = 40;
const GRAB_HANDLE_HEIGHT = DsSpace.xxs;

/**
 * A bottom sheet on phones and a centered dialog from 768 pt wide. Modal-based: the scrim
 * closes it, so do Android back, Escape on web and the visible close button. It enters in
 * 220 ms (instantly with Reduce Motion) and lifts above the software keyboard.
 *
 * Testing hooks: `${testID}` is the sheet, with `-scrim`, `-title`, `-close`, `-body` and
 * `-footer` inside.
 */
export function DsSheet({
  scheme,
  visible,
  onClose,
  title,
  closeLabel,
  children,
  footer,
  testID,
}: DsSheetProps) {
  const ds = getDsTheme(scheme);
  const reduceMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = useDsModalSheetLayout();
  const overlayRef = useRef<View>(null);
  const titleRef = useRef<Text>(null);
  const keyboardOverlap = useDsKeyboardOverlap(overlayRef, visible);
  const [mounted, setMounted] = useState(visible);
  const [closing, setClosing] = useState(false);
  const progress = useSharedValue(visible && !reduceMotion ? 0 : 1);

  const sheetMotion = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: ENTER_OFFSET * (1 - progress.value) }],
  }));
  const scrimMotion = useAnimatedStyle(() => ({ opacity: progress.value }));

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setClosing(false);
      if (reduceMotion) {
        progress.value = 1;
      } else {
        progress.value = withTiming(1, {
          duration: DS_MOTION.duration.standard,
          easing: Easing.bezier(...DS_MOTION.easing.easeOut),
        });
      }
      return () => cancelAnimation(progress);
    }
    if (!mounted) return undefined;
    if (reduceMotion) {
      progress.value = 0;
      setMounted(false);
      return undefined;
    }
    setClosing(true);
    progress.value = withTiming(
      0,
      { duration: DS_MOTION.duration.fast, easing: Easing.bezier(...DS_MOTION.easing.easeOut) },
      (finished) => {
        if (finished) runOnJS(setMounted)(false);
      },
    );
    return () => cancelAnimation(progress);
    // `mounted` is read once per close; reacting to it would restart the exit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, reduceMotion, visible]);

  // Move screen-reader focus to the title when the sheet opens.
  useEffect(() => {
    if (!visible || Platform.OS === 'web') return undefined;
    const timer = setTimeout(() => {
      const handle = findNodeHandle(titleRef.current);
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    }, DS_MOTION.duration.standard);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!mounted) return null;

  const maxHeight = Math.max(0, windowHeight * MAX_HEIGHT_RATIO - keyboardOverlap);

  return (
    <Modal animationType="none" onRequestClose={onClose} statusBarTranslucent transparent visible>
      <View
        ref={overlayRef}
        collapsable={false}
        pointerEvents={closing ? 'none' : 'auto'}
        style={[styles.overlay, layout.overlayStyle]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: ds.color.overlayNeutral },
            scrimMotion,
          ]}
        />
        <Pressable
          accessibilityElementsHidden
          aria-hidden
          focusable={false}
          importantForAccessibility="no-hide-descendants"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
          testID={testID ? `${testID}-scrim` : undefined}
        />
        <Animated.View
          accessibilityLabel={title}
          accessibilityViewIsModal
          aria-modal
          role="dialog"
          style={[
            styles.sheet,
            DsShadow.floating,
            {
              backgroundColor: ds.color.surfaceElevated,
              marginBottom: keyboardOverlap,
              maxHeight,
              paddingBottom: DsSpace.lg + (layout.isDesktop ? 0 : insets.bottom),
            },
            layout.contentStyle,
            sheetMotion,
          ]}
          testID={testID}
        >
          {layout.isDesktop ? null : (
            <View
              aria-hidden
              style={[styles.grabHandle, { backgroundColor: ds.color.borderStrong }]}
              testID={testID ? `${testID}-handle` : undefined}
            />
          )}
          <View style={styles.header}>
            <Text
              ref={titleRef}
              accessibilityRole="header"
              style={[styles.title, DsTypography.heading, { color: ds.color.textPrimary }]}
              testID={testID ? `${testID}-title` : undefined}
            >
              {title}
            </Text>
            <DsIconButton
              accessibilityLabel={closeLabel}
              icon="close"
              onPress={onClose}
              scheme={scheme}
              size={44}
              testID={testID ? `${testID}-close` : undefined}
            />
          </View>
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            style={styles.scroll}
            testID={testID ? `${testID}-body` : undefined}
          >
            {children}
          </ScrollView>
          {footer ? (
            <View style={styles.footer} testID={testID ? `${testID}-footer` : undefined}>
              {footer}
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: DsRadius.xxl,
    borderTopRightRadius: DsRadius.xxl,
    paddingHorizontal: DsSpace.lg,
    paddingTop: DsSpace.sm,
  },
  grabHandle: {
    alignSelf: 'center',
    borderRadius: DsRadius.pill,
    height: GRAB_HANDLE_HEIGHT,
    marginBottom: DsSpace.xs,
    width: GRAB_HANDLE_WIDTH,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: DsSpace.sm,
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  body: {
    gap: DsSpace.sm,
    paddingVertical: DsSpace.xs,
  },
  footer: {
    gap: DsSpace.xs,
    paddingTop: DsSpace.sm,
  },
});
