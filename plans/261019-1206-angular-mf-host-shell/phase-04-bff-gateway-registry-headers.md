---
phase: 4
title: "BFF gateway, registry, security headers"
status: completed
effort: 1d
dependsOn: [3]
---

# Phase 04: BFF gateway, registry, security headers

## Mục tiêu
BFF trở thành origin duy nhất của hệ thống. Nó phục vụ shell và các remote, proxy API kèm token, trả registry đã lọc theo role, và đặt đủ security header.

## File tạo hoặc sửa (trong `apps/bff/src/`)
- `registry/registry.config.json`: danh sách remote do server quản lý. Mỗi mục gồm:
  - `name`, `title`, `icon`, `route`
  - `remoteEntry`: đường dẫn tương đối, ví dụ `/apps/demo/remoteEntry.json`
  - `exposedModule` (`./routes`), `requiredRoles`
  - `upstream`: URL dev server hoặc thư mục dist
- `registry/registry-routes.ts`: `GET /registry` (cần `requireAuth`). Trả về:
  - `manifest`: dạng `{ [name]: remoteEntryUrl }` cho `initFederation`.
  - `items`: dữ liệu sidebar.
  - Cả hai chỉ chứa remote mà user có đủ role. Có header `Cache-Control: no-store`.
- `gateway/apps-routes.ts`: `/apps/:name/*` chạy `requireAuth` rồi `requireRole(entry.requiredRoles)`. Khi dev thì proxy sang `:4201`, khi production thì phục vụ static từ `dist/apps/demo-remote/browser`. `name` chỉ được lấy từ registry, không ghép đường dẫn từ input.
- `gateway/api-proxy.ts`: `/api/*` chạy `requireAuth`, rồi CSRF cho method ghi. Sau đó xoá header `cookie` khỏi request đi upstream, gắn `Authorization: Bearer <access token>` lấy từ session, và proxy sang `API_UPSTREAM_URL` (`:4100`). Response trả về được lọc bỏ `set-cookie` của upstream.
- `gateway/shell-routes.ts`: `/` cùng các đường dẫn SPA. Khi dev thì proxy sang `:4200` (có WebSocket cho HMR), khi production thì phục vụ `dist/apps/shell/browser`. Có fallback `index.html` cho route SPA.
- `security/headers.ts`: Helmet 8 cùng nonce sinh cho từng request:
  - `Content-Security-Policy`:
    - `default-src 'self'`
    - `script-src 'self' 'nonce-{n}'`, cộng thêm `blob:` chỉ khi phase 06 chứng minh `es-module-shims` cần
    - `style-src 'self' 'nonce-{n}'`
    - `img-src 'self' data:`, `connect-src 'self'`, `font-src 'self'`
    - `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self' http://localhost:8080`, `object-src 'none'`
    - Có `report-uri /csp-report`.
  - `Strict-Transport-Security` (bật khi chạy sau HTTPS, khi dev ghi log cảnh báo).
  - `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `Cross-Origin-Opener-Policy: same-origin`.
  - `Permissions-Policy` tắt camera, mic, geolocation, payment.
- `security/csp-nonce.ts`: chèn nonce vào `index.html` khi phục vụ, gồm thuộc tính `ngCspNonce` trên `<sh-root>` và `nonce` trên các thẻ `<script>`/`<style>` inline.
- `security/csp-report.ts`: `POST /csp-report` ghi log vi phạm (có rate limit, giới hạn kích thước body).
- Đánh giá Trusted Types: thử `require-trusted-types-for 'script'` ở chế độ `Content-Security-Policy-Report-Only` và ghi kết quả vào phase 06.

## Các bước
1. Registry và test lọc theo role (`alice` thấy demo, `bob` không thấy).
2. Gateway `/apps` và `/` ở chế độ dev (proxy) và chế độ production (static), chọn bằng `NODE_ENV`.
3. API proxy và test: không chuyển tiếp cookie, có gắn Bearer.
4. Headers và chèn nonce. Test snapshot cho các header.

## Kiểm chứng
- `GET /registry` khi chưa đăng nhập trả 401. Với `bob`, `items` rỗng phần demo. Với `alice` thì có demo.
- `GET /apps/demo/remoteEntry.json` với `bob` trả 403, với `alice` trả 200.
- `POST /api/echo` thiếu CSRF trả 403. Có CSRF thì 200, và demo-api nhận được Bearer hợp lệ.
- `curl -I http://localhost:4000/` có đủ các header đã liệt kê, và mỗi request có nonce khác nhau.
- Test khẳng định `script-src` không chứa `unsafe-inline` và `unsafe-eval`.

## Rủi ro
- Proxy WebSocket HMR của Angular dev server qua BFF có thể lỗi. Phương án dự phòng là tắt HMR khi chạy qua BFF (`--hmr=false`).
- CSP với import map động của Native Federation. Phải chốt cùng phase 06, xem rủi ro chính trong `plan.md`.

## Rollback
Revert commit của phase. Phase 03 vẫn chạy độc lập.

## Ghi chú triển khai
- Registry nằm ở `apps/bff/registry.config.json` (đường dẫn đổi được qua `REGISTRY_FILE`). `parseRegistry` kiểm chặt: tên hợp lệ, không trùng tên, và `remoteEntry` phải nằm dưới `/apps/<name>/`.
- `SERVE_MODE=proxy|static`. Mặc định là `proxy` khi dev và `static` khi production. E2E sẽ dùng `static` với bản build thật.
- Remote được mount tại `/apps/<name>`. Express tự bỏ tiền tố, nên remote không cần `deployUrl`, vì Native Federation tải chunk tương đối theo vị trí của `remoteEntry.json`.
- Error handler giữ nguyên status 4xx do middleware ném ra (ví dụ 403 của `express.static` khi thử path traversal), thay vì trả 500.
- Header `Set-Cookie` từ upstream bị xoá trong `proxyRes`.
- Kết quả kiểm chứng (ngày 2026-10-19):
  - `nx run-many -t test lint build -p bff --skip-nx-cache` qua với 56 test, chạy ổn định qua hai lần.
  - Test gateway (proxy thật tới một upstream chạy trong process) xác nhận:
    - `/registry` trả 401 khi chưa đăng nhập, có remote demo với role `demo-access`, rỗng khi thiếu role.
    - `/apps/demo/*` trả 200, 403, 401, 404 đúng từng trường hợp, và chặn path traversal.
    - `/api/*` thiếu CSRF trả 403. Khi qua được thì request lên upstream có Bearer, không có cookie, không có header CSRF, và cookie của upstream bị xoá.
    - CSP có nonce đổi theo từng request, không có `unsafe-inline` hay `unsafe-eval`, kèm đủ HSTS, Referrer-Policy, nosniff, X-Frame-Options, COOP, Permissions-Policy.
  - Phần kiểm chứng với remote và demo-api thật được chạy ở phase 07. Phần đánh giá Trusted Types được làm ở phase 06.
