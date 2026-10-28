import crypto from 'crypto';

// Blueprint app configuration.
//
// Every value here is either Blueprint-specific or shared-but-generic (PORT,
// CORS_ORIGIN, COOKIE_DOMAIN, NODE_ENV). The app deliberately has its own
// secret, database file and cookie name so it can run side by side with the
// monolith, audit-app, pipeline-app and qa-app without any cross-talk.
export const config = {
  // Port for the Blueprint API + (in production) static frontend serving.
  // Vite dev server proxies /api here from 3107.
  port: parseInt(process.env.PORT || '3106', 10),
  // Fallback secret is generated at process start (never persisted). In
  // production set BLUEPRINT_JWT_SECRET so sessions survive restarts.
  jwtSecret: process.env.BLUEPRINT_JWT_SECRET || crypto.randomBytes(64).toString('hex'),
  // Session TTL in seconds (jsonwebtoken's numeric expiresIn). 7 days.
  jwtExpiresIn: 7 * 24 * 60 * 60,
  // Separate database file from the monolith and from the other standalone apps.
  dbPath: process.env.BLUEPRINT_DB_PATH || './server/data/blueprint.sqlite',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3107',
  nodeEnv: process.env.NODE_ENV || 'development',
  // Distinct cookie name so this app's session never collides with the
  // monolith's "token" cookie, audit-app's "audit_token", pipeline-app's
  // "pipeline_token" or qa-app's "qa_token" when they share a host.
  cookieName: process.env.COOKIE_NAME || 'blueprint_token',
  // Optional cookie domain. Left unset by default so the session cookie is
  // scoped to the exact host — which stays domain-agnostic across localhost and
  // the future `blueprint.<domain>` subdomain. Set COOKIE_DOMAIN only to share
  // the cookie across subdomains if that ever becomes necessary.
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  // Public base URL of this app (e.g. https://blueprint.nuriaai.com). Used to
  // build absolute links for verification / password-reset emails. When unset,
  // links fall back to the request's own origin so local and preview
  // environments always produce a working link.
  publicBaseUrl: process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '',
  // How long a password-reset token remains valid (1 hour).
  passwordResetTtlMs: 60 * 60 * 1000,
  // Resend is the mail provider (owner decision 2026-10-25): the same integration
  // and the same RESEND_API_KEY env var the monolith uses. Without a key the
  // service logs the would-be email instead of sending, so every auth flow stays
  // exercisable in dev/test.
  resendApiKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || 'Nuria AI <noreply@firstcreationmedia.com>',
  // Blueprint requires a verified email before login (mirrors the monolith).
  // Set BLUEPRINT_REQUIRE_VERIFICATION=false to bypass in local experiments.
  requireEmailVerification: process.env.BLUEPRINT_REQUIRE_VERIFICATION !== 'false',
  // Free tier allowance (projects per lifetime) — enforced from Phase 2 on by
  // projectLimit middleware; recorded here so the value lives in one place.
  freeTierProjectLimit: 1,
};

export const isProd = config.nodeEnv === 'production';

/** True when a Resend API key is present (i.e. real email delivery is possible). */
export function isEmailConfigured(): boolean {
  return config.resendApiKey.trim().length > 0;
}
