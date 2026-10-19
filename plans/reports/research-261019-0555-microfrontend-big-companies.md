# Các công ty lớn dùng microfrontend như thế nào

Thời điểm nghiên cứu: 2026-10-19 (UTC).

## Kết luận nhanh

Không có một cách "chuẩn" duy nhất. Công ty lớn chọn cách ghép (composition) theo bài toán của họ:

- Ghép phía server/edge (IKEA, Zalando, American Express): tốt cho SEO và tốc độ tải đầu.
- Ghép phía client bằng app shell (DAZN, Ant Group với qiankun): tốt cho app dạng SPA, back-office.
- Module Federation (ByteDance): tốt khi cùng framework, cần chia sẻ dependency và hiệu năng.
- iframe (Spotify desktop cũ): cách ly mạnh nhưng Spotify đã bỏ vì gây ma sát cho developer.

Bài học chung: vấn đề lớn nhất không nằm ở thư viện mà ở quản trị (governance): version dependency, design system, quy trình release và ranh giới ownership giữa các team.

## Từng công ty

### IKEA: ghép ở edge/server, chia theo dọc
- Chia frontend theo "vertical slice": một team sở hữu cả backend lẫn frontend của một mảng nghiệp vụ, deploy độc lập.
- Dùng Akamai ESI (Edge Side Includes) để ghép trang ở edge; các trang khác nhau có thể dùng framework khác nhau.
- Chia sẻ UI giữa các framework bằng cách bọc component thành Web Components.

### Zalando: Project Mosaic, ghép phía server
- Skipper làm router, Tailor làm layout engine: server tải các "fragment" của từng team rồi ghép thành trang hoàn chỉnh.
- Nhược điểm được nêu: nhiều service tự xây, đường cong học tập cao.

### DAZN: app shell phía client, chia theo dọc
- Mỗi microfrontend sở hữu một vùng nghiệp vụ, được app shell mount/unmount.
- App shell cung cấp API cho các vấn đề cắt ngang (auth, logging, cấu hình…).
- Có một nguồn bên thứ ba nói DAZN dùng build-time integration; mâu thuẫn với nguồn chính chủ, chưa xác minh.

### Spotify: từng dùng iframe, rồi bỏ
- Desktop app cũ: mỗi "trang" là một app riêng chạy trong iframe, để nhiều team (thậm chí partner) tự chủ.
- Kết quả: gây "ma sát nghiêm trọng" cho developer, quá nhiều công nghệ web khác nhau, iframe tốn tài nguyên; web player phải tải lại nhiều JS/CSS mỗi lần chuyển view.
- Kiến trúc mới (2021): một lớp Platform API dùng chung, UI thống nhất bằng React. Tức là quay về hướng thống nhất stack.

### American Express: One App + Holocron
- Server Node.js render SPA React; nghiệp vụ nằm trong các "Holocron module" phát triển, test, deploy độc lập.
- Một "module map" (file JSON) khai báo version của từng module; server nạp module mới vào bộ nhớ mà không cần restart. Đây chính là mô hình "registry + URL" lúc chạy.
- Repo open-source đã archive (05/2024).

### Ant Group (Alibaba): qiankun
- qiankun sinh ra từ nền tảng front-end hợp nhất cho các sản phẩm cloud của Ant.
- Theo tài liệu chính chủ, phục vụ hơn 2000 ứng dụng online bên trong Ant (số tự công bố).
- Mô hình mức ứng dụng: shell + app con, chạy trên single-spa, hợp với back-office có nhiều app cũ.

### ByteDance: Module Federation
- Zack Jackson (tác giả Module Federation) làm ở ByteDance; MF 2.0 được hoàn thiện qua quy mô lớn của ByteDance (TikTok web, CapCut…).
- Hướng mức module: import chunk từ build khác lúc chạy, chia sẻ dependency.

### PayPal: thử nghiệm Module Federation
- Bài blog 2020 mô tả proof-of-concept MF và một gateway "Component Explorer" để chia sẻ UI component. Là thử nghiệm, không phải rollout đã xác nhận.

## Bài học rút ra

1. Chia theo nghiệp vụ (dọc), không chia theo kỹ thuật. Một team sở hữu trọn một mảng.
2. Có một registry/manifest trung tâm khai báo app và version (Amex module map, import map, MF manifest).
3. Host/shell chỉ lo phần cắt ngang: layout, auth, routing, logging. Không chứa nghiệp vụ.
4. Kiểm soát đa dạng công nghệ. Cho phép khác stack nhưng có giới hạn; Spotify là ví dụ trả giá vì quá đa dạng.
5. Design system + design tokens là bắt buộc; nếu khác stack thì dùng Web Components.
6. Quản lý version dependency dùng chung (React 17 vs 18 lệch nhau gây lỗi khó debug).
7. Chi phí vận hành tăng: mỗi app thêm một pipeline, repo, cấu hình deploy. Sản phẩm nhỏ thường không đáng.
8. Security tập trung ở host/gateway/edge, không dựa vào sandbox của thư viện.

## Áp dụng cho dự án này

- Bắt đầu với host + registry JSON + gateway cùng domain (giống Amex/IKEA về tư duy).
- Khác stack, cần gắn URL: qiankun. Cùng stack, cần hiệu năng: Module Federation 2.0.
- Đặt quy ước từ đầu: phiên bản framework cho phép, design tokens, hợp đồng giao tiếp giữa các app.

## Câu hỏi còn mở

- Số team và số app con dự kiến? Nếu ít (1–2 team), cân nhắc lại microfrontend có đáng không.
- Cần SEO/SSR không? Nếu cần, ghép phía server/edge đáng xem xét hơn ghép phía client.

## Nguồn

- https://en.wikipedia.org/wiki/Micro_frontend
- https://infoq.com/news/2018/08/experiences-micro-frontends
- https://medium.com/@amirilovic/web-microfrontends-introduction-451f72e68c8c
- https://fileadmin.cs.lth.se/cs/Personal/Lars_Bendix/Teaching/Lund/Theses/ST23/ST23-report.pdf
- https://www.infoq.com/podcasts/micro-frontends-dazn/
- https://www.oreilly.com/library/view/building-micro-frontends/9781492082989/ch04.html
- https://www.simform.com/blog/frontend-composition-techniques/
- https://engineering.atspotify.com/2021/4/building-the-future-of-our-desktop-apps
- https://engineering.atspotify.com/2019/3/building-spotifys-new-web-player
- https://github.com/americanexpress/one-app
- https://gitnation.com/contents/the-micro-frontend-revolution-at-amex
- https://qiankun.umijs.org/guide
- https://syntax.fm/show/860/module-federation-microfrontends-with-byedance-s-zack-jackson/transcript
- https://medium.com/paypal-engineering/decentralizing-ui-development-with-module-federation-90dbfb6ace29
- https://dev.to/tahamjp/why-micro-frontends-failed-us-and-what-were-trying-next-43oo
- https://thenewstack.io/4-lessons-learned-from-building-microfrontends/
