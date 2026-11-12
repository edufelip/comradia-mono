import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';

// Must match apps/firebase/firebase.json and storage.rules.
const BUCKET = 'demo-comradia.appspot.com';
const STORAGE = 'http://127.0.0.1:9199';
const OBJECTS = `${STORAGE}/v0/b/${BUCKET}/o`;
/** The emulator's admin token: rules are bypassed, so tests seed and read raw objects. */
const ADMIN = { Authorization: 'Bearer owner' };

/** The HTTP status of one object: 200 when it exists, 404 when it does not. */
export async function objectStatus(path: string): Promise<number> {
  const res = await fetch(`${OBJECTS}/${encodeURIComponent(path)}`, { headers: ADMIN });
  return res.status;
}

/** Every object name under `prefix`. The emulator omits `items` when nothing matches. */
export async function listObjects(prefix: string): Promise<string[]> {
  const res = await fetch(`${OBJECTS}?prefix=${encodeURIComponent(prefix)}`, { headers: ADMIN });
  expect(res.ok).toBeTruthy();
  const body = (await res.json()) as { items?: { name: string }[] };
  return (body.items ?? []).map((item) => item.name);
}

/** Uploads a JPEG file as `path`, bypassing the rules (the same bytes the app would send). */
export async function uploadJpeg(path: string, file: string): Promise<void> {
  const res = await fetch(
    `${STORAGE}/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(path)}`,
    {
      method: 'POST',
      headers: { ...ADMIN, 'Content-Type': 'image/jpeg' },
      body: new Uint8Array(readFileSync(file)),
    },
  );
  if (!res.ok) throw new Error(`upload ${path} → ${res.status} ${await res.text()}`);
}
