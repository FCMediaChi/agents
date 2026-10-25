# Nuria Client Pipeline

An outbound sales & prospecting tool for freelancers and small agencies.

**Nuria Client Pipeline** is a standalone, full-stack SaaS application that helps you generate
client case studies and cold pitch emails. It is a **separate app** from the Nuria Website
Blueprint / Website Audit / QA Assistant products — it has its own accounts, database, login, and
routes, sharing only the Nuria brand identity.

This repository contains the Blueprint app (root) and the standalone product apps under their own
directories (`qa-app/`, `audit-app/`, `pipeline-app/`). Each is built and deployed independently.

> **Phase 1 status:** standalone scaffold complete — own Express server, own SQLite schema
> (`users` + trial columns + the 3 pipeline tables), auth (register/login/logout/me/password-reset)
> with login rate limiting, a 7-day free-trial access middleware, and a landing + auth + empty
> dashboard shell. The case-study/pitch engines and routes arrive in Phase 2; pricing/checkout in
> Phase 4.

## Tech stack

- **Frontend:** Vite + React + TypeScript, Tailwind CSS v4, React Router
- **Backend:** Node.js + Express (ESM, run via `tsx`), Zod validation
- **Database:** SQLite via `sql.js` (persisted to a local file, mirroring the other apps' approach)
- **Auth:** bcrypt password hashing + JWT in an HTTP-only cookie

## Directory layout

```
pipeline-app/
  server/src/          # Express backend
    index.ts           # App bootstrap + static serving
    db.ts              # sql.js init + schema (users + trial columns + pipeline tables)
    config.ts          # env-driven configuration
    rateLimit.ts       # in-memory login rate limiting
    middleware/        # auth.ts, trial.ts (7-day trial / paid access)
    routes/            # auth.ts, pipeline.ts (GET /api/pipeline/me placeholder)
    schemas/           # zod request schemas (auth.ts)
    types.ts           # shared server types
  src/                 # React frontend
    lib/               # api client, auth context, constants
    components/        # shared UI + layout
    pages/             # landing, auth, dashboard
```

## Getting started

```bash
cd pipeline-app
npm install
# Terminal 1 — API server (port 3104)
npm run dev:server
# Terminal 2 — Vite dev server (port 3105, proxies /api → 3104)
npm run dev
```

Environment variables (all optional):

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3104` | API/static server port |
| `PIPELINE_JWT_SECRET` | random (per-process) | Session signing secret — set in production for stable sessions |
| `PIPELINE_DB_PATH` | `./server/data/pipeline.sqlite` | SQLite file path |
| `CORS_ORIGIN` | `http://localhost:3105` | Allowed CORS origin |
| `COOKIE_NAME` | `pipeline_token` | Auth cookie name |
| `COOKIE_DOMAIN` | (unset) | Optional cookie domain — leave unset to scope the cookie to the exact host (works for localhost and the future `pipeline.<domain>` subdomain) |
| `PUBLIC_BASE_URL` / `APP_BASE_URL` | (unset) | Public base URL (e.g. `https://pipeline.example.com`), reserved for absolute links such as password-reset emails |
| `NODE_ENV` | `development` | Set `production` to enable `secure` cookies |

The Pipeline app deliberately uses port **3104** (not Blueprint's 3001, QA's 3101, or Audit's
3102) and cookie name `pipeline_token` so it can run alongside the other products without
conflicts.

## Production build & serve

```bash
npm run build          # tsc + vite build → dist/
npm start              # PORT=3104 NODE_ENV=production, serves dist/ + API
```

## API overview

All `/api/*` routes. Cookie-based auth (HTTP-only `pipeline_token`).

- `POST /api/auth/register` — create account (starts the 7-day free trial)
- `POST /api/auth/login` — log in
- `POST /api/auth/logout` — log out
- `GET  /api/auth/me` — current user
- `POST /api/auth/request-password-reset` — generate reset token
- `POST /api/auth/reset-password` — reset password with token

- `GET  /api/pipeline/me` — subscription + trial status (requires active trial or paid tier; expired → `402 TRIAL_EXPIRED`)

## Access model

- On signup a `FREE` user starts a **7-day free trial** (`trial_started_at` → `trial_ends_at`).
- `requirePipelineAccess` grants access to non-`FREE` (paid) tiers unconditionally, and to `FREE`
  users only while their trial is active; an expired trial returns `402 TRIAL_EXPIRED`.

## Security notes

- Passwords hashed with bcrypt (cost 10); never stored plaintext.
- JWT stored in an HTTP-only, SameSite=Strict cookie.
- Login attempts rate-limited in-memory by IP and email.
- Password-reset tokens stored as SHA-256 hashes with a 1-hour expiry.

## Roadmap (planned phases)

1. ✅ Authentication + database schema + trial middleware + dashboard shell
2. Case-study + pitch engines (`caseStudyEngine.ts`, `pitchAnalyzer.ts`) and the 15 pipeline endpoints
3. Frontend pages (onboarding, case study, cold pitch)
4. Pricing & Stripe checkout (Solo/Team/Agency) + trial-expiry gating
5. Cutover & decommission (repoint `pipeline.` subdomain, remove monolith code)
