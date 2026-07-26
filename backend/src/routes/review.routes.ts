import { Router } from "express";
import { ReviewController } from "../controllers/review.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { catchAsync } from "../utils/catchAsync.js";

/**
 * Router cho module đánh giá sản phẩm (review).
 * Được gắn prefix "/reviews" trong index routes.
 *
 * Các route:
 *  GET  /latest   – Lấy danh sách review mới nhất (công khai, không cần đăng nhập).
 *  POST /         – Tạo hoặc cập nhật review cho sản phẩm (yêu cầu đăng nhập).
 */
export const reviewRoutes = Router();

// [Công khai] Lấy tối đa 6 review mới nhất – dùng hiển thị trên trang chủ / widget
reviewRoutes.get("/latest", catchAsync(ReviewController.getLatest));

// [Yêu cầu JWT] authMiddleware kiểm tra token, gán req.userId; sau đó gọi create
reviewRoutes.post("/", authMiddleware, catchAsync(ReviewController.create));
