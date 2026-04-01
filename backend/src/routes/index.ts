import { Router, Request, Response } from "express";
import { sendSuccess, HTTP_STATUS } from "../utils/apiResponse";
import { authRoutes } from "./auth.routes";
import { productRoutes } from "./product.routes";
import { categoryRoutes } from "./category.routes";

const router = Router();

/**
 * API Base Information Route
 * Returns API version and available endpoints
 *
 * @route GET /api
 * @returns {Object} API information with available endpoints
 */
router.get("/", (_req: Request, res: Response) => {
  const apiInfo = {
    name: "Maverik Store API",
    version: process.env.API_VERSION || "v1",
    documentation: "https://docs.maverik-store.com", // Future docs URL
    endpoints: {
      health: "/api/health",
      auth: `/api/${process.env.API_VERSION || "v1"}/auth`,
      users: `/api/${process.env.API_VERSION || "v1"}/users`,
      products: `/api/${process.env.API_VERSION || "v1"}/products`,
      categories: `/api/${process.env.API_VERSION || "v1"}/categories`,
      cart: `/api/${process.env.API_VERSION || "v1"}/cart`,
      orders: `/api/${process.env.API_VERSION || "v1"}/orders`,
      reviews: `/api/${process.env.API_VERSION || "v1"}/reviews`,
      favorites: `/api/${process.env.API_VERSION || "v1"}/favorites`,
    },
  };

  sendSuccess(res, apiInfo, "Welcome to Maverik Store API", HTTP_STATUS.OK);
});

/**
 * Health Check Route
 * Simple endpoint to verify API is running and database is connected
 * Useful for monitoring and deployment checks
 *
 * @route GET /api/health
 * @returns {Object} Health status
 *
 * @example
 * GET http://localhost:5000/api/health
 * Response: { status: "success", data: {...}, message: "API is healthy" }
 */
router.get("/health", (_req: Request, res: Response) => {
  const healthStatus = {
    status: "healthy",
    environment: process.env.NODE_ENV || "development",
    apiVersion: process.env.API_VERSION || "v1",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };

  sendSuccess(
    res,
    healthStatus,
    "Maverik Store API is running",
    HTTP_STATUS.OK,
  );
});

// ==================== Authentication Routes ====================
router.use(`/${process.env.API_VERSION || "v1"}/auth`, authRoutes);

// ==================== Product Routes ====================
router.use(`/${process.env.API_VERSION || "v1"}/products`, productRoutes);

// ==================== Category Routes ====================
router.use(`/${process.env.API_VERSION || "v1"}/categories`, categoryRoutes);

// ==================== Cart Routes ====================
import { cartRoutes } from './cart.routes';
router.use(`/${process.env.API_VERSION || 'v1'}/cart`, cartRoutes);

// ==================== Order Routes ====================
// @TODO: Implement when ready
// import orderRoutes from './order.routes';
// router.use(`/${process.env.API_VERSION || 'v1'}/orders`, orderRoutes);

// ==================== User Routes ====================
// @TODO: Implement when ready
// import userRoutes from './user.routes';
// router.use(`/${process.env.API_VERSION || 'v1'}/users`, userRoutes);

// ==================== Review Routes ====================
// @TODO: Implement when ready
// import reviewRoutes from './review.routes';
// router.use(`/${process.env.API_VERSION || 'v1'}/reviews`, reviewRoutes);

// ==================== Favorite Routes ====================
// @TODO: Implement when ready
// import favoriteRoutes from './favorite.routes';
// router.use(`/${process.env.API_VERSION || 'v1'}/favorites`, favoriteRoutes);

export default router;
