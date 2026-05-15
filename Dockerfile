FROM node:24-slim AS frontend-deps

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci


FROM node:24-slim AS frontend-builder

WORKDIR /app/frontend

ARG NEXT_PUBLIC_API_BASE_URL=/api
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=

ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=frontend-deps /app/frontend/node_modules ./node_modules
COPY frontend/ ./

RUN npm run build
RUN npm prune --omit=dev


FROM node:24-slim AS frontend

WORKDIR /app/frontend

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=frontend-builder /app/frontend/package.json ./package.json
COPY --from=frontend-builder /app/frontend/package-lock.json ./package-lock.json
COPY --from=frontend-builder /app/frontend/next.config.ts ./next.config.ts
COPY --from=frontend-builder /app/frontend/public ./public
COPY --from=frontend-builder /app/frontend/.next ./.next
COPY --from=frontend-builder /app/frontend/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "run", "start"]


FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS backend

WORKDIR /app/backend

ENV PATH="/app/backend/.venv/bin:${PATH}"
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy
ENV PYTHONUNBUFFERED=1

COPY backend/pyproject.toml backend/uv.lock backend/.python-version ./
RUN uv sync --frozen --no-dev --no-install-project

COPY backend/ ./
RUN uv sync --frozen --no-dev

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
