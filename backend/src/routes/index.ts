import { Router, Request, Response } from "express";
import { sendSuccess, HTTP_STATUS } from "../utils/apiResponse";
import { getEnv } from "../config/env.config";
import { authRoutes } from "./auth.routes";
import { userRoutes } from "./user.routes";
import { productRoutes } from "./product.routes";
import { categoryRoutes } from "./category.routes";
import { cartRoutes } from "./cart.routes";
import { orderRoutes, adminOrderRoutes } from "./order.routes";
import { adminRoutes } from "./admin.routes";
import { paymentRoutes } from "./payment.routes";

const router = Router();

// FIX: Dùng constant ở module level — KHÔNG gọi getEnv() trực tiếp ở đây
// vì với ESM, module code chạy TRƯỚC khi initializeEnv() trong server.ts body
// process.env đã có giá trị từ .env file qua dotenv.config() ở server.ts... 
// nhưng dotenv cũng chạy sau import. Dùng "v1" làm fallback hợp lệ.
const V = process.env["API_VERSION"] ?? "v1";

// ==================== API Info Route ====================
router.get("/", (_req: Request, res: Response) => {
  // getEnv() bên trong handler là OK — chỉ chạy khi có request, sau khi env đã init
  const env = getEnv();
  const apiInfo = {
    name: "Maverik Store API",
    version: env.API_VERSION,
    documentation: "https://docs.maverik-store.com",
    endpoints: {
      health: "/api/health",
      auth: `/api/${env.API_VERSION}/auth`,
      users: `/api/${env.API_VERSION}/users`,
      products: `/api/${env.API_VERSION}/products`,
      categories: `/api/${env.API_VERSION}/categories`,
      cart: `/api/${env.API_VERSION}/cart`,
      orders:   `/api/${env.API_VERSION}/orders`,
      payments: `/api/${env.API_VERSION}/payments`,
      reviews:  `/api/${env.API_VERSION}/reviews`,
      favorites: `/api/${env.API_VERSION}/favorites`,
    },
  };
  sendSuccess(res, apiInfo, "Welcome to Maverik Store API", HTTP_STATUS.OK);
});

// ==================== Health Check Route ====================
router.get("/health", (_req: Request, res: Response) => {
  // getEnv() bên trong handler — an toàn, lazy evaluation
  const env = getEnv();
  const healthStatus = {
    status: "healthy",
    environment: env.NODE_ENV,
    apiVersion: env.API_VERSION,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };
  sendSuccess(res, healthStatus, "Maverik Store API is running", HTTP_STATUS.OK);
});

// ==================== Route Mounting ====================
// Dùng `V` (constant, module-level safe) thay vì getEnv() trực tiếp

// Auth
router.use(`/${V}/auth`, authRoutes);

// Product
router.use(`/${V}/products`, productRoutes);

// Category
router.use(`/${V}/categories`, categoryRoutes);

// Cart
router.use(`/${V}/cart`, cartRoutes);

// Order (User)
router.use(`/${V}/orders`, orderRoutes);

// Order (Admin) — Quản lý đơn hàng
router.use(`/${V}/admin/orders`, adminOrderRoutes);

// Admin Analytics — Dashboard, Revenue, Reports, Export
router.use(`/${V}/admin`, adminRoutes);

// Users (Profile Management)
router.use(`/${V}/users`, userRoutes);

// Payment (VNPay)
router.use(`/${V}/payments`, paymentRoutes);

// ==================== @TODO Routes ====================
// import reviewRoutes from './review.routes';
// router.use(`/${V}/reviews`, reviewRoutes);

// import favoriteRoutes from './favorite.routes';
// router.use(`/${V}/favorites`, favoriteRoutes);

export default router;
