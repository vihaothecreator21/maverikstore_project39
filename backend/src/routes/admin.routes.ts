import { Router } from "express";
import { AdminController } from "../controllers/admin.controller";
import { catchAsync } from "../utils/catchAsync";
import { authMiddleware, requireAdmin } from "../middlewares/auth.middleware";

/**
 * Admin Analytics Routes — /api/v1/admin
 *
 * All routes require: authMiddleware + requireAdmin (ADMIN or SUPER_ADMIN)
 *
 * GET /api/v1/admin/stats              → Dashboard overview stats
 * GET /api/v1/admin/revenue            → Revenue by period (bar chart data)
 * GET /api/v1/admin/revenue/payment    → Revenue by payment method (pie chart)
 * GET /api/v1/admin/products/stats     → Best sellers, low stock, by category
 * GET /api/v1/admin/customers/stats    → Customer stats + top spenders
 * GET /api/v1/admin/export/orders      → Raw data for CSV/PDF export
 *
 * Note: Admin ORDER management routes (/api/v1/admin/orders/...)
 *       are still in order.routes.ts and mounted separately — not changed.
 */
export const adminRoutes = Router();

// Apply auth + role guard to ALL admin analytics routes
adminRoutes.use(authMiddleware, requireAdmin);

adminRoutes.get("/stats",             catchAsync(AdminController.getDashboardStats));
adminRoutes.get("/revenue",           catchAsync(AdminController.getRevenue));
adminRoutes.get("/revenue/payment",   catchAsync(AdminController.getRevenueByPayment));
adminRoutes.get("/products/stats",    catchAsync(AdminController.getProductStats));
adminRoutes.get("/customers/stats",   catchAsync(AdminController.getCustomerStats));
adminRoutes.get("/export/orders",     catchAsync(AdminController.exportOrders));
