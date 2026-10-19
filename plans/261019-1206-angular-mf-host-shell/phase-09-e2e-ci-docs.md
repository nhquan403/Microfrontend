---
phase: 9
title: "E2E, CI, tài liệu chạy local"
status: completed
effort: 1.25d
dependsOn: [1, 2, 3, 4, 5, 6, 7, 8]
---

# Phase 09: E2E, CI, tài liệu chạy local

## Mục tiêu
Tự động kiểm chứng toàn bộ 8 tiêu chí nghiệm thu bằng Playwright, chạy trong CI, và có tài liệu để người mới chạy hệ thống local được trong vài lệnh.

## File tạo hoặc sửa
- `apps/shell-e2e/` (`@nx/playwright`, Playwright 1.64.1, Chromium):
  - `playwright.config.ts`: `baseURL: http://localhost:4000`. `webServer` khởi động demo-api, demo-remote, shell, BFF. Keycloak giả định đã chạy qua docker-compose.
  - `fixtures/login.ts`: đăng nhập qua form Keycloak bằng user `alice` hoặc `bob` (mật khẩu đọc từ env, không hard-code trong test).
  - `auth.spec.ts`: đăng nhập, `/auth/me`, đăng xuất. Sau khi logout, truy cập lại phải bị đưa về Keycloak (session Keycloak cũng đã hết).
  - `no-token-in-browser.spec.ts`: sau khi đăng nhập và mở remote, duyệt `localStorage`, `sessionStorage`, `document.cookie`, `indexedDB` và các thuộc tính của `window`. Không được có chuỗi khớp `/eyJ[\w-]+\.[\w-]+\./`. `context.cookies()` cho thấy `__Host-sid` có `httpOnly: true`.
  - `security-headers.spec.ts`: kiểm tra từng header. Bắt event `console` và `securitypolicyviolation`: không được có vi phạm CSP nào.
  - `csrf.spec.ts`: dùng `request` của Playwright với cookie session, gửi `POST /api/echo` không có header CSRF thì 403, sai `Origin` thì 403, đúng thì 200.
  - `roles.spec.ts`: `alice` thấy Demo, `bob` không thấy. `bob` gõ thẳng `/demo` thì vào `/forbidden`, và `GET /apps/demo/remoteEntry.json` bằng session của `bob` trả 403.
  - `remote-from-registry.spec.ts`: khẳng định request `remoteEntry.json` trùng URL trong response `/registry`.
  - `remote-down.spec.ts`: dùng `page.route('/apps/demo/**', r => r.abort())` để giả lập remote chết. Trang lỗi hiển thị, header và sidebar vẫn còn, điều hướng sang Trang chủ vẫn được.
- `.github/workflows/ci.yml`:
  - Node 24, `npm ci`.
  - `npm audit --audit-level=high`.
  - `npx nx affected -t lint test build`.
  - Job e2e: dựng Keycloak bằng service container hoặc docker compose, sau đó chạy `npx nx e2e shell-e2e`.
  - Secret test đọc từ GitHub Secrets.
  - Upload trace của Playwright khi thất bại.
- `README.md`: giới thiệu, sơ đồ kiến trúc, yêu cầu (Node 24, Docker), lệnh chạy nhanh, danh sách port, tài khoản dev, cách thêm remote mới.
- `docs/architecture.md`: luồng đăng nhập (sequence), luồng tải remote, các lớp security và lý do chọn.
- `docs/remote-contract.md`: viết ở phase 07, rà lại ở đây.
- `docs/security.md`: danh sách control, cách kiểm chứng, và những việc phải làm khi lên production (HTTPS, Redis session, HSTS preload, xoay vòng secret, đổi realm export).
- `package.json`: script `dev` chạy song song cả 4 service (`nx run-many -t serve --parallel`), và `e2e`.

## Các bước
1. Dựng project e2e và fixture đăng nhập.
2. Viết từng spec theo đúng tiêu chí nghiệm thu.
3. Viết CI và chạy thử trên branch.
4. Viết tài liệu, rồi tự làm theo README trên một clone sạch để kiểm chứng.

## Kiểm chứng
- `npx nx run-many -t lint test build` chạy qua.
- `npx nx e2e shell-e2e` chạy qua cả 8 nhóm spec trên máy local.
- CI xanh trên GitHub Actions.
- Clone sạch, làm theo README, đăng nhập `alice` trong vòng 10 phút.

## Rủi ro
- Keycloak khởi động chậm trong CI. Cần healthcheck và tăng timeout của `webServer`.
- E2E phụ thuộc form đăng nhập của Keycloak. Theme đổi thì selector có thể vỡ, nên dùng `#username`, `#password`, `#kc-login`.

## Rollback
Xoá workflow hoặc project e2e. Không ảnh hưởng tới runtime.

## Ghi chú triển khai
- E2E chạy trên bản build production, BFF ở `SERVE_MODE=static`. Playwright tự khởi động demo-api và BFF qua `webServer`, Keycloak chạy sẵn bằng `npm run infra:up`. Target `e2e` phụ thuộc vào target `build` của shell, demo-remote, bff và demo-api.
- `PW_CHROMIUM_PATH` cho phép dùng Chromium có sẵn trên máy. Trong CI thì chạy `npx playwright install --with-deps chromium`.
- `tools/scripts/create-env.mjs` (`npm run env:create`) tạo `.env` với secret ngẫu nhiên. CI cũng dùng script này, nên không cần GitHub Secrets.
- Để `npm audit --audit-level=high` qua một cách trung thực, `http-proxy-middleware` được thay bằng `httpxy` qua module `apps/bff/src/gateway/proxy.ts`. Lý do: chuỗi `micromatch → braces` của nó có lỗ hổng mức high chưa có bản vá. `undici` (tooling của Nx) được override lên 7.29.1.
- Script npm: `env:create`, `infra:up`, `infra:down`, `dev`, `check`, `e2e`.
- Tắt `inspect` của `@nx/js:node` cho bff và demo-api, để hai server không tranh nhau port 9229 khi chạy `npm run dev`.
- Kết quả kiểm chứng (ngày 2026-10-19):
  - `nx run-many -t lint test build --skip-nx-cache` qua cho 8 project.
  - `nx e2e shell-e2e` qua 12/12 test trong Chromium (Keycloak 26.8.1 thật), phủ cả 8 tiêu chí nghiệm thu.
  - `npm audit --audit-level=high` trả exit 0 (còn 24 lỗ hổng moderate hoặc low trong dev tooling).
  - `npm run dev` (chế độ proxy) chạy được với CSP cùng Trusted Types, đã kiểm bằng Chromium.
  - CI trên GitHub Actions chưa chạy được ở đây, vì workflow chỉ chạy khi có push lên `master` hoặc khi có PR. Sẽ được kiểm khi mở PR.
