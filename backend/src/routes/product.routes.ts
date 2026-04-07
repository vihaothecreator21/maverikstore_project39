import { Router } from "express";
import { ProductController } from "../controllers/product.controller";
import { catchAsync } from "../utils/catchAsync";
import { authMiddleware } from "../middlewares/auth.middleware";

/**
 * Product Routes
 *
 * Public Routes (no auth required):
 *   GET  /api/v1/products            - Get all products (with pagination + filter)
 *   GET  /api/v1/products/:id        - Get product by ID
 *   GET  /api/v1/products/slug/:slug - Get product by slug
 *
 * Admin-only Routes (TODO: protect with authMiddleware + adminMiddleware):
 *   POST   /api/v1/products          - Create new product
 *   PUT    /api/v1/products/:id      - Update product
 *   DELETE /api/v1/products/:id      - Delete product
 *   POST   /api/v1/products/admin/fix-null-slugs - Fix NULL slugs (Debug)
 */

export const productRoutes = Router();

// ── Public Routes ──────────────────────────────────────────────
productRoutes.get("/", catchAsync(ProductController.getAll));
productRoutes.get("/slug/:slug", catchAsync(ProductController.getBySlug));
productRoutes.get("/:id", catchAsync(ProductController.getById));

// ── Admin Routes (requires authentication) ──────────────
productRoutes.post(
  "/admin/fix-null-slugs",
  authMiddleware,
  catchAsync(ProductController.fixNullSlugs),
);
productRoutes.post("/", authMiddleware, catchAsync(ProductController.create));
productRoutes.put("/:id", authMiddleware, catchAsync(ProductController.update));
productRoutes.delete(
  "/:id",
  authMiddleware,
  catchAsync(ProductController.delete),
);
