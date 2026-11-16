import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Text } from 'react-native';
import { HapticTab } from '@/components/haptic-tab';
import { getDsTheme } from '@/constants/design-system';
import { BrandLockup } from '@/components/ui/brand-lockup';
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

describe('TabIcon', () => {
  it('draws one path per glyph segment', async () => {
    await render(<TabIcon color={getDsTheme('light').color.accentPrimary} name="home" />);

    expect(collectHostTypes().filter((type) => type === 'RNSVGPath')).toHaveLength(1);
  });

  it('draws the multi-segment account glyph', async () => {
    await render(
      <TabIcon color={getDsTheme('light').color.accentPrimary} name="account" size={28} />,
    );

    expect(collectHostTypes().filter((type) => type === 'RNSVGPath')).toHaveLength(2);
  });
});

describe('IconSymbol', () => {
  it('renders the platform symbol', async () => {
    await render(<IconSymbol color="#231214" name="chevron.right" size={18} />);

    expect(collectHostTypes()).toEqual(['ViewManagerAdapter_SymbolModule']);
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
