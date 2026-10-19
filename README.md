# Microfrontend portal

Portal Angular theo kiến trúc microfrontend gồm các phần sau:

- **Shell (host):** lo đăng nhập SSO, header, sidebar và footer. Mỗi tính năng ở sidebar là một app con (remote) được tải lúc chạy qua **Native Federation**.
- **BFF:** server đứng giữa trình duyệt và Keycloak, giữ token phía server. Trình duyệt chỉ có một cookie phiên `HttpOnly`.

```
Trình duyệt ── http://localhost:4000 ──► BFF / gateway (Express)
                                         ├─ /auth/*     đăng nhập OIDC + PKCE với Keycloak (:8080)
                                         ├─ /registry   danh sách remote, lọc theo role
                                         ├─ /apps/<x>/  file của remote (kiểm role)
                                         ├─ /api/*      proxy tới API, gắn access token phía server
                                         └─ /           shell + CSP có nonce và Trusted Types
```

## Thành phần

- `apps/shell`: host Angular 22. Đọc `/registry`, sinh route, tải remote, hiển thị layout.
- `apps/demo-remote`: remote mẫu, expose `./routes`.
- `apps/bff`: BFF Node.js (Express 5) lo OIDC, session, CSRF, gateway và security header.
- `apps/demo-api`: API mẫu kiểm JWT của Keycloak, là upstream cho `/api/*`.
- `apps/shell-e2e`: bộ test Playwright end-to-end.
- `libs/shell-auth`: `AuthService`, `roleGuard`, interceptor. Shell và remote dùng chung dạng singleton.
- `libs/ui-components`: Web Components viết bằng Lit, tiền tố `mf-`.
- `libs/design-tokens`: CSS variables `--mf-*` (có chế độ sáng và tối).
- `infra/`: Keycloak 26.8.1 chạy bằng docker-compose, kèm realm mẫu.

## Yêu cầu

- Node.js 24 LTS (từ 24.15.0 trở lên, xem `.nvmrc`).
- Docker có kèm Docker Compose.

## Chạy local

```bash
npm ci
npm run env:create     # tạo .env với secret ngẫu nhiên (không commit file này)
npm run infra:up       # khởi động Keycloak và đợi tới khi healthy
npm run dev            # chạy shell :4200, demo-remote :4201, demo-api :4100, BFF :4000
```

Sau đó mở **http://localhost:4000**. Chỉ truy cập qua cổng 4000, không mở trực tiếp các dev server.

Tài khoản thử, mật khẩu nằm trong `.env`:

- `alice` (`E2E_ALICE_PASSWORD`): có role `shell-user` và `demo-access`, thấy và mở được Demo.
- `bob` (`E2E_BOB_PASSWORD`): chỉ có `shell-user`. Mở `/demo` sẽ thấy trang "Access denied".

Dừng Keycloak: `npm run infra:down`.

## Port cố định

- `4000`: BFF, cổng duy nhất mà trình duyệt dùng.
- `4200`: dev server của shell (BFF proxy tới).
- `4201`: dev server của demo-remote (BFF proxy tới, phục vụ dưới `/apps/demo/`).
- `4100`: demo-api, chỉ lắng nghe trên `127.0.0.1`.
- `8080`: Keycloak.

Nếu một port đang bị chiếm, hãy dừng process cũ (ví dụ `lsof -ti tcp:4000 | xargs kill`) chứ đừng đổi sang port khác. Redirect URI và CSP đều được cấu hình theo đúng các port này.

## Kiểm tra

```bash
npm run check   # lint + unit test + build cho mọi project
npm run e2e     # build rồi chạy Playwright (cần Keycloak đang chạy)
```

Nếu máy đã có sẵn Chromium, đặt `PW_CHROMIUM_PATH=/đường/dẫn/tới/chromium` để không phải chạy `npx playwright install chromium`.

CI (`.github/workflows/ci.yml`) chạy `npm audit --audit-level=high`, lint, test và build, sau đó dựng Keycloak tạm thời và chạy bộ e2e.

## Thêm một remote mới

Xem [docs/remote-contract.md](docs/remote-contract.md). Tóm tắt:

1. Tạo app Angular.
2. Chạy `nx g @angular-architects/native-federation:init --project=<app> --type=remote --port=<port>`.
3. Expose `./routes` và dùng `sharedFederationConfig()`.
4. Thêm một mục vào `apps/bff/registry.config.json`.

## Tài liệu

- [docs/architecture.md](docs/architecture.md): luồng đăng nhập, luồng tải remote, các quyết định chính.
- [docs/security.md](docs/security.md): các lớp bảo vệ, cách kiểm chứng, việc cần làm trước khi lên production.
- [docs/remote-contract.md](docs/remote-contract.md): hợp đồng cho remote.
