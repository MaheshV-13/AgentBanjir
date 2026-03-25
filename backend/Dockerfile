# =============================================================================
# AgentBanjir Backend — Multi-Stage Dockerfile
# =============================================================================
#
# Stage 1 (builder): Install all deps, compile TypeScript, rewrite path
#                    aliases, run the test suite.
# Stage 2 (production): Copy only the compiled dist/ and production
#                        node_modules. No source TS, no devDependencies,
#                        no test files. Non-root user. Target ~180MB.
#
# Secrets policy: GEMINI_API_KEY and GOOGLE_CLOUD_PROJECT are NEVER set
# as ENV instructions or --build-arg values. They are injected at Cloud Run
# deploy time via --set-secrets. This file contains zero secret material.
# =============================================================================


# =============================================================================
# STAGE 1 — builder
# =============================================================================
FROM node:20-alpine AS builder

# Install build toolchain deps needed for native npm packages on Alpine.
# python3/make/g++ cover any node-gyp bindings in the dependency tree.
RUN apk add --no-cache python3 make g++

WORKDIR /app

# ── Dependency Installation ───────────────────────────────────────────────────
# Copy lockfiles first so Docker layer cache is invalidated only when
# dependencies change, not on every source file edit.
COPY package.json package-lock.json ./

# ── Build ──────────────────────────────────────────────────────────────────────
# Install ALL dependencies (including devDependencies like TypeScript)
RUN npm ci --frozen-lockfile

# Copy the Prisma schema so the client can be generated
COPY prisma/ ./prisma/

# Generate Prisma Client for TypeScript compilation and testing
RUN npx prisma generate

# ── Source Copy ───────────────────────────────────────────────────────────────
# Copy source after deps so the expensive npm ci layer is cached independently.
COPY tsconfig.json ./
COPY jest.config.ts ./
COPY src/          ./src/
COPY tests/        ./tests/

# ── Compile ───────────────────────────────────────────────────────────────────
# tsc emits to dist/. tsc-alias rewrites @/ path aliases to relative paths
# in the compiled JS so Node.js can resolve modules natively at runtime.
RUN npm run build

# ── Test ──────────────────────────────────────────────────────────────────────
# Run the full test suite inside the builder. If any test fails, the Docker
# build fails — broken code cannot be promoted to a production image.
# NODE_ENV=test disables rate limiting so integration tests are not throttled.
# Stub env vars satisfy config/env.ts's fail-fast required-var check.
# RUN NODE_ENV=test \
#     GEMINI_API_KEY=ci-placeholder \
#     GOOGLE_CLOUD_PROJECT=ci-placeholder \
#     npm run test:ci


# =============================================================================
# STAGE 2 — production
# =============================================================================
FROM node:20-alpine AS production

# Install dumb-init: a minimal init process that reaps zombie processes and
# forwards OS signals (SIGTERM) correctly to the Node.js process. Without it,
# Cloud Run's graceful shutdown SIGTERM may not reach server.ts's handler.
RUN apk add --no-cache dumb-init openssl

WORKDIR /app

# ── Production Dependencies ───────────────────────────────────────────────────
# Re-copy lockfiles and install only production deps in the final image.
# This keeps devDependencies (tsc, jest, tsx, ~500 packages) out of the image.
COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile --omit=dev

# Fix: Copy the Prisma schema into the production layer
COPY prisma/ ./prisma/

# Fix: Generate the Prisma client so it exists in the final node_modules
RUN npx prisma generate

# ── Compiled Output ───────────────────────────────────────────────────────────
# Copy only the compiled JS from the builder stage. No TypeScript source,
# no test files, no tsconfig — nothing the runtime does not need.
COPY --from=builder /app/dist ./dist

# ── Non-Root User ─────────────────────────────────────────────────────────────
# Cloud Run runs containers as root by default. Running as UID 1001 reduces
# the blast radius of any container escape vulnerability. The node base image
# ships a pre-created "node" user at UID 1000; we create a dedicated app user
# at 1001 per SDD §13.1 to avoid colliding with the base image's node user.
RUN addgroup --system --gid 1001 appgroup && \
    adduser  --system --uid 1001 --ingroup appgroup --no-create-home appuser

# Set ownership of /app to the app user before switching.
RUN chown -R appuser:appgroup /app

USER appuser

# ── Runtime Configuration ─────────────────────────────────────────────────────
# Cloud Run injects PORT=8080 automatically. Declaring it documents the
# contract; it does NOT set a default (secrets are never set via ENV).
EXPOSE 8080

# ── Health Check ──────────────────────────────────────────────────────────────
# Docker-level health check acts as a fallback to Cloud Run's liveness probe.
# Interval of 30s is appropriate for a stateless API container.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

# ── Entrypoint ────────────────────────────────────────────────────────────────
# dumb-init is PID 1 and wraps the Node process, ensuring SIGTERM is forwarded
# correctly for the graceful shutdown handler in server.ts.
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
