---
phase: 6
title: "Shell layout, auth, guard, dynamic routes"
status: completed
effort: 1.5d
dependsOn: [4, 5]
---

# Phase 06: Shell layout, auth, guard, dynamic routes

## Mục tiêu
Shell Angular kiểm tra session trước khi khởi động, dựng layout bằng Lit components, sinh route từ registry, tải remote qua Native Federation, chặn route theo role và gắn CSRF cho request ghi.

## File tạo hoặc sửa
- `apps/shell/federation.config.js`: cấu hình host bằng `withNativeFederation`, `shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' })`. Lib `@mf/shell-auth` và `@mf/ui-components` được chia sẻ qua `sharedMappings`. Thêm `skip` cho các gói chỉ dùng phía server.
- `apps/shell/project.json`: chuyển target build và serve sang builder của native-federation (dùng schematic `ng add @angular-architects/native-federation --project shell --type dynamic-host` rồi điều chỉnh cho Nx).
- `apps/shell/src/main.ts`:
  1. `fetch('/auth/me', { credentials: 'same-origin' })`. Nếu 401 thì `location.assign('/auth/login?returnTo=' + encodeURIComponent(location.pathname))`.
  2. `fetch('/registry')` lấy `{ manifest, items }`.
  3. `initFederation(manifest)` (truyền object, không truyền URL do người dùng nhập).
  4. `import('./bootstrap')`, truyền `user` và `items` qua `InjectionToken`.
- `apps/shell/src/bootstrap.ts`: `bootstrapApplication` với `provideRouter`, `provideHttpClient(withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }))`, `provideZonelessChangeDetection()` nếu phù hợp với Angular 22. Gọi `defineMfComponents()` và import `tokens.css` một lần.
- `apps/shell/src/app/app.routes.ts`:
  - Route tĩnh: `''` (trang chủ), `forbidden`, `remote-error`, `**` (not-found).
  - Route động sinh từ `items`: `{ path: item.route, canMatch: [roleGuard(item.requiredRoles)], loadChildren: () => loadRemoteModule({ remoteName: item.name, exposedModule: './routes' }).then(m => m.routes) }`.
- `apps/shell/src/app/layout/shell-layout.component.ts`: `<mf-app-header>`, `<mf-sidebar>`, `<router-outlet>`, `<mf-app-footer>`. Lắng nghe `mf-navigate` để gọi `router.navigateByUrl`, và `mf-logout` để gọi `AuthService.logout()`.
- `apps/shell/src/app/pages/`: `home`, `forbidden`, `not-found`. Trang `remote-error` để phase 08 làm tiếp.
- `apps/shell/src/index.html`: `<sh-root ngCspNonce="__CSP_NONCE__">`. BFF thay placeholder bằng nonce thật.
- `libs/shell-auth/src/`:
  - `auth.service.ts`: `providedIn: 'root'`, singleton qua federation. Chỉ có `user()` (signal), `hasRole(role)`, `logout()`. Hàm logout gọi `POST /auth/logout` rồi điều hướng tới URL end-session trả về. Service không có hàm hay biến nào trả token.
  - `role.guard.ts`: `roleGuard(roles)` dạng `CanMatchFn`. Thiếu role thì trả `UrlTree('/forbidden')`.
  - `auth.tokens.ts`: `CURRENT_USER`, `REGISTRY_ITEMS`.
  - `session-expired.interceptor.ts`: response 401 thì chuyển về `/auth/login`.
  - `index.ts`: public API.
- Test: `*.spec.ts` cho `roleGuard`, `AuthService`, phần sinh route và layout.

## Các bước
1. Cài native-federation 22.2.3 cho shell. Chạy thử với manifest rỗng.
2. Viết `shell-auth` và test.
3. Viết `main.ts`, `bootstrap.ts` và route động.
4. Viết layout với Lit components.
5. Chạy shell qua BFF tại `http://localhost:4000`, mở DevTools và **chốt CSP**:
   - Xem `es-module-shims` hay import map có bị CSP chặn không.
   - Nếu bị chặn, thử theo thứ tự: nonce cho script import map, native import map (bỏ shim nếu native-federation 22 hỗ trợ), cuối cùng mới đến `blob:`.
   - Ghi quyết định cuối vào phase này và `security/headers.ts`.
6. Đánh giá Trusted Types bằng report-only. Nếu không có vi phạm từ Angular, Lit và native-federation thì bật enforce, nếu có thì ghi lý do để ở report-only.

