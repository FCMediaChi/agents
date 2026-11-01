# Fly.io deployment runbook — Nuria standalone apps

Packaging for the three live Nuria apps. **Nothing here has been deployed yet** —
`flyctl` was not installed and no Fly token existed when this was written. Every
command below is the exact go-live sequence, in order.

| App | Dir | Fly app | Fly volume | Subdomain |
|---|---|---|---|---|
| Nuria Website Blueprint | `blueprint-app/` | `nuria-blueprint` | `blueprint_data` | `blueprint.nuriaapps.com` |
| Nuria Website Audit | `audit-app/` | `nuria-audit` | `audit_data` | `audit.nuriaapps.com` |
| Nuria Client Pipeline | `pipeline-app/` | `nuria-pipeline` | `pipeline_data` | `pipeline.nuriaapps.com` |

`qa-app/` is **out of scope** (owner moratorium). Its `qa.` subdomain stays unused.

## What's in the repo

Per app: `Dockerfile`, `.dockerignore`, `fly.toml`. Each image is a two-stage
build (`node:22-bookworm-slim`): stage 1 runs `npm ci` + `npm run build` (emits
`dist/`), stage 2 installs production deps only and runs
`npm start` → `tsx server/src/index.ts`, which serves the SPA from `dist/` and the
`/api` routes on **one** port (`$PORT`, default 8080 in the image).

The database is SQLite on the Fly volume at `/data/<app>.sqlite`, selected by the
`*_DB_PATH` env var in `fly.toml` — nothing is hardcoded in source.

> **No native module.** The DB layer is `sql.js` (SQLite as WebAssembly), not
> `better-sqlite3`, so the image needs no python3/make/g++ toolchain. If a native
> addon is added later, add `apt-get install -y --no-install-recommends python3 make g++`
> to the builder stage before `npm ci`.

> **Port.** Fly does **not** inject `PORT`; `fly.toml` sets `PORT = "8080"` in
> `[env]`, which must equal `http_service.internal_port`. The apps read
> `process.env.PORT` in `server/src/config.ts`. The `npm start` scripts used to
> hardcode `PORT=3102/3104/3106`, which would have overridden Fly's value — that
> was fixed, and the local defaults still come from `config.ts`.

## 0. One-time prerequisites

```bash
# Install flyctl (Linux)
curl -L https://fly.io/install.sh | sh
export FLYCTL_INSTALL="$HOME/.fly"; export PATH="$FLYCTL_INSTALL/bin:$PATH"

flyctl auth login          # or: export FLY_API_TOKEN=...  (token from the owner)
flyctl orgs list           # note the org slug to use below, e.g. "personal"
```

Set a shell variable for the org so the commands below are copy-pasteable:

```bash
export ORG=personal
export REGION=iad        # change to the region closest to the customers
export REPO=~/agents     # path to the FCMediaChi/agents checkout
```

## 1. Create the apps and their volumes

Run once per app. `--yes` skips the interactive confirm.

```bash
# ---- Blueprint ----
flyctl apps create nuria-blueprint --org "$ORG"
flyctl volumes create blueprint_data --app nuria-blueprint --region "$REGION" --size 1 --yes

# ---- Audit ----
flyctl apps create nuria-audit --org "$ORG"
flyctl volumes create audit_data --app nuria-audit --region "$REGION" --size 1 --yes

# ---- Pipeline ----
flyctl apps create nuria-pipeline --org "$ORG"
flyctl volumes create pipeline_data --app nuria-pipeline --region "$REGION" --size 1 --yes
```

The volume must exist **before** the first deploy, otherwise the machine fails to
start (`mounts` in `fly.toml`). Size 1 GB is plenty for SQLite; grow later with
`flyctl volumes extend <id> --size 5`.

## 2. Set the secrets

Secrets are never committed. Generate the JWT secrets fresh per app — they sign
session cookies, so they must differ per app and must not be reused from the
sandbox.

