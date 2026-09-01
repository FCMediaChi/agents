# Nuria Design QA Assistant

A smarter final check before your website goes live.

**Nuria Design QA Assistant** (working name: "AI Design QA Checklist & Launch Assistant") is a
standalone, full-stack SaaS application for structured pre-launch website QA. It is a **separate
app** from the Nuria Website Blueprint / Audit / Pipeline products — it has its own accounts,
database, login, and routes, sharing only the Nuria brand identity.

This repository contains the Blueprint/Audit/Pipeline app (root) and this QA Assistant app under
`qa-assistant/`. The QA Assistant is built and deployed independently.

> **Phase 1 status:** authentication + database + project management are implemented. The checklist
> engine, scoring, launch-readiness, autosave, AI assistant, and reports are planned for later
> phases. No AI yet, no fake scaffolding.

## Tech stack

- **Frontend:** Vite + React + TypeScript, Tailwind CSS v4, React Router
- **Backend:** Node.js + Express (ESM, run via `tsx`), Zod validation
- **Database:** SQLite via `sql.js` (persisted to a local file, mirroring the Blueprint app's approach)
- **Auth:** bcrypt password hashing + JWT in an HTTP-only cookie

## Directory layout

```
qa-assistant/
  server/src/          # Express backend
    index.ts           # App bootstrap + static serving
    db.ts              # sql.js init + normalized schema
    config.ts          # env-driven configuration
    rateLimit.ts       # in-memory login rate limiting
    middleware/auth.ts # JWT cookie auth
    routes/            # auth.ts, projects.ts
    schemas/           # zod request schemas
    utils/url.ts       # website URL validation (SSRF guard)
  src/                 # React frontend
    lib/               # api client, auth context, constants
    components/        # shared UI + layout
    pages/             # landing, auth, dashboard, projects
```

## Getting started

```bash
cd qa-assistant
npm install
# Terminal 1 — API server (port 3101)
npm run dev:server
# Terminal 2 — Vite dev server (port 3100, proxies /api → 3101)
npm run dev
```

Environment variables (all optional):

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3101` | API/static server port |
| `JWT_SECRET` | random (per-process) | Session signing secret — set in production for stable sessions |
| `DB_PATH` | `./data/qa-assistant.db` | SQLite file path |
| `CORS_ORIGIN` | `http://localhost:3100` | Allowed CORS origin |
| `COOKIE_NAME` | `qa_token` | Auth cookie name |
| `NODE_ENV` | `development` | Set `production` to enable `secure` cookies |

The QA Assistant deliberately uses port **3101** (not the Blueprint app's 3001) and cookie name
`qa_token` so it can run alongside the other products without conflicts.

## Production build & serve

```bash
npm run build          # tsc + vite build → dist/
npm start              # PORT=3101 NODE_ENV=production, serves dist/ + API
```

## API overview

All `/api/*` routes. Cookie-based auth (HTTP-only `qa_token`).

- `POST /api/auth/register` — create account
- `POST /api/auth/login` — log in
- `POST /api/auth/logout` — log out
- `GET  /api/auth/me` — current user
- `POST /api/auth/request-password-reset` — generate reset token
- `POST /api/auth/reset-password` — reset password with token
- `GET/POST /api/projects` — list / create
- `GET/PUT/DELETE /api/projects/:id` — read / update / delete

## Security notes

- Passwords hashed with bcrypt (cost 10); never stored plaintext.
- JWT stored in an HTTP-only, SameSite=Strict cookie.
- Every project query scopes by the authenticated `user_id` (server-enforced; not just frontend routing).
- Login attempts rate-limited in-memory by IP and email.
- Password-reset tokens stored as SHA-256 hashes with a 1-hour expiry.
- Website URLs validated to allow `http(s)` only, rejecting `javascript:`, `data:`, `file:`,
  localhost, and private/internal hosts (SSRF guard for any future server-side fetching).
- No AI yet; the app has no hard dependency on any external service.

## Roadmap (planned phases)

1. ✅ Authentication + database + project management
2. Checklist engine + QA categories + results
3. Scoring + launch readiness
4. Autosave + history + issue management
5. AI assistant ("QA Copilot")
6. Reports / export
7. Security hardening + rate limiting + performance
8. Full application testing
