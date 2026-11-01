# syntax=docker/dockerfile:1
#
# Nuria Website Blueprint — production container image (Fly.io).
#
# Build from the REPO ROOT, using this app directory as the build context:
#   docker build -f blueprint-app/Dockerfile -t nuria-blueprint:local blueprint-app
#
# Run locally (DB on a named volume so it survives restarts):
#   docker run --rm -p 8080:8080 \
#     -e BLUEPRINT_JWT_SECRET=dev-secret \
#     -v blueprint_data:/data \
#     nuria-blueprint:local
#
# The server reads its port from $PORT (server/src/config.ts) and serves both
# the built SPA in ./dist and the /api routes on that single port.
#
# NATIVE MODULES: the database layer is `sql.js` (SQLite compiled to WebAssembly),
# not `better-sqlite3`, so there is no native addon to compile and the image needs
# no python3/make/g++ toolchain. If a native module is ever added to package.json,
# add `apt-get update && apt-get install -y --no-install-recommends python3 make g++`
# to the builder stage before `npm ci` (and to the runner stage too if the module
# is loaded at runtime).

# ---------- Stage 1: install all deps and build the frontend ----------
FROM node:22-bookworm-slim AS builder
WORKDIR /app

ENV NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false

# Copy manifests first so the dependency layer is cached independently of source.
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Everything else (node_modules/, dist/, *.sqlite are excluded via .dockerignore).
COPY . .

# tsc -b (typecheck) + vite build -> ./dist
RUN npm run build

# ---------- Stage 2: runtime ----------
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    PORT=8080 \
    BLUEPRINT_DB_PATH=/data/blueprint.sqlite

# Production deps only. `tsx` is a runtime dependency here (it runs the
# TypeScript server directly), so it is installed by this step.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Built frontend + the server sources it serves from.
COPY --from=builder /app/dist ./dist
COPY server ./server

# The SQLite file lives on the Fly volume mounted at /data. Create the mount
# point in the image so a plain `docker run` without a volume still works.
RUN mkdir -p /data

# NOTE: the container runs as root on purpose. Fly attaches volumes owned by
# root, so a non-root USER cannot write /data without a chown at startup.
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# `npm start` = NODE_ENV=production tsx server/src/index.ts
CMD ["npm", "start"]
