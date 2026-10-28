# Nuria Website Blueprint

An all-in-one website planning tool: sitemaps, page outlines, content questionnaires, wireframes,
and project proposals — turning a rough idea into a deliverable-ready plan.

**Nuria Website Blueprint** is a standalone, full-stack SaaS application. It is a **separate app** from
Nuria Website Audit, Nuria Client Pipeline, and the Design QA Assistant — it has its own accounts,
database, session cookie, and deployment, sharing only the Nuria brand identity.

This repository contains the standalone product apps under their own directories (`audit-app/`,
`pipeline-app/`, `qa-app/`, `blueprint-app/`) plus the original monolith at the root. Each app is
built and deployed independently.

> **Phase 1 status (this PR): standalone scaffold.** Own Express server, own SQLite database with the
> full Blueprint schema, own env vars and cookie, and complete authentication with **email
> verification** and **password reset** wired through the **Resend** mail integration
> (`emailService.ts`, same `RESEND_API_KEY` the monolith uses). Landing page, all auth pages, and an
> empty dashboard shell are in place. Project CRUD, the five builders, and pricing/checkout arrive in
> Phases 2–4 (see `../pipeline-blueprint-split-plan.md`).

## Tech stack

- **Frontend:** Vite + React + TypeScript, Tailwind CSS v4, React Router
- **Backend:** Node.js + Express (ESM, run via `tsx`), Zod validation
- **Database:** SQLite via `sql.js`, persisted to a local file (same approach as the other apps)
- **Auth:** bcrypt password hashing + JWT in an HTTP-only, SameSite=Strict cookie
- **Email:** Resend (`RESEND_API_KEY`), with a console + file fallback when no key is set

## Ports and identifiers (deliberately distinct from every sibling app)

| | Blueprint | Monolith | Audit | Pipeline | QA |
| --- | --- | --- | --- | --- | --- |
| API port | **3106** | 3001 | 3102 | 3104 | 3100 |
| Vite dev port | **3107** | 3000 | 3103 | 3105 | 3101 |
| Cookie | **`blueprint_token`** | `token` | `audit_token` | `pipeline_token` | `qa_token` |
| DB file | **`blueprint.sqlite`** | `theblueprint.db` | `audit.sqlite` | `pipeline.sqlite` | `qa.sqlite` |
| JWT secret env | **`BLUEPRINT_JWT_SECRET`** | `JWT_SECRET` | `AUDIT_JWT_SECRET` | `PIPELINE_JWT_SECRET` | `QA_JWT_SECRET` |
| DB path env | **`BLUEPRINT_DB_PATH`** | `DB_PATH` | `AUDIT_DB_PATH` | `PIPELINE_DB_PATH` | `QA_DB_PATH` |

## Directory layout

```
blueprint-app/
  server/src/            # Express backend (no imports from the monolith or sibling apps)
    index.ts             # App bootstrap, health/docs endpoints, static + SPA serving
    config.ts            # env-driven configuration (BLUEPRINT_* vars)
    db.ts                # sql.js init, tracked migrations, Blueprint schema + indexes
    emailService.ts      # Resend integration + dev log fallback + email templates
    rateLimit.ts         # in-memory login rate limiting
    middleware/auth.ts   # authenticate / optionalAuth (blueprint_token cookie)
    routes/auth.ts       # register, verify, resend, login, logout, me, forgot/reset password
    schemas/auth.ts      # zod request schemas
    types.ts             # shared server types
  src/                   # React frontend
    lib/                 # api client, auth context, constants (tiers + deliverables)
    components/          # Brand, AppLayout, ProtectedRoute, shared UI primitives
    pages/               # landing, register, login, verify, forgot, reset, dashboard
```

## Getting started

```bash
cd blueprint-app
npm install
# Terminal 1 — API server (port 3106)
npm run dev:server
# Terminal 2 — Vite dev server (port 3107, proxies /api → 3106)
npm run dev
```

Both at once: `npm run dev:all`.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3106` | API/static server port |
| `BLUEPRINT_JWT_SECRET` | random (per process) | Session signing secret — **set in production** so sessions survive restarts |
| `BLUEPRINT_DB_PATH` | `./server/data/blueprint.sqlite` | SQLite file path |
| `CORS_ORIGIN` | `http://localhost:3107` | Allowed CORS origin |
| `COOKIE_NAME` | `blueprint_token` | Auth cookie name (leave as-is) |
| `COOKIE_DOMAIN` | (unset) | Optional cookie domain. Leave unset: the cookie stays scoped to the exact host, which works for localhost and the future `blueprint.<domain>` subdomain |
| `PUBLIC_BASE_URL` / `APP_BASE_URL` | (unset) | Public base URL used to build absolute links in verification / reset emails. When unset, the request's own origin is used |
| `RESEND_API_KEY` | (unset) | Resend API key. **Unset ⇒ emails are logged, not sent** (see below) |
| `EMAIL_FROM` | `Nuria AI <noreply@firstcreationmedia.com>` | From address for outbound mail |
| `BLUEPRINT_REQUIRE_VERIFICATION` | `true` | `false` disables the unverified-login block (local experiments only) |
| `NODE_ENV` | `development` | `production` enables `secure` cookies and hides dev tokens |

