---
title: "Bốn app tính năng: Tasks, Contacts, Notes, Reports"
description: "Thêm 4 remote Angular dùng chung design system, mỗi remote là một mục ở sidebar và có role riêng, chạy trên một API in-memory chung. Trước đó sửa các lỗi bảo mật từ đợt review."
status: pending
priority: P1
effort: 7d
branch: feat/angular-mf-host-shell
tags: [feature, frontend, backend, auth]
blockedBy: []
blocks: []
created: 2026-10-19
---

# Bốn app tính năng: Tasks, Contacts, Notes, Reports

## Tổng quan

Plan này mở rộng portal hiện có (shell + BFF + Keycloak, xem `plans/261019-1206-angular-mf-host-shell/`) thêm 4 remote. Mỗi remote là một mục ở sidebar, có role riêng, và dùng chung design system (`@mf/design-tokens` và `@mf/ui-components`, được mở rộng thêm form, card, dialog, toast). Dữ liệu nằm trong một API in-memory chung (`apps/portal-api`, đổi tên từ `demo-api`), có seed sẵn và mất khi restart.

Trước khi làm tính năng mới, phase 01 sửa các lỗi từ đợt review bảo mật (`plans/reports/code-review-261019-1325-bff-shell-security.md`). Các app mới dựa trực tiếp vào phần BFF có lỗi, nhất là việc kiểm role trên `/api`.

## Quyết định đã chốt (người dùng chọn ngày 2026-10-19)

- **App:** Tasks (Kanban), Contacts (danh bạ), Notes (ghi chú cá nhân), Reports (dashboard chỉ đọc).
- **Dữ liệu:** một API in-memory chung, có seed.
- **Phân quyền:** mỗi app một role: `tasks-access`, `contacts-access`, `notes-access`, `reports-access`.
  - `alice` có cả 4 role (và giữ `demo-access`).
  - `bob` chỉ có `tasks-access` và `notes-access`, để sidebar của hai người khác nhau.

## Tính năng thêm vào (đề xuất trong plan)

- **Thông báo dùng chung (toast):** shell hiển thị một vùng toast. Remote gọi `NotificationService` (singleton, chia sẻ qua federation), ví dụ "Đã tạo task". Đây là ví dụ cho việc các app giao tiếp qua một hợp đồng nhỏ.
- **Trang chủ dạng dashboard:** trang Home của shell hiển thị thẻ lối tắt cho từng app mà người dùng có quyền.

## Port cố định (bổ sung)

- `4202`: dev server của tasks-remote.
- `4203`: dev server của contacts-remote.
- `4204`: dev server của notes-remote.
- `4205`: dev server của reports-remote.
- Giữ nguyên: 4000 (BFF), 4100 (portal-api), 4200 (shell), 4201 (demo-remote), 8080 (Keycloak).

## Các phase

1. [Phase 01: Sửa lỗi từ review bảo mật](phase-01-security-review-fixes.md). Trạng thái: pending. Không phụ thuộc phase nào.
2. [Phase 02: Mở rộng design system và thư viện dùng chung](phase-02-shared-ui-and-services.md). Trạng thái: pending. Không phụ thuộc phase nào, làm song song được với phase 01.
3. [Phase 03: portal-api in-memory](phase-03-portal-api.md). Trạng thái: pending. Cần phase 01.
4. [Phase 04: Realm, registry, BFF và shell](phase-04-realm-registry-shell.md). Trạng thái: pending. Cần phase 01, 02, 03.
5. [Phase 05: Remote Tasks](phase-05-tasks-remote.md). Trạng thái: pending. Cần phase 04.
6. [Phase 06: Remote Contacts](phase-06-contacts-remote.md). Trạng thái: pending. Cần phase 04.
7. [Phase 07: Remote Notes](phase-07-notes-remote.md). Trạng thái: pending. Cần phase 04.
8. [Phase 08: Remote Reports](phase-08-reports-remote.md). Trạng thái: pending. Cần phase 04.
9. [Phase 09: E2E, tài liệu](phase-09-e2e-docs.md). Trạng thái: pending. Cần phase 01 đến 08.

Phase 05 đến 08 độc lập với nhau (mỗi phase sở hữu riêng `apps/<x>-remote/**`), nên chạy song song được. Riêng `apps/bff/registry.config.json` và `infra/keycloak/realm-microfrontend.json` chỉ được sửa ở phase 04.

## Kiến trúc bổ sung

```
Sidebar: Home | Demo | Tasks | Contacts | Notes | Reports   (lọc theo role)
                         │       │         │        │
                /apps/tasks/  /apps/contacts/ /apps/notes/ /apps/reports/   (BFF kiểm role)
                         │       │         │        │
BFF /api/<app>/*  ──►  kiểm role theo tiền tố đường dẫn  ──►  portal-api :4100
                                                             ├─ /api/tasks     (tasks-access)
                                                             ├─ /api/contacts  (contacts-access)
                                                             ├─ /api/notes     (notes-access, lọc theo owner = sub)
                                                             └─ /api/reports   (reports-access, chỉ đọc, tổng hợp)
```

## Tiêu chí nghiệm thu

1. Các lỗi High và Medium trong báo cáo review đều được sửa, mỗi lỗi có test dựng lại tình huống.
2. `alice` thấy sidebar "Home, Demo, Tasks, Contacts, Notes, Reports". `bob` thấy "Home, Tasks, Notes". Khi bob gõ thẳng `/contacts` hoặc `/reports` thì vào `/forbidden`, và BFF trả 403 cho cả `/apps/<x>/*` lẫn `/api/<x>/*`.
3. Tasks: tạo, sửa, xoá task, chuyển cột Todo, Doing, Done (bằng nút và bằng kéo thả), lọc theo người phụ trách.
4. Contacts: danh sách, tìm kiếm, xem chi tiết, thêm, sửa, xoá. Form có kiểm tra dữ liệu (tên bắt buộc, email hợp lệ).
5. Notes: tạo, sửa, xoá, ghim, tìm kiếm. Ghi chú của `alice` không bao giờ hiển thị hay sửa được bởi `bob`, kể cả khi gọi API trực tiếp.
6. Reports: các thẻ KPI và biểu đồ phản ánh đúng dữ liệu hiện tại. Tạo một task thì số liệu trên Reports thay đổi tương ứng.
7. Cả 4 app dùng chung design tokens và component `mf-*`, không có mã màu hex trong code của remote. Toast hiển thị khi tạo, sửa hoặc xoá dữ liệu.
8. Cả trang chỉ có một bản `@angular/core`. Không có vi phạm CSP hay Trusted Types trên mọi app.
9. `npm run check`, `npm audit --audit-level=high` và `npm run e2e` (gồm bộ e2e cũ và mới) đều qua.

## Rủi ro chính

- **Form với Web Components:** Reactive Forms của Angular không tự bind với `mf-input`. Phase 02 thêm `ControlValueAccessor` trong `libs/ui-angular`. Phải test kỹ trạng thái validation, touched và disabled.
- **Kéo thả trong Kanban:** dùng HTML5 drag and drop sẽ không dùng được bằng bàn phím. Vì vậy luôn có thêm nút chuyển cột.
- **Dữ liệu in-memory:** mất khi restart, không phù hợp production. Đây là quyết định có chủ đích của đợt này.
- **Build chậm hơn:** thêm 4 remote. Nx cache cùng `cacheExternalArtifacts` của Native Federation sẽ giảm chi phí build lặp lại.

## Câu hỏi còn mở

Không còn câu hỏi chặn việc triển khai. Remote `demo` được giữ lại làm remote tham chiếu và để bộ e2e cũ vẫn chạy.
