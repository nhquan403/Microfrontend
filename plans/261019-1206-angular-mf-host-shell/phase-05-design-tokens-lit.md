---
phase: 5
title: "Design tokens và Lit components"
status: pending
effort: 1d
dependsOn: [1]
---

# Phase 05: Design tokens và Lit components

## Mục tiêu
Có bộ design tokens dạng CSS variables và một thư viện Web Components bằng Lit 3.3, prefix `mf-`. Shell nạp bộ này đúng một lần cho cả trang.

## File tạo hoặc sửa
- `libs/design-tokens/src/tokens.css`: `:root` chứa `--mf-color-*` (primary, surface, text, border, danger, success), `--mf-space-*`, `--mf-radius-*`, `--mf-font-*`, `--mf-shadow-*`. Có biến thể dark mode qua `[data-theme="dark"]`.
- `libs/design-tokens/README.md`: quy ước đặt tên token.
- `libs/ui-components/src/index.ts`: hàm `defineMfComponents()`. Hàm này đăng ký mọi component, có guard `if (!customElements.get(tag))` để gọi nhiều lần cũng không lỗi.
- `libs/ui-components/src/components/`:
  - `mf-button.ts`: variant, disabled, type submit. Hỗ trợ form qua `ElementInternals`.
  - `mf-icon.ts`: bộ icon SVG nhúng sẵn, không tải từ ngoài.
  - `mf-app-header.ts`: slot cho brand, user menu và nút logout. Phát event `mf-logout`.
  - `mf-sidebar.ts`: nhận `items` qua property, highlight mục đang active, phát event `mf-navigate`. Không tự điều hướng, router do shell quản lý.
  - `mf-app-footer.ts`
  - `mf-alert.ts`: dùng cho trang lỗi remote.
  - `mf-spinner.ts`
- `libs/ui-components/src/**/*.spec.ts`: test bằng `@open-wc/testing` hoặc Vitest với happy-dom (theo runner Nx đã chọn ở phase 01).

## Quy ước
- Mọi style của component nằm trong Shadow DOM qua `static styles` của Lit. Lit dùng `adoptedStyleSheets` nên không vi phạm CSP `style-src`.
- Component chỉ dùng `var(--mf-*)`, không hard-code màu.
- Không dùng `unsafeHTML`, không dùng `innerHTML` với dữ liệu ngoài.
- Event dùng `composed: true, bubbles: true`, tên có prefix `mf-`.
- Angular dùng các component này qua `CUSTOM_ELEMENTS_SCHEMA`, chỉ khai báo trong component cần dùng.
- Remote **không** gọi `defineMfComponents()`, vì shell đã gọi rồi. Remote chỉ import type. Với Native Federation, lib `@mf/ui-components` được chia sẻ dạng singleton, nên dù remote có gọi thì guard cũng ngăn đăng ký trùng.

## Các bước
1. Viết tokens và trang demo tĩnh để duyệt màu.
2. Viết từng component cùng unit test (render, thuộc tính, event).
3. Kiểm tra accessibility cơ bản: role, `aria-current` cho sidebar, focus ring, điều hướng bằng bàn phím.

## Kiểm chứng
- `npx nx test ui-components` và `npx nx build ui-components` chạy qua.
- Gọi `defineMfComponents()` hai lần không ném lỗi.
- Không có chuỗi màu hex nào trong `components/` (kiểm bằng lint rule hoặc grep).

## Rủi ro
- `ElementInternals` cho form: Angular Reactive Forms không tự bind được. Nếu remote cần dùng với form thì viết `ControlValueAccessor` wrapper sau, ngoài phạm vi đợt này.

## Rollback
Thư viện độc lập, revert commit là đủ.
