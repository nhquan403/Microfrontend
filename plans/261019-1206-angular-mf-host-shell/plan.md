---
title: "App host microfrontend Angular (shell + BFF + Keycloak)"
description: "Dựng shell Angular dùng Native Federation, đăng nhập Keycloak qua BFF Node.js, design system Lit, kèm một remote demo và đầy đủ lớp security."
status: in-progress
priority: P1
effort: 8d
branch: master
tags: [feature, frontend, backend, auth, infra]
blockedBy: []
blocks: []
created: 2026-10-19
---

# App host microfrontend Angular

## Tổng quan

Kế hoạch dựng một Nx monorepo gồm shell Angular (host), BFF Node.js (kiêm gateway), design system (tokens và Lit Web Components), thư viện auth dùng chung và một remote demo. Người dùng đăng nhập Keycloak qua BFF. Trình duyệt chỉ giữ cookie session HttpOnly. Shell lấy danh sách remote từ `GET /registry` đã lọc theo role, rồi tải remote bằng Native Federation.

Các quyết định đã chốt nằm ở `plans/reports/brainstorm-261019-1206-angular-mf-host-shell.md`. Kế hoạch này không bàn lại các quyết định đó.

## Phiên bản đã kiểm tra (npm registry và quay.io, ngày 2026-10-19)

- Angular `~22.2` (`@angular/core` 22.2.3, `@angular/cli` 22.2.3). Yêu cầu Node `^22.22.3 || ^24.15.0 || >=26`.
- `@angular-architects/native-federation` 22.2.3. Peer dependency là `@angular/build ~22.2.0`, phải khớp minor với Angular.
- Nx 23.3.0 (`@nx/angular` hỗ trợ Angular `>=20 <23`).
- Node 24 LTS (`>=24.15.0`). Máy hiện tại đang chạy Node 22.22.0, thấp hơn `^22.22.3`, nên phải nâng trước phase 1.
- Lit 3.3.3, Express 5.3.0, Helmet 8.3.0, openid-client 6.8.8, express-session 1.19.0, express-rate-limit 8.7.1, Playwright 1.64.1.
- Keycloak image `quay.io/keycloak/keycloak:26.8.1`.

Nguyên tắc: ghim chính xác các phiên bản này trong `package.json` và `.nvmrc`. Angular, `@angular/build` và native-federation luôn nâng cùng nhau.

## Port cố định khi chạy local

- `4000`: BFF/gateway. Đây là **origin duy nhất** trình duyệt truy cập (`http://localhost:4000`).
- `4200`: dev server của shell. Chỉ BFF gọi tới, trình duyệt không mở trực tiếp.
- `4201`: dev server của demo-remote. Chỉ BFF gọi tới, BFF phục vụ nó dưới `/apps/demo/`.
- `4100`: demo-api, upstream mẫu cho `/api/*`.
- `8080`: Keycloak.

## Kiến trúc

```
Trình duyệt ── http://localhost:4000 ──► BFF (Express)
   cookie __Host-sid (HttpOnly)           ├─ /auth/login|callback|logout|me ──► Keycloak :8080 (OIDC + PKCE)
   cookie XSRF-TOKEN (đọc được, không    ├─ /api/*       proxy + Bearer token (phía server) ──► demo-api :4100
   phải bí mật)                           ├─ /registry    manifest lọc theo role
                                          ├─ /apps/demo/  ─► dist hoặc dev server :4201 (kiểm tra role)
                                          └─ /            ─► dist hoặc dev server :4200 + CSP nonce + headers
Shell (Angular 22 + Native Federation)
   main.ts: GET /auth/me (401 → /auth/login) → GET /registry → initFederation(manifest) → bootstrap
   layout: header / sidebar / footer (Lit components + design tokens)
   routes: sinh từ registry → loadRemoteModule({ remoteName, exposedModule: './routes' })
   remote-error page + roleGuard + csrf interceptor
```

