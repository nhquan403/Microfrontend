# Review bảo mật: BFF + shell (nhánh feat/angular-mf-host-shell)

Ngày: 2026-10-19 (UTC). Commit HEAD: 70c1ce8. Review chỉ đọc, không sửa mã.

## Phạm vi

- apps/bff/src: auth/*, session/*, security/*, gateway/*, registry/registry.ts, app.ts, main.ts, config.ts, logging/logger.ts
- apps/shell/src: main.ts, federation/nonce-import-map.ts, app/**, index.html; libs/shell-auth/src/**
- apps/demo-api/src/**; infra/keycloak/realm-microfrontend.json; infra/docker-compose.yml; đối chiếu docs/security.md
- Kiểm chứng: `npx nx test bff` (6 file, 60 test, đều pass). Chạy trực tiếp `safeReturnTo` và `express/lib/utils.compileTrust` bằng Node 24 để xác nhận hai lỗi bên dưới. Đọc mã httpxy 0.5.5 để xác nhận cách proxy chép header.
- Phiên bản: express 5.3.0, express-session 1.19.0, openid-client 6.8.8, helmet 8.3.0, express-rate-limit 8.7.1, httpxy 0.5.5, jose 6.2.12, Angular 22.2.3.

## Đánh giá chung

Khung bảo mật nhìn chung đúng hướng: code+PKCE+nonce kiểm hai lần, regenerate session sau đăng nhập, cookie `__Host-sid`, CSRF áp cho mọi method không an toàn, kèm kiểm Origin, CSP nonce + Trusted Types, proxy bỏ cookie cả hai chiều. Dù vậy vẫn có một lỗi open redirect đã xác nhận (High), và một loạt lỗi Medium về cấu hình proxy, vòng đời session/token và phân quyền. Các lỗi Medium này sẽ lộ ra khi chạy production sau reverse proxy hoặc khi scale nhiều instance. Test hiện có không phủ các trường hợp này.

## Critical

Không có.

## High

### H1. Open redirect qua `returnTo` có dot-segment (đã xác nhận)

- File: apps/bff/src/auth/return-to.ts:7-24; dùng tại apps/bff/src/auth/auth-routes.ts:34 và :97.
- Nguyên nhân: các bước kiểm `startsWith('//')` và `includes('\\')` chạy trên chuỗi thô. Sau đó `new URL(raw, origin)` chuẩn hoá dot-segment, nên `pathname` có thể bắt đầu bằng `//` mà `url.origin` vẫn bằng publicOrigin. Hàm lại trả về chính `pathname` đã chuẩn hoá này.
- Kiểm chứng (chạy thật hàm `safeReturnTo` với origin https://app.example.com):
  - `/.//evil.com` cho ra `//evil.com`
  - `/%2e%2e//evil.com` cho ra `//evil.com`
  - `/a/..//evil.com` cho ra `//evil.com`
- Kịch bản: kẻ tấn công gửi link `https://app/auth/login?returnTo=%2F.%2F%2Fevil.com`. Nạn nhân đăng nhập Keycloak trên trang thật. Callback trả `302 Location: //evil.com` và trình duyệt chuyển sang https://evil.com, nơi có trang "phiên hết hạn, nhập lại mật khẩu" giả. Đây là phishing ngay sau một lần đăng nhập thật nên rất thuyết phục. Nếu đã có phiên SSO thì không cần tương tác gì.
- Cách sửa: kiểm lại trên kết quả sau khi chuẩn hoá, ví dụ:
  ```ts
  const path = `${url.pathname}${url.search}${url.hash}`;
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return '/';
  ```
  Hoặc gộp `//` ở đầu pathname thành `/`. Bổ sung ba payload trên vào `support.spec.ts`.

## Medium

### M1. `TRUST_PROXY=1` bị hiểu thành địa chỉ IP 0.0.0.1, nên không proxy nào được tin (đã xác nhận)

- File: apps/bff/src/config.ts:69 (`trustProxy: env['TRUST_PROXY'] || false`), apps/bff/src/app.ts:35.
- Kiểm chứng: `compileTrust("1")` trả `true` cho `0.0.0.1` nhưng `false` cho `10.0.0.5` và `127.0.0.1`. Giá trị số `1` mới có nghĩa là "tin 1 hop". Giá trị `"true"` thì làm app crash lúc khởi động (`invalid IP address: true`). docs/security.md chỉ nói "đặt TRUST_PROXY đúng với hạ tầng" mà không nêu định dạng.
- Kịch bản production sau reverse proxy terminate TLS, với `TRUST_PROXY=1` (giá trị phổ biến nhất):
  1. `req.secure` là false, nên express-session không phát cookie `Secure`. Đăng nhập không bao giờ giữ được session, người dùng bị lặp đăng nhập.
  2. `req.ip` là IP của proxy, nên rate limit `/auth` (60/phút) thành một bucket chung cho mọi người dùng. `/auth/me` được gọi mỗi lần tải shell, nên toàn bộ người dùng nhận 429 và shell trắng trang (`main.ts` ném lỗi `failed with 429`).
- Cách sửa: parse rõ ràng. Chuỗi toàn chữ số chuyển thành number, `true`/`false` chuyển thành boolean, còn lại là danh sách IP/subnet. Khi `production` và `PUBLIC_ORIGIN` là https mà `trustProxy` là false thì nên fail-fast hoặc ít nhất log cảnh báo rõ. Ghi định dạng vào .env.example.

### M2. Refresh token: mọi lỗi đều huỷ session, và chống race chỉ có hiệu lực trong một process

- File: apps/bff/src/auth/token-refresh.ts:28, :42-49, :58-67; realm có `revokeRefreshToken: true`, `refreshTokenMaxReuse: 0`.
- Đã xác nhận: khối `catch` gọi `destroySession` cho mọi lỗi, kể cả timeout mạng, Keycloak trả 5xx hay lỗi discovery. Một sự cố ngắn của IdP vì vậy sẽ đăng xuất mọi người dùng đang gọi `/api` vào lúc access token (5 phút) hết hạn.
- Suy luận (khi dùng store chung như docs khuyến nghị và chạy nhiều instance): map `inFlight` nằm trong từng process. Hai instance nhận hai request song song của cùng một session sẽ cùng refresh bằng một refresh token. Với maxReuse 0, instance thứ hai nhận `invalid_grant` rồi `destroySession` xoá luôn session mà instance thứ nhất vừa lưu token mới. Kết quả là người dùng bị đăng xuất ngẫu nhiên. Với MemorySessionStore một instance thì cửa sổ race gần như bằng 0.
- Cách sửa: chỉ huỷ session khi lỗi là `invalid_grant` (openid-client ném `ResponseBodyError` có `error === 'invalid_grant'`). Lỗi tạm thời thì trả 503 và giữ session. Trước khi refresh, đọc lại session từ store: nếu `tokens` đã đổi thì dùng token mới. Khi scale ra, dùng khoá phân tán theo sid (ví dụ Redis SET NX PX).

### M3. Logout bị "hồi sinh" nếu đang có một refresh dở dang (race, đã xác nhận bằng đọc mã)

- File: apps/bff/src/auth/token-refresh.ts:59-62; apps/bff/src/auth/auth-routes.ts:106-118; apps/bff/src/session/session.ts:66 (`rolling: true`).
- Kịch bản: request A gọi `/api` đúng lúc access token hết hạn và đang chờ `oidc.refresh`. Người dùng bấm Logout: `/auth/logout` xoá session trong store, xoá cookie rồi trả `logoutUrl`. Sau đó A nhận token mới và `saveSession(req)` gọi `store.set(sid, …)`, ghi lại toàn bộ snapshot (user, token mới) dưới sid cũ. Do `rolling: true`, response của A còn gửi lại `Set-Cookie: __Host-sid=<sid cũ>`. Kết quả: sau khi "đăng xuất", trình duyệt vẫn có session hợp lệ, `/auth/me`, `/registry`, `/apps/*` vẫn chạy, và access token mới dùng được tối đa 5 phút. Session tồn tại tới idle timeout. Trên máy dùng chung, đây là lỗi thật.
- Cách sửa: trước `saveSession` trong refresh, kiểm `await store.get(sid)` còn tồn tại; nếu không còn thì bỏ kết quả và trả undefined. Một cách khác là lưu "tombstone" sid đã logout trong khoảng ngắn. Nên gọi thêm `client.tokenRevocation` cho refresh token khi logout, để không phụ thuộc việc trình duyệt có đi tiếp tới `logoutUrl` hay không.

### M4. MemorySessionStore không giới hạn, vẫn dùng ở production, và session "chờ đăng nhập" sống 30 phút

- File: apps/bff/src/session/memory-session-store.ts:14, :35-44; apps/bff/src/main.ts:16-21 (production chỉ `logger.warn`); apps/bff/src/auth/auth-routes.ts:28-38.
- Kịch bản: `GET /auth/login` không cần cookie nhưng mỗi lần gọi tạo một session phía server (state, nonce, verifier, khoảng 0,5-1 KB sau JSON) với TTL bằng `idleMs` (30 phút), không phải `PENDING_LOGIN_TTL_MS` (10 phút). Rate limit 60/phút/IP (IPv6 gộp theo /56): một dải IPv6 /48 có 256 prefix /56, cho khoảng 256 x 60 x 30 ≈ 460 nghìn entry trong RAM, cộng thêm một botnet nhỏ. Process có thể bị OOM, và mọi session mất theo. Kết hợp M1 thì rate limit còn kém tác dụng hơn.
- Cách sửa: đặt `req.session.cookie.maxAge = PENDING_LOGIN_TTL_MS` ở `/auth/login` (TTL trong store đọc từ `cookie.maxAge`). Thêm trần số entry cho MemorySessionStore (từ chối hoặc xoá entry cũ nhất). Ở production, nên từ chối khởi động với memory store, trừ khi có cờ cho phép tường minh.

### M5. Role `shell-user` không được kiểm ở đâu cả; docs và comment nói BFF kiểm role trên `/api/*` nhưng mã không làm vậy

- File: apps/bff/src/auth/auth-routes.ts:81-97 (callback nhận mọi user của realm); apps/bff/src/gateway/gateway-routes.ts:82-91 (`/api` chỉ có `requireAuth`); docs/security.md (mục Phân quyền: "BFF kiểm role trên /registry, /apps/<name>/* và /api/*"); libs/shell-auth/src/lib/role.guard.ts:5-8 nói điều tương tự.
- Kịch bản: grep toàn bộ apps/libs chỉ thấy `shell-user` trong test-helpers. Mọi tài khoản của realm (ở production thường là realm dùng chung với ứng dụng khác) đều đăng nhập được vào shell, thấy các remote có `requiredRoles: []`, và được BFF gắn access token để gọi mọi đường dẫn upstream dưới `/api`. Hiện demo-api tự kiểm `demo-access` nên chưa lộ dữ liệu. Nhưng upstream nào gắn sau này mà tin vào lớp kiểm của BFF như docs mô tả sẽ bị lộ.
- Cách sửa: thêm cấu hình `LOGIN_REQUIRED_ROLES` (mặc định `shell-user`), kiểm ở callback và trả 403 "không có quyền dùng portal" khi thiếu. Thêm `requireRoles` cấu hình được cho `/api`. Sửa docs và comment cho khớp mã.

### M6. Vòng lặp chuyển hướng đăng nhập khi upstream trả 401

- File: libs/shell-auth/src/lib/session-expired.interceptor.ts:6-17; apps/demo-api/src/app.ts:34-39; apps/bff/src/gateway/proxy.ts (status upstream được chuyển nguyên).
- Kịch bản: demo-api trả 401 `invalid_token` cho mọi lỗi verify, kể cả khi `createRemoteJWKSet` không tới được Keycloak, lệch audience hay lệch đồng hồ. BFF chuyển nguyên 401. Remote dùng HttpClient của shell (remote.routes.ts ghi rõ chạy trong injector của shell) nên interceptor coi đó là hết phiên và chuyển tới `/auth/login`. Keycloak còn phiên SSO nên đăng nhập lại im lặng, quay về `/demo`, rồi lại 401. Kết quả là lặp vô hạn, và mỗi vòng còn đốt quota rate limit `/auth`.
- Cách sửa: BFF đổi 401 từ upstream thành mã khác (ví dụ 502 kèm `{error:'upstream_rejected_token'}`). Interceptor chỉ chuyển hướng khi body là `{error:'unauthenticated'}` của BFF. demo-api trả 503 khi lỗi JWKS hoặc mạng (`JWKSTimeout`, lỗi fetch). Có thể thêm chặn lặp phía client (đếm số lần chuyển hướng trong sessionStorage).

## Low

### L1. `absoluteTimeout` dùng `destroy` làm `req.session` thành undefined, khiến `/auth/login` và `/auth/callback` trả 500

- File: apps/bff/src/session/session.ts:84-94; apps/bff/src/auth/auth-routes.ts:30, :42-43.
- express-session xoá `req.session` khi `destroy`. Nếu request đầu tiên sau khi quá 8 giờ là `/auth/login` (từ bookmark, hoặc do interceptor chuyển tới), dòng `req.session.pendingLogin = …` ném TypeError và trả 500 `internal_error`. Middleware CSRF và requireAuth dùng `?.` nên không bị.
- Sửa: dùng `req.session.regenerate` thay `destroy`, để phần sau luôn có một session rỗng mới.

### L2. Header của upstream ghi đè header bảo mật của BFF

- File: apps/bff/src/gateway/proxy.ts:35-40, :68-73. httpxy (web-outgoing) gọi `res.setHeader` cho mọi header upstream sau khi helmet đã set.
- Upstream có thể ghi đè `Content-Security-Policy`, `Strict-Transport-Security` và `X-Frame-Options` trên origin của BFF, hoặc thêm `Access-Control-Allow-Origin`/`-Credentials`. Riêng CORS từ upstream sẽ biến `/api` thành đọc được từ site cùng-site (cookie Lax vẫn được gửi giữa các subdomain). demo-api hiện không gửi các header này nên đây mới là rủi ro tiềm ẩn. Ngoài ra `/api` không có `Cache-Control: no-store` cho dữ liệu theo người dùng.
- Sửa: trong `proxyRes`, xoá `access-control-*`, `content-security-policy*`, `strict-transport-security`, `x-frame-options`, `permissions-policy`, `cross-origin-*`. Đặt `Cache-Control: no-store` cho `/api` nếu upstream không đặt.

### L3. `X-Forwarded-*`, `Forwarded` và `X-Real-IP` do client gửi được chuyển nguyên lên upstream

- File: apps/bff/src/gateway/proxy.ts:28-33 (httpxy `setupOutgoing` sao chép toàn bộ `req.headers`; `xfwd` tắt nên không ghi đè).
- Upstream nào tin `X-Forwarded-For` để log, rate limit hay allowlist IP sẽ bị giả mạo. Ở dev, `localhostSecureShim` còn ép `x-forwarded-proto: https` lên upstream.
- Sửa: xoá các header này trong `proxyReq`, và nếu cần thì đặt lại từ `req.ip`/`req.protocol` đã được tin qua trust proxy.

### L4. Logout thất bại im lặng khi session BFF đã hết hạn

- File: apps/bff/src/security/csrf.ts:56-60; libs/shell-auth/src/lib/auth.service.ts:28-37; apps/shell/src/app/app.ts:53-55.
- Khi session đã hết idle/absolute, `POST /auth/logout` bị 403 `csrf_token_invalid` (session không còn token). Shell chỉ `console.error`, người dùng bấm Logout mà không có gì xảy ra, và phiên Keycloak (nếu còn) không được kết thúc.
- Sửa: cho `/auth/logout` chỉ cần kiểm Origin khi request không có session đăng nhập, và vẫn trả `logoutUrl` (không có `id_token_hint`). Hoặc shell chuyển hướng tới một endpoint GET riêng khi POST thất bại.

### L5. Role bị "đóng băng" lúc đăng nhập; thu hồi ở IdP không có hiệu lực tới khi refresh thất bại

- File: apps/bff/src/auth/auth-routes.ts:85-92; apps/bff/src/auth/token-refresh.ts:59-60; realm `frontchannelLogout: false`, không có backchannel logout.
- Gỡ role hoặc khoá user ở Keycloak không ảnh hưởng `/registry` và `/apps/*` cho tới 8 giờ, vì các route này không chạm tới token. Logout do admin hay IdP khởi xướng cũng không tới BFF.
- Sửa: cập nhật `session.user.roles` từ `claims` của ID token mới trong mỗi lần refresh. Cân nhắc thêm backchannel logout (lưu ánh xạ sid của Keycloak sang sid của BFF).

### L6. Callback xoá `pendingLogin` trước khi kiểm state; nhiều tab đăng nhập đè nhau

- File: apps/bff/src/auth/auth-routes.ts:30-36, :42-62.
- Một trang bên ngoài điều hướng top-level tới `/auth/callback?state=x` (cookie Lax được gửi) là xoá được `pendingLogin` của nạn nhân, làm hỏng lần đăng nhập đang diễn ra. Mở hai tab cùng chưa đăng nhập thì chỉ tab sau thành công. Không vượt được bảo mật, chỉ gây phiền.
- Sửa: chỉ xoá khi state khớp. Lưu pendingLogin theo map `state → entry` (giới hạn vài entry).

### L7. Cookie `XSRF-TOKEN` không có prefix `__Host-`

- File: apps/bff/src/security/csrf.ts:4, :19-24; apps/shell/src/app/app.config.ts:32-35.
- Một subdomain anh em có thể ghi đè cookie (cookie tossing), khiến Angular gửi header sai và mọi POST/DELETE bị 403. Đây chỉ là DoS, không vượt được kiểm tra vì server so sánh với token trong session.
- Sửa: đổi tên thành `__Host-XSRF-TOKEN` ở cả BFF và `withXsrfConfiguration`. Remote đang dùng HttpClient của shell nên chỉ cần đổi một chỗ.

### L8. Chế độ proxy (chỉ dev): bề mặt mở rộng

- apps/bff/src/gateway/proxy.ts:59-87: `injectNonce` được áp cho mọi response `text/html` của dev server, nên nếu dev server phản chiếu input trong HTML (trang lỗi chẳng hạn) thì `<script>` bị chèn sẽ được gắn nonce hợp lệ. `proxyRes` không có handler `error`/`aborted`, nên upstream đứt giữa chừng thì response treo. Body HTML được buffer không giới hạn.
- apps/bff/src/gateway/gateway-routes.ts:116-124: request không phải HTML tới shell dev server không cần đăng nhập.
- apps/bff/src/gateway/proxy.ts:93-101: proxy WebSocket không kiểm session hay Origin.
- apps/bff/src/main.ts:32: `app.listen(config.port)` bind mọi interface (demo-api thì bind 127.0.0.1), nên các bề mặt trên lộ ra mạng LAN.
- Sửa: bind `127.0.0.1` khi `insecureLocalhost`. Chỉ transform HTML cho request điều hướng. Thêm handler lỗi stream.

### L9. Chế độ static: `/index.html` được `express.static` trả nguyên bản

- File: apps/bff/src/gateway/gateway-routes.ts:101-105. Request `/index.html` không qua `requireAuth` và nhận nội dung còn placeholder `__CSP_NONCE__`, script không có nonce, nên trang hỏng. Không lộ dữ liệu, chỉ là lỗi đúng/sai.
- Sửa: chặn `/index.html` trong static (dùng option `setHeaders` không đủ; nên đặt route GET `/index.html` trước static, hoặc đổi tên file mẫu).

### L10. Trusted Types: policy `mf-import-map` là identity, CSP có `'allow-duplicates'`

- File: apps/shell/src/federation/nonce-import-map.ts:30-33; apps/bff/src/security/headers.ts:43-51.
- Policy không bị export và chỉ nhận `JSON.stringify(importMap)` nên hiện chưa khai thác được. Nhưng `'allow-duplicates'` cho phép mã bất kỳ tạo lại policy cùng tên, và policy không tự kiểm đầu vào. Đây là ghi chú để siết thêm, không phải lỗi.
- Gợi ý: trong `createScript`, parse JSON và chỉ chấp nhận `imports`/`scopes` có URL cùng origin. Gỡ `'allow-duplicates'` nếu xác nhận chỉ `angular` cần nó (kiểm trên Chromium).

## Các điểm đã kiểm và không thấy lỗi

- Session fixation: `regenerate` sau callback, cookie `__Host-` chống bị ghi đè từ subdomain.
- OIDC: state được tự kiểm rồi openid-client kiểm lại; PKCE S256; nonce và chữ ký ID token (`enableNonRepudiationChecks`). Request line dạng absolute-form chỉ làm lệch redirect_uri, Keycloak từ chối, không có tác động bảo mật.
- CSRF: áp cho mọi method ngoài GET/HEAD/OPTIONS; kiểm Origin hoặc Referer, thiếu cả hai thì từ chối; so sánh timing-safe. `/csp-report` đặt trước session/CSRF là đúng (không tạo session, có rate limit và giới hạn body 8 KB). Log ra JSON nên không có log injection.
- Static: `express.static`/send chặn traversal; tên remote đối chiếu với registry đã validate (`NAME` regex); route `/apps/demo` không khớp `/apps/demo-x`.
- SSRF: không có. Target proxy cố định từ config; URL dạng absolute-form chỉ thành path rác trên đúng target.
- Proxy `/api`: ghi đè `Authorization` và xoá `cookie`, `x-xsrf-token`; `Set-Cookie` của upstream bị xoá.
- demo-api: `jwtVerify` có issuer và audience; ID token (aud=shell-bff) và refresh token (HS512) không qua được.
- Lỗi trả ra ngoài chỉ là mã chung, không có stack. Logger che token, cookie và chuỗi trông giống JWT.
- `.env` không bị commit (chỉ có `.env.example`). Keycloak chỉ bind 127.0.0.1; secret lấy từ biến môi trường.

## Việc nên làm, theo thứ tự ưu tiên

1. Sửa H1 (`safeReturnTo` kiểm sau chuẩn hoá) và thêm test cho các payload dot-segment.
2. Sửa M1 (parse `TRUST_PROXY`) trước bất kỳ triển khai nào sau reverse proxy.
3. M3 và M2: kiểm session còn tồn tại trước khi lưu kết quả refresh; chỉ huỷ session khi `invalid_grant`; revoke refresh token khi logout.
4. M5: bắt buộc role đăng nhập và role cho `/api`, sửa docs/security.md cho khớp.
5. M6: phân biệt 401 của BFF với 401 của upstream.
6. M4: TTL ngắn cho session chờ đăng nhập, giới hạn kích thước memory store, chặn memory store ở production.
7. Các mục Low theo thời gian cho phép (L1, L2, L3 nên làm cùng đợt với M1-M3).

## Số liệu

- Unit test BFF: 60/60 pass. Không có test cho open redirect dạng dot-segment, cho race logout/refresh, cho định dạng TRUST_PROXY, hay cho lỗi refresh tạm thời.
- Không chạy lint, typecheck hay e2e (ngoài phạm vi review chỉ đọc). Không đo coverage.

## Câu hỏi còn mở

- Realm production có dùng chung với ứng dụng khác không? Nếu có, M5 nên nâng lên High.
- Có kế hoạch chạy nhiều instance BFF với Redis không? Nếu có, M2 trở thành lỗi chắc chắn xảy ra.
- `'allow-duplicates'` cần cho policy nào? Nếu chỉ vì nhiều bản Angular tạo policy `angular`, có thể thu hẹp lại.
