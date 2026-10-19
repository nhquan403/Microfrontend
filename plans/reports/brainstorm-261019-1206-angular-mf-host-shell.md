# Brainstorm: App host microfrontend Angular

Thời điểm: 2026-10-19 (UTC). Trạng thái: đã chốt, chuyển sang lập kế hoạch.

## Quyết định đã chốt

- Framework: Angular cho host và mọi app con, cùng một major version.
- Federation: `@angular-architects/native-federation` (ESM + import map, builder esbuild mặc định của Angular). Danh sách remote lấy lúc chạy từ manifest do BFF trả về.
- Chia sẻ UI: design tokens dạng CSS variables và thư viện Web Components viết bằng Lit. Host nạp design system đúng một lần cho cả trang.
- SSO: Keycloak (OIDC), chạy local bằng docker-compose.
- Auth pattern: BFF viết bằng Node.js. BFF giữ token phía server, trình duyệt chỉ có cookie session HttpOnly.
- Repo: Nx monorepo gồm host, BFF, design system và một app con demo. Mỗi app build và deploy riêng.

## Outcome

Host Angular gồm:
- Đăng nhập SSO qua BFF. Chưa đăng nhập thì bị chuyển hướng.
- Header (thông tin user, logout), footer.
- Sidebar sinh từ registry đã lọc theo quyền.
- Mỗi mục sidebar tải một app con qua Native Federation vào vùng nội dung.
- App con lỗi chỉ làm hỏng vùng nội dung, phần còn lại của host vẫn chạy.

## Constraints

- Security là phần lõi ngay từ đầu.
- Không có token trong JavaScript của trình duyệt. Mọi app con chạy chung `window`.
- App con được phục vụ cùng domain qua gateway (`/apps/<name>/`).
- App con không tự đăng nhập. Nó lấy thông tin user qua thư viện auth dùng chung (singleton).

## Non-goals

- Nghiệp vụ thực tế của các app con (chỉ có một app demo).
- Hạ tầng production (Kubernetes, CDN, IaC).
- Quản trị user và role trong Keycloak ngoài realm mẫu cho dev.

## Acceptance criteria

1. Đăng nhập và đăng xuất qua Keycloak chạy đúng. Đăng xuất xoá session ở cả BFF lẫn Keycloak.
2. Không có access hay refresh token trong `localStorage`, `sessionStorage`, cookie đọc được bằng JS, hay biến JavaScript.
3. Response có CSP (không có `unsafe-inline` cho script), HSTS, `frame-ancestors`, `Referrer-Policy`, `X-Content-Type-Options`. Console không báo vi phạm CSP.
4. Request ghi dữ liệu (POST, PUT, DELETE) qua BFF đều bị kiểm tra CSRF.
5. Sidebar và route thay đổi theo role của user. Truy cập thẳng URL của app không có quyền thì bị chặn ở cả host lẫn BFF.
6. App con demo được tải từ URL trong registry, không hard-code trong host.
7. Tắt app con demo thì host hiển thị trang báo lỗi, không trắng trang.
8. Lint, unit test và build của từng project đều chạy qua.

## Security controls dự kiến

- Cookie session: `HttpOnly`, `Secure`, `SameSite=Lax` hoặc `Strict`, thời hạn ngắn, có idle timeout.
- OIDC Authorization Code + PKCE giữa BFF và Keycloak. Refresh token phía server. Kiểm tra `state` và `nonce`.
- CSRF: double-submit token hoặc custom header, kèm kiểm tra `Origin`.
- CSP chặt, `script-src` chỉ cho `'self'`. App con cùng origin qua gateway. Bật Trusted Types nếu tương thích.
- Registry chỉ do BFF trả về sau khi xác thực, đã lọc theo role. Host không nhận URL remote từ input người dùng.
- Phân quyền kiểm tra hai lớp: route guard ở host (để hiển thị) và kiểm tra ở BFF hoặc API (để bảo vệ thật).
- Có error boundary cho từng remote.
- Scan dependency (`npm audit`) trong CI.

## Trade-offs

- **Native Federation:** phụ thuộc nhiều nhất vào việc thư viện theo kịp major version mới của Angular. Rủi ro đầu tiên là phải chờ cập nhật khi Angular ra bản mới. Phương án thay thế là webpack Module Federation, nhưng phải bỏ builder esbuild.
- **BFF:** phụ thuộc vào việc vận hành thêm một server. Rủi ro đầu tiên là BFF trở thành điểm nghẽn hoặc điểm lỗi chung, nên cần health check và scale ngang (session lưu ở Redis khi chạy nhiều instance). Phương án thay thế là SPA PKCE, đơn giản hơn nhưng token nằm trong JS.
- **Web Components (Lit):** phụ thuộc vào việc chấp nhận mất tích hợp với form và DI của Angular. Rủi ro đầu tiên là form control phức tạp cần viết thêm `ControlValueAccessor` wrapper. Phương án thay thế là Angular UI library chia sẻ qua `shared`.

## Better approaches

- Native Federation thay cho webpack Module Federation, vì Angular mặc định build bằng esbuild.
- BFF thay cho SPA giữ token, vì mọi remote chạy chung `window`.

## Câu hỏi còn mở

- Phiên bản Angular và Node cụ thể sẽ chốt khi lập kế hoạch, theo bản ổn định mới nhất mà native-federation hỗ trợ.
- Session store cho BFF: bộ nhớ trong khi dev, Redis khi production (cần xác nhận lúc triển khai).
