import type { Bucket } from '@google-cloud/storage';

export const MAX_PROFILE_PHOTOS = 3;
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

export interface PhotoObject {
  name: string;
  createdAt: number;
  contentType?: string;
}

export interface PhotoCapStore {
  listPhotos(uid: string): Promise<PhotoObject[]>;
  getProfilePhotoPath(uid: string): Promise<string | null>;
  readFirstBytes(name: string): Promise<Uint8Array | undefined>;
  deletePhoto(name: string): Promise<void>;
}

export async function enforcePhotoCap(
  uid: string,
  objectName: string,
  contentType: string | undefined,
  store: PhotoCapStore,
): Promise<void> {
  if (contentType !== 'image/jpeg') {
    await store.deletePhoto(objectName);
    return;
  }
  const signature = await store.readFirstBytes(objectName);
  if (signature && !JPEG_SIGNATURE.every((byte, index) => signature[index] === byte)) {
    await store.deletePhoto(objectName);
    return;
  }

  const [photos, referencedPath] = await Promise.all([store.listPhotos(uid), store.getProfilePhotoPath(uid)]);
  if (photos.length <= MAX_PROFILE_PHOTOS) return;
  const deletable = photos
    .filter(({ name }) => name !== referencedPath)
    .sort((first, second) => first.createdAt - second.createdAt || first.name.localeCompare(second.name));
  let remaining = photos.length;
  for (const photo of deletable) {
    if (remaining <= MAX_PROFILE_PHOTOS) break;
    await store.deletePhoto(photo.name);
    remaining -= 1;
  }
}

export class FirebasePhotoCapStore implements PhotoCapStore {
  constructor(private readonly firestore: FirebaseFirestore.Firestore, private readonly bucket: Bucket) {}

  async listPhotos(uid: string): Promise<PhotoObject[]> {
    const [files] = await this.bucket.getFiles({ prefix: `photos/${uid}/` });
    return files.map((file) => ({
      name: file.name,
      createdAt: Date.parse(file.metadata.timeCreated ?? '') || 0,
      contentType: file.metadata.contentType,
    }));
  }

  async getProfilePhotoPath(uid: string): Promise<string | null> {
    const profile = await this.firestore.doc(`profiles/${uid}`).get();
    const path = profile.get('photoPath');
    return typeof path === 'string' ? path : null;
  }

  async readFirstBytes(name: string): Promise<Uint8Array | undefined> {
    try {
      const stream = this.bucket.file(name).createReadStream({ start: 0, end: 2 });
      const parts: Buffer[] = [];
      for await (const part of stream) parts.push(Buffer.isBuffer(part) ? part : Buffer.from(part));
      return Buffer.concat(parts);
    } catch {
      // A storage backend without ranged-read support still enforces contentType and cap.
      return undefined;
    }
  }

  async deletePhoto(name: string): Promise<void> {
    try {
      await this.bucket.file(name).delete();
    } catch (error) {
      if ((error as { code?: number }).code !== 404) throw error;
    }
  }
}
