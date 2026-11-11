import { render, screen } from '@testing-library/react-native';
import ProfileScreen from '@/app/(tabs)/profile';

jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));

describe('ProfileScreen', () => {
  it('renders the profile header and sections', async () => {
    await render(<ProfileScreen />);

    expect(screen.getByText('Your Profile')).toBeOnTheScreen();
    expect(screen.getByText('Real chemistry. Shared values.')).toBeOnTheScreen();
    expect(screen.getByText('Core Values')).toBeOnTheScreen();
    expect(screen.getByText('Democratic Socialist')).toBeOnTheScreen();
    expect(screen.getByText('Passions & Causes')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Labor Rights · Universal Healthcare · Climate Action · Housing as a Human Right',
      ),
    ).toBeOnTheScreen();
  });
});
