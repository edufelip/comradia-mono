import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Dimensions, Text } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import { DsAvatar } from '@/components/ds/primitives/DsAvatar';
import { DsDivider } from '@/components/ds/primitives/DsDivider';
import { DsEmptyState } from '@/components/ds/primitives/DsEmptyState';
import { DsListRow } from '@/components/ds/primitives/DsListRow';
import { DsNotice } from '@/components/ds/primitives/DsNotice';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsSectionHeader } from '@/components/ds/primitives/DsSectionHeader';
import { DsSheet } from '@/components/ds/primitives/DsSheet';
import { getDsTheme } from '@/constants/design-system';

const light = getDsTheme('light');
const dark = getDsTheme('dark');

/** The portrait's image and initial are hidden from screen readers; the root carries the name. */
const HIDDEN = { includeHiddenElements: true };

describe('DsDivider', () => {
  it('is a hairline in the border color, hidden from assistive tech', async () => {
    await render(<DsDivider scheme="light" testID="line" />);

    expect(screen.getByTestId('line', HIDDEN)).toHaveStyle({
      height: 1,
      backgroundColor: light.color.border,
    });
    expect(screen.queryByTestId('line')).toBeNull();
  });

  it('uses the stronger border on a muted surface and can be inset', async () => {
    await render(<DsDivider inset={64} onMuted scheme="dark" testID="line" />);

    expect(screen.getByTestId('line', HIDDEN)).toHaveStyle({
      backgroundColor: dark.color.borderStrong,
      marginLeft: 64,
    });
  });
});

