import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
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
  const isLocal = path !== null && LOCAL.test(path);
  const remote = usePhotoUrl(isLocal ? null : path);
  const uri = isLocal ? path : remote;
  const [width, setWidth] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);

  const top = shape === 'circle' ? 9999 : width / 2;
  const bottom = shape === 'circle' ? 9999 : 16;
  const showImage = uri !== null && failed !== uri;

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
            contentFit="cover"
            onError={() => setFailed(uri)}
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            testID={testID ? `${testID}-image` : undefined}
            transition={150}
          />
        </View>
      ) : (
        <Text
          aria-hidden
          style={[
            styles.initial,
            { color: ds.color.accentPrimary, fontSize: Math.max(14, width * 0.36) },
          ]}
        >
          {name.trim().charAt(0).toUpperCase()}
        </Text>
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
  circle: {
    aspectRatio: 1,
  },
  initial: {
    fontFamily: DsFontFamily.display,
    fontWeight: '700',
  },
});
