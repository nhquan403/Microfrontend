---
phase: 4
title: "Realm, registry, BFF và shell"
status: pending
effort: 1d
dependsOn: [1, 2, 3]
---

# Phase 04: Realm, registry, BFF và shell

## Mục tiêu
Khai báo 4 app mới ở mọi lớp: role trong Keycloak, mục trong registry, kiểm role theo đường dẫn API ở BFF, và vùng toast cùng trang chủ dạng dashboard ở shell. Đây là phase **duy nhất** được sửa các file dùng chung (`registry.config.json`, file realm, code của shell).

## File tạo hoặc sửa
- `infra/keycloak/realm-microfrontend.json`:
  - Thêm 4 realm role `tasks-access`, `contacts-access`, `notes-access`, `reports-access`.
  - `alice` có đủ 4 role mới. `bob` chỉ có `tasks-access` và `notes-access`.
  - Hướng dẫn trong README: chạy `npm run infra:down && npm run infra:up` để import lại realm.
- `apps/bff/registry.config.json`: thêm 4 mục `tasks`, `contacts`, `notes`, `reports`. Mỗi mục có `route`, `icon`, `requiredRoles`, `devUrl` (4202 đến 4205), `staticDir` và `apiPrefix` (ví dụ `/api/tasks`).
- `apps/bff/src/registry/registry.ts`: thêm trường `apiPrefix` (tuỳ chọn, phải bắt đầu bằng `/api/`, kiểm chặt khi parse).
- `apps/bff/src/gateway/gateway-routes.ts`: `/api/*` kiểm role theo `apiPrefix` của registry, kèm prefix `/api/hello` và `/api/echo` cho demo. Prefix không khớp mục nào thì trả 404 ngay ở BFF. Đây là phần còn lại của lỗi M5.
- `apps/shell/src/app/app.html` và `app.ts`: thêm `<mf-toast-region>` bind với `NotificationService.toasts()`.
- `apps/shell/src/app/pages/home.page.ts`: lưới `mf-card` với lối tắt tới từng app trong registry (icon, tiêu đề, mô tả lấy thêm từ trường `description` của registry).
- `apps/shell/src/app/app.config.ts`: không cần provider mới (`NotificationService` là `providedIn: 'root'`). Phải kiểm tra remote nhận đúng instance của shell.
- Test: `gateway-routes.spec.ts` (kiểm role theo prefix, prefix lạ trả 404), `home.page.spec.ts`, và test vùng toast trong `app.spec.ts`.

## Các bước
1. Sửa realm, import lại, kiểm `alice` và `bob` có đúng role (dùng script kiểm token claims, chỉ in tên role).
2. Sửa registry và BFF, chạy test.
3. Sửa shell, chạy test và build.

## Kiểm chứng
- `npx nx run-many -t lint test build -p bff shell` qua.
- Gọi `/registry` bằng session thật: `alice` có 5 remote, `bob` có 2 remote (tasks, notes) và `restrictedRoutes` là `demo`, `contacts`, `reports`.
- `bob` gọi `/api/contacts` thì nhận 403 từ BFF, chưa tới portal-api (kiểm bằng log của portal-api).

## Rủi ro
- Remote chưa tồn tại ở phase này, nên sidebar có mục mà bấm vào sẽ hiện trang lỗi remote. Đây là trạng thái tạm, được giải quyết ở phase 05 đến 08.

## Rollback
Revert commit. Registry và realm quay về chỉ có `demo`.
