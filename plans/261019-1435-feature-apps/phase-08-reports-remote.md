---
phase: 8
title: "Remote Reports"
status: pending
effort: 0.75d
dependsOn: [4]
---

# Phase 08: Remote Reports (dashboard)

## Mục tiêu
Remote `reports`: dashboard chỉ đọc dựa trên `/api/reports/summary`. Gồm các thẻ KPI (tổng task, đang làm, quá hạn, tổng liên hệ, tổng ghi chú), một biểu đồ cột task theo trạng thái, và top 5 công ty theo số liên hệ. Có nút làm mới.

## Quyền sở hữu file
Chỉ `apps/reports-remote/**`.

## File tạo
- Sinh app và init federation, port `4205`, `name: 'reports'`.
- `src/app/remote.routes.ts`: `''` trỏ tới `DashboardPage`.
- `src/app/reports-api.service.ts`.
- `src/app/pages/dashboard.page.ts`: lưới `mf-card` cho KPI, có `mf-spinner` khi đang tải và `mf-alert` khi lỗi.
- `src/app/components/bar-chart.ts`: biểu đồ cột SVG tự vẽ, không dùng thư viện chart, nên không cần thêm dependency hay nới CSP. Màu lấy từ `var(--mf-*)`, có `role="img"` và `aria-label` mô tả số liệu, kèm bảng số liệu ẩn cho trình đọc màn hình.
- Test cho dashboard (render số liệu, trạng thái lỗi) và bar chart (tỉ lệ cột, nhãn truy cập) cùng contract routes.

## Kiểm chứng
- `npx nx run-many -t lint test build -p reports-remote` qua.
- Chạy qua BFF: số liệu khớp với dữ liệu. Tạo task ở Tasks, quay lại Reports và bấm làm mới thì số tăng tương ứng. Không có vi phạm CSP hay Trusted Types.

## Rollback
Xoá mục `reports` khỏi registry, sau đó revert commit.