## Email wiring (Resend)

Email is the one external dependency this app has. Per the owner's decision (2026-10-25) the app
**keeps Resend** and reuses the monolith's integration and the same `RESEND_API_KEY`.

- With `RESEND_API_KEY` set, `sendAuthEmail` posts to `https://api.resend.com/emails`.
- With no key (dev/test/preview), the message is **not sent**: it is printed to the server console
  (`[EMAIL:LOGGED] …`) and appended to `.data/sent-emails.jsonl` (git-ignored), so every flow stays
  fully exercisable without an inbox.
- Any Resend failure (bad key, network) also falls back to that logging path rather than failing the
  request — registration still succeeds.
- In non-production, `register`, `resend-verification` and `forgot-password` additionally return
  `dev_verification_token` / `dev_reset_token` (plus a ready-made `dev_*_url`) so the flows can be
  driven end-to-end by curl or the UI. **These fields are omitted when `NODE_ENV=production`.**

## Authentication flow

1. `POST /api/auth/register` → account created **unverified**; verification email sent; **no session
   cookie is set**.
2. The user opens `/verify?token=…` → the SPA posts the token to `POST /api/auth/verify`
   (`GET /api/auth/verify?token=…` also works, for clicking straight from the inbox).
3. `POST /api/auth/login` → `403` with `verification_required: true` until verified; on success sets
   the `blueprint_token` cookie (7 days).
4. `POST /api/auth/forgot-password` → reset token (SHA-256 hashed at rest, 1-hour expiry, single use)
   emailed as `/reset-password?token=…`; `POST /api/auth/reset-password` consumes it.

## API overview

All `/api/*`. Cookie auth via `blueprint_token`.

- `POST /api/auth/register` — create an account + send the verification email
- `POST /api/auth/verify` / `GET /api/auth/verify?token=…` — verify an email address
- `POST /api/auth/resend-verification` — resend the verification email (2-minute cooldown)
- `POST /api/auth/login` — log in (requires a verified email)
- `POST /api/auth/logout` — log out
- `GET  /api/auth/me` — current user
- `POST /api/auth/forgot-password` — send a password-reset link
- `POST /api/auth/reset-password` — reset the password with a token (`newPassword`, `password` accepted as an alias)
- `GET  /api/health` — status, app name, table count, email configuration
- `GET  /api/docs` — machine-readable endpoint list

## Database schema (16 tables)

`users` plus the 15 Blueprint domain tables, mirrored from the monolith so Phase 2 can port routes
without a data-model change:

`projects`, `pages`, `questionnaires`, `wireframes`, `proposals`, `team_members`,
`whitelabel_settings`, `project_monthly`, `project_members`, `wireframe_comments`, `api_keys`,
`custom_domains`, `blueprint_whitelabel`, `invite_codes`, `promo_redemptions`.

Audit and Pipeline tables are **not** created here — they belong to their own apps.

Migrations are tracked in `schema_migrations`: `001_initial_schema` creates every table and index and
is applied once per database, so restarts are idempotent and future column additions append a new
migration entry.

## Production build & serve

```bash
npm run build          # tsc -b + vite build → dist/
npm start              # PORT=3106 NODE_ENV=production, serves dist/ + API
```

## Security notes

- Passwords hashed with bcrypt (cost 10); never stored plaintext.
- JWT in an HTTP-only, SameSite=Strict cookie (`secure` in production).
- Login attempts rate-limited in memory by IP and email (5 attempts / 15 minutes).
- Verification tokens are single-use; reset tokens are stored **hashed** with a 1-hour expiry.
- `forgot-password` and `resend-verification` return generic messages so account existence is not
  leaked, and both are rate-limited (3 per hour / 2-minute cooldown).
- Dev-only token echoes are suppressed under `NODE_ENV=production`.

## Roadmap

1. ✅ **Phase 1** — standalone scaffold: auth + DB + shell + email wiring (this PR)
2. Phase 2 — port projects/pages/questionnaires/wireframes/proposals/account/apiKeys/domains routes
   plus `projectLimit` / `apiKeyAuth` middleware (free tier = 1 project)
3. Phase 3 — port the builder frontend (sitemap, outline, questionnaire, wireframe, proposal)
4. Phase 4 — pricing & Stripe checkout + webhook, promo/invite codes, team seats, white-label
5. Phase 5 — cutover to `blueprint.` subdomain, decommission the monolith
