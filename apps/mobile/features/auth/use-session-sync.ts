import { useEffect } from 'react';

import { backend } from '@/services/backend';

import { syncSession } from './session-sync';

export function useSessionSync() {
  useEffect(() => syncSession(backend), []);
}
