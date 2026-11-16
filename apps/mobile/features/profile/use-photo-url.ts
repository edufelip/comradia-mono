import { useEffect, useState } from 'react';
import { backend } from '@/services/backend';

/** Download URL for a `photoPath`; null while loading, when there is no photo, or on error. */
export function usePhotoUrl(path: string | null): string | null {
  const [url, setUrl] = useState<{ path: string; url: string } | null>(null);

  useEffect(() => {
    if (!path) return;
    let active = true;
    backend
      .photoUrl(path)
      .then((next) => {
        if (active) setUrl({ path, url: next });
      })
      // A missing or unreadable photo falls back to the placeholder.
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [path]);

  return path && url?.path === path ? url.url : null;
}
