import { describe, expect, it } from 'bun:test';

import { createApp } from '../src/app';
import { BASE_URL, readJson } from './helpers';

type HealthBody = {
  status: string;
  service: string;
  runtime: { bunVersion: string };
};

describe('GET /health', () => {
  it('reports ok, the service name and the running Bun version', async () => {
    const app = createApp();
    const response = await app.handle(new Request(`${BASE_URL}/health`));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await readJson<HealthBody>(response)).toEqual({
      status: 'ok',
      service: 'comradia-server',
      runtime: { bunVersion: Bun.version },
    });
  });

  it('answers HEAD without a body', async () => {
    const app = createApp();
    const response = await app.handle(new Request(`${BASE_URL}/health`, { method: 'HEAD' }));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
  });

  it('is served per app instance', async () => {
    const first = await createApp().handle(new Request(`${BASE_URL}/health`));
    const second = await createApp().handle(new Request(`${BASE_URL}/health`));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });
});

describe('unknown routes', () => {
  it('returns 404 NOT_FOUND for an unregistered path', async () => {
    const app = createApp();
    const response = await app.handle(new Request(`${BASE_URL}/does-not-exist`));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('NOT_FOUND');
  });

  it('returns 404 for the bare root path', async () => {
    const app = createApp();
    const response = await app.handle(new Request(`${BASE_URL}/`));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('NOT_FOUND');
  });

  it('serves a known path with a trailing slash (lenient routing)', async () => {
    const app = createApp();
    const response = await app.handle(new Request(`${BASE_URL}/health/`));

    expect(response.status).toBe(200);
    expect(await readJson<HealthBody>(response)).toMatchObject({ status: 'ok', service: 'comradia-server' });
  });

  it('returns 404 (not 405) for a known path with the wrong method', async () => {
    const app = createApp();
    const cases = [
      new Request(`${BASE_URL}/health`, { method: 'POST' }),
      new Request(`${BASE_URL}/health`, { method: 'DELETE' }),
      new Request(`${BASE_URL}/discovery/feed`, { method: 'PUT' }),
      new Request(`${BASE_URL}/discovery/swipe`),
      new Request(`${BASE_URL}/early-access`),
    ];

    for (const request of cases) {
      const response = await app.handle(request);
      expect(response.status).toBe(404);
      expect(await response.text()).toBe('NOT_FOUND');
    }
  });
});