describe('DsSectionHeader', () => {
  it('renders the label as a header in the eyebrow style by default', async () => {
    await render(<DsSectionHeader label="Recent" scheme="light" />);

    const header = screen.getByRole('header', { name: 'Recent' });
    expect(header).toHaveStyle({ color: light.color.textTertiary, textTransform: 'uppercase' });
  });

  it('renders the screenTitle variant in the primary text color', async () => {
    await render(<DsSectionHeader label="Recent" scheme="dark" variant="screenTitle" />);

    expect(screen.getByRole('header', { name: 'Recent' })).toHaveStyle({
      color: dark.color.textPrimary,
    });
  });

  it('shows no action unless one is given', async () => {
    await render(<DsSectionHeader label="Recent" scheme="light" />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('offers a trailing action with a 44 pt target and an optional spoken name', async () => {
    const onPress = jest.fn();
    await render(
      <DsSectionHeader
        action={{
          label: 'See all',
          onPress,
          accessibilityLabel: 'See all recent matches',
          testID: 'see-all',
        }}
        label="Recent"
        scheme="light"
      />,
    );

    const action = screen.getByRole('button', { name: 'See all recent matches' });
    expect(action).toHaveStyle({ minHeight: 44, minWidth: 44 });
    expect(screen.getByText('See all')).toHaveStyle({ color: light.color.accentText });
    await fireEvent.press(screen.getByTestId('see-all'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('names the action after its label by default', async () => {
    await render(
      <DsSectionHeader
        action={{ label: 'See all', onPress: jest.fn() }}
        label="Recent"
        scheme="light"
      />,
    );

    expect(screen.getByRole('button')).toHaveAccessibleName('See all');
  });
});

describe('DsEmptyState', () => {
  it('shows a header, a body and one action that calls back', async () => {
    const onAction = jest.fn();
    await render(
      <DsEmptyState
        actionLabel="Go to Discover"
        actionTestID="empty-cta"
        body="Likes become matches here."
        onAction={onAction}
        scheme="light"
        testID="empty"
        title="No matches yet"
      />,
    );

    expect(screen.getByTestId('empty')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'No matches yet' })).toBeOnTheScreen();
    expect(screen.getByText('Likes become matches here.')).toHaveStyle({
      color: light.color.textSecondary,
    });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await fireEvent.press(screen.getByTestId('empty-cta'));

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('omits the action when there is nothing to do', async () => {
    await render(<DsEmptyState body="Nobody here." scheme="dark" title="Empty" />);

    expect(screen.getByRole('header', { name: 'Empty' })).toBeOnTheScreen();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('DsAvatar', () => {
  it('names the avatar with the localized label, as an image', async () => {
    await render(
      <DsAvatar accessibilityLabel="Photo of Rosa" name="Rosa" scheme="light" shape="circle" />,
    );

    expect(screen.getByRole('image', { name: 'Photo of Rosa' })).toBeOnTheScreen();
  });

  it('is hidden from assistive tech when no name is given', async () => {
    await render(<DsAvatar name="Rosa" scheme="light" shape="circle" testID="a" />);

    expect(screen.queryByTestId('a')).toBeNull();
    expect(screen.getByTestId('a', HIDDEN)).toBeOnTheScreen();
  });

  it('shows the capitalised initial in the accent text color when there is no image', async () => {
    await render(<DsAvatar name="rosa" scheme="dark" shape="circle" size={56} testID="a" />);

    expect(screen.getByText('R', HIDDEN)).toHaveStyle({ color: dark.color.accentText });
    expect(screen.getByTestId('a', HIDDEN)).toHaveStyle({
      backgroundColor: dark.color.accentPrimarySoft,
      width: 56,
      borderTopLeftRadius: 9999,
    });
  });

  it('shows the image and animates it in unless reduced motion is on', async () => {
    const view = await render(
      <DsAvatar imageUri="file:///me.jpg" name="Rosa" scheme="light" shape="circle" testID="a" />,
    );

    expect(screen.getByTestId('a-image', HIDDEN).props.source).toEqual([{ uri: 'file:///me.jpg' }]);
    expect(screen.getByTestId('a-image', HIDDEN).props.transition).toMatchObject({ duration: 150 });
    expect(screen.queryByText('R', HIDDEN)).toBeNull();

    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    await view.rerender(
      <DsAvatar imageUri="file:///me.jpg" name="Rosa" scheme="light" shape="circle" testID="a" />,
    );
    expect(screen.getByTestId('a-image', HIDDEN).props.transition).toMatchObject({ duration: 0 });
  });

  it('falls back to the initial when the image fails, fading in unless reduced motion is on', async () => {
    const timing = jest.spyOn(Reanimated, 'withTiming');
    await render(
      <DsAvatar imageUri="file:///me.jpg" name="Rosa" scheme="light" shape="circle" testID="a" />,
    );

    await fireEvent(screen.getByTestId('a-image', HIDDEN), 'error', { nativeEvent: {} });

    expect(screen.queryByTestId('a-image', HIDDEN)).toBeNull();
    expect(screen.getByText('R', HIDDEN)).toBeOnTheScreen();
    expect(timing).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 120 }));
  });

  it('shows the initial at once on failure with reduced motion', async () => {
    const timing = jest.spyOn(Reanimated, 'withTiming');
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    await render(
      <DsAvatar imageUri="file:///me.jpg" name="Rosa" scheme="light" shape="circle" testID="a" />,
    );

    await fireEvent(screen.getByTestId('a-image', HIDDEN), 'error', { nativeEvent: {} });

    expect(screen.getByText('R', HIDDEN)).toBeOnTheScreen();
    expect(timing).not.toHaveBeenCalled();
  });

  it('ignores an image error from a portrait that was replaced', async () => {
    const view = await render(
      <DsAvatar imageUri="file:///old.jpg" name="Rosa" scheme="light" shape="circle" testID="a" />,
    );
    const oldImage = screen.getByTestId('a-image', HIDDEN);
    await view.rerender(
      <DsAvatar imageUri="file:///new.jpg" name="Rosa" scheme="light" shape="circle" testID="a" />,
    );

    await fireEvent(oldImage, 'error', { nativeEvent: {} });

    expect(screen.getByTestId('a-image', HIDDEN).props.source).toEqual([
      { uri: 'file:///new.jpg' },
    ]);
  });

  it('shows neither image nor initial while loading, and reports busy', async () => {
    await render(
      <DsAvatar
        accessibilityLabel="Photo of Rosa"
        loading
        name="Rosa"
        scheme="light"
        shape="circle"
      />,
    );

    expect(screen.queryByText('R', HIDDEN)).toBeNull();
    expect(screen.getByRole('image', { name: 'Photo of Rosa' })).toBeBusy();
  });

  it('rounds the top of an arch to half its measured width', async () => {
    await render(<DsAvatar name="Rosa" scheme="light" shape="arch" testID="a" />);
    await fireEvent(screen.getByTestId('a', HIDDEN), 'layout', {
      nativeEvent: { layout: { width: 120, height: 160, x: 0, y: 0 } },
    });

    expect(screen.getByTestId('a', HIDDEN)).toHaveStyle({
      borderTopLeftRadius: 60,
      borderBottomLeftRadius: 16,
    });
  });

  it('draws a presence dot only when asked, bigger on large avatars', async () => {
    const view = await render(
      <DsAvatar name="Rosa" scheme="light" shape="circle" size={40} testID="a" />,
    );
    expect(screen.queryByTestId('a-presence', HIDDEN)).toBeNull();

    await view.rerender(
      <DsAvatar name="Rosa" presence scheme="light" shape="circle" size={40} testID="a" />,
    );
    expect(screen.getByTestId('a-presence', HIDDEN)).toHaveStyle({
      backgroundColor: light.color.success,
      width: 12,
    });

    await view.rerender(
      <DsAvatar name="Rosa" presence scheme="light" shape="circle" size={96} testID="a" />,
    );
    expect(screen.getByTestId('a-presence', HIDDEN)).toHaveStyle({ width: 16 });
  });
});

describe('DsListRow', () => {
  it('is one button named after its title and subtitle', async () => {
    const onPress = jest.fn();
    await render(
      <DsListRow onPress={onPress} scheme="light" subtitle="Say hi" testID="row" title="Maya" />,
    );

    const row = screen.getByRole('button', { name: 'Maya, Say hi' });
    expect(row).toHaveStyle({ minHeight: 64 });
    await fireEvent.press(screen.getByTestId('row'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('row-title')).toHaveStyle({ color: light.color.textPrimary });
    expect(screen.getByTestId('row-subtitle')).toHaveStyle({ color: light.color.textSecondary });
  });

  it('speaks and shows unread state', async () => {
    await render(
      <DsListRow
        onPress={jest.fn()}
        scheme="light"
        subtitle="New message"
        testID="row"
        title="Maya"
        unread
        unreadLabel="Unread"
      />,
    );

    expect(screen.getByRole('button')).toHaveAccessibleName('Unread, Maya, New message');
    expect(screen.getByTestId('row-unread', HIDDEN)).toHaveStyle({
      backgroundColor: light.color.accentPrimary,
    });
  });

  it('has no unread dot when read', async () => {
    await render(<DsListRow onPress={jest.fn()} scheme="light" testID="row" title="Maya" />);

    expect(screen.queryByTestId('row-unread', HIDDEN)).toBeNull();
    expect(screen.queryByTestId('row-subtitle')).toBeNull();
  });

  it('lets an explicit accessibilityLabel replace the combined name', async () => {
    await render(
      <DsListRow
        accessibilityLabel="Open chat with Maya"
        onPress={jest.fn()}
        scheme="light"
        title="Maya"
      />,
    );

    expect(screen.getByRole('button')).toHaveAccessibleName('Open chat with Maya');
  });

  it('is disabled and does not call back', async () => {
    const onPress = jest.fn();
    await render(<DsListRow disabled onPress={onPress} scheme="light" testID="row" title="Maya" />);

    expect(screen.getByRole('button')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('row'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders leading, trailing meta and a chevron', async () => {
    await render(
      <DsListRow
        chevron
        leading={<Text>lead</Text>}
        onPress={jest.fn()}
        scheme="dark"
        title="Maya"
        trailing={<Text>9:41</Text>}
      />,
    );

    expect(screen.getByText('lead')).toBeOnTheScreen();
    expect(screen.getByText('9:41')).toBeOnTheScreen();
  });

  it('insets its divider to the text, after the leading visual', async () => {
    await render(
      <DsListRow
        divider
        leading={<Text testID="lead">lead</Text>}
        onPress={jest.fn()}
        scheme="light"
        testID="row"
        title="Maya"
      />,
    );
    await fireEvent(screen.getByTestId('lead').parent!, 'layout', {
      nativeEvent: { layout: { width: 40, height: 40, x: 0, y: 0 } },
    });

    // md padding + 40 pt visual + sm gap
    expect(screen.getByTestId('row-divider', HIDDEN)).toHaveStyle({ marginLeft: 68 });
  });

  it('draws a divider without a leading visual flush with the padding', async () => {
    await render(
      <DsListRow divider onPress={jest.fn()} scheme="light" testID="row" title="Maya" />,
    );

    expect(screen.getByTestId('row-divider', HIDDEN)).toHaveStyle({ marginLeft: 16 });
  });

  it('has no divider unless asked', async () => {
    await render(<DsListRow onPress={jest.fn()} scheme="light" testID="row" title="Maya" />);

    expect(screen.queryByTestId('row-divider', HIDDEN)).toBeNull();
  });
});

describe('DsNotice', () => {
  it('shows an icon, a title and an optional body', async () => {
    await render(
      <DsNotice body="Check your inbox." scheme="light" testID="n" title="Saved" tone="success" />,
    );

    expect(screen.getByTestId('n-tint', HIDDEN)).toHaveStyle({
      backgroundColor: light.color.successSoft,
    });
    expect(screen.getByTestId('n-motion')).toBeOnTheScreen();
    expect(screen.getByText('Saved')).toHaveStyle({ color: light.color.textPrimary });
    expect(screen.getByText('Check your inbox.')).toHaveStyle({ color: light.color.textPrimary });
    expect(screen.getByTestId('n-icon', HIDDEN)).toBeOnTheScreen();
  });

  it.each([
    ['info', 'accentPrimarySoft'],
    ['success', 'successSoft'],
    ['warning', 'warningSoft'],
    ['danger', 'dangerSoft'],
  ] as const)('tints the %s tone with its soft color', async (tone, token) => {
    await render(<DsNotice scheme="dark" testID="n" title="Hello" tone={tone} />);

    expect(screen.getByTestId('n-tint', HIDDEN)).toHaveStyle({
      backgroundColor: dark.color[token],
    });
  });

  it('keeps an opaque surface under the translucent tint so an overlay hides the screen behind', async () => {
    await render(<DsNotice overlay scheme="dark" testID="n" title="Hello" />);

    expect(screen.getByTestId('n')).toHaveStyle({ backgroundColor: dark.color.surface });
  });

  it('defaults to a polite status and can be urgent', async () => {
    const view = await render(<DsNotice scheme="light" title="FYI" />);
    expect(screen.getByRole('status')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();

    await view.rerender(<DsNotice scheme="light" title="Oops" tone="danger" urgency="alert" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Oops');
  });

  it('shows no body or actions unless given, and adds a shadow when overlaying', async () => {
    const view = await render(<DsNotice scheme="light" testID="n" title="FYI" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByTestId('n')).not.toHaveStyle({ elevation: 6 });

    await view.rerender(
      <DsNotice
        actions={<DsPillButton label="Undo" onPress={jest.fn()} scheme="light" size="sm" />}
        overlay
        scheme="light"
        testID="n"
        title="FYI"
      />,
    );
    expect(screen.getByRole('button', { name: 'Undo' })).toBeOnTheScreen();
    expect(screen.getByTestId('n')).toHaveStyle({ elevation: 6 });
  });

  it('plays its exit and reports completion', async () => {
    const onExitComplete = jest.fn();
    const view = await render(
      <DsNotice onExitComplete={onExitComplete} scheme="light" title="FYI" />,
    );
    expect(onExitComplete).not.toHaveBeenCalled();

    await view.rerender(
      <DsNotice closing onExitComplete={onExitComplete} scheme="light" title="FYI" />,
    );

    expect(onExitComplete).toHaveBeenCalledTimes(1);
  });

  it('exits at once and hides from assistive tech with reduced motion', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    const timing = jest.spyOn(Reanimated, 'withTiming');
    const onExitComplete = jest.fn();
    await render(
      <DsNotice closing onExitComplete={onExitComplete} scheme="light" testID="n" title="FYI" />,
    );

    expect(onExitComplete).toHaveBeenCalledTimes(1);
    expect(timing).not.toHaveBeenCalled();
    expect(screen.queryByTestId('n')).toBeNull();
  });

  describe('auto-dismiss', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('dismisses by itself, never before 5 s', async () => {
      const onDismiss = jest.fn();
      await render(
        <DsNotice autoDismissMs={1000} onDismiss={onDismiss} scheme="light" title="FYI" />,
      );

      await act(async () => jest.advanceTimersByTime(4900));
      expect(onDismiss).not.toHaveBeenCalled();
      await act(async () => jest.advanceTimersByTime(200));

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('honours a longer stay', async () => {
      const onDismiss = jest.fn();
      await render(
        <DsNotice autoDismissMs={8000} onDismiss={onDismiss} scheme="light" title="FYI" />,
      );

      await act(async () => jest.advanceTimersByTime(7900));
      expect(onDismiss).not.toHaveBeenCalled();
      await act(async () => jest.advanceTimersByTime(200));

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('stays when it has an action', async () => {
      const onDismiss = jest.fn();
      await render(
        <DsNotice
          actions={<DsPillButton label="Undo" onPress={jest.fn()} scheme="light" />}
          autoDismissMs={5000}
          onDismiss={onDismiss}
          scheme="light"
          title="FYI"
        />,
      );

      await act(async () => jest.advanceTimersByTime(60000));

      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('does not dismiss while closing or when it is unmounted', async () => {
      const onDismiss = jest.fn();
      const view = await render(
        <DsNotice autoDismissMs={5000} closing onDismiss={onDismiss} scheme="light" title="FYI" />,
      );
      await act(async () => jest.advanceTimersByTime(6000));
      expect(onDismiss).not.toHaveBeenCalled();

      await view.rerender(
        <DsNotice autoDismissMs={5000} onDismiss={onDismiss} scheme="light" title="FYI" />,
      );
      await view.unmount();
      await act(async () => jest.advanceTimersByTime(6000));

      expect(onDismiss).not.toHaveBeenCalled();
    });
  });
});

describe('DsSheet', () => {
  const renderSheet = (props: Partial<React.ComponentProps<typeof DsSheet>> = {}) =>
    render(
      <DsSheet
        closeLabel="Done"
        onClose={jest.fn()}
        scheme="light"
        testID="sheet"
        title="Filters"
        visible
        {...props}
      >
        <Text>sheet content</Text>
      </DsSheet>,
    );

  afterEach(async () => {
    await act(async () =>
      Dimensions.set({ window: { width: 390, height: 844, scale: 2, fontScale: 1 } }),
    );
  });

  it('shows a modal dialog with a header title, content and a visible close button', async () => {
    await renderSheet();

    expect(screen.getByTestId('sheet')).toHaveProp('accessibilityViewIsModal', true);
    expect(screen.getByTestId('sheet')).toHaveProp('accessibilityLabel', 'Filters');
    expect(screen.getByRole('header', { name: 'Filters' })).toBeOnTheScreen();
    expect(screen.getByText('sheet content')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Done' })).toBeOnTheScreen();
    expect(screen.getByTestId('sheet')).toHaveStyle({
      backgroundColor: light.color.surfaceElevated,
      borderTopLeftRadius: 20,
    });
  });

  it('renders nothing while closed', async () => {
    await renderSheet({ visible: false });

    expect(screen.queryByTestId('sheet')).toBeNull();
    expect(screen.queryByText('sheet content')).toBeNull();
  });

  it('closes from the close button', async () => {
    const onClose = jest.fn();
    await renderSheet({ onClose });

    await fireEvent.press(screen.getByTestId('sheet-close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from a tap on the scrim', async () => {
    const onClose = jest.fn();
    await renderSheet({ onClose });

    await fireEvent.press(screen.getByTestId('sheet-scrim', HIDDEN));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from Android back and Escape (the modal request to close)', async () => {
    const onClose = jest.fn();
    await renderSheet({ onClose });

    let node = screen.getByTestId('sheet').parent;
    while (node && !node.props.onRequestClose) node = node.parent;
    expect(node).toBeTruthy();
    await act(async () => node!.props.onRequestClose());

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('pins an optional footer under the content', async () => {
    const view = await renderSheet();
    expect(screen.queryByTestId('sheet-footer')).toBeNull();

    await view.rerender(
      <DsSheet
        closeLabel="Done"
        footer={<DsPillButton label="Apply" onPress={jest.fn()} scheme="light" />}
        onClose={jest.fn()}
        scheme="light"
        testID="sheet"
        title="Filters"
        visible
      >
        <Text>sheet content</Text>
      </DsSheet>,
    );

    expect(screen.getByTestId('sheet-footer')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeOnTheScreen();
  });

  it('starts closed at progress 0 so the first open animates in', async () => {
    const sharedValue = jest.spyOn(Reanimated, 'useSharedValue');
    await renderSheet({ visible: false });

    expect(sharedValue).toHaveBeenCalledWith(0);
    expect(sharedValue).not.toHaveBeenCalledWith(1);
  });

  it('opens and closes as visible changes, animated or not', async () => {
    const view = await renderSheet({ visible: false });
    await view.rerender(
      <DsSheet
        closeLabel="Done"
        onClose={jest.fn()}
        scheme="light"
        testID="sheet"
        title="Filters"
        visible
      >
        <Text>sheet content</Text>
      </DsSheet>,
    );
    expect(screen.getByTestId('sheet')).toBeOnTheScreen();

    await view.rerender(
      <DsSheet
        closeLabel="Done"
        onClose={jest.fn()}
        scheme="light"
        testID="sheet"
        title="Filters"
        visible={false}
      >
        <Text>sheet content</Text>
      </DsSheet>,
    );

    expect(screen.queryByTestId('sheet')).toBeNull();
  });

  it('opens and closes without animation with reduced motion', async () => {
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    const timing = jest.spyOn(Reanimated, 'withTiming');
    const view = await renderSheet();
    expect(screen.getByTestId('sheet')).toBeOnTheScreen();

    await view.rerender(
      <DsSheet
        closeLabel="Done"
        onClose={jest.fn()}
        scheme="light"
        testID="sheet"
        title="Filters"
        visible={false}
      >
        <Text>sheet content</Text>
      </DsSheet>,
    );

    expect(screen.queryByTestId('sheet')).toBeNull();
    expect(timing).not.toHaveBeenCalled();
  });

  it('moves screen-reader focus to the title once it has opened', async () => {
    jest.useFakeTimers();
    jest.spyOn(require('react-native'), 'findNodeHandle').mockReturnValue(7);
    const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation();
    await renderSheet();

    await act(async () => jest.advanceTimersByTime(300));

    expect(focus).toHaveBeenCalledWith(7);
    jest.useRealTimers();
  });

  it('is a bottom sheet with a grab handle on a phone', async () => {
    await renderSheet();

    expect(screen.getByTestId('sheet-handle', HIDDEN)).toBeOnTheScreen();
    expect(screen.getByTestId('sheet')).not.toHaveStyle({ maxWidth: 560 });
  });

  it('is a centered dialog without a grab handle from 768 wide', async () => {
    Dimensions.set({ window: { width: 1024, height: 768, scale: 1, fontScale: 1 } });
    await renderSheet();

    expect(screen.queryByTestId('sheet-handle', HIDDEN)).toBeNull();
    expect(screen.getByTestId('sheet')).toHaveStyle({ maxWidth: 560, borderTopLeftRadius: 16 });
  });
});