## Các phase

1. [Phase 01: Workspace Nx và tooling](phase-01-workspace-tooling.md). Trạng thái: completed. Không phụ thuộc phase nào.
2. [Phase 02: Keycloak docker-compose và realm](phase-02-keycloak-realm.md). Trạng thái: completed. Cần phase 01.
3. [Phase 03: BFF auth, session, CSRF](phase-03-bff-auth-session-csrf.md). Trạng thái: completed. Cần phase 01 và 02.
4. [Phase 04: BFF gateway, registry, security headers](phase-04-bff-gateway-registry-headers.md). Trạng thái: pending. Cần phase 03.
5. [Phase 05: Design tokens và Lit components](phase-05-design-tokens-lit.md). Trạng thái: pending. Cần phase 01. Làm song song được với phase 02–04.
6. [Phase 06: Shell layout, auth, guard, dynamic routes](phase-06-shell.md). Trạng thái: pending. Cần phase 04 và 05.
7. [Phase 07: demo-remote và hợp đồng remote](phase-07-demo-remote.md). Trạng thái: pending. Cần phase 06.
8. [Phase 08: Xử lý lỗi remote](phase-08-remote-error-handling.md). Trạng thái: pending. Cần phase 07.
9. [Phase 09: E2E, CI, tài liệu chạy local](phase-09-e2e-ci-docs.md). Trạng thái: pending. Cần phase 01–08.

## Tiêu chí nghiệm thu (toàn kế hoạch)

1. Đăng nhập và đăng xuất qua Keycloak chạy đúng end-to-end (phase 03, 09).
2. Không tìm thấy token ở bất kỳ nơi nào phía trình duyệt, có test e2e kiểm chứng (phase 03, 09).
3. Response có đủ security headers, console không báo vi phạm CSP (phase 04, 06, 09).
4. Request ghi dữ liệu thiếu CSRF token bị từ chối 403 (phase 03, 09).
5. Sidebar và route khác nhau giữa `alice` và `bob`. Truy cập thẳng URL không có quyền bị chặn ở cả shell và BFF (phase 04, 06, 09).
6. demo-remote được tải từ URL trong registry (phase 07, 09).
7. Tắt demo-remote thì shell hiển thị trang lỗi, header và sidebar vẫn chạy (phase 08, 09).
8. Lint, unit test, build từng project và e2e Playwright đều chạy qua (phase 09).

## Rủi ro chính

- **CSP và Native Federation.** Native Federation dựa vào `es-module-shims` và import map được chèn lúc chạy. Có thể cần `blob:` hoặc nonce trong `script-src`. Phase 04 và 06 phải chạy thử và chốt cách xử lý. Mục tiêu là không có `unsafe-inline` hay `unsafe-eval`.
- **Lệch phiên bản Angular với native-federation.** Hai gói này phải cùng minor. Ghim chính xác và nâng cùng nhau.
- **Cookie `Secure` trên `http://localhost`.** Chrome và Firefox coi localhost là secure context nên vẫn nhận. Ghi rõ trong tài liệu, và e2e chạy bằng Chromium.

## Quyết định bổ sung (đã chốt ngày 2026-10-19)

1. Thêm `apps/demo-api` (Node, port 4100) làm upstream mẫu cho `/api/*`. Service này xác thực JWT của Keycloak và có `GET /api/hello`, `POST /api/echo`.
2. CSRF dùng double-submit cookie (`XSRF-TOKEN` + header `X-XSRF-TOKEN`) kèm kiểm tra `Origin`.
3. Session có idle timeout 30 phút và absolute timeout 8 giờ.

## Câu hỏi còn mở

- Chưa có câu nào chặn việc triển khai. Cách cấu hình CSP cho Native Federation (nonce, native import map hay `blob:`) sẽ được chốt bằng thực nghiệm ở phase 06, không cần hỏi trước.
