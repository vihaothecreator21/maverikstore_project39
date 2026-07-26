import { Request, Response } from "express";
import { APIError, ApiResponse } from "../utils/apiResponse.js";

/**
 * Middleware Xử lý 404 Not Found
 * Xử lý tất cả request đến các route chưa được định nghĩa
 * Phải đặt SAU tất cả route và TRƯỚC error handler
 * 
 * @usage
 * app.use(notFoundHandler);  // 404 handler
 * app.use(errorHandler);     // Error handler (phải sau 404)
 */
export const notFoundHandler = (req: Request, res: Response<ApiResponse<never>>): void => {
  const availableEndpoints = {
    health: "/api/health",
    auth: "/api/v1/auth",
    users: "/api/v1/users",
    products: "/api/v1/products",
    categories: "/api/v1/categories",
    cart: "/api/v1/cart",
    orders: "/api/v1/orders",
    reviews: "/api/v1/reviews",
    favorites: "/api/v1/favorites",
  };

  const error = new APIError(
    404,
    `Route not found: ${req.method} ${req.path}`,
    {
      method: req.method,
      path: req.path,
      availableEndpoints,
      suggestion: "Check the endpoint URL and HTTP method",
    },
    "ROUTE_NOT_FOUND"
  );

  res.status(404).json({
    status: "error" as const,
    code: 404,
    message: error.message,
    details: error.details,
    timestamp: new Date().toISOString(),
  });
};

export default notFoundHandler;
