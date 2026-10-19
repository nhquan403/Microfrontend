---
phase: 7
title: "demo-remote và hợp đồng remote"
status: completed
effort: 0.75d
dependsOn: [6]
---

# Phase 07: demo-remote và hợp đồng remote

## Mục tiêu
Có một remote Angular expose `./routes`, được shell tải từ URL trong registry, dùng chung `AuthService` và Lit components của shell, và gọi được `/api/*` qua BFF.

## File tạo hoặc sửa
- `apps/demo-remote/federation.config.js`: `withNativeFederation({ name: 'demo', exposes: { './routes': './apps/demo-remote/src/app/remote.routes.ts' }, shared: shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }) })`.
- `apps/demo-remote/project.json`: builder native-federation loại `remote`, port `4201`, `baseHref`/`deployUrl` là `/apps/demo/`.
- `apps/demo-remote/src/app/remote.routes.ts`: `export const routes: Routes` gồm trang danh sách và trang chi tiết (dữ liệu từ `GET /api/hello`), cùng một form gọi `POST /api/echo` để kiểm chứng CSRF.
- `apps/demo-remote/src/app/pages/*`: component dùng `inject(AuthService).user()` để hiển thị tên và dùng `<mf-button>`.
- `apps/demo-remote/src/main.ts` và `bootstrap.ts`: cho phép chạy độc lập khi phát triển. Khi chạy độc lập, remote vẫn phải đi qua BFF, nếu không thì hiển thị thông báo "chạy qua http://localhost:4000".
- `apps/demo-api/src/main.ts`: Express trên port 4100.
  - Kiểm tra JWT bằng JWKS của Keycloak (`jose`): issuer, audience, hạn dùng.
  - `GET /api/hello` yêu cầu role `demo-access`.
  - `POST /api/echo` trả lại body.
  - Chỉ lắng nghe trên `127.0.0.1`.
- `docs/remote-contract.md`: hợp đồng remote.
  - Bắt buộc expose `./routes`.
  - Không tự đăng nhập, không lưu token.
  - Không gọi `defineMfComponents`.
  - Gọi API qua đường dẫn tương đối `/api/...`.
  - Dùng chung đúng phiên bản Angular.
  - Không gắn gì lên `window`.
  - CSS chỉ dùng `var(--mf-*)` và encapsulation mặc định của Angular.
- Sửa `apps/bff/src/registry/registry.config.json`: thêm mục `demo` (`route: 'demo'`, `requiredRoles: ['demo-access']`, `remoteEntry: '/apps/demo/remoteEntry.json'`).

## Các bước
1. `ng add @angular-architects/native-federation --project demo-remote --type remote --port 4201`, rồi chỉnh cho Nx.
2. Viết routes và các trang.
3. Viết demo-api cùng test kiểm tra JWT (token sai `aud` thì 401, thiếu role thì 403).
4. Thêm mục vào registry, chạy cả hệ thống qua BFF.

## Kiểm chứng
- `alice` vào `/demo` thì thấy trang của remote. Tab Network cho thấy `remoteEntry.json` được tải từ `/apps/demo/`, đúng URL trong `/registry`.
- Trong console có đúng một bản `@angular/core` (kiểm bằng import map hoặc `ng.getComponent`, hoặc đếm request tải `@angular/core`).
- Form gọi `POST /api/echo` thành công khi đi qua shell. Gọi bằng curl không có header CSRF thì nhận 403.
- Đổi `remoteEntry` trong registry config sang một build khác thì shell nhận ngay mà không phải rebuild.
- `npx nx lint demo-remote demo-api`, `npx nx test demo-remote demo-api`, `npx nx build demo-remote` chạy qua.

## Rủi ro
- Lệch `deployUrl` hoặc `baseHref` làm chunk của remote tải sai đường dẫn. Kiểm tra kỹ trong Network.
- Remote dùng `inject(AuthService)` sẽ chỉ nhận đúng singleton khi federation share đúng lib. Nếu nhận bản thứ hai thì `user()` rỗng. Cần test cho trường hợp này.

## Rollback
Xoá mục `demo` trong registry để shell ngừng tải remote ngay mà không cần deploy lại shell. Sau đó revert commit.

## Ghi chú triển khai
- Remote tên `demo`, expose `./routes` gồm trang chính và trang `items/:id`. Remote dùng `AuthService`, `HttpClient` và design system của shell.
- demo-api (Express trên `127.0.0.1:4100`) kiểm JWT bằng JWKS của Keycloak (issuer, audience `demo-api`, hạn dùng) và yêu cầu role `demo-access`.
- Không cần `deployUrl` hay `baseHref` cho remote, vì Native Federation tải chunk tương đối theo `remoteEntry.json` dưới `/apps/demo/`.
- Hợp đồng remote được viết ở `docs/remote-contract.md`.
- Kết quả kiểm chứng (ngày 2026-10-19, hệ thống thật: Keycloak, BFF chạy `SERVE_MODE=static`, demo-api, Chromium):
  - `nx run-many -t lint test build -p demo-remote demo-api` qua. demo-remote có 4 test, demo-api có 7 test (sai audience, hết hạn, sai khoá, thiếu role đều bị từ chối).
  - `alice` mở `/demo`:
    - Remote hiển thị "Demo remote", dữ liệu từ demo-api, và POST `/api/echo` qua CSRF của Angular thành công.
    - Chỉ có một request tới bundle `@angular/core` (của shell).
    - `remoteEntry.json` được tải từ `/apps/demo/`, đúng URL trong registry.
    - Không có vi phạm CSP hay Trusted Types.
  - Kiểm phía server:
    - `bob` gọi `/apps/demo/remoteEntry.json` và `/api/hello` đều nhận 403. `alice` gọi `/apps/demo/remoteEntry.json` nhận 200.
    - POST `/api/echo` thiếu CSRF trả 403, khác Origin trả 403, hợp lệ trả 200.
    - `/registry` khi chưa đăng nhập trả 401.
    - Log BFF không có chuỗi `eyJ`.
