import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { manipulateAsync } from 'expo-image-manipulator';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { pickPhoto } from '@/features/profile/pick-photo';
import { PHOTO_MAX_SIDE } from '@/features/profile/profile-schema';
import { ProfilePhoto } from '@/features/profile/ProfilePhoto';
import { fakeBackend } from './mocks/backend';

/** The portrait's image and initial are hidden from screen readers; its root carries the name. */
const HIDDEN = { includeHiddenElements: true };

jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(async () => ({ uri: 'file:///tmp/out.jpg' })),
  SaveFormat: { JPEG: 'jpeg' },
}));

const launch = launchImageLibraryAsync as jest.Mock;
const manipulate = manipulateAsync as jest.Mock;

describe('pickPhoto', () => {
  beforeEach(() => {
    launch.mockReset();
    manipulate.mockClear();
  });

  it('returns null when the person cancels', async () => {
    launch.mockResolvedValue({ canceled: true, assets: null });
    await expect(pickPhoto()).resolves.toBeNull();
    expect(manipulate).not.toHaveBeenCalled();
  });

  it('crops to 3:4 and caps a tall photo at the max height', async () => {
    launch.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///in.heic', width: 3000, height: 4000 }],
    });
    await expect(pickPhoto()).resolves.toBe('file:///tmp/out.jpg');
    expect(launch).toHaveBeenCalledWith(
      expect.objectContaining({ allowsEditing: true, aspect: [3, 4] }),
    );
    expect(manipulate).toHaveBeenCalledWith(
      'file:///in.heic',
      [{ resize: { height: PHOTO_MAX_SIDE } }],
      { compress: 0.8, format: 'jpeg' },
    );
  });

  it('caps a wide photo by width and leaves a small one unscaled', async () => {
    launch.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'a', width: 4000, height: 3000 }],
    });
    await pickPhoto();
    expect(manipulate).toHaveBeenLastCalledWith(
      'a',
      [{ resize: { width: PHOTO_MAX_SIDE } }],
      expect.anything(),
    );

    launch.mockResolvedValue({ canceled: false, assets: [{ uri: 'b', width: 600, height: 800 }] });
    await pickPhoto();
    expect(manipulate).toHaveBeenLastCalledWith('b', [], expect.anything());
  });
});

describe('ProfilePhoto', () => {
  it('names the photo after the person, or "Your photo" before a name is typed', async () => {
    await render(<ProfilePhoto name="Rosa" path={null} scheme="light" shape="arch" testID="p" />);
    expect(screen.getByLabelText('Photo of Rosa')).toBeOnTheScreen();
    await render(<ProfilePhoto name="  " path={null} scheme="light" shape="arch" testID="p" />);
    expect(screen.getByLabelText('Your photo')).toBeOnTheScreen();
  });

  it('shows a local file directly, without asking the backend', async () => {
    await render(
      <ProfilePhoto name="Rosa" path="file:///tmp/me.jpg" scheme="light" shape="arch" testID="p" />,
    );
    expect(screen.getByTestId('p-image', HIDDEN).props.source).toEqual([
      { uri: 'file:///tmp/me.jpg' },
    ]);
    expect(fakeBackend.callsTo('photoUrl')).toHaveLength(0);
    expect(screen.getByLabelText('Photo of Rosa')).toBeOnTheScreen();
    expect(screen.getByTestId('p-image', HIDDEN).props.transition).toMatchObject({ duration: 150 });
  });

  it('shows photos without an image transition when reduced motion is enabled', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);

    await render(
      <ProfilePhoto name="Rosa" path="file:///tmp/me.jpg" scheme="light" shape="arch" testID="p" />,
    );

    expect(screen.getByTestId('p-image', HIDDEN).props.transition).toMatchObject({ duration: 0 });
  });

  it('ignores a delayed image error after the portrait has been replaced', async () => {
    const timing = jest.spyOn(Reanimated, 'withTiming');
    const view = await render(
      <ProfilePhoto name="Rosa" path="file:///tmp/old.jpg" scheme="light" shape="arch" testID="p" />,
    );
    const oldImage = screen.getByTestId('p-image', HIDDEN);

    await view.rerender(
      <ProfilePhoto
        name="Rita"
        path="file:///tmp/new.jpg"
        scheme="light"
        shape="arch"
        testID="p"
      />,
    );
    await fireEvent(oldImage, 'error', { nativeEvent: { error: 'late' } });

    expect(screen.getByTestId('p-image', HIDDEN).props.source).toEqual([
      { uri: 'file:///tmp/new.jpg' },
    ]);
    expect(timing).not.toHaveBeenCalled();
  });

  it('falls back to the initial when the image fails to load', async () => {
    const timing = jest.spyOn(Reanimated, 'withTiming');
    await render(
      <ProfilePhoto name="rosa" path="photos/u1/a.jpg" scheme="dark" shape="circle" testID="p" />,
    );
    await waitFor(() => expect(screen.getByTestId('p-image', HIDDEN)).toBeOnTheScreen());
    await fireEvent(screen.getByTestId('p-image', HIDDEN), 'error', {
      nativeEvent: { error: 'gone' },
    });
    expect(screen.queryByTestId('p-image', HIDDEN)).toBeNull();
    expect(screen.getByText('R', HIDDEN)).toBeOnTheScreen();
    expect(timing).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 120 }));
  });

  it('uses an instant placeholder when a failed image has reduced motion enabled', async () => {
    const timing = jest.spyOn(Reanimated, 'withTiming');
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    await render(
      <ProfilePhoto name="Rosa" path="file:///tmp/me.jpg" scheme="light" shape="arch" testID="p" />,
    );

    await fireEvent(screen.getByTestId('p-image', HIDDEN), 'error', {
      nativeEvent: { error: 'gone' },
    });

    expect(screen.getByText('R', HIDDEN)).toBeOnTheScreen();
    expect(timing).not.toHaveBeenCalled();
  });

  it('cancels a running fallback transition when the portrait unmounts', async () => {
    const cancel = jest.spyOn(Reanimated, 'cancelAnimation');
    const view = await render(
      <ProfilePhoto name="Rosa" path="file:///tmp/me.jpg" scheme="light" shape="arch" testID="p" />,
    );
    await fireEvent(screen.getByTestId('p-image', HIDDEN), 'error', {
      nativeEvent: { error: 'gone' },
    });

    await view.unmount();

    expect(cancel).toHaveBeenCalled();
  });

  it('rounds the top of an arch to half its measured width', async () => {
    await render(<ProfilePhoto name="Rosa" path={null} scheme="light" shape="arch" testID="p" />);
    await fireEvent(screen.getByTestId('p'), 'layout', {
      nativeEvent: { layout: { width: 120, height: 160, x: 0, y: 0 } },
    });
    expect(screen.getByTestId('p')).toHaveStyle({
      borderTopLeftRadius: 60,
      borderBottomLeftRadius: 16,
    });
  });
});
