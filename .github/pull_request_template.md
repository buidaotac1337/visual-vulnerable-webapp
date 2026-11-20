## Summary

<!-- Mô tả ngắn gọn mục tiêu và phạm vi thay đổi -->

## Change Scope (Gate Selection)

- [ ] Docs-only (`docs/**`, `*.md`) -> Chạy `Gate 0 + Gate 1 (docs)`
- [ ] Backend / Lab Python / Scripts -> Chạy `Gate 0 + Gate 2 (backend)`
- [ ] Frontend / Lab UI -> Chạy `Gate 0 + Gate 3 (frontend)`
- [ ] Infra / Postgres / CI -> Chạy `Gate 0 + Gate 4 (infra)`

## Engineering Quality Checklist

- [ ] Nhánh đặt đúng chuẩn `<type>/<kebab-slug>` và tiêu đề PR theo Conventional Commits.
- [ ] Đã chạy `uv run python scripts/gates.py --auto` và pass 100%.
- [ ] Mọi file source mới/sửa đều `<= 350` dòng và tách rõ trách nhiệm (SRP/SOLID/DRY/SSOT).
- [ ] Tuân thủ Barrel Imports (`__init__.py` + `__all__`, `index.ts`) — không deep import xuyên module.
- [ ] Đầy đủ Type Hinting & Docstrings / JSDoc.
- [ ] Mọi package mới (nếu có) đều pin exact version và cập nhật lockfile (`uv.lock` / `pnpm-lock.yaml`).
- [ ] Nếu có thay đổi kiến trúc: đã tạo & đăng ký ADR trong `docs/adr/README.md`.
- [ ] Không đưa mã lỗ hổng có chủ đích ra ngoài `labs/<id>/backend/vulnerable.py` hoặc lab sandbox UI.
