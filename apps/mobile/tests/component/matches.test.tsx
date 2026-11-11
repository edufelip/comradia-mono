import { render, screen } from '@testing-library/react-native';

import MatchesScreen from '@/app/(tabs)/matches';
import { useDiscoveryStore } from '@/features/discovery/discovery-store';
import type { DiscoveryProfile } from '@/features/profile/profile-schema';
import { enUS } from '@/localization/en-US';

jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));

function liked(id: string, displayName: string, age: number, vibe: DiscoveryProfile['vibe']) {
  return {
    id,
    displayName,
    age,
    vibe,
    lookingFor: 'everyone' as const,
    unionMember: false,
    union: null,
    values: ['bookshops_coffee', 'tenant_rights', 'cycling'] as DiscoveryProfile['values'],
    promptId: 'perfect_sunday' as const,
    promptAnswer: `${displayName}'s answer.`,
  };
}

describe('MatchesScreen', () => {
  it('explains how to get a first match when there are none', async () => {
    await render(<MatchesScreen />);

    expect(screen.getByText(enUS['matches.title'])).toBeOnTheScreen();
    expect(screen.getByText(enUS['matches.subtitle'])).toBeOnTheScreen();
    expect(screen.getByText(enUS['matches.empty'])).toBeOnTheScreen();
  });

  it('lists everyone liked this session', async () => {
    useDiscoveryStore.setState({
      liked: [liked('p-maya', 'Maya', 28, 'outdoorsy'), liked('p-val', 'Val', 26, 'creative')],
    });

    await render(<MatchesScreen />);

    expect(screen.getByText('Maya, 28')).toBeOnTheScreen();
    expect(screen.getByText('Outdoorsy')).toBeOnTheScreen();
    expect(screen.getByText("Maya's answer.")).toBeOnTheScreen();
    expect(screen.getByText('Val, 26')).toBeOnTheScreen();
    expect(screen.getByText('Creative')).toBeOnTheScreen();
    expect(screen.queryByText(enUS['matches.empty'])).not.toBeOnTheScreen();
  });
});
