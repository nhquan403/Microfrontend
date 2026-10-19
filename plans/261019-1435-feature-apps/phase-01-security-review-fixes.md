---
phase: 1
title: "Sửa lỗi từ review bảo mật"
status: pending
effort: 1d
dependsOn: []
---

# Phase 01: Sửa lỗi từ review bảo mật

## Mục tiêu
Sửa lỗi High H1, các lỗi Medium M1 đến M6, và các lỗi Low có chi phí thấp (L1, L2, L3, L6, L9). Nguồn là `plans/reports/code-review-261019-1325-bff-shell-security.md`. Mỗi lỗi có một test dựng lại tình huống, test này đỏ trước khi sửa và xanh sau khi sửa.

## File tạo hoặc sửa
- `apps/bff/src/auth/return-to.ts` và `support.spec.ts` (H1): kiểm tra lại trên giá trị **đã chuẩn hoá**. Từ chối nếu kết quả bắt đầu bằng `//` hoặc `/\`. Thêm test cho các payload `/.//evil.com`, `/%2e%2e//evil.com`, `/a/..//evil.com`.
- `apps/bff/src/config.ts` (M1): parse `TRUST_PROXY` như sau. Chuỗi số thì đổi thành `Number` (số hop). `true` hoặc `false` thì đổi thành boolean. Ngoài ra thì giữ nguyên chuỗi (danh sách IP hoặc subnet). Có test cho từng dạng.
- `apps/bff/src/auth/token-refresh.ts` (M2, M3):
  - Chỉ huỷ session khi lỗi là `invalid_grant` hoặc 4xx từ IdP. Lỗi mạng hay 5xx thì trả 503 và giữ session.
  - Sau khi refresh xong, đọc lại session trong store. Nếu session đã bị huỷ (do logout) thì không ghi đè.
  - Ghi chú về giới hạn khi chạy nhiều instance trong `docs/security.md`.
- `apps/bff/src/auth/auth-routes.ts`:
  - L6: chỉ xoá `pendingLogin` sau khi kiểm state xong.
  - L4: logout khi không còn session vẫn trả URL end-session, không gửi `id_token_hint`.
- `apps/bff/src/session/memory-session-store.ts` (M4):
  - Giới hạn số session (mặc định 10.000, cấu hình bằng `SESSION_MAX_ENTRIES`). Khi đầy thì loại bỏ session hết hạn sớm nhất.
  - Session chỉ chứa `pendingLogin` có TTL 10 phút thay vì 30 phút.
  - `main.ts` từ chối khởi động với store in-memory khi `NODE_ENV=production`, trừ khi đặt `ALLOW_MEMORY_SESSION_STORE=true`.
- `apps/bff/src/auth/auth-routes.ts` và `require-auth.ts` (M5): callback từ chối đăng nhập nếu thiếu role `shell-user` (trả 403 kèm trang thông báo). Phần kiểm role theo từng app trên `/api` được làm ở phase 04.
- `libs/shell-auth/src/lib/session-expired.interceptor.ts` và BFF (M6):
  - BFF trả 401 kèm `{"error":"unauthenticated"}` chỉ khi **session BFF** đã hết.
  - 401 từ upstream được đổi thành 502 kèm `{"error":"upstream_auth_failed"}`.
  - Interceptor chỉ chuyển về trang đăng nhập khi body là `unauthenticated`, và tối đa một lần trong 30 giây (lưu trong `sessionStorage`, không chứa dữ liệu nhạy cảm) để chặn vòng lặp.
- `apps/bff/src/session/session.ts` (L1): `absoluteTimeout` dùng `regenerate` thay cho `destroy`, để `req.session` luôn tồn tại.
- `apps/bff/src/gateway/proxy.ts`:
  - L2: response từ upstream không được ghi đè các security header của BFF (CSP, HSTS, X-Frame-Options, COOP, CORP, Permissions-Policy, Referrer-Policy) và không được thêm header CORS.
  - L3: xoá `x-forwarded-*`, `forwarded`, `x-real-ip` do client gửi trước khi chuyển lên upstream.
- `apps/bff/src/gateway/gateway-routes.ts` (L9): ở chế độ static, request tới `/index.html` cũng đi qua nhánh chèn nonce (không để `express.static` trả trực tiếp).

## Các bước
1. Viết test dựng lại từng lỗi và xác nhận test đỏ.
2. Sửa từng lỗi, chạy `npx nx test bff shell-auth`.
3. Chạy lại e2e cũ để chắc không có hồi quy.

## Kiểm chứng
- Unit test của từng lỗi xanh. `npx nx run-many -t lint test build -p bff shell-auth shell` qua.
- `npm run e2e` qua 12/12 test cũ.
- Báo cáo review được cập nhật: đánh dấu từng mục là đã sửa hay chủ động để lại (L5, L7, L8, L10), kèm lý do.

## Rủi ro
- Đổi 401 của upstream thành 502 có thể làm remote hiểu sai lỗi. Mọi remote phải hiển thị lỗi API chung chung, không tự xử lý chuyện đăng nhập.

## Rollback
Mỗi lỗi một commit, revert được riêng lẻ.
