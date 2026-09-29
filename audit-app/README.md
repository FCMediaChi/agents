# Nuria Website Audit

A clear, scored audit of your live website.

**Nuria Website Audit** is a standalone, full-stack SaaS application that analyzes a live website
across design, UX, accessibility, SEO, mobile, and conversion, and turns the results into an
actionable report. It is a **separate app** from the Nuria Website Blueprint / QA Assistant /
Pipeline products — it has its own accounts, database, login, and routes, sharing only the Nuria
brand identity.

This repository contains the Blueprint app (root) and the standalone product apps under their own
directories (`qa-app/`, `audit-app/`). Each is built and deployed independently.

> **Phase 2 status:** the audit engine + API routes are ported from the monolith and wired to the
> app's own database. `POST /api/audit/run` and `/run-html` are reachable **without auth** (anonymous
> = free tier, 1-audit limit); authenticated users get their subscription tier, and reports +
> dimensions/checks are persisted locally. No AI yet, no fake scaffolding.

## Tech stack

- **Frontend:** Vite + React + TypeScript, Tailwind CSS v4, React Router
- **Backend:** Node.js + Express (ESM, run via `tsx`), Zod validation
- **Database:** SQLite via `sql.js` (persisted to a local file, mirroring the other apps' approach)
- **Auth:** bcrypt password hashing + JWT in an HTTP-only cookie

## Directory layout

```
audit-app/
  server/src/          # Express backend
    index.ts           # App bootstrap + static serving
    db.ts              # sql.js init + normalized schema
    config.ts          # env-driven configuration
    rateLimit.ts       # in-memory login rate limiting
    engine/            # audit analyzers (cheerio-based, 7 dimensions)
    middleware/        # auth.ts, abuseProtection.ts (rate limits, queue, blacklist)
    routes/            # auth.ts, audit.ts (the 6 audit endpoints)
    schemas/           # zod request schemas (auth.ts, audit.ts)
    types.ts           # shared server types
  src/                 # React frontend
    lib/               # api client, auth context, constants
    components/        # shared UI + layout
    pages/             # landing, auth, dashboard
```

## Getting started

```bash
cd audit-app
npm install
# Terminal 1 — API server (port 3102)
npm run dev:server
# Terminal 2 — Vite dev server (port 3103, proxies /api → 3102)
npm run dev
```

Environment variables (all optional):

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3102` | API/static server port |
| `AUDIT_JWT_SECRET` | random (per-process) | Session signing secret — set in production for stable sessions |
| `AUDIT_DB_PATH` | `./server/data/audit.sqlite` | SQLite file path |
| `CORS_ORIGIN` | `http://localhost:3103` | Allowed CORS origin |
| `COOKIE_NAME` | `audit_token` | Auth cookie name |
| `COOKIE_DOMAIN` | (unset) | Optional cookie domain — leave unset to scope the cookie to the exact host (works for localhost and the future `audit.<domain>` subdomain) |
| `PUBLIC_BASE_URL` / `APP_BASE_URL` | (unset) | Public base URL (e.g. `https://audit.example.com`), reserved for absolute links such as password-reset emails |
| `NODE_ENV` | `development` | Set `production` to enable `secure` cookies |

The Audit app deliberately uses port **3102** (not the Blueprint app's 3001 or the QA Assistant's
3101) and cookie name `audit_token` so it can run alongside the other products without conflicts.

## Production build & serve

```bash
npm run build          # tsc + vite build → dist/
npm start              # PORT=3102 NODE_ENV=production, serves dist/ + API
```

## API overview

All `/api/*` routes. Cookie-based auth (HTTP-only `audit_token`).

- `POST /api/auth/register` — create account
- `POST /api/auth/login` — log in
- `POST /api/auth/logout` — log out
- `GET  /api/auth/me` — current user
- `POST /api/auth/request-password-reset` — generate reset token
- `POST /api/auth/reset-password` — reset password with token

- `POST /api/audit/run` — run a website audit (no auth required; anonymous = free tier)
- `POST /api/audit/run-html` — run an audit from pasted HTML
- `GET  /api/audit/reports` — list your reports (scoped to the user or `anonymous`)
- `GET  /api/audit/reports/:id` — full report with dimensions + checks
- `GET  /api/audit/reports/:id/status` — poll a running report
- `GET  /api/audit/usage` — free-tier usage + remaining audits

## Security notes

- Passwords hashed with bcrypt (cost 10); never stored plaintext.
- JWT stored in an HTTP-only, SameSite=Strict cookie.
- Login attempts rate-limited in-memory by IP and email.
- Password-reset tokens stored as SHA-256 hashes with a 1-hour expiry.
- No AI yet; the app has no hard dependency on any external service.

## Roadmap (planned phases)

1. ✅ Authentication + database schema + dashboard shell
2. ✅ Audit engine (crawl + analyze a live URL, dimension scoring)
3. ✅ Anonymous homepage-audit free tier + full-audit reports (free tier = homepage only, 1 audit)
4. Report export + history (frontend report UI)
5. AI-assisted explanations (clearly labeled)
6. Security hardening + rate limiting + performance
7. Full application testing
