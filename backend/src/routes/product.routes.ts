import { Router } from "express";
import { ProductController } from "../controllers/product.controller";
import { catchAsync } from "../utils/catchAsync";

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
 */

export const productRoutes = Router();

// ── Public Routes ──────────────────────────────────────────────
productRoutes.get("/", catchAsync(ProductController.getAll));
productRoutes.get("/slug/:slug", catchAsync(ProductController.getBySlug));
productRoutes.get("/:id", catchAsync(ProductController.getById));

// ── Admin Routes (TODO: Add authMiddleware, adminMiddleware) ────
productRoutes.post("/", catchAsync(ProductController.create));
productRoutes.put("/:id", catchAsync(ProductController.update));
productRoutes.delete("/:id", catchAsync(ProductController.delete));
