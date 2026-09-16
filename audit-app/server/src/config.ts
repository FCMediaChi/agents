import crypto from 'crypto';

export const config = {
  // Port for the Audit API + (in production) static frontend serving.
  port: parseInt(process.env.PORT || '3102', 10),
  // Fallback secret is generated at process start (never persisted). In
  // production set AUDIT_JWT_SECRET so sessions survive restarts.
  jwtSecret: process.env.AUDIT_JWT_SECRET || crypto.randomBytes(64).toString('hex'),
  // Session TTL in seconds (jsonwebtoken's numeric expiresIn). 7 days.
  jwtExpiresIn: 7 * 24 * 60 * 60,
  // Separate database file from the monolith and from the other standalone apps.
  dbPath: process.env.AUDIT_DB_PATH || './server/data/audit.sqlite',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3103',
  nodeEnv: process.env.NODE_ENV || 'development',
  // Distinct cookie name so this app's session never collides with the
  // monolith's "token" cookie (or qa-app's "qa_token") when they share localhost.
  cookieName: process.env.COOKIE_NAME || 'audit_token',
  // How long a password-reset token remains valid.
  passwordResetTtlMs: 60 * 60 * 1000, // 1 hour
};

export const isProd = config.nodeEnv === 'production';
