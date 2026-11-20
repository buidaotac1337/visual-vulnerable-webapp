# 0001. Sử dụng Python `uv` Workspace & Pin Exact Version toàn bộ Stack

## Status

Accepted

* **Date:** 2026-11-21
* **Deciders:** Project Owner & Engineering Setup

## Context

Dự án VVWA hướng tới mô hình sinh viên tự clone và chạy local bằng Docker, đồng thời phát triển song song với nhiều AI coding agents. Nếu phụ thuộc Python (`requirements.txt` không lock), Frontend (`^`/`~` ranges) hoặc Docker image (`:latest`) trôi phiên bản, môi trường dễ phát sinh lỗi không tái lập được giữa local và CI.

## Decision Drivers

* Tái lập tuyệt đối (deterministic builds) trên Windows, macOS, Linux và GitHub Actions.
* Tốc độ cài đặt và đồng bộ môi trường nhanh để agent lặp vòng kiểm thử liên tục.
* Một nguồn sự thật duy nhất (SSOT) cho toàn bộ cấu hình tooling.

## Decision

1. Quản lý Python bằng **`uv` workspace** tại root (`pyproject.toml`, `uv.lock`, `.python-version = 3.12.14`) với workspace member `core/backend`.
2. Pin chính xác phiên bản (`==`) cho tất cả Python runtime & dev dependencies trong `pyproject.toml`.
3. Frontend quản lý bằng **`pnpm`** với `save-exact=true`, `engine-strict=true` và commit `pnpm-lock.yaml`.
4. Pin chính xác tag cho toàn bộ Docker base image (`python:3.12.14-slim`, `ghcr.io/astral-sh/uv:0.13.1`, `node:22.21.1-alpine`, `postgres:16.11-alpine`) và GitHub Actions.

## Consequences

### Positive
* `uv sync --frozen` và `pnpm install --frozen-lockfile` đảm bảo môi trường giống hệt nhau 100% giữa mọi máy và CI.
* Rút ngắn thời gian cài đặt Python xuống vài giây nhờ cache của `uv`.

### Negative / Trade-offs
* Khi cần nâng cấp thư viện phải cập nhật tường minh file manifest và lockfile (có chủ đích, tránh nâng cấp âm thầm gây vỡ bài lab).

## Verification

* CI luôn chạy `uv sync --frozen` và `pnpm install --frozen-lockfile`.
* `AGENTS.md` và PR template kiểm soát quy tắc không dùng version floating.
