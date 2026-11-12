import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import type { NotificationSettingsStatus } from './NotificationSettings';
import {
  disableNotifications,
  enableNotifications,
  getNotificationSettings,
  openNotificationSettings,
} from './notifications';

export function useNotificationSettings(uid: string | undefined) {
  const [status, setStatus] = useState<NotificationSettingsStatus>('loading');
  const [busy, setBusy] = useState(false);
  const [errorAction, setErrorAction] = useState<'enable' | 'disable'>('enable');

  const refresh = useCallback(async () => {
    if (!uid) {
      setStatus('unavailable');
      return;
    }
    try {
      setStatus(await getNotificationSettings(uid));
    } catch {
      setStatus('error');
    }
  }, [uid]);

  useEffect(() => {
    setStatus('loading');
    setErrorAction('enable');
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const enable = useCallback(async () => {
    if (!uid || busy) return;
    setBusy(true);
    setErrorAction('enable');
    try {
      await enableNotifications(uid);
      await refresh();
    } catch {
      setStatus('error');
    } finally {
      setBusy(false);
    }
  }, [busy, refresh, uid]);

  const disable = useCallback(async () => {
    if (!uid || busy) return;
    setBusy(true);
    setErrorAction('disable');
    try {
      await disableNotifications(uid);
      await refresh();
    } catch {
      setStatus('error');
    } finally {
      setBusy(false);
    }
  }, [busy, refresh, uid]);

  const openSettings = useCallback(async () => {
    try {
      await openNotificationSettings();
    } catch {
      setStatus('error');
    }
  }, []);

  return {
    status,
    busy,
    errorAction,
    onEnable: enable,
    onDisable: disable,
    onOpenSettings: openSettings,
  };
}
