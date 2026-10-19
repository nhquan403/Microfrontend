---
phase: 5
title: "Remote Tasks"
status: pending
effort: 1d
dependsOn: [4]
---

# Phase 05: Remote Tasks (Kanban)

## Mục tiêu
Remote `tasks`: bảng Kanban có 3 cột Todo, Doing, Done. Tạo, sửa và xoá task, chuyển cột bằng nút hoặc kéo thả, lọc theo người phụ trách. Toast hiện khi thao tác thành công hoặc lỗi.

## Quyền sở hữu file
Chỉ `apps/tasks-remote/**`. Không sửa file dùng chung (registry, realm, shell, libs).

## File tạo
- Sinh app bằng `nx g @nx/angular:application apps/tasks-remote --prefix=tasks ...` (giống demo-remote), rồi `nx g @angular-architects/native-federation:init --project=tasks-remote --type=remote --port=4202`.
- `federation.config.mjs`: `name: 'tasks'`, expose `./routes`, dùng `sharedFederationConfig()`.
- `src/app/remote.routes.ts`: `''` trỏ tới `BoardPage`.
- `src/app/tasks-api.service.ts`: gọi `/api/tasks` qua `HttpClient`.
- `src/app/board.store.ts`: state bằng signal, cập nhật lạc quan (optimistic) và rollback khi API lỗi.
- `src/app/pages/board.page.ts`: `mf-page-header` (nút "New task", ô lọc `mf-select` theo người phụ trách), 3 cột `mf-card`, kéo thả bằng HTML5 DnD, và nút "←/→" để chuyển cột bằng bàn phím.
- `src/app/components/task-dialog.ts`: `mf-dialog` với Reactive Form dùng `@mf/ui-angular` (title bắt buộc, description, assignee, dueDate).
- Test: store (chuyển cột, rollback), board page (render, lọc, nút chuyển cột), dialog (validation), và contract `remote.routes.spec.ts`.

## Kiểm chứng
- `npx nx run-many -t lint test build -p tasks-remote` qua.
- Chạy qua BFF trên Chromium: thao tác CRUD, chuyển cột và lọc đều chạy, toast hiện, không có vi phạm CSP hay Trusted Types.
- Code không có mã màu hex hay style toàn cục.

## Rủi ro
- Kéo thả HTML5 trên Playwright cần `dragTo`. E2E chủ yếu dùng nút chuyển cột cho ổn định, và có một test riêng cho kéo thả.

## Rollback
Xoá mục `tasks` khỏi registry để ẩn ngay app này. Sau đó revert commit.
