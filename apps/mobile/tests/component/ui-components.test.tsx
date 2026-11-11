import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Text } from 'react-native';
import { HapticTab } from '@/components/haptic-tab';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandLockup } from '@/components/ui/brand-lockup';
import { Collapsible } from '@/components/ui/collapsible';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TabIcon } from '@/components/ui/tab-icon';
import { collectHostTypes } from './support/host-tree';

jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));

describe('BrandLockup', () => {
  it('renders the mark and wordmark', async () => {
    await render(<BrandLockup scheme="dark" />);

    expect(screen.getByLabelText('Comradia logo')).toBeOnTheScreen();
    expect(screen.getByText('Comradia')).toBeOnTheScreen();
  });
});

describe('Collapsible', () => {
  it('reveals its children only after the heading is pressed', async () => {
    await render(
      <Collapsible title="Why Comradia?">
        <Text>Because values matter.</Text>
      </Collapsible>,
    );

    expect(screen.getByText('Why Comradia?')).toBeOnTheScreen();
    expect(screen.queryByText('Because values matter.')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Why Comradia?'));

    expect(screen.getByText('Because values matter.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Why Comradia?'));

    expect(screen.queryByText('Because values matter.')).not.toBeOnTheScreen();
  });
});

describe('TabIcon', () => {
  it('draws one path per glyph segment', async () => {
    await render(<TabIcon color="#D92D3A" name="home" />);

    expect(collectHostTypes().filter((type) => type === 'RNSVGPath')).toHaveLength(1);
  });

  it('draws the multi-segment account glyph', async () => {
    await render(<TabIcon color="#D92D3A" name="account" size={28} />);

    expect(collectHostTypes().filter((type) => type === 'RNSVGPath')).toHaveLength(2);
  });
});

describe('IconSymbol', () => {
  it('renders the platform symbol', async () => {
    await render(<IconSymbol color="#231214" name="chevron.right" size={18} />);

    expect(collectHostTypes()).toEqual(['ViewManagerAdapter_SymbolModule']);
  });
});

describe('ThemedText and ThemedView', () => {
  it('render their content', async () => {
    await render(
      <ThemedView testID="themed-view">
        <ThemedText type="title">Themed title</ThemedText>
        <ThemedText type="link">Themed link</ThemedText>
      </ThemedView>,
    );

    expect(screen.getByTestId('themed-view')).toBeOnTheScreen();
    expect(screen.getByText('Themed title')).toBeOnTheScreen();
    expect(screen.getByText('Themed link')).toBeOnTheScreen();
  });
});

describe('HapticTab', () => {
  it('renders a pressable tab button and forwards presses', async () => {
    const onPress = jest.fn();
    await render(
      <ThemeProvider value={DefaultTheme}>
        <HapticTab
          accessibilityLabel="Matches tab"
          onPress={onPress}
          onPressIn={jest.fn()}
          testID="haptic-tab"
        >
          <Text>Matches</Text>
        </HapticTab>
      </ThemeProvider>,
    );

    await fireEvent(screen.getByTestId('haptic-tab'), 'pressIn');
    await fireEvent.press(screen.getByTestId('haptic-tab'));

    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
