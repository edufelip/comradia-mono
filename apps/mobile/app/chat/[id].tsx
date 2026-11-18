import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useLayoutEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DsMotionView } from '@/components/ds/motion/DsMotionView';
import { DsBackButton } from '@/components/ds/primitives/DsBackButton';
import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsScreen } from '@/components/ds/primitives/DsScreen';
import { useDsKeyboardOverlap } from '@/components/ds/primitives/useDsKeyboard';
import { DsRadius, DsSpace, DsTypography, getDsTheme } from '@/constants/design-system';
import { useSessionStore } from '@/features/auth/session-store';
import { chatScrollAction, scrollIntentFor } from '@/features/chat/chat-scroll';
import { useChat } from '@/features/chat/use-chat';
import { sharedValues } from '@/features/matches/shared-values';
import { ProfilePhoto } from '@/features/profile/ProfilePhoto';
import { useBlockedUids } from '@/features/safety/use-blocked-uids';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';
import { backend } from '@/services/backend';
import { MESSAGE_MAX } from '@/services/backend/shared';
import type { ChatMessage } from '@/services/backend/types';

/**
 * S10. One conversation: the shared values pinned at the top, every message live from
 * Firestore (mine on the right), and a text composer capped at the rules' 1000 characters.
 */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const ds = getDsTheme(scheme);
  const { t } = useTranslation();
  const router = useRouter();
  const isFocused = useIsFocused();
  const uid = useSessionStore((state) => state.user?.uid);
  const myProfile = useSessionStore((state) => state.profile);
  const {
    status,
    match,
    messages,
    canLoadEarlier,
    loadingEarlier,
    earlierFailed,
    loadEarlier,
    retry,
  } = useChat(backend, uid, id);
  const { blockedUids } = useBlockedUids(backend, uid);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const [animatedMessageIds, setAnimatedMessageIds] = useState<Set<string>>(() => new Set());
  const messageSnapshot = useRef<{ key: string; initialized: boolean; ids: Set<string> }>({
    key: `${uid ?? ''}:${id}`,
    initialized: false,
    ids: new Set(),
  });
  const insets = useSafeAreaInsets();
  const rootRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  // The composer sits at the screen's bottom: lift it by the keyboard height (0 on web,
  // where the browser resizes the viewport itself), else keep it above the safe area.
  const keyboardOverlap = useDsKeyboardOverlap(rootRef);
  // Where the viewport sits, and why the message content is about to change size.
  const scrollOffset = useRef(0);
  const contentHeight = useRef(0);
  const scrollIntent = useRef<ReturnType<typeof scrollIntentFor>>('none');
  const previousMessages = useRef<ChatMessage[]>([]);
  const latestMessageId = messages.at(-1)?.id;

  const other = match?.other;
  // Their card is unreadable when they blocked me: show the conversation closed, without
  // a name, portrait or values — only the uid the match id already carries.
  const otherCard = other && 'displayName' in other ? other : null;
  const shared = sharedValues(myProfile?.values, otherCard?.values ?? []);
  const canSend = draft.trim().length > 0 && !sending;
  // A block on either side closes the conversation: the messages stay readable, the
  // composer goes away.
  const closed = other ? !otherCard || blockedUids.includes(other.id) : false;

  useLayoutEffect(() => {
    if (!isFocused || status !== 'ready') {
      setAnimatedMessageIds((current) => (current.size === 0 ? current : new Set()));
    }

    const key = `${uid ?? ''}:${id}`;
    if (messageSnapshot.current.key !== key) {
      messageSnapshot.current = { key, initialized: false, ids: new Set() };
      setAnimatedMessageIds(new Set());
      return;
    }

    if (status !== 'ready') {
      messageSnapshot.current.initialized = false;
      return;
    }

    if (!messageSnapshot.current.initialized) {
      messageSnapshot.current.initialized = true;
      messageSnapshot.current.ids = new Set(messages.map((message) => message.id));
      return;
    }

    const incoming = messages.filter((message) => !messageSnapshot.current.ids.has(message.id));
    messages.forEach((message) => messageSnapshot.current.ids.add(message.id));
    if (isFocused && incoming.length > 0) {
      setAnimatedMessageIds(
        (current) => new Set([...current, ...incoming.map((message) => message.id)]),
      );
    }
  }, [id, isFocused, messages, status, uid]);

  // The scroll intent must be decided per message-list change only: an unrelated re-render
  // between the change and its layout event must not overwrite it.
  useLayoutEffect(() => {
    const intent = scrollIntentFor(previousMessages.current, messages);
    if (intent === 'latest' || (intent === 'anchor' && scrollIntent.current !== 'latest')) {
      scrollIntent.current = intent;
    }
    previousMessages.current = messages;
  }, [messages]);

  useLayoutEffect(() => {
    if (!latestMessageId) return;
    // At the live query limit, a new message can replace an old one without a resize.
    const frame = requestAnimationFrame(() => {
      if (scrollIntent.current !== 'latest') return;
      scrollIntent.current = 'none';
      scrollRef.current?.scrollToEnd({ animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [latestMessageId]);

  const send = async () => {
    if (!uid || !canSend) return;
    setSending(true);
    setSendFailed(false);
    try {
      await backend.sendMessage(uid, id, draft.trim());
      setDraft('');
    } catch {
      // Keep the text so Retry (another press) does not lose it.
      setSendFailed(true);
    } finally {
      setSending(false);
    }
  };

  const isLoading = status === 'idle' || status === 'loading';

  return (
    <DsScreen
      contentContainerStyle={styles.container}
      scheme={scheme}
      scrollable={false}
      testID="chat-screen"
    >
      <View collapsable={false} ref={rootRef} style={styles.root}>
        <View style={styles.header}>
          <DsBackButton
            accessibilityLabel={t('chat.back')}
            onPress={() => router.back()}
            scheme={scheme}
            testID="chat-back"
          />
          {otherCard ? (
            <ProfilePhoto
              name={otherCard.displayName}
              path={otherCard.photoPath}
              scheme={scheme}
              shape="circle"
              style={{ width: 40 }}
              testID="chat-photo"
            />
          ) : null}
          <View style={styles.headerText}>
            <Text
              accessibilityRole="header"
              style={[DsTypography.cardTitle, { color: ds.color.textPrimary }]}
            >
              {otherCard ? otherCard.displayName : t('chat.title')}
            </Text>
            {otherCard ? (
              <Text style={[DsTypography.caption, { color: ds.color.textSecondary }]}>
                {otherCard.age} · {t(`onboarding.vibe.${otherCard.vibe}`)}
              </Text>
            ) : null}
          </View>
          {other ? (
            <DsPillButton
              fullWidth={false}
              label={t('chat.safety')}
              onPress={() => router.push(`/safety/${other.id}?context=chat&match=${match.id}`)}
              scheme={scheme}
              size="xs"
              style={styles.headerAction}
              testID="chat-safety"
              variant="ghost"
            />
          ) : null}
        </View>

        {shared.length > 0 ? (
          <DsCard scheme={scheme} style={styles.banner} variant="muted">
            <Text style={[DsTypography.micro, { color: ds.color.accentText }]}>
              {t('chat.shared_label')}
            </Text>
            <View style={styles.valuesRow}>
              {shared.map((value) => (
                <View key={value} style={[styles.valueChip, { backgroundColor: ds.color.surface }]}>
                  <Text style={[DsTypography.caption, { color: ds.color.textSecondary }]}>
                    {t(`onboarding.values.${value}`)}
                  </Text>
                </View>
              ))}
            </View>
          </DsCard>
        ) : null}

        <ScrollView
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={(_width, height) => {
            const action = chatScrollAction({
              height,
              intent: scrollIntent.current,
              offset: scrollOffset.current,
              previousHeight: contentHeight.current,
            });
            // One change of the message list consumes one intent.
            scrollIntent.current = 'none';
            contentHeight.current = height;
            if (action.kind === 'latest') {
              // Newest message visible on load, on arrival and after sending.
              scrollRef.current?.scrollToEnd({ animated: false });
            } else if (action.kind === 'anchor') {
              // Older messages prepended above: keep what is on screen where it is.
              scrollRef.current?.scrollTo({ y: action.y, animated: false });
            }
          }}
          onScroll={(event) => {
            scrollOffset.current = event.nativeEvent.contentOffset.y;
          }}
          ref={scrollRef}
          scrollEventThrottle={16}
          style={styles.scroll}
          testID="chat-messages"
        >
          {isLoading ? (
            <Text style={[DsTypography.body, { color: ds.color.textSecondary }]}>
              {t('chat.loading')}
            </Text>
          ) : status === 'not_found' ? (
            <Text
              style={[DsTypography.body, { color: ds.color.textPrimary }]}
              testID="chat-not-found"
            >
              {t('chat.not_found')}
            </Text>
          ) : status === 'error' ? (
            <DsCard scheme={scheme} style={styles.card} testID="chat-load-error">
              <Text
                accessibilityRole="alert"
                style={[DsTypography.body, { color: ds.color.textPrimary }]}
              >
                {t('chat.load_error')}
              </Text>
              <DsPillButton
                label={t('chat.retry')}
                onPress={retry}
                scheme={scheme}
                testID="chat-retry"
                variant="primary"
              />
            </DsCard>
          ) : (
            <>
              {canLoadEarlier ? (
                <DsPillButton
                  accessibilityLabel={t('chat.load_earlier')}
                  disabled={loadingEarlier}
                  fullWidth={false}
                  label={t('chat.load_earlier')}
                  loading={loadingEarlier}
                  onPress={() => void loadEarlier()}
                  scheme={scheme}
                  size="xs"
                  style={styles.loadEarlier}
                  testID="chat-load-earlier"
                  variant="ghost"
                />
              ) : null}
              {earlierFailed ? (
                <Text
                  accessibilityRole="alert"
                  style={[DsTypography.caption, { color: ds.color.danger }]}
                  testID="chat-earlier-error"
                >
                  {t('chat.load_error')}
                </Text>
              ) : null}
              {messages.map((message) => {
                const mine = message.from === uid;
                const bubble = (
                  <View
                    key={message.id}
                    style={[
                      styles.bubble,
                      {
                        alignSelf: mine ? 'flex-end' : 'flex-start',
                        backgroundColor: mine ? ds.color.actionPrimary : ds.color.surfaceMuted,
                      },
                    ]}
                    testID={`chat-message-${message.id}`}
                  >
                    <Text
                      style={[
                        DsTypography.body,
                        { color: mine ? ds.color.onActionPrimary : ds.color.textPrimary },
                      ]}
                    >
                      {message.text}
                    </Text>
                  </View>
                );

                return isFocused && animatedMessageIds.has(message.id) ? (
                  <DsMotionView
                    key={message.id}
                    variant="slide"
                    testID={`chat-message-motion-${message.id}`}
                  >
                    {bubble}
                  </DsMotionView>
                ) : (
                  bubble
                );
              })}
            </>
          )}
        </ScrollView>

        {status === 'ready' ? (
          <View
            style={[
              styles.footer,
              {
                paddingBottom:
                  keyboardOverlap > 0 ? keyboardOverlap + DsSpace.sm : insets.bottom + DsSpace.md,
              },
            ]}
          >
            {closed ? (
              <Text
                style={[DsTypography.body, { color: ds.color.textSecondary }]}
                testID="chat-closed"
              >
                {t('chat.closed')}
              </Text>
            ) : (
              <>
                {sendFailed ? (
                  <Text
                    accessibilityRole="alert"
                    style={[DsTypography.caption, { color: ds.color.danger }]}
                    testID="chat-error"
                  >
                    {t('chat.error')}
                  </Text>
                ) : null}

                <View style={styles.composer}>
                  <TextInput
                    accessibilityLabel={t('chat.input_label')}
                    maxLength={MESSAGE_MAX}
                    onChangeText={setDraft}
                    placeholder={t('chat.placeholder')}
                    placeholderTextColor={ds.color.textTertiary}
                    style={[
                      styles.input,
                      {
                        backgroundColor: ds.color.surface,
                        borderColor: ds.color.border,
                        color: ds.color.textPrimary,
                      },
                    ]}
                    testID="chat-input"
                    value={draft}
                  />
                  <DsPillButton
                    disabled={!canSend}
                    fullWidth={false}
                    label={t('chat.send')}
                    loading={sending}
                    onPress={() => {
                      void send();
                    }}
                    scheme={scheme}
                    testID="chat-send"
                    variant="primary"
                  />
                </View>
              </>
            )}
          </View>
        ) : null}
      </View>
    </DsScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: DsSpace.lg,
    paddingTop: DsSpace.lg,
  },
  root: {
    flex: 1,
    gap: DsSpace.md,
  },
  scroll: {
    flex: 1,
  },
  messages: {
    gap: DsSpace.md,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  loadEarlier: {
    alignSelf: 'center',
  },
  footer: {
    gap: DsSpace.md,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: DsSpace.sm,
  },
  headerAction: {
    // Shares the row with the name; the label wraps rather than overflowing a 320 pt screen.
    flexShrink: 1,
    marginLeft: 'auto',
    maxWidth: '32%',
  },
  headerText: {
    flex: 1,
    gap: DsSpace.xxs,
    minWidth: 0,
  },
  banner: {
    gap: DsSpace.xs,
  },
  valuesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DsSpace.xs,
  },
  valueChip: {
    borderRadius: DsRadius.sm,
    paddingHorizontal: DsSpace.sm,
    paddingVertical: DsSpace.xxs,
  },
  card: {
    gap: DsSpace.xs,
  },
  bubble: {
    borderRadius: DsRadius.lg,
    maxWidth: '80%',
    paddingHorizontal: DsSpace.md,
    paddingVertical: DsSpace.sm,
  },
  composer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: DsSpace.sm,
  },
  input: {
    borderRadius: DsRadius.pill,
    borderWidth: 1,
    ...DsTypography.input,
    flex: 1,
    minHeight: 46,
    paddingHorizontal: DsSpace.md,
  },
});
