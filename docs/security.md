# Security

## Các lớp bảo vệ

### Phiên đăng nhập và token

- Luồng OIDC dùng Authorization Code + PKCE (S256). Client là confidential, Keycloak bắt buộc PKCE, redirect URI khai báo chính xác.
- BFF kiểm `state` hai lần (tự kiểm trước, sau đó openid-client kiểm lại), và kiểm `nonce` cùng **chữ ký ID token** theo JWKS (`enableNonRepudiationChecks`).
- Token chỉ nằm trong session phía server. `/auth/me` chỉ trả về `sub`, `name`, `email`, `roles`.
- Cookie `__Host-sid` có `HttpOnly; Secure; SameSite=Lax; Path=/`. Session được regenerate sau khi đăng nhập để chống session fixation, có idle timeout 30 phút và absolute timeout 8 giờ.
- `returnTo` chỉ chấp nhận đường dẫn tương đối cùng origin, để chống open redirect.

### CSRF

- Dùng double-submit: cookie `XSRF-TOKEN` (`Secure; SameSite=Strict`) và header `X-XSRF-TOKEN` (Angular `HttpClient` tự gửi), so sánh timing-safe với giá trị lưu trong session.
- Mọi request `POST`, `PUT`, `PATCH`, `DELETE` còn bị kiểm `Origin` (hoặc `Referer`) phải đúng `PUBLIC_ORIGIN`.

### Phân quyền

- Kiểm hai lớp:
  - Shell dùng `roleGuard` để ẩn route và sidebar (chỉ phục vụ trải nghiệm).
  - BFF kiểm role trên `/registry`, `/apps/<name>/*` và `/api/*`. demo-api tự kiểm thêm role trong access token.
- Registry là cấu hình phía server. URL của remote bị ràng buộc phải nằm dưới `/apps/<name>/` cùng origin, và không bao giờ lấy từ input của người dùng.
- Người không có quyền chỉ biết tên route của remote, không thấy URL hay manifest.

### Trình duyệt

- **CSP**: `default-src 'self'`, `script-src 'self' 'nonce-…'`, `style-src 'self' 'nonce-…'`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, có `report-uri /csp-report`. Không có `unsafe-inline`, `unsafe-eval` hay `blob:`.
- **Trusted Types**: `require-trusted-types-for 'script'`, chỉ cho phép các policy `nfo`, `mf-import-map`, `es-module-shims`, `angular`, `angular#bundler`, `lit-html`.
- **Các header khác**: HSTS (1 năm, includeSubDomains), `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `Permissions-Policy` tắt camera, mic, vị trí, thanh toán.

### Gateway và vận hành

- Proxy bỏ cookie của trình duyệt khi gửi lên upstream, và bỏ `Set-Cookie` của upstream khi trả về.
- `/auth/*` bị giới hạn tần suất (mặc định 60 request mỗi phút mỗi IP). `/csp-report` bị giới hạn tần suất và kích thước body.
- Log có lọc thông tin nhạy cảm: khoá chứa token, cookie, authorization, secret, password, code, verifier, nonce, state, cùng mọi chuỗi trông giống JWT.
- CI chạy `npm audit --audit-level=high`.

## Cách kiểm chứng

Bộ e2e `apps/shell-e2e` kiểm tự động:

- `auth.spec.ts`: đăng nhập và đăng xuất ở cả BFF lẫn Keycloak.
- `no-token-in-browser.spec.ts`: không có JWT trong storage, cookie đọc được bằng JS hay thuộc tính của `window`. `__Host-sid` là HttpOnly.
- `security-headers.spec.ts`: đủ header, và không có vi phạm CSP hay Trusted Types khi chạy shell cùng remote.
- `csrf.spec.ts`: thiếu token, hoặc khác origin, đều bị trả 403.
- `roles.spec.ts`: shell và BFF đều chặn user không có quyền.
- `remote-from-registry.spec.ts` và `remote-down.spec.ts`: remote được tải theo registry, và lỗi của remote được giới hạn trong vùng nội dung.

Unit test của BFF dùng một IdP giả chạy trong process để kiểm openid-client thật: sai nonce, sai chữ ký, sai state đều bị từ chối.

## Việc phải làm trước khi lên production

1. **HTTPS** ở edge, và đặt `PUBLIC_ORIGIN=https://…`. Shim cookie cho localhost tự tắt. Đặt `TRUST_PROXY` đúng với hạ tầng.
2. **Session store dùng chung** (ví dụ Redis) thay cho bộ nhớ trong process: viết một class implement `SessionStore` trong `apps/bff/src/session/session-store.ts`.
3. **Realm production**: tạo client secret mới, bỏ user mẫu, cập nhật redirect URI và web origin, cân nhắc bật MFA.
4. **Xoay vòng secret** (`SESSION_SECRET`, `OIDC_CLIENT_SECRET`) qua secret manager. Không dùng `.env` trên server.
5. **HSTS preload** khi domain đã sẵn sàng.
6. **Giám sát `/csp-report`** và log BFF.
7. **Trusted Types** hiện chỉ có tác dụng trên Chromium. Các trình duyệt khác vẫn được bảo vệ bằng nonce.

## Phụ thuộc đáng chú ý

- `http-proxy-middleware` đã được thay bằng `httpxy` (thư viện proxy nó dùng bên dưới). Lý do: chuỗi `micromatch → braces` của nó có lỗ hổng mức high chưa có bản vá (GHSA-vfj7-8cjw-p6xm).
- `undici` (chỉ dùng trong tooling của Nx) được override lên `7.29.1` để vá các lỗ hổng đã công bố.
