// Seeds the Firestore emulator with Discover profiles. Emulator only: the `owner` token
// bypasses security rules and is rejected by real Firebase.
//   node scripts/seed.mjs            (FIRESTORE_EMULATOR_HOST defaults to 127.0.0.1:8089)
//   node scripts/seed.mjs --clear    (wipe the emulator first)
const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8089';
const project = process.env.GCLOUD_PROJECT || 'demo-comradia';
const base = `http://${host}/v1/projects/${project}/databases/(default)/documents`;

export const SEED_PROFILES = {
  'seed-maya': {
    displayName: 'Maya', age: 28, vibe: 'outdoorsy', lookingFor: 'everyone', unionMember: true,
    union: 'apeoesp', values: ['climate_outdoors', 'public_transit', 'tenant_rights'],
    promptId: 'perfect_sunday',
    promptAnswer: 'Community garden at sunrise, then a long lunch that turns into dinner.',
  },
  'seed-lucas': {
    displayName: 'Lucas', age: 31, vibe: 'bookworm', lookingFor: 'women', unionMember: true,
    union: 'seesp', values: ['bookshops_coffee', 'indie_film_music', 'cycling'],
    promptId: 'hill_to_die_on', promptAnswer: 'Public libraries are the best thing a city does.',
  },
  'seed-val': {
    displayName: 'Val', age: 26, vibe: 'creative', lookingFor: 'everyone', unionMember: false,
    union: null, values: ['volunteering', 'community_gardens', 'pets_parks', 'food_markets'],
    promptId: 'together_we_could', promptAnswer: 'Run a bike-to-work convoy and keep it going past February.',
  },
};

function toValue(v) {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Number.isInteger(v)) return { integerValue: String(v) };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  throw new Error(`Unsupported seed value: ${v}`);
}

async function request(url, init) {
  const res = await fetch(url, { ...init, headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error(`${init.method} ${url} → ${res.status} ${await res.text()}`);
}

export async function seed({ clear = false } = {}) {
  if (clear) await request(`http://${host}/emulator/v1/projects/${project}/databases/(default)/documents`, { method: 'DELETE' });
  const now = { timestampValue: new Date().toISOString() };
  for (const [id, profile] of Object.entries(SEED_PROFILES)) {
    const fields = Object.fromEntries(Object.entries(profile).map(([k, v]) => [k, toValue(v)]));
    await request(`${base}/profiles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields: { ...fields, createdAt: now, updatedAt: now } }),
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await seed({ clear: process.argv.includes('--clear') });
  console.log(`Seeded ${Object.keys(SEED_PROFILES).length} profiles into ${host}`);
}
