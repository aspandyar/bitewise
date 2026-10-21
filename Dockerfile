# syntax=docker/dockerfile:1
# Production image: Next.js standalone server plus the bundled release scripts (ops/*.js).

FROM node:24-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# Modules read env at import time and `next build` imports them. These placeholders are not
# secrets (#19); set on the command, not as ENV, they stay out of the image config entirely.
ENV NEXT_TELEMETRY_DISABLED=1
RUN DATABASE_URL=postgres://build:build@localhost:5432/build \
    NEXTAUTH_SECRET=build-time-placeholder-not-a-secret-000000 \
    NEXTAUTH_URL=https://build.invalid \
    sh -c 'pnpm build && pnpm ops:build'

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
# Code stays owned by root: the server process (user node) can read it but not rewrite it (#102).
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/ops ./ops
COPY --from=build /app/db/migrations ./db/migrations
COPY --from=build /app/db/seed/foods.json ./db/seed/foods.json
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health > /dev/null || exit 1
CMD ["node", "server.js"]
