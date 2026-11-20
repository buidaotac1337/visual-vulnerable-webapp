# syntax=docker/dockerfile:1.10
FROM python:3.12.14-slim AS base

COPY --from=ghcr.io/astral-sh/uv:0.13.1 /uv /uvx /bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR /app

COPY pyproject.toml uv.lock .python-version ./
COPY core/backend/pyproject.toml ./core/backend/pyproject.toml

RUN uv sync --frozen --no-dev --package vvwa-backend --no-install-project \
    && mkdir -p /app/labs

COPY core/backend/app ./core/backend/app
COPY core/postgres/seed.sql ./core/postgres/seed.sql

ENV PATH="/app/.venv/bin:${PATH}" \
    PYTHONPATH="/app/core/backend:/app"

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "/app/core/backend/app"]
