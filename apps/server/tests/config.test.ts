import { describe, expect, it } from 'bun:test';

import { readConfig } from '../src/config';

const DEV_ORIGINS = [
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:3510',
];

const DEFAULT_DATABASE_URL =
  'postgres://comradia_local:comradia_local_password@localhost:15442/comradia_server_local';

describe('readConfig defaults', () => {
  it('returns the full local development configuration for an empty environment', () => {
    expect(readConfig({})).toEqual({
      port: 3410,
      databaseUrl: DEFAULT_DATABASE_URL,
      redisUrl: 'redis://localhost:16389',
      jwtIssuer: 'comradia-local',
      jwtAudience: 'comradia-mobile',
      jwtPluginSecret: 'comradia-local-jwt-plugin-secret',
      localDevAuthEnabled: true,
      allowedWebOrigins: DEV_ORIGINS,
      production: false,
    });
  });

  it('ignores ambient process.env when given an explicit environment object', () => {
    expect(readConfig({}).port).toBe(3410);
    expect(readConfig({}).production).toBe(false);
  });

  it('reads ambient process.env when called with no argument', () => {
    const config = readConfig();

    expect(typeof config.port).toBe('number');
    expect(config.port).toBeGreaterThan(0);
    expect(Array.isArray(config.allowedWebOrigins)).toBe(true);
    expect(typeof config.databaseUrl).toBe('string');
  });
});

describe('readConfig PORT parsing', () => {
  it('accepts positive integer ports', () => {
    expect(readConfig({ PORT: '8080' }).port).toBe(8080);
    expect(readConfig({ PORT: ' 21 ' }).port).toBe(21);
    expect(readConfig({ PORT: '65535' }).port).toBe(65535);
    expect(readConfig({ PORT: '3410' }).port).toBe(3410);
  });

  it('falls back to 3410 for missing, blank, negative, zero or non-numeric ports', () => {
    for (const raw of [undefined, '', 'abc', '0', '-1', '0x1f', 'NaN', 'Infinity']) {
      expect(readConfig(raw === undefined ? {} : { PORT: raw }).port).toBe(3410);
    }
  });

  it('truncates trailing garbage like Number.parseInt does', () => {
    expect(readConfig({ PORT: '8080.9' }).port).toBe(8080);
    expect(readConfig({ PORT: '8080abc' }).port).toBe(8080);
  });
});

describe('readConfig production mode', () => {
  it('turns production on for NODE_ENV=production and disables local dev auth', () => {
    const config = readConfig({ NODE_ENV: 'production' });

    expect(config.production).toBe(true);
    expect(config.localDevAuthEnabled).toBe(false);
    expect(config.allowedWebOrigins).toEqual([]);
  });

  it('keeps dev origins outside production and only matches NODE_ENV exactly', () => {
    expect(readConfig({ NODE_ENV: 'development' }).production).toBe(false);
    expect(readConfig({ NODE_ENV: 'staging' }).allowedWebOrigins).toEqual(DEV_ORIGINS);
    expect(readConfig({ NODE_ENV: 'PRODUCTION' }).production).toBe(false);
  });

  it('honours WEB_ALLOWED_ORIGINS in production', () => {
    const config = readConfig({
      NODE_ENV: 'production',
      WEB_ALLOWED_ORIGINS: 'https://comradia.test',
    });

    expect(config.allowedWebOrigins).toEqual(['https://comradia.test']);
    expect(config.localDevAuthEnabled).toBe(false);
  });
});

describe('readConfig local dev auth flag', () => {
  it('is enabled by default and disabled only by the literal "false"', () => {
    expect(readConfig({}).localDevAuthEnabled).toBe(true);
    expect(readConfig({ LOCAL_DEV_AUTH_ENABLED: 'true' }).localDevAuthEnabled).toBe(true);
    expect(readConfig({ LOCAL_DEV_AUTH_ENABLED: 'FALSE' }).localDevAuthEnabled).toBe(true);
    expect(readConfig({ LOCAL_DEV_AUTH_ENABLED: '0' }).localDevAuthEnabled).toBe(true);
    expect(readConfig({ LOCAL_DEV_AUTH_ENABLED: 'false' }).localDevAuthEnabled).toBe(false);
  });

  it('cannot be enabled in production', () => {
    const config = readConfig({
      NODE_ENV: 'production',
      LOCAL_DEV_AUTH_ENABLED: 'true',
    });

    expect(config.localDevAuthEnabled).toBe(false);
  });
});

describe('readConfig allowed web origins', () => {
  it('splits, trims and drops empty origin entries', () => {
    const config = readConfig({
      WEB_ALLOWED_ORIGINS: ' http://a.test , ,https://b.test,  ',
    });

    expect(config.allowedWebOrigins).toEqual(['http://a.test', 'https://b.test']);
  });

  it('accepts an explicit empty list', () => {
    expect(readConfig({ WEB_ALLOWED_ORIGINS: '' }).allowedWebOrigins).toEqual([]);
    expect(readConfig({ WEB_ALLOWED_ORIGINS: ' , ' }).allowedWebOrigins).toEqual([]);
  });

  it('keeps a single origin as a one-element list', () => {
    expect(readConfig({ WEB_ALLOWED_ORIGINS: 'https://one.test' }).allowedWebOrigins).toEqual([
      'https://one.test',
    ]);
  });
});

describe('readConfig explicit overrides', () => {
  it('uses every provided environment value verbatim', () => {
    const config = readConfig({
      PORT: '9000',
      DATABASE_URL: 'postgres://user:pass@db:5432/app',
      REDIS_URL: 'redis://cache:6379',
      JWT_ISSUER: 'issuer.test',
      JWT_AUDIENCE: 'audience.test',
      JWT_PLUGIN_SECRET: 'super-secret',
      WEB_ALLOWED_ORIGINS: 'https://app.test',
    });

    expect(config).toEqual({
      port: 9000,
      databaseUrl: 'postgres://user:pass@db:5432/app',
      redisUrl: 'redis://cache:6379',
      jwtIssuer: 'issuer.test',
      jwtAudience: 'audience.test',
      jwtPluginSecret: 'super-secret',
      localDevAuthEnabled: true,
      allowedWebOrigins: ['https://app.test'],
      production: false,
    });
  });

  it('does not mutate the environment object it is given', () => {
    const env: Record<string, string | undefined> = { PORT: '1234' };

    readConfig(env);

    expect(env).toEqual({ PORT: '1234' });
  });
});
