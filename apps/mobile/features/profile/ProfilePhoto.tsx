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
import { DsFontFamily, getDsTheme } from '@/constants/design-system';
import { useTranslation } from '@/localization';
import { usePhotoUrl } from './use-photo-url';

type Props = {
  /** `photoPath` from the profile, or a local file uri (onboarding preview); null shows the initial. */
  path: string | null;
  name: string;
  /** `arch` is the design's portrait frame (round top, soft bottom); `circle` is an avatar. */
  shape: 'arch' | 'circle';
  scheme: 'light' | 'dark';
  /** Sets width / height / aspectRatio. A circle also needs a width. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const LOCAL = /^(file|blob|data|content|ph|https?):/;

/**
 * A person's portrait, or their initial on a soft tint when there is none (or it fails to
 * load). The image itself carries `${testID}-image`.
 */
export function ProfilePhoto({ path, name, shape, scheme, style, testID }: Props) {
  const ds = getDsTheme(scheme);
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const isLocal = path !== null && LOCAL.test(path);
  const remote = usePhotoUrl(isLocal ? null : path);
  const uri = isLocal ? path : remote;
  const photoIdentity = JSON.stringify([path, uri, name]);
  const currentIdentity = useRef<string | null>(photoIdentity);
  const [width, setWidth] = useState(0);
  const [failedIdentity, setFailedIdentity] = useState<string | null>(null);
  const fallbackProgress = useSharedValue(1);
  const fallbackStyle = useAnimatedStyle(() => ({
    opacity: fallbackProgress.value,
    transform: [{ scale: 0.98 + fallbackProgress.value * 0.02 }],
  }));

  const top = shape === 'circle' ? 9999 : width / 2;
  const bottom = shape === 'circle' ? 9999 : 16;
  const showImage = uri !== null && failedIdentity !== photoIdentity;

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
      // Onboarding shows the photo before a name is typed.
      accessibilityLabel={name.trim() ? t('photo.of', { name }) : t('photo.mine')}
      accessibilityRole="image"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[
        styles.frame,
        {
          backgroundColor: ds.color.accentPrimarySoft,
          borderTopLeftRadius: top,
          borderTopRightRadius: top,
          borderBottomLeftRadius: bottom,
          borderBottomRightRadius: bottom,
        },
        shape === 'circle' && styles.circle,
        style,
      ]}
      testID={testID}
    >
      {showImage ? (
        // The root is the one named image; the inner <img> would be read again, unnamed.
        <View aria-hidden style={StyleSheet.absoluteFill}>
          <Image
            key={`${photoIdentity}:${uri}`}
            contentFit="cover"
            onError={() => {
              if (currentIdentity.current !== photoIdentity) return;
              setFailedIdentity(photoIdentity);
              if (reduceMotion) {
                fallbackProgress.value = 1;
              } else {
                fallbackProgress.value = 0;
                fallbackProgress.value = withTiming(1, {
                  duration: 120,
                  easing: Easing.out(Easing.cubic),
                });
              }
            }}
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            testID={testID ? `${testID}-image` : undefined}
            transition={reduceMotion ? 0 : 150}
          />
        </View>
      ) : (
        <Animated.View
          accessible={false}
          aria-hidden
          style={[styles.initialContainer, fallbackStyle]}
        >
          <Text
            aria-hidden
            style={[
              styles.initial,
              { color: ds.color.accentPrimary, fontSize: Math.max(14, width * 0.36) },
            ]}
          >
            {name.trim().charAt(0).toUpperCase()}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
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
  initial: {
    fontFamily: DsFontFamily.display,
    fontWeight: '700',
  },
});
