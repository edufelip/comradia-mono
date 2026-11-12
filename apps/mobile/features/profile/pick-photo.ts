import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { PHOTO_MAX_SIDE } from './profile-schema';

/**
 * Opens the system photo picker (no permission prompt: it runs out of process) and returns
 * a local JPEG cropped to 3:4 with its longest side at most PHOTO_MAX_SIDE, or null when
 * the person cancels. Web ignores the crop; `ProfilePhoto` covers whatever shape comes back.
 */
export async function pickPhoto(): Promise<string | null> {
  const result = await launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [3, 4],
    quality: 1,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;

  const longest = Math.max(asset.width, asset.height);
  const resize =
    longest > PHOTO_MAX_SIDE
      ? [
          {
            resize:
              asset.width >= asset.height ? { width: PHOTO_MAX_SIDE } : { height: PHOTO_MAX_SIDE },
          },
        ]
      : [];
  const jpeg = await manipulateAsync(asset.uri, resize, {
    compress: 0.8,
    format: SaveFormat.JPEG,
  });
  return jpeg.uri;
}
