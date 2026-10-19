export interface BffConfig {
  port: number;
  publicOrigin: string;
  /** True when the BFF is reached over plain http://localhost (dev); see `session.ts`. */
  insecureLocalhost: boolean;
  trustProxy: string | false;
  oidc: {
    issuer: string;
    clientId: string;
    clientSecret: string;
  };
  session: {
    secret: string;
    idleMs: number;
    absoluteMs: number;
  };
  authRateLimitPerMinute: number;
  apiUpstreamUrl: string;
  shellDevUrl?: string;
  production: boolean;
}

type Env = Record<string, string | undefined>;

function required(env: Env, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function positiveNumber(env: Env, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Environment variable ${name} must be a positive number`);
  }
  return value;
}

/** Reads and validates configuration once at startup. Secret values are never logged. */
export function loadConfig(env: Env = process.env): BffConfig {
  const publicOrigin = new URL(required(env, 'PUBLIC_ORIGIN')).origin;
  const sessionSecret = required(env, 'SESSION_SECRET');
  if (sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters');
  }
  const url = new URL(publicOrigin);
  return {
    port: positiveNumber(env, 'BFF_PORT', 4000),
    publicOrigin,
    insecureLocalhost: url.protocol === 'http:' && url.hostname === 'localhost',
    trustProxy: env['TRUST_PROXY'] || false,
    oidc: {
      issuer: required(env, 'OIDC_ISSUER'),
      clientId: required(env, 'OIDC_CLIENT_ID'),
      clientSecret: required(env, 'OIDC_CLIENT_SECRET'),
    },
    session: {
      secret: sessionSecret,
      idleMs: positiveNumber(env, 'SESSION_IDLE_MINUTES', 30) * 60_000,
      absoluteMs: positiveNumber(env, 'SESSION_ABSOLUTE_HOURS', 8) * 3_600_000,
    },
    authRateLimitPerMinute: positiveNumber(
      env,
      'AUTH_RATE_LIMIT_PER_MINUTE',
      60,
    ),
    apiUpstreamUrl: required(env, 'API_UPSTREAM_URL'),
    shellDevUrl: env['SHELL_DEV_URL'] || undefined,
    production: env['NODE_ENV'] === 'production',
  };
}
