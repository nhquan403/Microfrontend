---
phase: 9
title: "E2E, tài liệu"
status: pending
effort: 1d
dependsOn: [1, 2, 3, 4, 5, 6, 7, 8]
---

# Phase 09: E2E và tài liệu

## Mục tiêu
Kiểm chứng tự động 9 tiêu chí nghiệm thu của plan này, đồng thời giữ bộ e2e cũ xanh. Cập nhật tài liệu và lệnh chạy cho 4 app mới.

## File tạo hoặc sửa
- `apps/shell-e2e/project.json`: thêm `tasks-remote`, `contacts-remote`, `notes-remote`, `reports-remote`, `portal-api` vào `implicitDependencies` và `dependsOn` build.
- `apps/shell-e2e/src/`:
  - `sidebar-by-role.spec.ts`: sidebar của `alice` và `bob`. `bob` gặp `/forbidden` và 403 ở `/apps/*`, `/api/*` của contacts và reports.
  - `tasks.spec.ts`: tạo, sửa, chuyển cột (bằng nút và kéo thả), lọc, xoá, và toast hiển thị.
  - `contacts.spec.ts`: tìm kiếm, thêm (kèm lỗi validation), sửa, deep link `/contacts/:id/edit`, xoá.
  - `notes.spec.ts`: CRUD, ghim, tìm kiếm. Ghi chú của `alice` không hiện cho `bob` (qua UI và qua `page.request`). Nội dung `<script>` được hiển thị dạng text.
  - `reports.spec.ts`: số liệu thay đổi sau khi tạo task.
  - `shared-runtime.spec.ts`: mở lần lượt cả 5 app trong cùng một phiên. Chỉ có một request tới bundle `@angular/core`, toast của mọi app hiện trong cùng một vùng, và không có vi phạm CSP hay Trusted Types.
  - Fixture reset dữ liệu: portal-api có `POST /api/__test__/reset`, **chỉ bật khi `PORTAL_API_TEST_HOOKS=true`** (đặt trong `webServer` của e2e, không bao giờ bật ở dev hay production). Endpoint này bị BFF chặn ở prefix map nên trình duyệt không gọi được. E2E gọi thẳng `127.0.0.1:4100`.
- `package.json`: script `dev` chạy thêm 4 remote mới.
- `README.md`: bảng port (dạng danh sách), tài khoản và role mới, cách import lại realm, mô tả 4 app.
- `docs/architecture.md`: sơ đồ có 5 remote, phần kiểm role theo `apiPrefix`, phần toast dùng chung.
- `docs/remote-contract.md`: cách dùng `@mf/ui-angular` và `@mf/shell-services`, cách khai báo `apiPrefix` trong registry.
- `docs/security.md`: cập nhật các mục đã sửa từ review, quy tắc owner của Notes, và test hook chỉ dùng cho e2e.

## Kiểm chứng
- `npm run check` qua cho mọi project.
- `npm audit --audit-level=high` trả exit 0.
- `npm run e2e` qua toàn bộ, gồm bộ cũ và bộ mới.
- `npm run dev` mở được cả 6 mục ở sidebar trên Chromium mà không có vi phạm CSP.

## Rủi ro
- Bộ e2e dài hơn. Vẫn chạy `workers: 1` để Keycloak không khoá tài khoản do brute force, và reset dữ liệu trước mỗi file spec.

## Rollback
Xoá các spec mới. Không ảnh hưởng tới runtime.
