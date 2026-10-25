import crypto from 'crypto';

export const config = {
  // Port for the Pipeline API + (in production) static frontend serving.
  port: parseInt(process.env.PORT || '3104', 10),
  // Fallback secret is generated at process start (never persisted). In
  // production set PIPELINE_JWT_SECRET so sessions survive restarts.
  jwtSecret: process.env.PIPELINE_JWT_SECRET || crypto.randomBytes(64).toString('hex'),
  // Session TTL in seconds (jsonwebtoken's numeric expiresIn). 7 days.
  jwtExpiresIn: 7 * 24 * 60 * 60,
  // Separate database file from the monolith and from the other standalone apps.
  dbPath: process.env.PIPELINE_DB_PATH || './server/data/pipeline.sqlite',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3105',
  nodeEnv: process.env.NODE_ENV || 'development',
  // Distinct cookie name so this app's session never collides with the
  // monolith's "token" cookie (or audit-app's "audit_token") when they share
  // localhost.
  cookieName: process.env.COOKIE_NAME || 'pipeline_token',
  // Optional cookie domain. Left unset by default so the session cookie is
  // scoped to the exact host — which stays domain-agnostic across localhost and
  // the future `pipeline.<domain>` subdomain. Set COOKIE_DOMAIN only to share the
  // cookie across subdomains if that ever becomes necessary.
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  // Public base URL of this app (e.g. https://pipeline.example.com). Reserved for
  // absolute links (password-reset emails, share links). Not yet consumed by
  // any route; kept configurable so the app is domain-agnostic until cutover.
  publicBaseUrl: process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '',
  // How long a password-reset token remains valid.
  passwordResetTtlMs: 60 * 60 * 1000, // 1 hour
  // Length of the Pipeline free trial (7 days), started on signup.
  trialDurationMs: 7 * 24 * 60 * 60 * 1000,
};

export const isProd = config.nodeEnv === 'production';
