# Đóng góp

Quy trình phát triển VVWA: môi trường dev, quy ước nhánh và commit, Quality Gates, chuẩn code và ADR. Bản tóm tắt dành cho AI coding agents: [AGENTS.md](../AGENTS.md).

## 1. Môi trường phát triển

| Công cụ | Phiên bản | Bắt buộc |
| :--- | :--- | :---: |
| `uv` | Python `3.12.14` (pin trong `.python-version`) | ✓ |
| Docker Desktop | Compose v2 | ✓ (chạy stack, gate `infra`, fallback cho gate `frontend`) |
| Node.js + `pnpm` | `26.13.1` (`core/frontend/.nvmrc`) + `10.12.1` | Khuyến nghị (gate `frontend` chạy nhanh hơn khi có sẵn) |

```bash
# Cài môi trường Python và dev tooling từ uv.lock
uv sync --frozen

# Cài git hooks (pre-commit, commit-msg, pre-push)
uv run pre-commit install --hook-type pre-commit --hook-type commit-msg --hook-type pre-push

# (Tùy chọn) biến môi trường local
cp .env.example .env
```

Chạy stack: xem [Cài đặt & Vận hành](getting-started.md).

## 2. Nhánh & commit

* Không commit trực tiếp lên `main`; hook `no-commit-to-branch` chặn việc này.
* Tên nhánh: `<type>/<kebab-slug>` với `type` thuộc `feat`, `fix`, `lab`, `docs`, `refactor`, `chore`, `ci`, `adr`.

  | Type | Dùng cho | Ví dụ |
  | :--- | :--- | :--- |
  | `feat` | Tính năng nền tảng | `feat/source-reader` |
  | `lab` | Thêm hoặc nâng cấp bài lab | `lab/02-stored-xss` |
  | `fix` | Sửa lỗi | `fix/cors-headers` |
  | `docs` | Chỉ tài liệu | `docs/improve-setup-guide` |
  | `adr` | Thêm hoặc cập nhật ADR | `adr/0007-race-condition-tests` |
  | `refactor`, `chore`, `ci` | Tái cấu trúc, bảo trì, CI/CD | `ci/cache-pnpm` |

* Commit theo Conventional Commits, tiêu đề tối đa 72 ký tự:

  ```text
  <type>(<scope>): <mô tả ngắn>
  ```

  `type` cho commit còn chấp nhận thêm `test`, `style`, `perf`, `build`. Ví dụ: `feat(lab-01): implement vulnerable and secure login handlers`.

## 3. Quality Gates

Chạy trước mỗi commit và PR. Gate được chọn tự động theo file thay đổi:

```bash
uv run python scripts/gates.py --auto
```

| Gate | Kích hoạt khi đổi | Nội dung kiểm tra |
| :--- | :--- | :--- |
| `hygiene` | Luôn chạy | Tên nhánh (và tiêu đề PR trên CI) |
| `docs` | `docs/**`, `*.md`, `LICENSE`, `scripts/**`, `pyproject.toml` | Link tương đối trong Markdown, đặt tên và đăng ký ADR |
| `backend` | `core/backend/**`, `labs/*/backend/**`, `labs/*/meta.json`, `scripts/**`, `pyproject.toml`, `uv.lock`, `.python-version` | Giới hạn dòng, barrel, `ruff check`, `ruff format --check`, `mypy --strict`, `pytest` |
| `frontend` | `core/frontend/**`, `labs/*/frontend/**`, `scripts/**`, `pyproject.toml` | Giới hạn dòng, barrel, design token SSOT (`check_design_tokens`, [ADR-0012](adr/0012-atlassian-style-design-tokens.md)), `pnpm lint`, `format:check`, `typecheck`, `test`, `build` (dùng Docker `node:26.13.1-alpine` nếu máy không có `pnpm`) |
| `infra` | `docker-compose.yml`, `**/Dockerfile`, `.dockerignore`, `core/postgres/**`, `.github/**`, `.pre-commit-config.yaml`, `.env.example`, `scripts/**` | `init.sql`/`seed.sql` không rỗng, `docker compose config` |

Chạy đích danh:

```bash
uv run python scripts/gates.py --gate docs      # hoặc backend | frontend | infra | all
```

Bộ phân loại ở [`scripts/quality/classifier.py`](../scripts/quality/classifier.py) và bộ lọc đường dẫn ở [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) phải luôn khớp nhau. CI tổng hợp kết quả qua job `ci-summary`.

## 4. Chuẩn code

| Quy tắc | Chi tiết |
| :--- | :--- |
| Kích thước file | Mọi `.py`, `.ts`, `.tsx`, `.css`, `.sql` trong `core/`, `labs/`, `scripts/` tối đa **350 dòng**, cảnh báo từ 281 dòng |
| Độ phức tạp | McCabe ≤ 10 (Ruff `C90`, ESLint `complexity`) |
| Barrel import | Python: `__init__.py` có `__all__`, import qua package (`from app.schemas import HealthResponse`). Frontend: `index.ts`, import qua `@/components`, `@/hooks`, `@/lib`, `@/types` |
| Type & tài liệu | Python: `mypy --strict`, Ruff `ANN` + `D` (docstring Google). Frontend: `tsc --noEmit` strict, `noUncheckedIndexedAccess`, `explicit-function-return-type`, JSDoc cho symbol export |
| Pin version | Python `==` trong `pyproject.toml` + `uv lock`; `pnpm` không dùng `^`/`~`; Docker và GitHub Actions dùng tag cụ thể, không `:latest` |
| Ranh giới bảo mật | Lỗ hổng có chủ đích chỉ trong `labs/<id>/backend/vulnerable.py` và `labs/<id>/frontend/vulnerable.tsx` ([Kiến trúc](architecture.md#8-ranh-giới-bảo-mật)) |

Cấu hình ngưỡng là SSOT trong `[tool.vvwa.quality]` của [`pyproject.toml`](../pyproject.toml).

## 5. ADR

Tạo ADR mới khi thay đổi:

* Framework, database, package manager hoặc thư viện lõi (thêm, thay, gỡ).
* Hợp đồng API, cấu trúc `trace`, schema `meta.json`, cú pháp `@step` / `@snippet`.
* Cấu trúc thư mục, ranh giới `core/` – `labs/`, quy chuẩn barrel, ngưỡng Quality Gate.
* Cơ chế sandbox hoặc phân quyền PostgreSQL.

Các bước:

1. Sao chép [`docs/adr/0000-template.md`](adr/0000-template.md) thành `NNNN-short-kebab-title.md`.
2. Điền đủ `## Status`, `## Context`, `## Decision`, `## Consequences`.
3. Thêm một dòng vào bảng trong [`docs/adr/README.md`](adr/README.md).
4. Chạy `uv run python scripts/gates.py --gate docs`.

## 6. Pull request

* Tiêu đề PR theo Conventional Commits (CI kiểm tra).
* Điền checklist trong [`.github/pull_request_template.md`](../.github/pull_request_template.md).
* Thêm bài lab mới: làm theo [Tạo bài lab](lab-authoring.md#9-checklist-trước-khi-mở-pr).
* Cập nhật tài liệu liên quan trong cùng PR khi thay đổi hành vi, API hoặc schema.
