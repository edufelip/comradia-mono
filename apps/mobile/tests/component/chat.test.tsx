import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import ChatScreen from '@/app/chat/[id]';
import * as chatScroll from '@/features/chat/chat-scroll';
import { useSessionStore } from '@/features/auth/session-store';
import { enUS } from '@/localization/en-US';
import { matchIdFor } from '@/services/backend/shared';
import { TEST_PROFILE, TEST_USER, fakeBackend } from './mocks/backend';
import type { DiscoveryProfile } from '@/features/profile/profile-schema';
import type { ChatMessage } from '@/services/backend/types';

/** The portrait's image and initial are hidden from screen readers; its root carries the name. */
const HIDDEN = { includeHiddenElements: true };

const mockBack = jest.fn();
const mockPush = jest.fn();
let mockParams: { id?: string } = {};
let mockIsFocused = true;
/** Every focus callback the screen registered, so a test can simulate regaining focus. */
let mockFocusEffects: (() => void)[] = [];
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    // Stand-in for `useFocusEffect`: runs on mount and whenever the callback changes,
    // which is what the real hook does when the screen regains focus.
    useFocusEffect: (callback: () => void) => {
      mockFocusEffects.push(callback);
      useEffect(callback, [callback]);
    },
    useLocalSearchParams: () => mockParams,
    useRouter: () => ({
      back: mockBack,
      navigate: jest.fn(),
      push: mockPush,
      replace: jest.fn(),
    }),
  };
});
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => mockIsFocused,
}));
jest.mock('@/localization/get-device-locale', () => ({ getDeviceLocale: () => 'en-US' }));

beforeEach(() => {
  mockIsFocused = true;
  mockParams = {};
  mockFocusEffects = [];
});

const MAYA: DiscoveryProfile = {
  id: 'p-maya',
  displayName: 'Maya',
  age: 28,
  vibe: 'outdoorsy',
  lookingFor: 'everyone',
  unionMember: true,
  union: 'apeoesp',
  values: ['bookshops_coffee', 'tenant_rights', 'cycling'],
  promptId: 'perfect_sunday',
  promptAnswer: 'Community garden at sunrise, then a long lunch.',
  photoPath: null,
};

function signIn() {
  useSessionStore.setState({ status: 'ready', user: TEST_USER, profile: TEST_PROFILE });
}

/** Creates a real match through the fake and points the route at it. */
async function seedMatch() {
  fakeBackend.state.profiles.set(MAYA.id, MAYA);
  fakeBackend.likeFrom(MAYA.id, TEST_USER.uid);
  const result = await fakeBackend.backend.like(TEST_USER.uid, MAYA.id);
  const id = result.matched ? result.matchId : matchIdFor(TEST_USER.uid, MAYA.id);
  mockParams = { id };
  return id;
}

function textOf(testID: string): string {
  return screen.getByTestId(testID).props.value as string;
}

