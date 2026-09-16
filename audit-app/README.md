# Nuria Website Audit

A clear, scored audit of your live website.

**Nuria Website Audit** is a standalone, full-stack SaaS application that analyzes a live website
across design, UX, accessibility, SEO, mobile, and conversion, and turns the results into an
actionable report. It is a **separate app** from the Nuria Website Blueprint / QA Assistant /
Pipeline products — it has its own accounts, database, login, and routes, sharing only the Nuria
brand identity.

This repository contains the Blueprint app (root) and the standalone product apps under their own
directories (`qa-app/`, `audit-app/`). Each is built and deployed independently.

> **Phase 1 status:** authentication + database schema + an auth-protected dashboard shell are
> implemented. The audit engine (crawling/analysis), scoring, reports, and the anonymous
> homepage-audit free tier are planned for later phases. No AI yet, no fake scaffolding.

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
    middleware/auth.ts # JWT cookie auth
    routes/            # auth.ts
    schemas/           # zod request schemas
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

(Audit endpoints — `/api/audit/*` — arrive with the Phase 2 engine.)

## Security notes

- Passwords hashed with bcrypt (cost 10); never stored plaintext.
- JWT stored in an HTTP-only, SameSite=Strict cookie.
- Login attempts rate-limited in-memory by IP and email.
- Password-reset tokens stored as SHA-256 hashes with a 1-hour expiry.
- No AI yet; the app has no hard dependency on any external service.

## Roadmap (planned phases)

1. ✅ Authentication + database schema + dashboard shell
2. Audit engine (crawl + analyze a live URL, dimension scoring)
3. Anonymous homepage-audit free tier + full-audit reports
4. Report export + history
5. AI-assisted explanations (clearly labeled)
6. Security hardening + rate limiting + performance
7. Full application testing
