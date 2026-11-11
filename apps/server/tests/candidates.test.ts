import { describe, expect, it } from 'bun:test';

import { createApp } from '../src/app';
import { BASE_URL, jsonRequest, rawRequest, readJson } from './helpers';

type CandidateProfile = {
  id: string;
  displayName: string;
  age: number;
  pronouns: string;
  city: string;
  tendency: string;
  causes: string[];
  bio: string;
  praxisPrompt: string;
  unionMember: boolean;
};

type FeedBody = { candidates: CandidateProfile[] };

type SwipeBody = {
  ok: boolean;
  targetId: string;
  direction: 'solidarity' | 'pass';
  matched: boolean;
};

type ValidationBody = {
  type: string;
  on: string;
  property: string;
  message: string;
  summary: string;
  errors: { message: string; summary: string }[];
};

const MAYA: CandidateProfile = {
  id: 'comrade-maya',
  displayName: 'Maya',
  age: 28,
  pronouns: 'she/her',
  city: 'São Paulo',
  tendency: 'Eco-Socialist',
  causes: ['Climate Justice', 'Transit For All', 'Tenant Union'],
  bio: 'Urban planner by day, community garden organizer by weekend. Looking for someone to bike with and debate degrowth over espresso.',
  praxisPrompt: 'Ideal first date: solidarity kitchen prep then live samba at a cooperative bar.',
  unionMember: true,
};

async function feedIds(app: ReturnType<typeof createApp>): Promise<string[]> {
  const response = await app.handle(new Request(`${BASE_URL}/discovery/feed`));
  const body = await readJson<FeedBody>(response);
  return body.candidates.map((candidate) => candidate.id);
}

async function swipe(
  app: ReturnType<typeof createApp>,
  body: unknown,
): Promise<{ status: number; body: unknown }> {
  const response = await app.handle(jsonRequest('/discovery/swipe', body, { method: 'POST' }));
  return { status: response.status, body: await response.json() };
}

describe('GET /discovery/feed', () => {
  it('returns the three seeded candidates with the documented profile shape', async () => {
    const app = createApp();
    const response = await app.handle(new Request(`${BASE_URL}/discovery/feed`));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');

    const body = await readJson<FeedBody>(response);
    expect(body.candidates.map((candidate) => candidate.id)).toEqual([
      'comrade-maya',
      'comrade-lucas',
      'comrade-val',
    ]);
    expect(body.candidates[0]).toEqual(MAYA);
  });

  it('gives every candidate a complete, serialisable profile', async () => {
    const app = createApp();
    const response = await app.handle(new Request(`${BASE_URL}/discovery/feed`));
    const { candidates } = await readJson<FeedBody>(response);

    expect(new Set(candidates.map((candidate) => candidate.id)).size).toBe(candidates.length);
    for (const candidate of candidates) {
      expect(candidate.displayName.length).toBeGreaterThan(0);
      expect(candidate.age).toBeGreaterThanOrEqual(18);
      expect(Array.isArray(candidate.causes)).toBe(true);
      expect(candidate.causes.length).toBeGreaterThan(0);
      expect(typeof candidate.unionMember).toBe('boolean');
      expect(Object.keys(candidate).sort()).toEqual(Object.keys(MAYA).sort());
    }
  });

  it('hides candidates after a solidarity swipe', async () => {
    const app = createApp();
    await swipe(app, { targetId: 'comrade-maya', direction: 'solidarity' });

    expect(await feedIds(app)).toEqual(['comrade-lucas', 'comrade-val']);
  });

  it('hides candidates after a pass swipe', async () => {
    const app = createApp();
    await swipe(app, { targetId: 'comrade-val', direction: 'pass' });

    expect(await feedIds(app)).toEqual(['comrade-maya', 'comrade-lucas']);
  });

  it('keeps each app instance state isolated', async () => {
    const first = createApp();
    await swipe(first, { targetId: 'comrade-maya', direction: 'pass' });

    expect(await feedIds(first)).toEqual(['comrade-lucas', 'comrade-val']);
    expect(await feedIds(createApp())).toEqual(['comrade-maya', 'comrade-lucas', 'comrade-val']);
  });
});

