import { Request, Response } from "express";
import { ProductService } from "../services/product.service";
import {
  CreateProductSchema,
  UpdateProductSchema,
  ProductQuerySchema,
} from "../schemas/product.schema";
import { ValidationError, sendSuccess, HTTP_STATUS } from "../utils/apiResponse";

/**
 * Product Controller - HTTP Request Handler Layer
 * Only handles req/res — delegates all logic to ProductService
 */

export class ProductController {
  /**
   * GET /api/v1/products
   * Get all products with optional filtering and pagination
   */
  static async getAll(req: Request, res: Response) {
    const validation = ProductQuerySchema.safeParse(req.query);
    if (!validation.success) {
      const errors: Record<string, string[]> = {};
      validation.error.errors.forEach((err) => {
        const path = err.path[0] as string;
        if (!errors[path]) errors[path] = [];
        errors[path].push(err.message);
      });
      throw new ValidationError("Invalid query parameters", errors);
    }

    const result = await ProductService.getAll(validation.data);

    return sendSuccess(
      res,
      result.products,
      "Products retrieved successfully",
      HTTP_STATUS.OK,
      result.meta,
    );
  }

  /**
   * GET /api/v1/products/:id
   * Get a single product by ID
   */
  static async getById(req: Request, res: Response) {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new ValidationError("Invalid product ID", {
        id: ["Product ID must be a valid number"],
      });
    }

    const product = await ProductService.getById(id);
    return sendSuccess(res, product, "Product retrieved successfully", HTTP_STATUS.OK);
  }

  /**
   * GET /api/v1/products/slug/:slug
   * Get a single product by slug
   */
  static async getBySlug(req: Request, res: Response) {
    const { slug } = req.params;
    const product = await ProductService.getBySlug(slug);
    return sendSuccess(res, product, "Product retrieved successfully", HTTP_STATUS.OK);
  }

  /**
   * POST /api/v1/products
   * Create a new product (Admin only)
   */
  static async create(req: Request, res: Response) {
    const validation = CreateProductSchema.safeParse(req.body);
    if (!validation.success) {
      const errors: Record<string, string[]> = {};
      validation.error.errors.forEach((err) => {
        const path = err.path[0] as string;
        if (!errors[path]) errors[path] = [];
        errors[path].push(err.message);
      });
      throw new ValidationError("Validation failed", errors);
    }

    const product = await ProductService.create(validation.data);
    return sendSuccess(res, product, "Product created successfully", HTTP_STATUS.CREATED);
  }

  /**
   * PUT /api/v1/products/:id
   * Update an existing product (Admin only)
   */
  static async update(req: Request, res: Response) {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new ValidationError("Invalid product ID", {
        id: ["Product ID must be a valid number"],
      });
    }

    const validation = UpdateProductSchema.safeParse(req.body);
    if (!validation.success) {
      const errors: Record<string, string[]> = {};
      validation.error.errors.forEach((err) => {
        const path = err.path[0] as string;
        if (!errors[path]) errors[path] = [];
        errors[path].push(err.message);
      });
      throw new ValidationError("Validation failed", errors);
    }

    const product = await ProductService.update(id, validation.data);
    return sendSuccess(res, product, "Product updated successfully", HTTP_STATUS.OK);
  }

  /**
   * DELETE /api/v1/products/:id
   * Delete a product (Admin only)
   */
  static async delete(req: Request, res: Response) {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new ValidationError("Invalid product ID", {
        id: ["Product ID must be a valid number"],
      });
    }

    const deleted = await ProductService.delete(id);
    return sendSuccess(
      res,
      deleted,
      `Product "${deleted.name}" deleted successfully`,
      HTTP_STATUS.OK,
    );
  }
}
