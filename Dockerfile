# syntax=docker/dockerfile:1.10
#
# ADO Metrics / Delivery Insights - single-container image (API + SPA).
#
# Targets:
#   runtime   (default) production image: compiled API + SPA static files + production node_modules only.
#   migrator  one-off job image: runs `prisma migrate deploy`. Contains the Prisma CLI (dev dependency).
#
# Build from the repository root:
#   docker buildx build --target runtime  -t ado-metrics:local .
#   docker buildx build --target migrator -t ado-metrics-migrator:local .
#
# The base image is pinned by exact tag. CI/Dependabot should additionally pin it by digest
# (FROM node:<tag>@sha256:<digest>) so a re-pushed tag can never change what we ship.

############################
# base: shared OS layer
############################
FROM node:26.12.1-alpine3.24 AS base
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

############################
# deps: full dependency tree (dev + prod) for building
############################
FROM base AS deps
# Prisma's schema engine (used by `prisma migrate`) needs OpenSSL to detect the musl/openssl target.
RUN apk add --no-cache openssl
# Every workspace manifest must be listed here (and in prod-deps) or `npm ci` rejects the lockfile.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci

############################
# build: compile shared -> api -> web
############################
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY apps/web apps/web
# `prisma generate` only needs a syntactically valid URL to load prisma.config.ts; it never connects.
# The value is scoped to this RUN and is not persisted in any image layer's environment.
RUN npm run build -w @ado-metrics/shared \
 && DATABASE_URL="postgresql://build:build@localhost:5432/build" npm run build -w @ado-metrics/api \
 && npm run build -w @ado-metrics/web \
 && test -f apps/api/dist/main.js \
 && test -f apps/web/dist/index.html

############################
# prod-deps: production dependencies of the API workspace only
############################
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# --workspace limits the install to the API and what it depends on (including the @ado-metrics/shared
# workspace, which npm links as node_modules/@ado-metrics/shared -> ../../packages/shared).
# --omit=optional: the root `overrides.prisma` makes @prisma/client's optional peers (the prisma CLI,
# typescript, Prisma Studio) "devOptional" in the lockfile, which --omit=dev alone keeps (~240 MB).
# No production dependency needs an optional package today; revisit if one ships optional native binaries.
# --ignore-scripts: the Prisma client was already generated in the build stage; no install hooks
# from third-party packages run in the tree we ship.
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --omit=dev --omit=optional --workspace=@ado-metrics/api --include-workspace-root=false --ignore-scripts \
 && mkdir -p apps/api/node_modules packages/shared/node_modules \
 && test ! -e node_modules/prisma && test ! -e node_modules/typescript

############################
# migrator: one-off `prisma migrate deploy` (Container Apps Job / docker compose)
############################
FROM base AS migrator
ARG VCS_REF=unknown
ARG BUILD_DATE=unknown
ARG VERSION=0.0.0-dev
LABEL org.opencontainers.image.title="ado-metrics-migrator" \
      org.opencontainers.image.description="ADO Metrics database migrations (prisma migrate deploy)" \
      org.opencontainers.image.source="https://github.com/contoso/ado-metrics" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.licenses="UNLICENSED" \
      org.opencontainers.image.vendor="Contoso"
RUN apk add --no-cache openssl \
 && addgroup -S -g 10001 app \
 && adduser -S -D -H -u 10001 -G app -h /tmp -s /sbin/nologin app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# API workspace with its dev dependencies (Prisma CLI + schema engine); no web or root tooling.
# `prisma --version` makes sure any engine download happens now, as root, not at run time on a
# read-only filesystem.
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --workspace=@ado-metrics/api --include-workspace-root=false \
 && cd apps/api && npx --no-install prisma --version
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/prisma.config.ts ./apps/api/prisma.config.ts
WORKDIR /app/apps/api
# HOME=/tmp keeps npx/prisma caches off the (read-only) root filesystem.
ENV NODE_ENV=production \
    HOME=/tmp \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1
USER 10001
CMD ["npx", "--no-install", "prisma", "migrate", "deploy"]

############################
# runtime: production image (default target)
############################
FROM base AS runtime
ARG VCS_REF=unknown
ARG BUILD_DATE=unknown
ARG VERSION=0.0.0-dev
LABEL org.opencontainers.image.title="ado-metrics" \
      org.opencontainers.image.description="ADO Metrics / Delivery Insights - API and web app" \
      org.opencontainers.image.source="https://github.com/contoso/ado-metrics" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.licenses="UNLICENSED" \
      org.opencontainers.image.vendor="Contoso"

# - Pick up Alpine security fixes published after the base image was built.
# - tini (≈40 KB) as PID 1: forwards SIGTERM to node and reaps zombies, so graceful shutdown does not
#   depend on the application registering signal handlers (node as PID 1 ignores SIGTERM otherwise).
# - Remove npm, npx and corepack: nothing installs packages at runtime, and their bundled
#   dependencies are a recurring source of scanner findings.
# - Non-root user 10001 with no shell and no home directory.
RUN apk upgrade --no-cache \
 && apk add --no-cache tini \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /root/.npm /tmp/* \
 && addgroup -S -g 10001 app \
 && adduser -S -D -H -u 10001 -G app -h /nonexistent -s /sbin/nologin app

# Everything below is owned by root and read-only for uid 10001: the process cannot modify its own code.
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    STATIC_DIR=/app/apps/web/dist \
    TMPDIR=/tmp

EXPOSE 3000
USER 10001
STOPSIGNAL SIGTERM

# Used by docker / docker compose. Azure Container Apps ignores HEALTHCHECK and uses the
# liveness/readiness/startup probes defined in infra/modules/container-app.bicep instead.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health/live',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/api/dist/main.js"]
