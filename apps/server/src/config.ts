export type ServerConfig = {
  port: number;
  databaseUrl: string;
  redisUrl: string;
  jwtIssuer: string;
  jwtAudience: string;
  jwtPluginSecret: string;
  localDevAuthEnabled: boolean;
  allowedWebOrigins: string[];
  production: boolean;
};

export function readConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const production = env.NODE_ENV === 'production';
  const rawPort = Number.parseInt(env.PORT ?? '3410', 10);
  const port = Number.isFinite(rawPort) && rawPort > 0 ? rawPort : 3410;

  const originsRaw =
    env.WEB_ALLOWED_ORIGINS ??
    (production ? '' : 'http://localhost:8081,http://127.0.0.1:8081,http://localhost:3510');

  return {
    port,
    databaseUrl:
      env.DATABASE_URL ??
      'postgres://comradia_local:comradia_local_password@localhost:15442/comradia_server_local',
    redisUrl: env.REDIS_URL ?? 'redis://localhost:16389',
    jwtIssuer: env.JWT_ISSUER ?? 'comradia-local',
    jwtAudience: env.JWT_AUDIENCE ?? 'comradia-mobile',
    jwtPluginSecret: env.JWT_PLUGIN_SECRET ?? 'comradia-local-jwt-plugin-secret',
    localDevAuthEnabled: env.LOCAL_DEV_AUTH_ENABLED !== 'false' && !production,
    allowedWebOrigins: originsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    production,
  };
}
