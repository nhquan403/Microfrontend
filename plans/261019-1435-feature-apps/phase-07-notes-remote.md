---
phase: 7
title: "Remote Notes"
status: pending
effort: 0.75d
dependsOn: [4]
---

# Phase 07: Remote Notes (ghi chú cá nhân)

## Mục tiêu
Remote `notes`: lưới ghi chú của người dùng hiện tại. Tạo, sửa, xoá, ghim (ghi chú được ghim hiện lên đầu), và tìm kiếm. Dữ liệu chỉ thuộc về chủ sở hữu, việc này do API bảo đảm.

## Quyền sở hữu file
Chỉ `apps/notes-remote/**`.

## File tạo
- Sinh app và init federation, port `4204`, `name: 'notes'`.
- `src/app/remote.routes.ts`: `''` trỏ tới `NotesPage`.
- `src/app/notes-api.service.ts`.
- `src/app/pages/notes.page.ts`: `mf-page-header` (ô tìm kiếm, nút "New note"), lưới `mf-card`, nút ghim, sửa và xoá trên từng thẻ, `mf-empty-state` khi chưa có ghi chú.
- `src/app/components/note-editor.ts`: `mf-dialog` với tiêu đề và nội dung (`mf-textarea`). Nội dung hiển thị dạng text thuần (interpolation của Angular), không render HTML hay markdown.
- Test cho trang (sắp xếp ghim trước, tìm kiếm), editor (validation) và contract routes.

## Kiểm chứng
- `npx nx run-many -t lint test build -p notes-remote` qua.
- Chạy qua BFF: `alice` và `bob` mỗi người chỉ thấy ghi chú của mình. Tạo ghi chú chứa `<script>` thì hiển thị đúng dạng chữ, không thực thi, và không có vi phạm Trusted Types.

## Rollback
Xoá mục `notes` khỏi registry, sau đó revert commit.
