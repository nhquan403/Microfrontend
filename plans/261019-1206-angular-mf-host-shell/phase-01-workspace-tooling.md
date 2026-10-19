---
phase: 1
title: "Workspace Nx và tooling"
status: completed
effort: 0.5d
dependsOn: []
---

# Phase 01: Workspace Nx và tooling

## Mục tiêu
Có một Nx workspace chạy được, gồm khung sườn của mọi project, với phiên bản đã ghim chính xác và lint, test, build chạy được ngay từ đầu.

## File tạo hoặc sửa
- Tạo `package.json`, `nx.json`, `tsconfig.base.json`, `.nvmrc` (`24`), `.npmrc` (`engine-strict=true`, `save-exact=true`).
- Tạo `.gitignore` (bỏ `node_modules`, `dist`, `.nx`, `.env`, `coverage`, `test-results`).
- Tạo `.editorconfig`, `eslint.config.mjs`, `.prettierrc`.
- Tạo khung project:
  - `apps/shell`: ứng dụng Angular, builder `@angular/build:application`.
  - `apps/demo-remote`: ứng dụng Angular.
  - `apps/bff`: Node, Express 5, TypeScript.
  - `apps/demo-api`: Node.
  - `libs/design-tokens`, `libs/ui-components`, `libs/shell-auth`.
- Tạo `.env.example`, chỉ chứa tên biến, không có giá trị bí mật.

## Các bước
1. Nâng Node lên 24 LTS (`>=24.15.0`) và kiểm tra bằng `node -v`.
2. `npx create-nx-workspace@23.3.0` với preset trống (`apps`), package manager npm.
3. Thêm `@nx/angular@23.3.0`, `@nx/node@23.3.0`, `@nx/js@23.3.0`, `@nx/playwright@23.3.0`.
4. Sinh `apps/shell` và `apps/demo-remote` bằng `@nx/angular:application`: standalone, routing bật, style SCSS, bundler esbuild, không SSR, prefix `sh` và `demo`.
5. Sinh `apps/bff` và `apps/demo-api` bằng `@nx/node:application` (framework `none`, tự cài Express 5).
6. Sinh `libs/shell-auth` (`@nx/angular:library`, buildable), `libs/ui-components` và `libs/design-tokens` (`@nx/js:library`).
7. Ghim chính xác: `@angular/*` 22.2.3, `@angular/build` 22.2.x, `typescript` theo đúng phạm vi Angular 22.2 yêu cầu.
8. Đặt alias trong `tsconfig.base.json`: `@mf/shell-auth`, `@mf/ui-components`, `@mf/design-tokens`.
9. Đặt module boundary trong ESLint bằng tag Nx:
   - `scope:shell`, `scope:remote`, `scope:bff`, `scope:shared`.
   - Remote không được import code của shell.
   - BFF không được import lib Angular.

## Kiểm chứng
- `npx nx run-many -t lint test build` chạy qua trên khung sườn trống.
- `npx nx graph --file=graph.json` cho thấy đúng các project và tag.
- `npm ls @angular/core @angular/build` chỉ có đúng một phiên bản.

## Rủi ro
- Generator của Nx 23 có thể đổi tên option. Hãy đọc `--help` của từng generator, không đoán.
- TypeScript lệch phạm vi Angular yêu cầu thì build lỗi. Dùng đúng phạm vi trong peer dependency của `@angular/compiler-cli`.

## Rollback
Workspace mới hoàn toàn, nên chỉ cần xoá các file đã sinh hoặc `git reset` về commit trước phase này.

## Ghi chú triển khai
- Node 24.22.0 LTS được cài vào `/opt/node24` trên máy dev này. Khi chạy lệnh cần `PATH=/opt/node24/bin:$PATH`.
- Workspace được dựng thủ công (`package.json`, `nx.json`, `tsconfig.base.json`) rồi sinh project bằng generator. Template `create-nx-workspace` mặc định dùng kiểu TS solution và kèm app demo nên không phù hợp.
- `libs/shell-auth` là thư viện buildable (ng-packagr 22.2.4), vì runner `vitest-angular` yêu cầu như vậy.
- Bỏ `baseUrl` khỏi `tsconfig.base.json` vì TypeScript 6 báo deprecated.
- `allowScripts` trong `package.json` chỉ cho phép install script của `esbuild`, `nx`, `unrs-resolver`. Các gói rebuild bằng node-gyp bị từ chối vì đã có bản prebuilt.
- Kết quả kiểm chứng: `nx run-many -t lint test build` cho 19/19 task thành công. `npm ls @angular/core` chỉ có `22.2.3`.
