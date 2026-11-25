import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { DsCard } from '@/components/ds/primitives/DsCard';
import { DsPillButton } from '@/components/ds/primitives/DsPillButton';
import { DsSheet } from '@/components/ds/primitives/DsSheet';
import { DsSpace, DsTypography, getDsTheme, type DsColorScheme } from '@/constants/design-system';
import { useTranslation } from '@/localization';
import type { GamDocument } from '@/services/gamification/types';
import type { GamCatalogItem, GamRedemption } from './model';
import { useGamification } from './provider';

async function clearRequestKey(storageKey: string) {
  try {
    await AsyncStorage.removeItem(storageKey);
  } catch {
    // A key that could not be removed remains safe to replay.
  }
}

export function RedemptionCatalog({ scheme, balance }: { scheme: DsColorScheme; balance: number }) {
  const { uid, client, flags } = useGamification();
  return uid && flags.gam_redemption ? (
    <CatalogContent key={uid} uid={uid} scheme={scheme} balance={balance} client={client} />
  ) : null;
}

function CatalogContent({
  uid,
  scheme,
  balance,
  client,
}: {
  uid: string;
  scheme: DsColorScheme;
  balance: number;
  client: ReturnType<typeof useGamification>['client'];
}) {
  const { t } = useTranslation();
  const theme = getDsTheme(scheme);
  const [items, setItems] = useState<GamDocument<GamCatalogItem>[]>([]);
  const [claims, setClaims] = useState<GamDocument<GamRedemption>[]>([]);
  const [selected, setSelected] = useState<GamDocument<GamCatalogItem> | null>(null);
  const [result, setResult] = useState<{ code: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef(false);

  useEffect(() => {
    const failed = () => setError(true);
    const stopCatalog = client.watchCatalog(setItems, failed);
    const stopHistory = client.watchRedemptions(uid, setClaims, failed);
    return () => {
      stopCatalog();
      stopHistory();
    };
  }, [client, uid]);

  const close = () => {
    setSelected(null);
    setResult(null);
  };

  async function redeem() {
    if (!selected || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(false);
    const storageKey = `comradia.cravos.redemption:${uid}:${selected.id}`;
    try {
      let key = await AsyncStorage.getItem(storageKey);
      if (key === null) {
        key = randomUUID();
        await AsyncStorage.setItem(storageKey, key);
      }
      const claim = await client.redeem(selected.id, key);
      await clearRequestKey(storageKey);
      if (claim.ok) setResult({ code: claim.code });
      else setError(true);
    } catch (failure) {
      // Keep the same key for an ambiguous network failure.
      const code =
        typeof failure === 'object' && failure !== null && 'code' in failure
          ? failure.code
          : undefined;
      if (code === 'functions/failed-precondition' || code === 'functions/invalid-argument') {
        await clearRequestKey(storageKey);
      }
      setError(true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const header = [DsTypography.cardTitle, { color: theme.color.textPrimary }];
  const body = [DsTypography.body, { color: theme.color.textSecondary }];
  return (
    <View style={{ gap: DsSpace.md }} testID="gam-redemption-catalog">
      <DsCard scheme={scheme}>
        <Text accessibilityRole="header" style={header}>
          {t('gam.catalog')}
        </Text>
        {items.map((item) => (
          <View key={item.id} style={{ gap: DsSpace.xs }}>
            <Text style={header}>{item.title}</Text>
            <Text style={body}>{item.description}</Text>
            <DsPillButton
              label={t('gam.confirm', { count: item.priceCravos })}
              scheme={scheme}
              disabled={balance < item.priceCravos || item.stock === 0}
              onPress={() => {
                setError(false);
                setSelected(item);
              }}
              testID={`gam-redeem-${item.id}`}
            />
          </View>
        ))}
        {error && selected === null ? (
          <Text accessibilityRole="alert" style={body}>
            {t('gam.failed')}
          </Text>
        ) : null}
      </DsCard>
      <DsCard scheme={scheme}>
        <Text accessibilityRole="header" style={header}>
          {t('gam.claims')}
        </Text>
        {claims.map((claim) => (
          <View key={claim.id} style={{ gap: DsSpace.xxs }}>
            <Text style={header}>
              {items.find((item) => item.id === claim.itemId)?.title ?? claim.itemId}
            </Text>
            <Text style={body}>{t(`gam.status.${claim.status}`)}</Text>
            {claim.code && (
              <Text selectable style={body}>
                {t('gam.code', { code: claim.code })}
              </Text>
            )}
          </View>
        ))}
      </DsCard>
      <DsSheet
        visible={selected !== null}
        scheme={scheme}
        title={selected?.title ?? t('gam.catalog')}
        closeLabel={t('gam.close')}
        onClose={() => {
          if (!pending.current) close();
        }}
        testID="gam-redeem-sheet"
      >
        {result ? (
          <View style={{ gap: DsSpace.sm }}>
            <Text style={header}>{t('gam.status.fulfilled')}</Text>
            {result.code && (
              <Text selectable style={body}>
                {t('gam.code', { code: result.code })}
              </Text>
            )}
            <DsPillButton label={t('gam.close')} scheme={scheme} onPress={close} />
          </View>
        ) : (
          selected && (
            <View style={{ gap: DsSpace.sm }}>
              <Text style={header}>{t('gam.confirm', { count: selected.priceCravos })}</Text>
              {error && (
                <Text accessibilityRole="alert" style={body}>
                  {t('gam.failed')}
                </Text>
              )}
              <DsPillButton
                label={t('gam.redeem')}
                scheme={scheme}
                disabled={busy}
                onPress={() => {
                  void redeem();
                }}
                testID="gam-redeem-confirm"
                variant="primary"
              />
            </View>
          )
        )}
      </DsSheet>
    </View>
  );
}
