---
phase: 2
title: "Mở rộng design system và thư viện dùng chung"
status: pending
effort: 1.5d
dependsOn: []
---

# Phase 02: Mở rộng design system và thư viện dùng chung

## Mục tiêu
Cả 4 app dùng chung một giao diện: thêm các component form và layout vào `@mf/ui-components`, thêm một lib Angular để bind form với Web Components, và một service toast dùng chung.

## File tạo hoặc sửa
- `libs/ui-components/src/components/`, mỗi component kèm file spec:
  - `mf-input`: label, type text, email hoặc search, `required`, `error` message, form-associated qua `ElementInternals`.
  - `mf-textarea`, `mf-select` (options qua property).
  - `mf-card`: slot `header`, `actions` và default.
  - `mf-page-header`: tiêu đề, mô tả, slot `actions`.
  - `mf-badge`: variant neutral, info, success, warning, danger.
  - `mf-dialog`: dựa trên `<dialog>` native, có focus trap và đóng bằng Esc, phát event `mf-close`.
  - `mf-empty-state`: icon, tiêu đề, mô tả, slot hành động.
  - `mf-toast-region`: hiển thị danh sách toast, có `aria-live="polite"`, tự ẩn sau 4 giây.
  - Thêm icon cho `mf-icon`: `list`, `users`, `note`, `chart`, `plus`, `edit`, `trash`, `pin`, `search`.
- `libs/design-tokens/src/tokens.css`: thêm token còn thiếu (ví dụ `--mf-color-warning*`, `--mf-z-overlay`), có giá trị cho cả chế độ dark.
- `libs/ui-angular/` (lib Angular mới, tag `scope:shared`):
  - `MfValueAccessor`: một directive `ControlValueAccessor` cho `mf-input`, `mf-textarea`, `mf-select`. Có `formControlName` và `ngModel`, đồng bộ trạng thái disabled, touched và lỗi validation.
  - `MfUiModule` hoặc danh sách export standalone gồm directive và `CUSTOM_ELEMENTS_SCHEMA` helper.
- `libs/shell-services/` (lib Angular mới, tag `scope:shared`):
  - `NotificationService`: `providedIn: 'root'`, có `success(message)`, `error(message)` và signal `toasts`.
  - Không chứa dữ liệu nhạy cảm, nội dung chỉ hiển thị dạng text (Lit escape sẵn).
- `tsconfig.base.json`: alias `@mf/ui-angular`, `@mf/shell-services`.
- `tools/federation/shared-federation-config.mjs`: không cần sửa, vì `mappingsFromWorkspace().filter(['@mf/*'])` tự share hai lib mới dạng singleton. Phải kiểm lại điều này bằng build.

## Các bước
1. Viết các component Lit cùng test (happy-dom), chỉ dùng `var(--mf-*)`.
2. Viết `libs/ui-angular` với test Reactive Forms thật (TestBed với một form có `Validators.required` và `Validators.email`).
3. Viết `libs/shell-services` cùng test.
4. Cập nhật trang demo `libs/design-tokens/demo/index.html` cho các component mới.

## Kiểm chứng
- `npx nx run-many -t lint test typecheck build -p ui-components design-tokens ui-angular shell-services` qua.
- Không có mã màu hex trong `libs/ui-components/src/components`.
- Test chứng minh: form Angular đọc, ghi được giá trị và trạng thái lỗi của `mf-input`. `mf-dialog` trả focus về chỗ cũ khi đóng.

## Rủi ro
- `<dialog>` và `ElementInternals` trên happy-dom có thể thiếu API. Test theo kiểu feature-detect giống `mf-button` đã làm.

## Rollback
Các lib mới độc lập. Revert commit không ảnh hưởng tới shell hiện tại.