describe('ChatScreen', () => {
  it('shows a loading line while the match travels from Firestore', async () => {
    signIn();
    jest.spyOn(fakeBackend.backend, 'getMatch').mockReturnValue(new Promise(() => undefined));

    await render(<ChatScreen />);

    expect(screen.getByTestId('chat-screen')).toBeOnTheScreen();
    expect(screen.getByText(enUS['chat.loading'])).toBeOnTheScreen();
    expect(screen.queryByTestId('chat-input')).not.toBeOnTheScreen();
  });

  it('explains a conversation it cannot find', async () => {
    signIn();
    mockParams = { id: 'missing' };

    await render(<ChatScreen />);

    expect(await screen.findByTestId('chat-not-found')).toBeOnTheScreen();
    expect(screen.queryByTestId('chat-input')).not.toBeOnTheScreen();
  });

  it('opens on the other person with the values the two share', async () => {
    signIn();
    const matchId = await seedMatch();

    await render(<ChatScreen />);

    expect(await screen.findByText('Maya')).toBeOnTheScreen();
    expect(screen.getByText('28 · Outdoorsy')).toBeOnTheScreen();
    expect(screen.getByText(enUS['chat.shared_label'])).toBeOnTheScreen();
    expect(screen.getByText('Bookshops & coffee')).toBeOnTheScreen();
    expect(screen.getByText('Tenant rights')).toBeOnTheScreen();
    expect(screen.getByTestId('chat-input')).toHaveAccessibleName('Message');
    expect(screen.getByTestId('chat-send')).toBeDisabled();
    expect(fakeBackend.callsTo('getMatch')).toEqual([
      { method: 'getMatch', args: [TEST_USER.uid, matchId] },
    ]);
  });

  it('shows the other person portrait in the header', async () => {
    signIn();
    await seedMatch();
    fakeBackend.state.profiles.set(MAYA.id, { ...MAYA, photoPath: 'photos/p-maya/a.jpg' });

    await render(<ChatScreen />);

    expect(await screen.findByTestId('chat-photo-image', HIDDEN)).toHaveProp('source', [
      { uri: 'https://photos.test/photos/p-maya/a.jpg' },
    ]);
  });

  it('shows the initial in the header when the other person has no portrait', async () => {
    signIn();
    await seedMatch();

    await render(<ChatScreen />);

    expect(await screen.findByTestId('chat-photo')).toBeOnTheScreen();
    expect(screen.queryByTestId('chat-photo-image', HIDDEN)).not.toBeOnTheScreen();
    expect(within(screen.getByTestId('chat-photo')).getByText('M', HIDDEN)).toBeOnTheScreen();
  });

  it('renders a live message from the other person', async () => {
    signIn();
    const matchId = await seedMatch();

    await render(<ChatScreen />);
    await screen.findByTestId('chat-input');

    await act(() => fakeBackend.receiveMessage(matchId, MAYA.id, 'Thursday sounds good'));

    expect(await screen.findByText('Thursday sounds good')).toBeOnTheScreen();
    const message = fakeBackend.state.messages.get(matchId)?.[0];
    expect(screen.getByTestId(`chat-message-${message?.id}`)).toBeOnTheScreen();
    expect(screen.getByTestId(`chat-message-motion-${message?.id}`)).toBeOnTheScreen();
  });

  it('does not animate the history delivered by the first message snapshot', async () => {
    signIn();
    const matchId = await seedMatch();
    fakeBackend.state.messages.set(matchId, [
      { id: 'history-1', from: MAYA.id, text: 'Before we matched', createdAt: 1 },
    ]);

    await render(<ChatScreen />);

    expect(await screen.findByText('Before we matched')).toBeOnTheScreen();
    expect(screen.queryByTestId('chat-message-motion-history-1')).not.toBeOnTheScreen();
  });

  it('loads and prepends earlier messages when the live window is full', async () => {
    signIn();
    const matchId = await seedMatch();
    fakeBackend.state.messages.set(
      matchId,
      Array.from({ length: 205 }, (_, index) => ({
        id: `history-${index + 1}`,
        from: MAYA.id,
        text: `History ${index + 1}`,
        createdAt: index + 1,
      })),
    );

    await render(<ChatScreen />);

    const loadEarlier = await screen.findByTestId('chat-load-earlier');
    expect(loadEarlier).toHaveAccessibleName(enUS['chat.load_earlier']);
    await fireEvent.press(loadEarlier);

    expect(await screen.findByText('History 1')).toBeOnTheScreen();
    expect(screen.getByTestId('chat-message-history-205')).toBeOnTheScreen();
    expect(fakeBackend.callsTo('loadOlderMessages')).toEqual([
      { method: 'loadOlderMessages', args: [matchId, 'history-6', 200] },
    ]);
  });

  it('keeps the visible position when earlier messages prepend', async () => {
    // Drive the resize before the animation-frame fallback, as a native layout can.
    jest.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(0);
    signIn();
    const matchId = await seedMatch();
    fakeBackend.state.messages.set(
      matchId,
      Array.from({ length: 205 }, (_, index) => ({
        id: `history-${index + 1}`,
        from: MAYA.id,
        text: `History ${index + 1}`,
        createdAt: index + 1,
      })),
    );
    const actionFor = jest.spyOn(chatScroll, 'chatScrollAction');

    await render(<ChatScreen />);
    const scroll = await screen.findByTestId('chat-messages');

    // First layout shows the newest message, as before.
    actionFor.mockClear();
    await act(() => scroll.props.onContentSizeChange(320, 1000));
    expect(actionFor).toHaveBeenLastCalledWith(
      expect.objectContaining({ intent: 'latest', height: 1000 }),
    );

    // The user scrolls up into the history.
    await act(() => scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 300 } } }));

    // Older messages prepend above the visible window: the viewport follows by exactly the
    // height the history added, instead of snapping back to the newest message.
    await fireEvent.press(await screen.findByTestId('chat-load-earlier'));
    expect(await screen.findByText('History 1')).toBeOnTheScreen();
    actionFor.mockClear();
    await act(() => scroll.props.onContentSizeChange(320, 2400));
    expect(actionFor).toHaveBeenLastCalledWith(
      expect.objectContaining({
        intent: 'anchor',
        offset: 300,
        previousHeight: 1000,
        height: 2400,
      }),
    );
    expect(actionFor).toHaveLastReturnedWith({ kind: 'anchor', y: 1700 });

    // A message that arrives still brings the newest into view.
    actionFor.mockClear();
    await act(() => fakeBackend.receiveMessage(matchId, MAYA.id, 'Newest'));
    await act(() => scroll.props.onContentSizeChange(320, 2500));
    expect(actionFor).toHaveBeenLastCalledWith(
      expect.objectContaining({ intent: 'latest', height: 2500 }),
    );
  });

  it('says so when earlier messages fail to load', async () => {
    signIn();
    const matchId = await seedMatch();
    fakeBackend.state.messages.set(
      matchId,
      Array.from({ length: 200 }, (_, index) => ({
        id: `history-${index + 1}`,
        from: MAYA.id,
        text: `History ${index + 1}`,
        createdAt: index + 1,
      })),
    );
    fakeBackend.state.failNext.set('loadOlderMessages', 'network');

    await render(<ChatScreen />);
    await fireEvent.press(await screen.findByTestId('chat-load-earlier'));

    expect(await screen.findByTestId('chat-earlier-error')).toBeOnTheScreen();
  });

  it('does not replay a message that arrived while Chat was hidden', async () => {
    signIn();
    const matchId = await seedMatch();
    mockIsFocused = false;

    const view = await render(<ChatScreen />);
    await screen.findByTestId('chat-input');
    await act(() => fakeBackend.receiveMessage(matchId, MAYA.id, 'While you were away'));

    expect(await screen.findByText('While you were away')).toBeOnTheScreen();
    const message = fakeBackend.state.messages.get(matchId)?.[0];
    expect(screen.queryByTestId(`chat-message-motion-${message?.id}`)).not.toBeOnTheScreen();

    mockIsFocused = true;
    await view.rerender(<ChatScreen />);

    expect(screen.queryByTestId(`chat-message-motion-${message?.id}`)).not.toBeOnTheScreen();
  });

  it('keeps the composer outside the scrolling messages so it stays at the bottom', async () => {
    signIn();
    const matchId = await seedMatch();

    await render(<ChatScreen />);
    await screen.findByTestId('chat-input');
    await act(() => fakeBackend.receiveMessage(matchId, MAYA.id, 'Hello'));
    await screen.findByText('Hello');

    const messages = within(screen.getByTestId('chat-messages'));
    expect(messages.getByText('Hello')).toBeOnTheScreen();
    expect(messages.queryByTestId('chat-input')).not.toBeOnTheScreen();
    expect(messages.queryByTestId('chat-send')).not.toBeOnTheScreen();
  });

  it('sends a message and clears the composer', async () => {
    signIn();
    const matchId = await seedMatch();

    await render(<ChatScreen />);
    await screen.findByTestId('chat-input');

    await fireEvent.changeText(screen.getByTestId('chat-input'), 'Hi Maya');
    expect(screen.getByTestId('chat-send')).toBeEnabled();
    await fireEvent.press(screen.getByTestId('chat-send'));

    expect(await screen.findByText('Hi Maya')).toBeOnTheScreen();
    expect(textOf('chat-input')).toBe('');
    expect(fakeBackend.callsTo('sendMessage')).toEqual([
      { method: 'sendMessage', args: [TEST_USER.uid, matchId, 'Hi Maya'] },
    ]);
  });

  it('keeps the text and reports a message that did not send', async () => {
    signIn();
    const matchId = await seedMatch();

    await render(<ChatScreen />);
    await screen.findByTestId('chat-input');
    fakeBackend.state.failNext.set('sendMessage', 'network');

    await fireEvent.changeText(screen.getByTestId('chat-input'), 'Hi Maya');
    await fireEvent.press(screen.getByTestId('chat-send'));

    expect(await screen.findByTestId('chat-error')).toBeOnTheScreen();
    expect(screen.getByText(enUS['chat.error'])).toBeOnTheScreen();
    expect(textOf('chat-input')).toBe('Hi Maya');
    expect(fakeBackend.state.messages.get(matchId)).toBeUndefined();
  });

  it('reports a failed read and recovers through Try again', async () => {
    signIn();
    const matchId = await seedMatch();
    fakeBackend.state.failNext.set('getMatch', 'network');

    await render(<ChatScreen />);

    expect(await screen.findByTestId('chat-load-error')).toBeOnTheScreen();
    expect(screen.getByText(enUS['chat.load_error'])).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('chat-retry'));

    expect(await screen.findByTestId('chat-input')).toBeOnTheScreen();
    expect(fakeBackend.callsTo('getMatch')).toHaveLength(2);
    expect(fakeBackend.callsTo('getMatch')[1].args).toEqual([TEST_USER.uid, matchId]);
  });

  it('stops following the messages when the screen unmounts', async () => {
    signIn();
    await seedMatch();
    const unsubscribe = jest.fn();
    jest.spyOn(fakeBackend.backend, 'onMessages').mockImplementation((matchId, listener) => {
      listener([]);
      return unsubscribe;
    });

    const view = await render(<ChatScreen />);
    await screen.findByTestId('chat-input');

    await view.unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('ignores a message that arrives after unmount', async () => {
    signIn();
    await seedMatch();
    let spill: ((messages: ChatMessage[]) => void) | undefined;
    jest.spyOn(fakeBackend.backend, 'onMessages').mockImplementation((matchId, listener) => {
      spill = listener;
      listener([]);
      return () => {};
    });

    const view = await render(<ChatScreen />);
    await screen.findByTestId('chat-input');
    await view.unmount();

    await act(() => spill?.([]));
  });

  it('waits for the session before opening the conversation', async () => {
    useSessionStore.setState({ status: 'signedOut', user: null, profile: null });
    mockParams = { id: 'anything' };

    await render(<ChatScreen />);

    expect(screen.getByText(enUS['chat.loading'])).toBeOnTheScreen();
    expect(fakeBackend.callsTo('getMatch')).toEqual([]);
  });

  it('goes back when the header back button is pressed', async () => {
    signIn();
    await seedMatch();

    await render(<ChatScreen />);
    await fireEvent.press(await screen.findByTestId('chat-back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('opens the safety sheet for the other person', async () => {
    signIn();
    const matchId = await seedMatch();

    await render(<ChatScreen />);

    const safety = await screen.findByTestId('chat-safety');
    expect(safety).toHaveAccessibleName('Safety options');

    await fireEvent.press(safety);

    expect(mockPush).toHaveBeenCalledWith(`/safety/${MAYA.id}?context=chat&match=${matchId}`);
  });

  it('lets the name and the safety action share a 320 pt header without overflowing', async () => {
    signIn();
    await seedMatch();

    await render(<ChatScreen />);

    // Without shrink and a width cap the Geist-wide name and button push the row past the screen.
    expect(await screen.findByTestId('chat-safety')).toHaveStyle({
      flexShrink: 1,
      maxWidth: '32%',
    });
    expect(screen.getByRole('header', { name: MAYA.displayName })).toBeOnTheScreen();
  });

  it('closes the conversation when the other person is blocked', async () => {
    signIn();
    const matchId = await seedMatch();
    fakeBackend.state.blocked.add(MAYA.id);
    await act(() => fakeBackend.receiveMessage(matchId, MAYA.id, 'Thursday sounds good'));

    await render(<ChatScreen />);

    expect(await screen.findByTestId('chat-closed')).toBeOnTheScreen();
    expect(screen.getByText(enUS['chat.closed'])).toBeOnTheScreen();
    // The messages stay readable; only the composer goes away.
    expect(screen.getByText('Thursday sounds good')).toBeOnTheScreen();
    expect(screen.queryByTestId('chat-input')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('chat-send')).not.toBeOnTheScreen();
  });

  it('opens a conversation they blocked as closed and identity-free, not missing', async () => {
    signIn();
    const matchId = await seedMatch();
    // The profile read can be denied before the separate block list catches up.
    fakeBackend.state.profileDenied.add(MAYA.id);
    fakeBackend.state.messages.set(matchId, [
      { id: 'history-1', from: MAYA.id, text: 'Before the block', createdAt: 1 },
    ]);

    await render(<ChatScreen />);

    expect(await screen.findByTestId('chat-closed')).toBeOnTheScreen();
    expect(screen.queryByTestId('chat-not-found')).not.toBeOnTheScreen();
    // The history stays readable; nothing about Maya beyond the uid the route carries.
    expect(screen.getByText('Before the block')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: enUS['chat.title'] })).toBeOnTheScreen();
    expect(screen.queryByTestId('chat-photo')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('chat-input')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('chat-send')).not.toBeOnTheScreen();
    // Reporting the person who blocked me is still possible.
    expect(screen.getByTestId('chat-safety')).toBeOnTheScreen();
  });

  it('recovers the conversation when they unblock me, without leaving the screen', async () => {
    signIn();
    const matchId = await seedMatch();
    fakeBackend.state.profileDenied.add(MAYA.id);
    fakeBackend.state.blocked.add(MAYA.id);

    await render(<ChatScreen />);
    expect(await screen.findByTestId('chat-closed')).toBeOnTheScreen();

    // They lift the block elsewhere; regaining focus re-reads the denied card instead of
    // keeping the denial memoized as a missing profile.
    fakeBackend.state.profileDenied.delete(MAYA.id);
    fakeBackend.state.blocked.delete(MAYA.id);
    await act(async () => {
      mockFocusEffects.forEach((effect) => effect());
    });

    expect(await screen.findByRole('header', { name: 'Maya' })).toBeOnTheScreen();
    expect(screen.getByText('28 · Outdoorsy')).toBeOnTheScreen();
    expect(screen.getByTestId('chat-input')).toBeOnTheScreen();
    expect(screen.queryByTestId('chat-closed')).not.toBeOnTheScreen();
  });

  it('keeps the composer when nobody is blocked', async () => {
    signIn();
    await seedMatch();

    await render(<ChatScreen />);

    expect(await screen.findByTestId('chat-input')).toBeOnTheScreen();
    expect(screen.queryByTestId('chat-closed')).not.toBeOnTheScreen();
  });
});
