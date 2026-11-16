import { Image } from 'expo-image';
import { useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  DsBorder,
  DsRadius,
  DsSpace,
  DsTypography,
  type DsColorScheme,
  getDsTheme,
} from '@/constants/design-system';
import { DS_MOTION } from '@/constants/motion';

/** The sizes the design system uses. */
export type DsAvatarSize = 32 | 40 | 56 | 96;

type DsAvatarProps = {
  scheme: DsColorScheme;
  /** `arch` is the design's portrait frame (round top, soft bottom); `circle` is an avatar. */
  shape: 'arch' | 'circle';
  /** Person's name: its first letter is the fallback when there is no image. */
  name: string;
  /** A displayable image uri (https, file, ...); null shows the initial. */
  imageUri?: string | null;
  /** Localized name of the image. Without it the avatar is hidden from assistive tech. */
  accessibilityLabel?: string;
  /** One of the design system sizes. Sets the width; a circle is also as tall. */
  size?: DsAvatarSize;
  /** The image is still being fetched: no initial is shown and the avatar reports busy. */
  loading?: boolean;
  /** Shows an online dot. Say it in `accessibilityLabel` when it matters. */
  presence?: boolean;
  /** Overrides the frame: width, height or aspectRatio (a circle also needs a width). */
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * A person's portrait, or their initial on a soft tint when there is none (or it fails to
 * load). The image itself carries `${testID}-image`.
 */
export function DsAvatar({
  scheme,
  shape,
  name,
  imageUri = null,
  accessibilityLabel,
  size,
  loading = false,
  presence = false,
  style,
  testID,
}: DsAvatarProps) {
  const ds = getDsTheme(scheme);
  const reduceMotion = useReducedMotion();
  const photoIdentity = JSON.stringify([imageUri, name]);
  const currentIdentity = useRef<string | null>(photoIdentity);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [failedIdentity, setFailedIdentity] = useState<string | null>(null);
  const fallbackProgress = useSharedValue(1);
  const fallbackStyle = useAnimatedStyle(() => ({
    opacity: fallbackProgress.value,
    transform: [{ scale: 0.98 + fallbackProgress.value * 0.02 }],
  }));

  const width = size ?? measuredWidth;
  const top = shape === 'circle' ? DsRadius.pill : width / 2;
  const bottom = shape === 'circle' ? DsRadius.pill : DsRadius.lg;
  const radii = {
    borderTopLeftRadius: top,
    borderTopRightRadius: top,
    borderBottomLeftRadius: bottom,
    borderBottomRightRadius: bottom,
  };
  const showImage = imageUri !== null && failedIdentity !== photoIdentity;
  const initialSize = Math.max(14, width * 0.36);
  const named = Boolean(accessibilityLabel);

  useLayoutEffect(() => {
    currentIdentity.current = photoIdentity;
    cancelAnimation(fallbackProgress);
    fallbackProgress.value = 1;
    return () => {
      cancelAnimation(fallbackProgress);
      if (currentIdentity.current === photoIdentity) currentIdentity.current = null;
    };
  }, [fallbackProgress, photoIdentity]);

  return (
    <View
      accessibilityElementsHidden={!named}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={named ? 'image' : undefined}
      accessibilityState={loading ? { busy: true } : undefined}
      accessible={named}
      aria-hidden={named ? undefined : true}
      importantForAccessibility={named ? 'auto' : 'no-hide-descendants'}
      onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}
      style={[
        styles.frame,
        { backgroundColor: ds.color.accentPrimarySoft, ...radii },
        size ? { width: size } : null,
        shape === 'circle' && styles.circle,
        style,
      ]}
      testID={testID}
    >
      <View aria-hidden style={[StyleSheet.absoluteFill, styles.clip, radii]}>
        {showImage ? (
          <Image
            key={`${photoIdentity}:${imageUri}`}
            contentFit="cover"
            onError={() => {
              if (currentIdentity.current !== photoIdentity) return;
              setFailedIdentity(photoIdentity);
              if (reduceMotion) {
                fallbackProgress.value = 1;
              } else {
                fallbackProgress.value = 0;
                fallbackProgress.value = withTiming(1, {
                  duration: DS_MOTION.duration.fast,
                  easing: Easing.out(Easing.cubic),
                });
              }
            }}
            source={{ uri: imageUri }}
            style={StyleSheet.absoluteFill}
            testID={testID ? `${testID}-image` : undefined}
            transition={reduceMotion ? 0 : 150}
          />
        ) : loading ? null : (
          <Animated.View
            accessible={false}
            aria-hidden
            style={[styles.initialContainer, fallbackStyle]}
          >
            <Text
              aria-hidden
              style={[
                DsTypography.cardTitle,
                {
                  color: ds.color.accentText,
                  fontSize: initialSize,
                  lineHeight: initialSize * 1.25,
                },
              ]}
            >
              {name.trim().charAt(0).toUpperCase()}
            </Text>
          </Animated.View>
        )}
      </View>
      {presence ? (
        <View
          aria-hidden
          style={[
            styles.presence,
            {
              backgroundColor: ds.color.success,
              borderColor: ds.color.surface,
              height: width > 40 ? DsSpace.md : DsSpace.sm,
              width: width > 40 ? DsSpace.md : DsSpace.sm,
            },
          ]}
          testID={testID ? `${testID}-presence` : undefined}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  clip: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initialContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    aspectRatio: 1,
  },
  presence: {
    borderRadius: DsRadius.pill,
    borderWidth: DsBorder.strong,
    bottom: 0,
    position: 'absolute',
    right: 0,
  },
});