```bash
# ---- Blueprint ----
flyctl secrets set --app nuria-blueprint \
  BLUEPRINT_JWT_SECRET="$(openssl rand -hex 32)"
flyctl secrets set --app nuria-blueprint \
  STRIPE_WEBHOOK_SECRET="whsec_..." \
  RESEND_API_KEY="re_..."

# ---- Audit ----
flyctl secrets set --app nuria-audit \
  AUDIT_JWT_SECRET="$(openssl rand -hex 32)"
flyctl secrets set --app nuria-audit \
  STRIPE_WEBHOOK_SECRET="whsec_..."

# ---- Pipeline ----
flyctl secrets set --app nuria-pipeline \
  PIPELINE_JWT_SECRET="$(openssl rand -hex 32)"
flyctl secrets set --app nuria-pipeline \
  STRIPE_WEBHOOK_SECRET="whsec_..."
```

**Secret names per app (complete list):**

| Secret | Blueprint | Audit | Pipeline | Notes |
|---|---|---|---|---|
| `BLUEPRINT_JWT_SECRET` | required | — | — | Sessions break on restart if unset (falls back to a random per-process value) |
| `AUDIT_JWT_SECRET` | — | required | — | same |
| `PIPELINE_JWT_SECRET` | — | — | required | same |
| `STRIPE_WEBHOOK_SECRET` | required | required | required | `whsec_...`; signature verification is skipped when empty |
| `RESEND_API_KEY` | required | — | — | Verification + password-reset email |

Non-secret config already lives in each `fly.toml` `[env]`: `NODE_ENV`, `PORT`,
`<APP>_DB_PATH`, `CORS_ORIGIN`, `PUBLIC_BASE_URL`, `APP_BASE_URL`, `EMAIL_FROM`.

Optional, only if needed: `COOKIE_DOMAIN`, `COOKIE_NAME`,
`BLUEPRINT_REQUIRE_VERIFICATION=false` (bypasses email verification — do **not**
set in production).

## 3. Deploy

Deploy from **inside each app directory** so flyctl picks up that app's
`fly.toml` and `Dockerfile` (the Dockerfile path in the config is relative to the
config file).

```bash
cd "$REPO/blueprint-app" && flyctl deploy
cd "$REPO/audit-app"     && flyctl deploy
cd "$REPO/pipeline-app"  && flyctl deploy
```

Equivalent explicit form, if you prefer to stay at the repo root:

```bash
flyctl deploy --config blueprint-app/fly.toml --dockerfile blueprint-app/Dockerfile blueprint-app
```

Verify each deploy:

```bash
flyctl status --app nuria-blueprint
flyctl logs   --app nuria-blueprint
curl -s https://nuria-blueprint.fly.dev/api/health     # {"status":"ok","app":"nuria-blueprint-app",...}
```

### Keep exactly one machine per app

The database is a single SQLite file on one volume, and `sql.js` holds it in
memory. Two machines would fork the data. After deploying, confirm:

```bash
flyctl scale show --app nuria-blueprint    # count must be 1
```

Never run `flyctl scale count 2`. If you need HA later, the database has to move
to Postgres/LiteFS first.

## 4. Custom domains + SSL certificates

For each app, create the certificate **first**, then add the DNS record.

```bash
flyctl certs create blueprint.nuriaapps.com --app nuria-blueprint
flyctl certs create audit.nuriaapps.com     --app nuria-audit
flyctl certs create pipeline.nuriaapps.com  --app nuria-pipeline
```

Then add these records at the DNS provider (`nuriaapps.com` is on **Gandi**
nameservers — `ns-233-b.gandi.net` etc.):

| Type | Host / Name | Value / Target | TTL |
|---|---|---|---|
| CNAME | `blueprint` | `nuria-blueprint.fly.dev.` | 300 |
| CNAME | `audit` | `nuria-audit.fly.dev.` | 300 |
| CNAME | `pipeline` | `nuria-pipeline.fly.dev.` | 300 |

