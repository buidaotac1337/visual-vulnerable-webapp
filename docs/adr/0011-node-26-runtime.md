# 0011. Nâng Node.js frontend lên 26.13.1 và cài pnpm bằng npm

## Status

Accepted

* **Date:** 2026-11-28
* **Deciders:** Maintainers / Agents

## Context

[ADR-0001](0001-uv-workspace-and-pinned-dependencies.md) và [ADR-0002](0002-frontend-typescript-and-design-system.md) ghim frontend vào Node.js `22.21.1` (`.nvmrc`, `node:22.21.1-alpine`, `actions/setup-node`). Máy dev hiện chỉ cài Node `26.13.1`. nvm-windows đọc `.nvmrc` nên từ chối chạy `node`/`pnpm`, và gate `frontend` phải chạy qua Docker.

Từ Node.js 25, corepack không còn đi kèm bản phân phối. Image `node:26.13.1-alpine` không có lệnh `corepack`, trong khi `core/frontend/Dockerfile` và đường fallback Docker trong `scripts/quality/runners.py` đều dùng `corepack enable && corepack prepare pnpm@...`.

## Decision Drivers

* Phiên bản Node khớp với máy dev và giữ nguyên quy tắc ghim chính xác.
* Không để gate hay image Docker phụ thuộc vào công cụ mà runtime đã bỏ.

## Decision

1. Ghim Node.js `26.13.1` ở mọi nơi: `core/frontend/.nvmrc`, `FROM node:26.13.1-alpine` trong `core/frontend/Dockerfile`, `PINNED_NODE_IMAGE` trong `scripts/quality/runners.py`, `node-version` của `actions/setup-node` trong CI, và `engines.node` là `>=26.13.1 <27.0.0`.
2. Cài pnpm bằng `npm install -g pnpm@10.12.1` thay cho corepack, cả trong Dockerfile lẫn đường fallback Docker của gate. Trên CI vẫn dùng `pnpm/action-setup` như cũ.
3. Nâng `@types/node` lên `26.6.11` cho khớp với runtime. Cập nhật `pnpm-lock.yaml` tương ứng.
4. Vitest chạy worker bằng `pool: 'forks'` với `execArgv: ['--no-experimental-webstorage']`. Từ Node 25, Node có sẵn `localStorage` toàn cục. Khi không có `--localstorage-file`, biến này là `undefined` và che mất `Storage` của jsdom, làm hỏng các test dùng `window.localStorage`.

Mục 1 thay cho các tag Node đã ghi trong ADR-0001 (mục 4) và ADR-0002 (mục 3). Phần còn lại của hai ADR đó vẫn giữ nguyên hiệu lực.

## Consequences

### Positive

* Gate `frontend` chạy native trên máy dev mà không phải đi qua Docker.
* Image và gate không còn phụ thuộc vào corepack.

### Negative / Trade-offs

* Node 26 chỉ thành LTS từ tháng 10/2026. Lần nâng major tiếp theo cần một ADR mới.
* Lần đầu chạy, Docker phải tải image mới, và volume `vvwa_frontend_node_modules` được cài lại dưới Node 26.

## Verification

* `uv run python scripts/gates.py --gate frontend` chạy được cả native (Node 26.13.1) lẫn qua fallback Docker `node:26.13.1-alpine`.
* Gate `infra` (`docker compose config -q`) và CI job `frontend-gate` dùng `node-version: "26.13.1"`.
