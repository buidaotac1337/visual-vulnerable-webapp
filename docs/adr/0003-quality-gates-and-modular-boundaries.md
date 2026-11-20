# 0003. Thiết lập Quality Gates phân luồng, giới hạn 350 LOC & Barrel Imports

## Status

Accepted

* **Date:** 2026-11-21
* **Deciders:** Project Owner & Engineering Setup

## Context

Khi nhiều AI agents cùng phát triển trên một codebase dài hạn, mã nguồn dễ phình to thành các file hàng nghìn dòng trộn lẫn trách nhiệm, import chéo lộn xộn hoặc thiếu docstring/type hint. Đồng thời, chạy toàn bộ pipeline CI nặng cho những thay đổi chỉ sửa tài liệu gây lãng phí thời gian và tài nguyên.

## Decision Drivers

* Giữ mã nguồn nhỏ gọn, tách biệt trách nhiệm (SRP/SOLID/DRY/SSOT) và dễ bảo trì lâu dài.
* Tự động hóa tối đa các rào chắn chất lượng ở cả local (`pre-commit`, `scripts/gates.py`) và GitHub Actions.
* Tối ưu tốc độ phản hồi CI bằng cách phân luồng chính xác theo đường dẫn thay đổi.

## Decision

1. **Giới hạn kích thước file:** Cứng `<= 350` dòng/file (cảnh báo sớm ở `> 280` dòng) được kiểm tra bởi `scripts/quality/check_file_limits.py` và ESLint `max-lines`.
2. **Barrel Imports bắt buộc:** Kiểm tra bằng AST (`scripts/quality/check_barrels.py`) đối với Python (`__init__.py` + `__all__`) và ESLint `no-restricted-imports` đối với TypeScript (`index.ts`).
3. **Độ phức tạp & Chất lượng mã:** Ruff (`ANN`, `D`, `C90 <= 10`, `PLR`, `S`), `mypy --strict`, ESLint (`complexity <= 10`, `jsdoc`). Riêng `labs/*/backend/vulnerable.py` được miễn chọn lọc nhóm cảnh báo bảo mật có chủ đích.
4. **Phân luồng 5 Gate rõ ràng:**
   * `hygiene` (luôn chạy): Conventional Commits & chuẩn tên nhánh.
   * `docs` (khi chỉ sửa tài liệu): kiểm tra relative link và tính đồng bộ ADR (bỏ qua toàn bộ gate logic).
   * `backend`, `frontend`, `infra`: chỉ chạy khi có file thuộc tầng tương ứng thay đổi.

## Consequences

### Positive
* Phản hồi cực nhanh (< 15s) cho PR tài liệu, trong khi PR sửa logic được bảo vệ chặt chẽ bởi toàn bộ gate liên quan.
* Ngăn chặn triệt để "god files" và spaghetti imports ngay trước khi commit.

### Negative / Trade-offs
* Cần dành thêm vài phút tách file hoặc thêm docstring/barrel khi tạo module mới — đánh đổi hợp lý để đổi lấy tính bền vững cao.

## Verification

* Bộ test tại `scripts/tests/test_quality_gates.py` kiểm chứng toàn bộ checker và bộ phân luồng.
* `.github/workflows/ci.yml` tổng hợp qua job `ci-summary` để gắn Branch Protection.
