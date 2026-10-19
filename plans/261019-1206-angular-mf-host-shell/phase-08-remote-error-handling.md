---
phase: 8
title: "Xử lý lỗi remote"
status: pending
effort: 0.5d
dependsOn: [7]
---

# Phase 08: Xử lý lỗi remote

## Mục tiêu
Remote không tải được (server chết, 404, lệch phiên bản, lỗi runtime khi khởi tạo) thì chỉ vùng nội dung hiển thị trang lỗi. Header, sidebar, footer và điều hướng sang mục khác vẫn chạy.

## File tạo hoặc sửa
- `apps/shell/src/app/remote/load-remote-routes.ts`: bọc `loadRemoteModule` bằng try/catch và timeout (ví dụ 10 giây). Khi lỗi thì trả về routes dự phòng `[{ path: '**', component: RemoteErrorPage, data: { remote: name, reason } }]`. Ghi log lỗi (không có dữ liệu nhạy cảm) và gửi `POST /api/client-errors` nếu có endpoint.
- `apps/shell/src/app/pages/remote-error/remote-error.page.ts`: dùng `<mf-alert>`, có nút "Thử lại". Nút này tải lại route, và vì Angular cache `loadChildren` đã lỗi nên cần reset bằng cách điều hướng với key mới hoặc tải lại trang.
- `apps/shell/src/main.ts`: nếu `initFederation` lỗi với một remote, bỏ remote đó khỏi manifest và đánh dấu trạng thái lỗi, không để shell sập toàn bộ. Cần kiểm tra cách `initFederation` của native-federation xử lý lỗi từng remote.
- `apps/shell/src/app/app.config.ts`: `ErrorHandler` toàn cục ghi log lỗi chưa xử lý và không làm vỡ layout.
- Test: `load-remote-routes.spec.ts` cho các trường hợp import ném lỗi, timeout và thành công.

## Các bước
1. Kiểm tra hành vi thực tế khi tắt `:4201`: lỗi xảy ra ở `initFederation` hay ở `loadRemoteModule`?
2. Viết wrapper và trang lỗi.
3. Xử lý lỗi ở giai đoạn `initFederation` theo kết quả bước 1.

## Kiểm chứng
- Tắt dev server của demo-remote rồi đăng nhập `alice`: shell vẫn tải, sidebar vẫn hiển thị Demo, bấm vào thì thấy trang lỗi có nút thử lại. Bấm sang Trang chủ thì vẫn chạy.
- Bật lại remote rồi bấm "Thử lại" thì trang demo hiển thị.
- Unit test của wrapper chạy qua.

## Rủi ro
- Nếu `initFederation` ném lỗi khi một remote chết, cần tải từng remote riêng lẻ hoặc dùng API cho phép bỏ qua lỗi. Phải đọc mã nguồn hoặc tài liệu bản 22.2.

## Rollback
Revert commit. Shell trở lại hành vi tải remote trực tiếp của phase 07.
