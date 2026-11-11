import { describe, expect, it } from 'bun:test';

import { createApp } from '../src/app';
import { BASE_URL, jsonRequest, readJson } from './helpers';

type EarlyAccessBody = { ok: true; email: string; count: number };
type EarlyAccessError = { error: { code: string; message: string } };
type ValidationBody = { type: string; property: string };

async function signup(body: unknown): Promise<{ status: number; body: unknown }> {
  const app = createApp();
  const response = await app.handle(jsonRequest('/early-access', body, { method: 'POST' }));
  return { status: response.status, body: await response.json() };
}

describe('POST /early-access', () => {
  it('creates a signup and returns 201 with the normalised email and count', async () => {
    const app = createApp();
    const response = await app.handle(
      jsonRequest(
        '/early-access',
        { email: '  Maya@Example.COM ', city: 'São Paulo', tendency: 'Eco-Socialist' },
        { method: 'POST' },
      ),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await readJson<EarlyAccessBody>(response)).toEqual({
      ok: true,
      email: 'maya@example.com',
      count: 1,
    });
  });

  it('counts each distinct email once', async () => {
    const app = createApp();
    const first = await app.handle(
      jsonRequest('/early-access', { email: 'one@example.com' }, { method: 'POST' }),
    );
    const second = await app.handle(
      jsonRequest('/early-access', { email: 'two@example.com' }, { method: 'POST' }),
    );

    expect(await readJson<EarlyAccessBody>(first)).toEqual({
      ok: true,
      email: 'one@example.com',
      count: 1,
    });
    expect(await readJson<EarlyAccessBody>(second)).toEqual({
      ok: true,
      email: 'two@example.com',
      count: 2,
    });
  });

  it('treats a repeat signup as success without inflating the count', async () => {
    const app = createApp();
    await app.handle(
      jsonRequest('/early-access', { email: 'maya@example.com' }, { method: 'POST' }),
    );
    const duplicate = await app.handle(
      jsonRequest('/early-access', { email: ' MAYA@example.com ' }, { method: 'POST' }),
    );

    expect(duplicate.status).toBe(201);
    expect(await readJson<EarlyAccessBody>(duplicate)).toEqual({
      ok: true,
      email: 'maya@example.com',
      count: 1,
    });
  });

  it('ignores unknown extra body fields', async () => {
    const { status, body } = await signup({
      email: 'extra@example.com',
      plan: 'premium',
      nested: { anything: true },
    });

    expect(status).toBe(201);
    expect(body).toEqual({ ok: true, email: 'extra@example.com', count: 1 });
  });

  it('starts each app instance with an empty waitlist', async () => {
    const app = createApp();
    await app.handle(
      jsonRequest('/early-access', { email: 'first@example.com' }, { method: 'POST' }),
    );

    const fresh = await createApp().handle(
      jsonRequest('/early-access', { email: 'first@example.com' }, { method: 'POST' }),
    );

    expect((await readJson<EarlyAccessBody>(fresh)).count).toBe(1);
  });
});

describe('POST /early-access email validation', () => {
  const invalidEmails = [
    '',
    '   ',
    'nope',
    'a@b',
    'a@b.',
    '@example.com',
    'user@',
    'user@@example.com',
    'two words@example.com',
    'user@exa mple.com',
  ];

  for (const email of invalidEmails) {
    it(`rejects ${JSON.stringify(email)} with a 400 invalid_email error`, async () => {
      const { status, body } = await signup({ email });

      expect(status).toBe(400);
      expect(body).toEqual({
        error: { code: 'invalid_email', message: 'Valid email is required.' },
      } satisfies EarlyAccessError);
    });
  }

  it('accepts plus-addressing and subdomains', async () => {
    for (const email of ['user+tag@example.co', 'a@mail.example.com', 'x_y@example.io']) {
      const { status } = await signup({ email });
      expect(status).toBe(201);
    }
  });

  it('does not count rejected emails', async () => {
    const app = createApp();
    await app.handle(jsonRequest('/early-access', { email: 'bad' }, { method: 'POST' }));
    const valid = await app.handle(
      jsonRequest('/early-access', { email: 'good@example.com' }, { method: 'POST' }),
    );

    expect((await readJson<EarlyAccessBody>(valid)).count).toBe(1);
  });
});

describe('POST /early-access request validation', () => {
  it('rejects a missing email with 422', async () => {
    const { status, body } = await signup({ city: 'São Paulo' });

    expect(status).toBe(422);
    expect(body).toMatchObject({ type: 'validation', on: 'body', property: '/email' });
  });

  it('rejects a non-string email with 422', async () => {
    for (const email of [5, null, ['a@b.co'], { value: 'a@b.co' }]) {
      const { status, body } = await signup({ email });
      expect(status).toBe(422);
      expect((body as ValidationBody).type).toBe('validation');
      expect((body as ValidationBody).property).toBe('/email');
    }
  });

  it('rejects a null body with 422', async () => {
    const app = createApp();
    const response = await app.handle(
      jsonRequest('/early-access', null, { method: 'POST' }),
    );

    expect(response.status).toBe(422);
    expect((await readJson<ValidationBody>(response)).property).toBe('root');
  });

  it('does not answer GET on the same path', async () => {
    const app = createApp();
    const response = await app.handle(new Request(`${BASE_URL}/early-access`));

    expect(response.status).toBe(404);
  });
});
