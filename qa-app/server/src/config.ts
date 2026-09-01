import crypto from 'crypto';

export const config = {
  // Port for the QA Assistant API + (in production) static frontend serving.
  port: parseInt(process.env.PORT || '3101', 10),
  // Fallback secret is generated at process start (never persisted). In
  // production set QA_JWT_SECRET so sessions survive restarts.
  jwtSecret: process.env.QA_JWT_SECRET || crypto.randomBytes(64).toString('hex'),
  // Session TTL in seconds (jsonwebtoken's numeric expiresIn). 7 days.
  jwtExpiresIn: 7 * 24 * 60 * 60,
  // Separate database file from the Blueprint/Audit/Pipeline app.
  dbPath: process.env.QA_DB_PATH || './server/data/qa.sqlite',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3100',
  nodeEnv: process.env.NODE_ENV || 'development',
  // Distinct cookie name so this app's session never collides with the
  // Blueprint app's "token" cookie when both run on localhost.
  cookieName: process.env.COOKIE_NAME || 'qa_token',
  // How long a password-reset token remains valid.
  passwordResetTtlMs: 60 * 60 * 1000, // 1 hour
};

export const isProd = config.nodeEnv === 'production';
