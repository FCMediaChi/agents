# Nuria Client Pipeline

An outbound sales & prospecting tool for freelancers and small agencies.

**Nuria Client Pipeline** is a standalone, full-stack SaaS application that helps you generate
client case studies and cold pitch emails. It is a **separate app** from the Nuria Website
Blueprint / Website Audit / QA Assistant products — it has its own accounts, database, login, and
routes, sharing only the Nuria brand identity.

This repository contains the Blueprint app (root) and the standalone product apps under their own
directories (`qa-app/`, `audit-app/`, `pipeline-app/`). Each is built and deployed independently.

> **Phase 2 status:** backend engines + routes complete — the deterministic case-study engine
> (`caseStudyEngine.ts`) and pitch analyzer (`pitchAnalyzer.ts`) are ported, and the full 15-endpoint
> pipeline API is live under `/api/pipeline` (agency onboarding, dashboard stats, case-study CRUD +
> generate, pitch CRUD + analyze/delete), with a per-user scrape cooldown as general abuse protection.
> The frontend feature pages arrive in Phase 3; pricing/checkout in Phase 4.

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
    pitchAnalyzer.ts   # deterministic site teardown + cold-email template
    caseStudyEngine.ts # deterministic scrape + narrative case-study template
    middleware/        # auth.ts, trial.ts (7-day trial / paid access), abuseProtection.ts (scrape cooldown)
    routes/            # auth.ts, pipeline.ts (15 pipeline endpoints)
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

- `GET  /api/pipeline/me` — subscription + trial status (auth only, so an expired-trial user can still read their status)
- `GET  /api/pipeline/agency` / `PUT /api/pipeline/agency` — get / update agency profile
- `POST /api/pipeline/onboarding` — create agency profile
- `GET  /api/pipeline/dashboard` — agency + case-study/pitch stats
- `GET  /api/pipeline/case-studies` / `POST /api/pipeline/case-studies` — list / create case studies
- `GET  /api/pipeline/case-studies/:id` / `PUT /api/pipeline/case-studies/:id` — get / update a case study
- `POST /api/pipeline/case-studies/:id/generate` — scrape old site + generate narrative case study
- `GET  /api/pipeline/pitches` / `POST /api/pipeline/pitches` — list / create pitches
- `GET  /api/pipeline/pitches/:id` — get a pitch
- `POST /api/pipeline/pitches/:id/analyze` — scrape prospect site + generate cold email
- `DELETE /api/pipeline/pitches/:id` — delete a pitch

All `/api/pipeline/*` routes except `/me` are gated by `requirePipelineAccess` (active trial or paid tier; expired → `402 TRIAL_EXPIRED`). The two scrape endpoints (`generate` / `analyze`) also enforce a 5-second per-user cooldown.

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
2. ✅ Case-study + pitch engines (`caseStudyEngine.ts`, `pitchAnalyzer.ts`) and the 15 pipeline endpoints
3. Frontend pages (onboarding, case study, cold pitch)
4. Pricing & Stripe checkout (Solo/Team/Agency) + trial-expiry gating
5. Cutover & decommission (repoint `pipeline.` subdomain, remove monolith code)
