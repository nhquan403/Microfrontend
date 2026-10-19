---
phase: 2
title: "Keycloak docker-compose và realm"
status: completed
effort: 0.5d
dependsOn: [1]
---

# Phase 02: Keycloak docker-compose và realm

## Mục tiêu
Chạy Keycloak 26.8.1 local trên port 8080 bằng một lệnh, kèm realm mẫu được import tự động.

## File tạo hoặc sửa
- Tạo `infra/docker-compose.yml`: service `keycloak` (image `quay.io/keycloak/keycloak:26.8.1`, lệnh `start-dev --import-realm`, port `8080:8080`, có healthcheck).
- Tạo `infra/keycloak/realm-microfrontend.json`: file realm export.
- Sửa `.env.example`: thêm `KEYCLOAK_ADMIN`, `KEYCLOAK_ADMIN_PASSWORD`, `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`.
- Sửa `package.json`: thêm script `infra:up`, `infra:down`.

## Nội dung realm `microfrontend`
- Client `shell-bff`:
  - Loại confidential (client authentication bật).
  - Chỉ bật Standard Flow. Tắt implicit, direct access grants và service accounts.
  - PKCE bắt buộc với method `S256` (`pkce.code.challenge.method=S256`).
  - Redirect URI chính xác: `http://localhost:4000/auth/callback`, không dùng wildcard.
  - Post-logout redirect URI: `http://localhost:4000/`.
  - Web origins: `http://localhost:4000`.
  - Access token sống 5 phút. Bật refresh token, và bật Revoke Refresh Token (rotation).
- Realm roles:
  - `shell-user`: được vào shell.
  - `demo-access`: được thấy và tải demo-remote, được gọi demo-api.
- Thêm protocol mapper để đưa realm roles vào claim `roles` của ID token và access token.
- Client `demo-api` loại bearer-only (hoặc audience mapper) để demo-api kiểm tra `aud`.
- User test (chỉ cho dev):
  - `alice` có `shell-user` và `demo-access`.
  - `bob` chỉ có `shell-user`.
  - Mật khẩu dev ghi trong `infra/keycloak/README` và đánh dấu rõ "chỉ dùng local".
- Client secret: realm export dùng placeholder. Giá trị thật đặt qua biến môi trường hoặc tạo lại sau khi import, không commit secret thật.
- Brute force detection bật. Password policy tối thiểu.

## Các bước
1. Viết `docker-compose.yml` có healthcheck gọi `/health/ready` (bật `KC_HEALTH_ENABLED=true`).
2. Tạo realm bằng giao diện admin, export (`kc.sh export --realm microfrontend --users realm_file`), rồi xoá secret và dữ liệu thừa.
3. Mount file realm vào `/opt/keycloak/data/import`.
4. `npm run infra:up` và chờ trạng thái healthy.

## Kiểm chứng
- `curl http://localhost:8080/realms/microfrontend/.well-known/openid-configuration` trả về JSON có `code_challenge_methods_supported` chứa `S256` và có `end_session_endpoint`.
- Đăng nhập `alice` và `bob` qua giao diện account của Keycloak thành công.
- Thử Authorization Code mà không gửi `code_challenge` thì bị Keycloak từ chối.

## Rủi ro
- Keycloak đổi định dạng realm export giữa các bản 26.x. Luôn export từ đúng image đã ghim.
- Hostname: BFF chạy trên máy host và gọi `localhost:8080`, trình duyệt cũng dùng `localhost:8080`, nên issuer khớp nhau. Nếu sau này BFF chạy trong container, phải đặt `KC_HOSTNAME`.

## Rollback
`npm run infra:down -v` xoá container và volume. Xoá thư mục `infra/`.

## Ghi chú triển khai
- Realm được viết tay thành `infra/keycloak/realm-microfrontend.json` thay vì export từ giao diện. Client secret và mật khẩu user dùng placeholder `${OIDC_CLIENT_SECRET}`, `${E2E_ALICE_PASSWORD}`, `${E2E_BOB_PASSWORD}`. Keycloak tự thay các placeholder này bằng biến môi trường khi import.
- Mật khẩu dev không ghi vào README. Giá trị ngẫu nhiên được sinh vào `.env` (đã gitignore). Hướng dẫn tạo `.env` sẽ nằm trong README gốc ở phase 09.
- Keycloak 26 dùng `KC_BOOTSTRAP_ADMIN_USERNAME/PASSWORD`. Compose ánh xạ từ `KEYCLOAK_ADMIN/KEYCLOAK_ADMIN_PASSWORD` trong `.env`.
- Kết quả kiểm chứng (ngày 2026-10-19):
  - Discovery trả issuer `http://localhost:8080/realms/microfrontend`, có `S256` và `end_session_endpoint`.
  - Request authorize thiếu PKCE bị chuyển về với `error=invalid_request` (`Missing parameter: code_challenge_method`). Có PKCE thì trả 200.
  - `alice` và `bob` đăng nhập qua form đều nhận được code. Sai mật khẩu thì không nhận được code.
