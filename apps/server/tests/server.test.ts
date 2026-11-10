import { describe, expect, it } from 'bun:test';

import { createApp } from '../src/app';
import { readConfig } from '../src/config';

describe('comradia-server', () => {
  it('returns ok from /health with the current Bun version', async () => {
    const app = createApp();
    const response = await app.handle(new Request('http://localhost/health'));
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      status: string;
      service: string;
      runtime: { bunVersion: string };
    };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('comradia-server');
    expect(body.runtime.bunVersion).toBe(Bun.version);
  });

  it('serves discovery candidates and records solidarity swipes', async () => {
    const app = createApp();
    const initialFeedRes = await app.handle(new Request('http://localhost/discovery/feed'));
    expect(initialFeedRes.status).toBe(200);
    const initialFeed = (await initialFeedRes.json()) as { candidates: { id: string }[] };
    expect(initialFeed.candidates.length).toBe(3);

    const firstId = initialFeed.candidates[0]!.id;
    const swipeRes = await app.handle(
      new Request('http://localhost/discovery/swipe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetId: firstId, direction: 'solidarity' }),
      })
    );
    expect(swipeRes.status).toBe(200);
    const swipeBody = (await swipeRes.json()) as { ok: boolean; matched: boolean };
    expect(swipeBody.ok).toBe(true);
    expect(swipeBody.matched).toBe(true);

    const nextFeedRes = await app.handle(new Request('http://localhost/discovery/feed'));
    const nextFeed = (await nextFeedRes.json()) as { candidates: { id: string }[] };
    expect(nextFeed.candidates.length).toBe(2);
  });

  it('reads default local configuration cleanly', () => {
    const cfg = readConfig({});
    expect(cfg.port).toBe(3410);
    expect(cfg.jwtIssuer).toBe('comradia-local');
  });
});
