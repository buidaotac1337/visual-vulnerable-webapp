# syntax=docker/dockerfile:1.10
FROM node:22.21.1-alpine AS base

ENV PNPM_HOME="/pnpm" \
    PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

WORKDIR /app/core/frontend

COPY core/frontend/package.json core/frontend/pnpm-lock.yaml core/frontend/.npmrc ./

RUN pnpm install --frozen-lockfile && mkdir -p /app/labs

COPY core/frontend ./

EXPOSE 5173

CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "5173"]
