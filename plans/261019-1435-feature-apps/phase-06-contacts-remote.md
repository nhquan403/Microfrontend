---
phase: 6
title: "Remote Contacts"
status: pending
effort: 0.75d
dependsOn: [4]
---

# Phase 06: Remote Contacts (danh bạ)

## Mục tiêu
Remote `contacts`: danh sách liên hệ có tìm kiếm (debounce 300 ms, gọi `?q=` lên API), trang chi tiết, và form thêm, sửa, xoá có kiểm tra dữ liệu.

## Quyền sở hữu file
Chỉ `apps/contacts-remote/**`.

## File tạo
- Sinh app và init federation như phase 05, port `4203`, `name: 'contacts'`.
- `src/app/remote.routes.ts`: `''` (danh sách), `new`, `:id` (chi tiết), `:id/edit`.
- `src/app/contacts-api.service.ts`.
- `src/app/pages/contact-list.page.ts`: `mf-page-header` có ô tìm `mf-input type="search"`, bảng hoặc danh sách liên hệ, `mf-empty-state` khi không có kết quả.
- `src/app/pages/contact-detail.page.ts`: `mf-card` hiển thị thông tin, nút sửa và xoá (xác nhận bằng `mf-dialog`).
- `src/app/pages/contact-form.page.ts`: Reactive Form với `@mf/ui-angular`. `name` bắt buộc, `email` dùng `Validators.email`. Lỗi 400 từ API được hiển thị theo từng field.
- Test cho list (tìm kiếm có debounce), form (validation và lỗi từ server), detail (xoá có xác nhận) và contract routes.

## Kiểm chứng
- `npx nx run-many -t lint test build -p contacts-remote` qua.
- Chạy qua BFF: tìm kiếm, thêm, sửa, xoá đều chạy, toast hiện, không có vi phạm CSP.
- Điều hướng trong remote (`/contacts/123/edit`) vẫn đúng khi tải lại trang (deep link).

## Rollback
Xoá mục `contacts` khỏi registry, sau đó revert commit.