describe('POST /discovery/swipe', () => {
  it('records a solidarity swipe and reports a match', async () => {
    const app = createApp();
    const { status, body } = await swipe(app, {
      targetId: 'comrade-maya',
      direction: 'solidarity',
    });

    expect(status).toBe(200);
    expect(body).toEqual({
      ok: true,
      targetId: 'comrade-maya',
      direction: 'solidarity',
      matched: true,
    });
  });

  it('records a pass swipe without a match', async () => {
    const app = createApp();
    const { status, body } = await swipe(app, { targetId: 'comrade-lucas', direction: 'pass' });

    expect(status).toBe(200);
    expect(body).toEqual({
      ok: true,
      targetId: 'comrade-lucas',
      direction: 'pass',
      matched: false,
    });
  });

  it('accepts a note and still returns the same response shape', async () => {
    const app = createApp();
    const { status, body } = await swipe(app, {
      targetId: 'comrade-maya',
      direction: 'solidarity',
      note: 'Rosa Luxemburg sourdough? Yes please.',
    });

    expect(status).toBe(200);
    expect(body).toEqual({
      ok: true,
      targetId: 'comrade-maya',
      direction: 'solidarity',
      matched: true,
    });
  });

  it('lets the last swipe win without duplicating feed entries', async () => {
    const app = createApp();
    const first = await swipe(app, { targetId: 'comrade-maya', direction: 'solidarity' });
    const second = await swipe(app, { targetId: 'comrade-maya', direction: 'pass' });

    expect((first.body as SwipeBody).matched).toBe(true);
    expect((second.body as SwipeBody).matched).toBe(false);
    expect(await feedIds(app)).toEqual(['comrade-lucas', 'comrade-val']);
  });

  it('accepts a target that is not in the feed (no referential check)', async () => {
    const app = createApp();
    const { status, body } = await swipe(app, {
      targetId: 'comrade-unknown',
      direction: 'solidarity',
    });

    expect(status).toBe(200);
    expect((body as SwipeBody).matched).toBe(true);
    expect(await feedIds(app)).toEqual(['comrade-maya', 'comrade-lucas', 'comrade-val']);
  });

  it('tolerates unknown extra body fields', async () => {
    const app = createApp();
    const { status } = await swipe(app, {
      targetId: 'comrade-maya',
      direction: 'pass',
      unexpected: 'ignored',
    });

    expect(status).toBe(200);
  });
});

describe('POST /discovery/swipe validation', () => {
  const invalidBodies: { label: string; body: unknown; property: string }[] = [
    { label: 'missing every field', body: {}, property: '/direction' },
    {
      label: 'missing targetId',
      body: { direction: 'pass' },
      property: '/targetId',
    },
    { label: 'empty targetId', body: { targetId: '', direction: 'pass' }, property: '/targetId' },
    { label: 'numeric targetId', body: { targetId: 5, direction: 'pass' }, property: '/targetId' },
    {
      label: 'unknown direction',
      body: { targetId: 'comrade-maya', direction: 'nope' },
      property: '/direction',
    },
    {
      label: 'note over 280 chars',
      body: { targetId: 'comrade-maya', direction: 'pass', note: 'x'.repeat(281) },
      property: '/note',
    },
    {
      label: 'note of the wrong type',
      body: { targetId: 'comrade-maya', direction: 'pass', note: 12 },
      property: '/note',
    },
  ];

  for (const { label, body, property } of invalidBodies) {
    it(`rejects ${label} with a 422 validation error`, async () => {
      const app = createApp();
      const response = await app.handle(
        jsonRequest('/discovery/swipe', body, { method: 'POST' }),
      );

      expect(response.status).toBe(422);
      expect(response.headers.get('content-type')).toContain('application/json');

      const error = await readJson<ValidationBody>(response);
      expect(error.type).toBe('validation');
      expect(error.on).toBe('body');
      expect(error.property).toBe(property);
      expect(error.errors.length).toBeGreaterThan(0);
    });
  }

  it('rejects a null body', async () => {
    const app = createApp();
    const response = await app.handle(
      jsonRequest('/discovery/swipe', null, { method: 'POST' }),
    );

    expect(response.status).toBe(422);
    const error = await readJson<ValidationBody>(response);
    expect(error.type).toBe('validation');
    expect(error.property).toBe('root');
  });

  it('rejects a body without a JSON content type', async () => {
    const app = createApp();
    const response = await app.handle(
      rawRequest('/discovery/swipe', JSON.stringify({ targetId: 'comrade-maya' }), {
        method: 'POST',
      }),
    );

    expect(response.status).toBe(422);
    expect((await readJson<ValidationBody>(response)).type).toBe('validation');
  });

  it('rejects malformed JSON with a 400 before validation runs', async () => {
    const app = createApp();
    const response = await app.handle(
      rawRequest('/discovery/swipe', '{"targetId":', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Bad Request');
  });

  it('does not record anything when validation fails', async () => {
    const app = createApp();
    await swipe(app, { targetId: '', direction: 'pass' });
    await swipe(app, { targetId: 'comrade-maya', direction: 'sideways' });

    expect(await feedIds(app)).toEqual(['comrade-maya', 'comrade-lucas', 'comrade-val']);
  });
});
