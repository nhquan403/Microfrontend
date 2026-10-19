---
phase: 3
title: "portal-api in-memory"
status: pending
effort: 1d
dependsOn: [1]
---

# Phase 03: portal-api in-memory

## Mục tiêu
Đổi `apps/demo-api` thành `apps/portal-api`: một API chung cho mọi app. Dữ liệu lưu trong bộ nhớ, có seed, có kiểm tra dữ liệu đầu vào, và kiểm role riêng cho từng nhóm endpoint.

## File tạo hoặc sửa
- Đổi tên project bằng `nx g @nx/workspace:move --projectName=demo-api --destination=apps/portal-api --newProjectName=portal-api`. Cập nhật `apps/shell-e2e/project.json`, `playwright.config.ts` và README.
- `apps/portal-api/src/auth.ts`: tách `requireBearer` và `requireRole` từ `app.ts` hiện tại.
- `apps/portal-api/src/store/in-memory-repository.ts`: repository generic, có `list`, `get`, `create`, `update`, `remove`. Id tạo bằng `crypto.randomUUID()`, có `createdAt` và `updatedAt`.
- `apps/portal-api/src/store/seed.ts`: dữ liệu mẫu cố định (task, liên hệ, ghi chú cho `alice` và `bob` theo `sub`, gắn sau lần gọi đầu tiên).
- `apps/portal-api/src/features/`:
  - `demo.routes.ts`: giữ `/api/hello` và `/api/echo` cho remote demo (role `demo-access`).
  - `tasks.routes.ts` (role `tasks-access`): `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/:id`. Trường gồm `title`, `description`, `status` (`todo`, `doing`, `done`), `assignee`, `dueDate`. Có lọc `?assignee=` và `?status=`.
  - `contacts.routes.ts` (role `contacts-access`): CRUD và `?q=` tìm theo tên, email, công ty. Trường gồm `name` (bắt buộc), `email` (định dạng hợp lệ), `phone`, `company`, `title`.
  - `notes.routes.ts` (role `notes-access`): CRUD và `?q=`, trường `pinned`. **Mọi truy vấn đều lọc theo `ownerSub = token.sub`**. Truy cập ghi chú của người khác trả 404, không phải 403, để không lộ việc ghi chú đó tồn tại.
  - `reports.routes.ts` (role `reports-access`): `GET /api/reports/summary` trả về số task theo trạng thái, số task quá hạn, tổng số liên hệ, số liên hệ theo công ty (top 5), và tổng số ghi chú (chỉ con số, không có nội dung).
- `apps/portal-api/src/validation.ts`: schema `zod` (4.6.7, ghim chính xác) cho body và query. Lỗi trả 400 kèm danh sách field, không echo lại input thô.
- Giới hạn body 16 KB. Giới hạn số bản ghi mỗi collection (ví dụ 1.000), vượt quá trả 409.
- `.env.example`: đổi biến `DEMO_API_*` thành `PORTAL_API_*`, giữ tương thích bằng giá trị mặc định.

## Các bước
1. Đổi tên project và chạy lại e2e cũ để chắc không vỡ.
2. Viết repository và seed.
3. Viết từng nhóm route cùng test bằng supertest và token tự ký (giống test hiện tại).

## Kiểm chứng
- `npx nx run-many -t lint test build -p portal-api` qua. Test phủ các trường hợp:
  - Thiếu role thì 403, ở từng nhóm route.
  - Body sai thì 400.
  - Notes: `bob` không đọc, sửa hay xoá được ghi chú của `alice` (404).
  - `/api/reports/summary` thay đổi khi tạo hoặc xoá task.
- `npm audit --audit-level=high` vẫn qua sau khi thêm `zod`.

## Rủi ro
- Đổi tên project làm lệch đường dẫn build trong config e2e. Phải tìm và thay hết chuỗi `demo-api`.

## Rollback
Revert commit. Project đổi tên quay về `demo-api`.
