import { Router } from "express";
import { PaymentController } from "../controllers/payment.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { catchAsync } from "../utils/catchAsync.js";

/**
 * Payment Routes — /api/v1/payments
 *
 * GET /api/v1/payments/vnpay/create   → Tạo URL thanh toán (cần đăng nhập)
 * GET /api/v1/payments/vnpay/return   → VNPay redirect về (public)
 * GET /api/v1/payments/vnpay/ipn      → VNPay IPN notify (public, server-to-server)
 */
export const paymentRoutes = Router();

// Tạo URL → cần đăng nhập (user phải sở hữu order)
paymentRoutes.get(
  "/vnpay/create",
  authMiddleware,
  catchAsync(PaymentController.createVNPayUrl),
);

// Return URL và IPN — public (VNPay gọi trực tiếp, không có Bearer token)
paymentRoutes.get("/vnpay/return", catchAsync(PaymentController.vnpayReturn));
paymentRoutes.get("/vnpay/ipn",    catchAsync(PaymentController.vnpayIPN));
