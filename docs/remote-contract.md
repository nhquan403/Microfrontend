# Hợp đồng cho remote (micro frontend)

Tài liệu này quy định những gì một app con phải tuân theo khi được shell tải qua Native Federation. App mẫu là `apps/demo-remote`.

## Bắt buộc

1. **Chỉ expose `./routes`.** Module này export `routes: Routes` của Angular. Shell mount chúng dưới route mà registry chỉ định (ví dụ `/demo`).
   ```js
   // apps/<remote>/federation.config.mjs
   export default withNativeFederation({
     name: '<remote-name>',
     exposes: { './routes': './apps/<remote>/src/app/remote.routes.ts' },
     ...sharedFederationConfig(),
   });
   ```
2. **Dùng cấu hình share chung** `tools/federation/shared-federation-config.mjs`. Angular, rxjs, Lit và các lib `@mf/*` đều là singleton `strictVersion`. Nếu remote lệch phiên bản, nó sẽ báo lỗi ngay lúc tải thay vì âm thầm chạy sai.
3. **Cùng phiên bản Angular với shell**, theo phiên bản ghim trong `package.json` gốc.
4. **Không tự đăng nhập và không giữ token.** Lấy thông tin người dùng qua `inject(AuthService).user()` từ `@mf/shell-auth`. Token chỉ nằm trong BFF.
5. **Gọi API bằng đường dẫn tương đối `/api/...`** qua `HttpClient`. BFF gắn access token phía server. `HttpClient` của shell tự gửi header CSRF cho request ghi dữ liệu và tự chuyển về trang đăng nhập khi gặp 401.
6. **Không gọi `defineMfComponents()`.** Shell đã đăng ký design system cho cả trang. Remote chỉ dùng thẻ `mf-*` kèm `CUSTOM_ELEMENTS_SCHEMA`.
7. **CSS** chỉ dùng `var(--mf-*)` và encapsulation mặc định của Angular. Không viết style toàn cục.
8. **Không gắn gì lên `window`**, không chèn `<script>` hay HTML thô. CSP của shell chặn script inline không có nonce và bắt buộc Trusted Types.

## Đăng ký remote mới

Thêm một mục vào `apps/bff/registry.config.json`:

```json
{
  "name": "orders",
  "title": "Orders",
  "icon": "grid",
  "route": "orders",
  "remoteEntry": "/apps/orders/remoteEntry.json",
  "exposedModule": "./routes",
  "requiredRoles": ["orders-access"],
  "devUrl": "http://127.0.0.1:4202",
  "staticDir": "dist/apps/orders/browser"
}
```

- `remoteEntry` phải nằm dưới `/apps/<name>/`. BFF phục vụ remote cùng origin và kiểm `requiredRoles` trên mọi file.
- Người dùng chỉ nhận được remote mà họ có đủ role. Với remote không được phép, shell chỉ biết tên route để hiển thị trang "Access denied".
- Muốn gỡ một remote khỏi production, chỉ cần xoá mục của nó trong registry. Không phải build lại shell.

## Chạy riêng một remote

Mở thẳng dev server của remote (port riêng) thì chỉ thấy một trang hướng dẫn. Remote luôn phải được chạy bên trong shell, qua `http://localhost:4000`.
