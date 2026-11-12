import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DsBackButton } from '@/components/ds/primitives/DsBackButton';
import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsScreen } from '@/components/ds/primitives/DsScreen';
import { useDsKeyboardOverlap } from '@/components/ds/primitives/useDsKeyboard';
import { DsRadius, DsSpace, DsTypography, getDsTheme } from '@/constants/design-system';
import { useSessionStore } from '@/features/auth/session-store';
import { useChat } from '@/features/chat/use-chat';
import { sharedValues } from '@/features/matches/shared-values';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/localization';
import { backend } from '@/services/backend';
import { MESSAGE_MAX } from '@/services/backend/shared';

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
  const uid = useSessionStore((state) => state.user?.uid);
  const myProfile = useSessionStore((state) => state.profile);
  const { status, match, messages, retry } = useChat(backend, uid, id);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const insets = useSafeAreaInsets();
  const rootRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  // The composer sits at the screen's bottom: lift it by the keyboard height (0 on web,
  // where the browser resizes the viewport itself), else keep it above the safe area.
  const keyboardOverlap = useDsKeyboardOverlap(rootRef);

  const shared = sharedValues(myProfile?.values, match?.other.values ?? []);
  const canSend = draft.trim().length > 0 && !sending;

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
          <View style={styles.headerText}>
            <Text
              accessibilityRole="header"
              style={[DsTypography.cardTitle, { color: ds.color.textPrimary }]}
            >
              {match ? match.other.displayName : t('chat.title')}
            </Text>
            {match ? (
              <Text style={[DsTypography.caption, { color: ds.color.textSecondary }]}>
                {match.other.age} · {t(`onboarding.vibe.${match.other.vibe}`)}
              </Text>
            ) : null}
          </View>
        </View>

        {shared.length > 0 ? (
          <DsCard scheme={scheme} style={styles.banner} variant="muted">
            <Text style={[DsTypography.micro, { color: ds.color.accentPrimary }]}>
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
          // Newest message visible on load, on arrival and after sending.
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          ref={scrollRef}
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
              {messages.map((message) => {
                const mine = message.from === uid;
                return (
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
  footer: {
    gap: DsSpace.md,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: DsSpace.sm,
  },
  headerText: {
    gap: DsSpace.xxs,
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
    flex: 1,
    fontSize: 14,
    minHeight: 46,
    paddingHorizontal: DsSpace.md,
  },
});
