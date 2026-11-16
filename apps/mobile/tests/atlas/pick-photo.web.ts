import { portrait } from './backend.web';
export async function pickPhoto(): Promise<string | null> {
  const id = (window as any).__COMRADIA_ATLAS_BOOT__?.id ?? '';
  if (id.endsWith('photo-error')) throw new Error('Synthetic picker rejection');
  return portrait;
}
