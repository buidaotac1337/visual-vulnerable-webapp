# MiniShop Security Labs (`labs/`)

Thư mục này chứa toàn bộ bài thực hành lỗ hổng bảo mật & *Safety Pattern* mà sinh viên mở trực tiếp để đọc, thử nghiệm và tự sửa code với Hot Reload.

## Quy chuẩn cấu trúc mỗi bài Lab

Xem đặc tả đầy đủ tại [docs/04-lab-authoring-and-roadmap.md](../docs/04-lab-authoring-and-roadmap.md):

```text
labs/<id>-<slug>/
├── meta.json          # Metadata, payload mẫu và bộ verifyTests
├── README.md          # Giải thích lý thuyết ngắn gọn
├── backend/
│   ├── vulnerable.py  # File có lỗ hổng sư phạm (sinh viên mở trực tiếp để vá)
│   └── secure.py      # Bản chuẩn áp dụng Safety Pattern
└── frontend/
    ├── LabView.tsx    # Giao diện MiniShop Sandbox cho bài lab (không chứa sink)
    ├── vulnerable.tsx # (Tùy chọn, đi theo cặp) Sink frontend có lỗ hổng sinh viên vá
    └── secure.tsx     # (Tùy chọn, đi theo cặp) Sink frontend an toàn
```

> **Lưu ý an toàn:** Chỉ đặt mã có lỗ hổng có chủ đích bên trong `labs/<id>/backend/vulnerable.py` và `labs/<id>/frontend/vulnerable.tsx`. Không tạo lỗ hổng trong `core/`, `LabView.tsx` hoặc các file `secure.*` ([ADR-0006](../docs/adr/0006-frontend-sink-grading-and-verify-matchers.md)).
