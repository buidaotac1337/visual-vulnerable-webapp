# Contributing Guide — Visual Vulnerable Web App (VVWA)

Tài liệu hướng dẫn quy trình phát triển chuẩn cho cả thành viên dự án lẫn AI coding agents. Xem thêm bản tóm tắt kỹ thuật tại [AGENTS.md](../AGENTS.md).

## 1. Cài đặt môi trường Local

### Yêu cầu tối thiểu
* **Python package manager:** `uv` (đã pin Python `3.12.14` trong `.python-version`).
* **Containers:** Docker Desktop (chạy toàn bộ stack qua `docker compose up` và tự động làm fallback cho Frontend gate nếu máy chưa cài Node).
* *(Khuyến nghị để chạy hook Frontend nhanh hơn)*: Node.js `22.21.1` + `pnpm` `10.12.1`.

### Khởi tạo lần đầu
```bash
# 1. Cài môi trường Python + dev tooling từ uv.lock
uv sync --frozen

# 2. Cài git hooks tự động (pre-commit, commit-msg, pre-push)
uv run pre-commit install --hook-type pre-commit --hook-type commit-msg --hook-type pre-push

# 3. Tạo file biến môi trường local
cp .env.example .env
```

## 2. Quy chuẩn Tạo Nhánh & Commit

1. **Luôn tách nhánh từ `main`** theo mẫu `<type>/<short-kebab-slug>`:
   * `feat/` — Tính năng nền tảng mới (`feat/source-reader`)
   * `lab/` — Thêm hoặc nâng cấp bài lab (`lab/01-sql-injection`)
   * `fix/` — Sửa lỗi (`fix/cors-headers`)
   * `docs/` — Chỉ cập nhật tài liệu (`docs/improve-setup-guide`)
   * `adr/` — Thêm hoặc cập nhật Architecture Decision Record (`adr/0004-trace-format`)
   * `refactor/`, `chore/`, `ci/` — Tái cấu trúc, bảo trì, CI/CD.
2. **Tuân thủ Conventional Commits:**
   * `<type>(<scope>): <mô tả ngắn gọn <= 72 ký tự>`
   * Ví dụ: `feat(lab-01): implement vulnerable and secure login handlers`

## 3. Chạy Quality Gates trước khi mở PR

Hệ thống tự động phân luồng theo file bạn thay đổi:
```bash
# Tự động chọn đúng gate dựa trên git status
uv run python scripts/gates.py --auto

# Hoặc chạy đích danh từng gate
uv run python scripts/gates.py --gate docs
uv run python scripts/gates.py --gate backend
uv run python scripts/gates.py --gate frontend
uv run python scripts/gates.py --gate infra
```

## 4. Khi nào cần viết ADR?

Mọi thay đổi kiến trúc quan trọng đều phải được ghi nhận tại [docs/adr/README.md](adr/README.md) theo mẫu [docs/adr/0000-template.md](adr/0000-template.md). Gate `docs` sẽ tự động kiểm tra tính đồng bộ của thư mục ADR.