Notes:
- Use a **CNAME** for each subdomain. Do **not** add A/AAAA records — those are
  only for apex/`www`, which stay pointed at the team site (`www` currently
  CNAMEs to `sites.cto-new.app`). Leave `www` and the apex alone.
- In Gandi's UI the "name" field is just the label (`blueprint`), not the FQDN,
  and the trailing dot on the target is not needed in the UI.
- These three subdomains currently have **no DNS records at all**, so adding them
  does not disturb anything that is already live.
- Cert issuance is automatic once the CNAME resolves. Watch it with:

```bash
flyctl certs show blueprint.nuriaapps.com --app nuria-blueprint
# "Status" goes Pending → Issued (usually < 15 min after DNS propagates)
flyctl certs list --app nuria-blueprint
```

If a cert is stuck `Pending`, `dig +short blueprint.nuriaapps.com CNAME` must
return `nuria-blueprint.fly.dev.`; fix the DNS record before retrying
(`flyctl certs delete` then `flyctl certs create` again).

Finally confirm end-to-end:

```bash
for h in blueprint audit pipeline; do
  echo -n "$h: "; curl -s "https://$h.nuriaapps.com/api/health"; echo
done
```

## 5. Post-deploy: Stripe webhooks

The Stripe account is on a Standard (full) account. Add/update three endpoints in
the Stripe dashboard (Developers → Webhooks), each with its own signing secret,
and put that secret in the matching `flyctl secrets set STRIPE_WEBHOOK_SECRET`:

| App | Endpoint URL |
|---|---|
| Blueprint | `https://blueprint.nuriaapps.com/api/webhooks/stripe` |
| Audit | `https://audit.nuriaapps.com/api/webhooks/stripe` |
| Pipeline | `https://pipeline.nuriaapps.com/api/webhooks/stripe` |

Events: `checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`. Then send a test event from the dashboard and
check `flyctl logs --app <app>` for the verification line. This is the step that
was still pending on the sandbox ("webhook delivery verification").

## 6. Updating an app later

```bash
cd "$REPO" && git pull
cd blueprint-app && flyctl deploy      # rebuilds the image and rolls the machine
```

Data on `/data` survives deploys — the volume is not part of the image.

## 7. Backup / restore the database

The whole database is one file on the volume. To take a copy:

```bash
flyctl ssh console --app nuria-blueprint -C "cp /data/blueprint.sqlite /data/backup-$(date +%F).sqlite"
flyctl ssh sftp get /data/blueprint.sqlite ./blueprint-backup.sqlite --app nuria-blueprint
```

Restore: `flyctl ssh sftp put ./blueprint-backup.sqlite /data/blueprint.sqlite --app nuria-blueprint`
then `flyctl apps restart nuria-blueprint`. Take a backup **before** any deploy
that changes the schema.

## 8. Rollback

```bash
flyctl releases --app nuria-blueprint          # list versions
flyctl deploy --image registry.fly.io/nuria-blueprint:<version> --app nuria-blueprint
```

## Local verification (what was actually run)

Docker was available in the sandbox, so each image was built and run locally
before this runbook was written. Reproduce per app:

```bash
cd "$REPO"
docker build -f blueprint-app/Dockerfile -t nuria-blueprint:local blueprint-app

docker volume create bp_data
docker run -d --name bp-test -p 8080:8080 \
  -e PORT=8080 \
  -e BLUEPRINT_JWT_SECRET=local-dev-secret \
  -e BLUEPRINT_DB_PATH=/data/blueprint.sqlite \
  -v bp_data:/data \
  nuria-blueprint:local

curl -s http://127.0.0.1:8080/api/health
docker exec bp-test ls -l /data            # blueprint.sqlite is created here
docker restart bp-test && curl -s http://127.0.0.1:8080/api/health   # survives restart
docker rm -f bp-test && docker volume rm bp_data
```

Swap the app name / env prefix (`AUDIT_`, `PIPELINE_`) for the other two.
