import { Router } from "express";
import { OrderController } from "../controllers/order.controller";
import { authMiddleware, requireAdmin } from "../middlewares/auth.middleware";
import { catchAsync } from "../utils/catchAsync";

// ── User Order Routes — /api/v1/orders ────────────────────────────
export const orderRoutes = Router();

orderRoutes.use(authMiddleware); // Tất cả order routes cần đăng nhập

orderRoutes.post("/", catchAsync(OrderController.placeOrder));
orderRoutes.get("/", catchAsync(OrderController.getMyOrders));
orderRoutes.get("/:id", catchAsync(OrderController.getOrderById));
orderRoutes.patch("/:id/cancel", catchAsync(OrderController.cancelOrder));

// ── Admin Order Routes — /api/v1/admin/orders ─────────────────────
export const adminOrderRoutes = Router();

adminOrderRoutes.use(authMiddleware, requireAdmin); // Phải là ADMIN/SUPER_ADMIN

adminOrderRoutes.get("/", catchAsync(OrderController.adminGetOrders));
adminOrderRoutes.get("/:id", catchAsync(OrderController.adminGetOrderById));
adminOrderRoutes.patch("/:id/status", catchAsync(OrderController.adminUpdateStatus));
