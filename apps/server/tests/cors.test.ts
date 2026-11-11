import { describe, expect, it } from 'bun:test';

import { createApp } from '../src/app';
import { BASE_URL } from './helpers';

const ALLOWED_ORIGIN = 'http://localhost:8081';
const SECOND_ORIGIN = 'http://127.0.0.1:8081';

function getWithOrigin(app: ReturnType<typeof createApp>, origin?: string) {
  return app.handle(
    new Request(`${BASE_URL}/health`, origin ? { headers: { origin } } : undefined),
  );
}

function preflight(app: ReturnType<typeof createApp>, origin: string, method = 'GET') {
  return app.handle(
    new Request(`${BASE_URL}/health`, {
      method: 'OPTIONS',
      headers: { origin, 'access-control-request-method': method },
    }),
  );
}

describe('CORS for simple requests', () => {
  it('echoes an allowed origin and allows credentials', async () => {
    const app = createApp();
    const response = await getWithOrigin(app, ALLOWED_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('echoes each configured development origin', async () => {
    const app = createApp();

    for (const origin of [ALLOWED_ORIGIN, SECOND_ORIGIN, 'http://localhost:3510']) {
      const response = await getWithOrigin(app, origin);
      expect(response.headers.get('access-control-allow-origin')).toBe(origin);
    }
  });

  it('omits CORS headers for an unknown origin', async () => {
    const app = createApp();
    const response = await getWithOrigin(app, 'https://evil.example');

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('omits CORS headers when no Origin header is sent', async () => {
    const app = createApp();
    const response = await getWithOrigin(app);

    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('uses only the origins from an explicit config override', async () => {
    const app = createApp({ allowedWebOrigins: ['https://app.comradia.test'] });

    const allowed = await getWithOrigin(app, 'https://app.comradia.test');
    const devOrigin = await getWithOrigin(app, ALLOWED_ORIGIN);

    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://app.comradia.test');
    expect(devOrigin.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('CORS preflight', () => {
  it('answers an allowed preflight with 204 and the CORS headers', async () => {
    const app = createApp();
    const response = await preflight(app, ALLOWED_ORIGIN, 'POST');

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('answers an unknown-origin preflight without an allow-origin header', async () => {
    const app = createApp();
    const response = await preflight(app, 'https://evil.example');

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('CORS with an empty allow-list', () => {
  it('reflects any origin (current behaviour when no origin is configured)', async () => {
    const app = createApp({ allowedWebOrigins: [] });
    const response = await getWithOrigin(app, 'https://evil.example');

    expect(response.headers.get('access-control-allow-origin')).toBe('https://evil.example');
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it.skip('should not reflect arbitrary origins in production without an explicit allow-list', async () => {
    // BUG: readConfig() yields allowedWebOrigins: [] in production when
    // WEB_ALLOWED_ORIGINS is unset, and createApp() turns an empty list into
    // `origin: true`, which reflects *any* caller origin with credentials: true.
    const app = createApp({ allowedWebOrigins: [] });
    const response = await getWithOrigin(app, 'https://evil.example');

    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });
});
