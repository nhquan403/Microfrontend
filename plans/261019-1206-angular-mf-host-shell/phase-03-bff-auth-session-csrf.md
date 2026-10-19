---
phase: 3
title: "BFF auth, session, CSRF"
status: completed
effort: 1.5d
dependsOn: [1, 2]
---

# Phase 03: BFF auth, session, CSRF

## Mục tiêu
BFF thực hiện OIDC Authorization Code + PKCE với Keycloak, giữ token phía server, cấp cookie session HttpOnly, chống CSRF và giới hạn tần suất gọi `/auth/*`.

## File tạo hoặc sửa (trong `apps/bff/src/`)
- `config.ts`: đọc và kiểm tra biến môi trường lúc khởi động. Thiếu biến thì dừng ngay. Không log giá trị bí mật.
- `session/session-store.ts`: interface `SessionStore` (`get`, `set`, `destroy`, `touch`).
- `session/memory-session-store.ts`: bản lưu trong bộ nhớ dùng khi dev.
- `session/session.ts`: cấu hình `express-session`:
  - Tên cookie `__Host-sid`, các cờ `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.
  - Idle timeout 30 phút bằng `rolling` + `maxAge`, absolute timeout 8 giờ kiểm tra bằng `createdAt`. Cả hai cấu hình được qua env.
  - Secret lấy từ env.
  - Gọi `regenerate()` sau khi đăng nhập để chống session fixation.
- `auth/oidc-client.ts`: dùng `openid-client` 6.x. Discovery từ `OIDC_ISSUER`, client confidential.
- `auth/auth-routes.ts`:
  - `GET /auth/login`: tạo `code_verifier`, `state`, `nonce` và lưu vào session tạm. Redirect sang Keycloak với `code_challenge_method=S256`. Chỉ nhận `returnTo` là đường dẫn tương đối nội bộ (allowlist, chống open redirect).
  - `GET /auth/callback`: kiểm tra `state`, đổi code lấy token kèm `code_verifier`, kiểm tra `nonce` và chữ ký ID token. Lưu token vào session, regenerate session, rồi redirect về `returnTo`.
  - `GET /auth/me`: trả `{ sub, name, email, roles }`, không trả token. Chưa đăng nhập thì trả 401.
  - `POST /auth/logout`: cần CSRF. Huỷ session, xoá cookie, trả URL `end_session_endpoint` (kèm `id_token_hint` và `post_logout_redirect_uri`) để trình duyệt điều hướng tới.
- `auth/token-refresh.ts`: refresh access token phía server khi sắp hết hạn, khoá theo session để không refresh trùng. Refresh thất bại thì huỷ session.
- `auth/require-auth.ts`: middleware trả 401 cho XHR/fetch, và redirect về `/auth/login` khi trình duyệt điều hướng trang.
- `auth/require-role.ts`: middleware `requireRole(role)` trả 403.
- `security/csrf.ts`:
  - Double-submit: cấp cookie `XSRF-TOKEN` (không HttpOnly, `SameSite=Strict`, `Secure`) gắn với session.
  - Với `POST`, `PUT`, `PATCH`, `DELETE`: so header `X-XSRF-TOKEN` với giá trị lưu trong session (so sánh timing-safe), và kiểm tra `Origin` (hoặc `Referer`) bằng `http://localhost:4000`. Sai thì 403.
- `security/rate-limit.ts`: `express-rate-limit` cho `/auth/*` (ví dụ 20 request mỗi phút mỗi IP).
- `logging/logger.ts`: logger có redact cho `authorization`, `cookie`, `set-cookie`, `*token*`, `code`.
- `main.ts`: lắp ráp middleware, `app.set('trust proxy', ...)` lấy theo cấu hình.
- Test: `apps/bff/src/**/*.spec.ts`.

## Các bước
1. Viết config và logger có redact trước.
2. Viết session store và interface (để sau này thay bằng Redis mà không đổi phần còn lại).
3. Viết OIDC login và callback. Unit test với IdP giả bằng `oauth4webapi` test server hoặc nock trên discovery và token endpoint.
4. Viết `/auth/me`, logout và refresh.
5. Viết CSRF và rate limit.
6. Chạy thử với Keycloak thật: đăng nhập `alice`, gọi `/auth/me`.

## Kiểm chứng
- Unit test bao phủ:
  - Callback sai `state` trả 400.
  - Sai `nonce` thì bị từ chối.
  - `returnTo` là URL tuyệt đối khác host thì bị bỏ qua.
  - POST thiếu hoặc sai `X-XSRF-TOKEN` trả 403. Sai `Origin` trả 403.
  - Session quá idle hoặc quá absolute thì trả 401.
  - Rate limit trả 429.
- Kiểm tra thủ công bằng curl:
  - Cookie `__Host-sid` có đủ `HttpOnly`, `Secure`, `SameSite`.
  - Response của `/auth/me` không chứa chuỗi nào giống JWT.
- Dò log khi chạy luồng đăng nhập: không có chuỗi `eyJ` (dấu hiệu của JWT).

## Rủi ro
- API của `openid-client` 6.x khác hẳn 5.x. Đọc tài liệu đúng bản 6.8.
- `express-session` với Express 5: kiểm tra tương thích khi cài, và kiểm tra async error handling.
- Session trong bộ nhớ mất khi restart và không chạy được nhiều instance. Chấp nhận khi dev, interface đã chừa sẵn chỗ cho Redis.

## Rollback
Các thay đổi chỉ nằm trong `apps/bff`, nên revert commit của phase này là đủ.

## Ghi chú triển khai
- `createApp()` nằm trong `app.ts`, nhận `OidcClient` và `SessionStore` qua tham số để test không cần mock module.
- openid-client v6 mặc định không kiểm chữ ký ID token nhận từ token endpoint (spec cho phép khi đi qua TLS). Mình bật `enableNonRepudiationChecks` để luôn kiểm chữ ký theo JWKS.
- express-session không phát cookie `Secure` khi request không phải TLS. Khi `PUBLIC_ORIGIN` là `http://localhost`, middleware `localhostSecureShim` đánh dấu request là https để cookie `__Host-sid` vẫn có `Secure`. Với origin khác localhost thì shim không chạy.
- Callback tự kiểm `state` trước, sau đó openid-client kiểm lại `state` và kiểm PKCE, chữ ký, `nonce`.
- Pending login hết hạn sau 10 phút.
- Rate limit cho `/auth/*` mặc định là 60 request mỗi phút (`AUTH_RATE_LIMIT_PER_MINUTE`), để e2e gọi `/auth/me` liên tục không bị chặn.
- Kết quả kiểm chứng (ngày 2026-10-19):
  - `nx run-many -t lint test build -p bff` qua, 39 unit test.
  - Test dùng IdP giả trong process với openid-client thật: sai nonce bị từ chối, sai chữ ký bị từ chối, sai state bị từ chối, verifier PKCE được gửi đúng.
  - Chạy thật với Keycloak 26.8.1 (`alice`):
    - Callback 302 về `/demo`.
    - `__Host-sid` có `HttpOnly; Secure; SameSite=Lax; Path=/`. `XSRF-TOKEN` có `Secure; SameSite=Strict` và không HttpOnly.
    - `/auth/me` trả profile cùng roles `shell-user, demo-access`, không có JWT.
    - Logout thiếu CSRF trả 403. Logout hợp lệ trả URL end_session có `id_token_hint`, Keycloak redirect về `http://localhost:4000/`, sau đó `/auth/me` trả 401.
    - Log BFF không có chuỗi `eyJ`.
