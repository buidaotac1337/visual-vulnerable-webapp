# syntax=docker/dockerfile:1.10
FROM node:26.13.1-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"

# Node 25+ no longer bundles corepack (ADR-0011): install the pinned pnpm with npm.
RUN npm install -g pnpm@10.12.1

WORKDIR /app/core/frontend

COPY core/frontend/package.json core/frontend/pnpm-lock.yaml core/frontend/.npmrc ./

RUN pnpm install --frozen-lockfile && mkdir -p /app/labs

COPY core/frontend ./

EXPOSE 5173

CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "5173"]