## Kiểm chứng
- Chưa đăng nhập, mở `http://localhost:4000/demo` thì bị chuyển sang Keycloak, đăng nhập xong quay về `/demo`.
- `alice` thấy mục Demo trong sidebar. `bob` không thấy, và khi gõ thẳng `/demo` thì vào `/forbidden`.
- Console không có lỗi CSP.
- Tìm trong `window`, `localStorage`, `sessionStorage` và `document.cookie`: không có JWT (`eyJ`) và không có `__Host-sid`.
- `npx nx lint shell shell-auth`, `npx nx test shell shell-auth`, `npx nx build shell` chạy qua.

## Rủi ro
- Schematic của native-federation viết cho Angular CLI, có thể phải chỉnh tay `project.json` cho Nx. Đọc tài liệu native-federation bản 22 về cách dùng với Nx.
- `strictVersion: true` làm remote lỗi khi lệch phiên bản. Đây là chủ ý, để phát hiện lệch sớm.
- Zoneless: nếu Angular 22 đã mặc định zoneless thì đảm bảo remote cấu hình giống host.

## Rollback
Revert commit. Shell trở về khung sườn của phase 01.

## Quyết định CSP với Native Federation (đã chốt bằng thực nghiệm ngày 2026-10-19)
- **Chọn: nonce cho mọi script inline, kèm Trusted Types bắt buộc. Không dùng `blob:`, không dùng `unsafe-inline` hay `unsafe-eval`.**
- CSP thực tế: `script-src 'self' 'nonce-…'`, `style-src 'self' 'nonce-…'`, `require-trusted-types-for 'script'`, `trusted-types nfo mf-import-map es-module-shims angular angular#bundler lit-html 'allow-duplicates'`.
- Lý do và bằng chứng:
  - Khi có `ngCspNonce` trong `index.html`, Angular build tự gắn placeholder nonce cho `<style>` critical CSS, script `esms-options` và script gỡ `media` của beasties. BFF thay placeholder `__CSP_NONCE__` bằng nonce của từng request.
  - Orchestrator của Native Federation cho phép thay `setImportMapFn`. Shell tự chèn `<script type="importmap-shim">` kèm nonce (`apps/shell/src/federation/nonce-import-map.ts`).
  - Khi bật Trusted Types, nội dung import map phải là `TrustedScript`. Vì vậy shell dùng policy riêng `mf-import-map`, chỉ nhận chuỗi `JSON.stringify` của import map. es-module-shims tự tạo policy tên `es-module-shims`, nên tên này cũng được khai báo.
  - Kiểm bằng Chromium (Playwright với `/opt/pw-browsers/chromium`), đăng nhập Keycloak thật, BFF chạy `SERVE_MODE=static`:
    - Không có sự kiện `securitypolicyviolation`, không có CSP report gửi về BFF.
    - `alice` thấy "Home, Demo". `bob` vào `/demo` thì bị chuyển sang `/forbidden`.
  - Trong quá trình thử, thiếu policy `es-module-shims` hoặc `mf-import-map` đều làm shell không khởi động được. Nghĩa là Trusted Types thực sự đang được ép buộc.
- Giới hạn: Trusted Types mới có trên Chromium. Firefox và Safari bỏ qua directive này nhưng vẫn áp dụng nonce.

## Ghi chú triển khai
- Registry trả thêm `requiredRoles` cho remote user được phép, và `restrictedRoutes` (chỉ tên route) cho remote không được phép. Nhờ vậy shell hiển thị `/forbidden` thay vì not-found, mà không lộ URL hay manifest.
- `main.ts` kiểm tra `/auth/me`, sau đó lấy `/registry`, rồi `initFederation(manifest)` và bootstrap. Nếu `remoteEntry` của một remote lỗi (ví dụ 404), shell vẫn khởi động.
- Cấu hình share dùng chung ở `tools/federation/shared-federation-config.mjs`: Angular, rxjs, Lit là singleton `strictVersion`, các lib `@mf/*` share qua mapping. Bỏ qua các gói chỉ chạy phía server và các entry phụ `@angular/platform-browser/animations*`, vì `@angular/animations` không được cài.
- Dev server của shell cố định port 4200.
- Kết quả kiểm chứng: `nx run-many -t lint test build -p shell shell-auth bff` qua. shell có 9 test, shell-auth có 9 test, bff có 56 test.
