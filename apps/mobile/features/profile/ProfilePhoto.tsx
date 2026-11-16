import { type StyleProp, type ViewStyle } from 'react-native';
import { DsAvatar } from '@/components/ds/primitives/DsAvatar';
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
 * A person's portrait: resolves the stored photo path to a url, names it in the active
 * language and renders the shared `DsAvatar`. The image itself carries `${testID}-image`.
 */
export function ProfilePhoto({ path, name, shape, scheme, style, testID }: Props) {
  const { t } = useTranslation();
  const isLocal = path !== null && LOCAL.test(path);
  const remote = usePhotoUrl(isLocal ? null : path);
  const uri = isLocal ? path : remote;

  return (
    <DsAvatar
      // Onboarding shows the photo before a name is typed.
      accessibilityLabel={name.trim() ? t('photo.of', { name }) : t('photo.mine')}
      imageUri={uri}
      name={name}
      scheme={scheme}
      shape={shape}
      style={style}
      testID={testID}
    />
  );
}
