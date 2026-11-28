# 0002. Nâng cấp Frontend sang Strict TypeScript & Tailwind CSS v4

## Status

Accepted

* **Date:** 2026-11-21
* **Deciders:** Project Owner & Engineering Setup

## Context

Tài liệu thiết kế ban đầu (`01-architecture.md`, `04-lab-authoring-and-roadmap.md`) phác thảo component Frontend bằng `.jsx`/`.js`. Tuy nhiên, dự án có hợp đồng dữ liệu phức tạp (Execution Trace JSON, metadata bài lab, kết quả Verify) và được phát triển theo hướng agentic coding yêu cầu kiểm soát kiểu dữ liệu chặt chẽ.

## Decision Drivers

* Bắt lỗi sai hợp đồng API ngay tại compile-time (`tsc --noEmit`) trước khi chạy trình duyệt.
* Đảm bảo mọi AI agent hiểu rõ cấu trúc props, API payload và barrel exports.
* Giữ nguyên stack React + Vite + Tailwind CSS v4 + Design System "Dual-Surface Pedagogy". *(Token màu, font và type scale của design system được thay theo [ADR-0012](0012-atlassian-style-design-tokens.md).)*

## Decision

1. Sử dụng **TypeScript strict mode** (`strict: true`, `noUncheckedIndexedAccess: true`) cho toàn bộ mã nguồn trong `core/frontend/` và `labs/*/frontend/` (`.ts`, `.tsx`).
2. Áp dụng ESLint v9 Flat Config kèm `@typescript-eslint` (`explicit-function-return-type`, `no-explicit-any`), `eslint-plugin-jsdoc` và `no-restricted-imports` để ép barrel imports.
3. Sử dụng Vitest làm unit test runner cho Frontend và cung cấp cơ chế chạy hybrid (native `pnpm` nếu host có Node, tự động fallback Docker `node:22.21.1-alpine` nếu chưa cài Node). *(Tag Node được thay bằng `node:26.13.1-alpine` theo [ADR-0011](0011-node-26-runtime.md).)*

## Consequences

### Positive
* Ngăn ngừa lỗi runtime trên UI Trace Inspector và giữ đồng bộ chặt với schema Pydantic của Backend.
* Tối ưu khả năng tự kiểm chứng của AI agent thông qua `pnpm typecheck` + `pnpm lint`.

### Negative / Trade-offs
* Sinh viên xem `LabView.tsx` sẽ thấy thêm type annotation cơ bản; các bài lab cần viết type gọn, dễ đọc đúng mục tiêu sư phạm.

## Verification

* Gate `frontend` chạy `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` trên mọi thay đổi Frontend.
