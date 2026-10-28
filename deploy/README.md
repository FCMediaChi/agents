# Serving & subdomain cutover

The four Nuria products are separate apps, each with its own database, cookie
name, secrets and process. The **public origin is the team site** at
`/home/team/shared/site` (Bun + `serve.ts`, port 3000). It routes by the first
DNS label of the `Host` header, so one origin serves every subdomain.

```
Host starts with   Served by            Port   Frontend + /api
---------------------------------------------------------------------
blueprint.         blueprint-app        3106   same Express process
audit.             audit-app            3102   same Express process
pipeline.          pipeline-app         3104   same Express process
qa.                — not routed yet —   —      owner moratorium (2026-09-01)
anything else      team site (apex)     3000   SPA in dist/client + monolith
                                               /api/* proxied to :3001
```

Matching is on the **prefix only**, never the full domain, so the same code path
works on `blueprint.localhost`, `blueprint.<sandbox>.ctonew.app` and
`blueprint.nuriaapps.com`. Nothing in the serving layer needs to know the domain.

## Why a proxy and not path routing

Each standalone app already serves its own built frontend *and* its own `/api`
from one Express port (`server/src/index.ts`: `express.static(dist)` + SPA
fallback + `/api/...` routes; see also `vite.config.ts` which proxies `/api` to
the same port in dev). The router therefore forwards **everything** for a
matching Host — pages, assets, `/api` — and never has to know which paths are
static and which are dynamic. The frontends call the API with relative paths
(`API_BASE = '/api'`), so no build-time API URL is involved and the same bundle
works on 3106, on `blueprint.localhost` and on the real subdomain.

## Files

| File | Where | Role |
| --- | --- | --- |
| `host-router.ts` | team site | Routing table + reverse proxy (`handleAppRequest`) |
| `serve.ts` | team site | Port 3000 origin; calls the router first, then the old apex behaviour |
| `verify-router.ts` | team site | Binds a spare port and runs the same router for local checks |
| `start-apps.sh` | team site | Resolves this repo, delegates to `deploy/start-apps.sh` |
| `start-all.sh` | team site | Restart-safe bring-up of apps + monolith + origin, prints the observed routing table |
| `publish.sh` | team site | Build + start apps + (re)start origin — the one command that makes all of it live |
| `deploy/start-apps.sh` | this repo | Starts/repairs the three app servers (idempotent, health-checked) |
| `startup.sh` | this repo | Reboot recovery: app servers + monolith |

The team site is **not** in this repository — those files are edited in place.

## Build

Each app builds itself; the site build does not build the apps.

```bash
cd audit-app     && npm install && npm run build    # -> audit-app/dist
cd pipeline-app  && npm install && npm run build    # -> pipeline-app/dist
cd blueprint-app && npm install && npm run build    # -> blueprint-app/dist
```

`dist/` is gitignored, so after a sandbox rebuild the apps must be rebuilt
before their subdomains serve anything (`start-apps.sh` warns when
`<app>/dist/index.html` is missing).

## Start / restart

```bash
/home/team/shared/site/publish.sh      # rebuild site, start apps, restart origin (routing live)
/home/team/shared/site/start-all.sh    # no rebuild; start whatever is down, print routing table
deploy/start-apps.sh                   # just the three app servers
deploy/start-apps.sh --restart         # force-restart them
```

All of them are safe to re-run: healthy apps are skipped by a `/api/health` probe
that also checks the app's own name (so a foreign process on the port is caught
and replaced rather than trusted).

## Verify

```bash
curl -s -H 'Host: blueprint.localhost' http://localhost:3000/ | grep -o '<title>[^<]*</title>'
curl -s -H 'Host: audit.localhost'     http://localhost:3000/api/health
curl -s -H 'Host: pipeline.localhost'  http://localhost:3000/api/health
```

Expected: each host returns *its own* app's HTML title and `/api/health` payload
(`nuria-blueprint-app`, `nuria-audit-app`, `nuria-pipeline-app`). Apex hosts keep
the team site. If an app process is down the subdomain returns **502** with the
app name in the body — the apex site is unaffected.

## Operational notes

- **Secrets/env are per app and inherited from the environment** — the startup
  scripts invent none. Production needs at minimum `BLUEPRINT_JWT_SECRET`,
  `PIPELINE_JWT_SECRET`, `AUDIT_JWT_SECRET` (otherwise sessions reset on every
  restart), the Stripe keys for entitlement webhooks, and `RESEND_API_KEY` for
  auth email. Stripe webhook endpoints point at
  `https://<app>.nuriaapps.com/api/<app>/stripe/webhook` — registering them is
  the lead's cutover step, not something these scripts do.
- **Cookies** stay host-scoped (`COOKIE_DOMAIN` unset), and each app uses a
  distinct cookie name (`blueprint_token`, `audit_token`, `pipeline_token`), so
  sessions cannot cross subdomains or collide with the apex.
- Behind the proxy the apps see `req.protocol = http`; the router sends
  `X-Forwarded-Proto`/`X-Forwarded-Host` so `PUBLIC_BASE_URL` or a future
  `trust proxy` setting produce `https://…` links. Emails already fall back to
  the request origin.
- After a sandbox restart the platform brings the site up in **dev** mode on
  3000, which has no router; run `publish.sh` (or `start-all.sh`) to restore
  subdomain routing.
