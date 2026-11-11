import { describe, expect, it } from 'bun:test';

import { createApp } from '../src/app';
import { BASE_URL, jsonRequest, readJson } from './helpers';

/**
 * Registered route table, CORS preflights included. This is a tripwire: when an
 * authenticated route is added it must show up here, forcing auth rejection
 * tests alongside it. There is no protected route today.
 */
const EXPECTED_ROUTES = [
  'GET /discovery/feed',
  'GET /health',
  'OPTIONS /',
  'OPTIONS /*',
  'POST /discovery/swipe',
  'POST /early-access',
];

type JwtLike = {
  sign: (payload: Record<string, unknown>) => Promise<string>;
  verify: (token: string) => Promise<unknown>;
};

function jwtDecorator(app: ReturnType<typeof createApp>): JwtLike {
  const decorator = (app.decorator as unknown as { jwt?: JwtLike }).jwt;
  if (!decorator) throw new Error('jwt decorator is not registered');
  return decorator;
}

describe('route table', () => {
  it('exposes exactly the expected routes and no auth-guarded endpoint yet', () => {
    const app = createApp();
    const routes = app.routes
      .map((route) => `${route.method} ${route.path}`)
      .sort();

    expect(routes).toEqual(EXPECTED_ROUTES);
  });
});

describe('JWT plugin wiring', () => {
  it('signs and verifies a token with the configured secret', async () => {
    const app = createApp();
    const jwt = jwtDecorator(app);

    const token = await jwt.sign({ sub: 'user-1', issuer: 'comradia-local' });
    const payload = await jwt.verify(token);

    expect(typeof token).toBe('string');
    expect(payload).not.toBe(false);
    expect((payload as { sub?: string }).sub).toBe('user-1');
  });

  it('rejects a token signed with a different secret', async () => {
    const issuer = jwtDecorator(createApp());
    const verifier = jwtDecorator(createApp({ jwtPluginSecret: 'another-secret' }));

    const token = await issuer.sign({ sub: 'user-1' });

    expect(await verifier.verify(token)).toBe(false);
  });

  it('rejects a malformed token', async () => {
    const jwt = jwtDecorator(createApp());

    expect(await jwt.verify('not-a-jwt')).toBe(false);
  });
});

describe('bearer handling on public routes', () => {
  it('serves public routes without a bearer token', async () => {
    const app = createApp();
    const response = await app.handle(new Request(`${BASE_URL}/discovery/feed`));

    expect(response.status).toBe(200);
  });

  it('does not gate public routes on a junk bearer token', async () => {
    const app = createApp();
    const response = await app.handle(
      new Request(`${BASE_URL}/discovery/feed`, {
        headers: { authorization: 'Bearer obviously-not-a-jwt' },
      }),
    );

    expect(response.status).toBe(200);
    expect((await readJson<{ candidates: unknown[] }>(response)).candidates.length).toBe(3);
  });

  it('does not gate public POST routes on a junk bearer token', async () => {
    const app = createApp();
    const response = await app.handle(
      jsonRequest(
        '/discovery/swipe',
        { targetId: 'comrade-maya', direction: 'pass' },
        { method: 'POST', headers: { authorization: 'Bearer junk' } },
      ),
    );

    expect(response.status).toBe(200);
  });
});
