import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { Text } from 'react-native';
import { HapticTab } from '@/components/haptic-tab.web';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';

it('provides timed web tab press and release feedback without changing navigation dispatch', async () => {
  const timing = jest.spyOn(Reanimated, 'withTiming');
  const onPress = jest.fn();
  await render(
    <ThemeProvider value={DefaultTheme}>
      <HapticTab accessibilityRole="tab" onPress={onPress} testID="web-tab-motion">
        <Text>Matches</Text>
      </HapticTab>
    </ThemeProvider>,
  );
  const tab = screen.getByTestId('web-tab-motion');
  await fireEvent(tab, 'pressIn');
  await fireEvent.press(tab);
  await fireEvent(tab, 'pressOut');
  expect(timing).toHaveBeenCalledTimes(2);
  expect(onPress).toHaveBeenCalledTimes(1);
});
