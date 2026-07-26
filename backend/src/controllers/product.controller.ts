import { Request, Response } from "express";
import { productService } from "../container.js";
import {
  CreateProductSchema,
  UpdateProductSchema,
  ProductQuerySchema,
} from "../schemas/product.schema.js";
import {
  ValidationError,
  sendSuccess,
  HTTP_STATUS,
} from "../utils/apiResponse.js";

/**
 * Product Controller - Tầng xử lý HTTP Request
 * Chỉ xử lý req/res — ủy toàn bộ logic cho ProductService
 */

export class ProductController {
  /**
   * GET /api/v1/products
   * Lấy danh sách tất cả sản phẩm (có hỗ trợ lọc và phân trang)
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
      throw new ValidationError("Tham số truy vấn không hợp lệ", errors);
    }

    const result = await productService.getAll(validation.data);

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
   * Lấy thông tin một sản phẩm theo ID
   */
  static async getById(req: Request, res: Response) {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new ValidationError("Invalid product ID", {
        id: ["Product ID must be a valid number"],
      });
    }

    const product = await productService.getById(id);
    return sendSuccess(
      res,
      product,
      "Product retrieved successfully",
      HTTP_STATUS.OK,
    );
  }

  /**
   * GET /api/v1/products/slug/:slug
   * Lấy thông tin một sản phẩm theo slug
   */
  static async getBySlug(req: Request, res: Response) {
    const { slug } = req.params;
    const product = await productService.getBySlug(slug);
    return sendSuccess(
      res,
      product,
      "Product retrieved successfully",
      HTTP_STATUS.OK,
    );
  }

  /**
   * POST /api/v1/products
   * Tạo sản phẩm mới (chỉ Admin)
   */
  static async create(req: Request, res: Response) {
    const validation = await CreateProductSchema.safeParseAsync(req.body);
    if (!validation.success) {
      const errors: Record<string, string[]> = {};
      validation.error.errors.forEach((err) => {
        const path = err.path[0] as string;
        if (!errors[path]) errors[path] = [];
        errors[path].push(err.message);
      });
      throw new ValidationError("Validation failed", errors);
    }

    const product = await productService.create(validation.data);
    return sendSuccess(
      res,
      product,
      "Product created successfully",
      HTTP_STATUS.CREATED,
    );
  }

  /**
   * PUT /api/v1/products/:id
   * Cập nhật sản phẩm theo ID (chỉ Admin)
   */
  static async update(req: Request, res: Response) {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new ValidationError("Invalid product ID", {
        id: ["Product ID must be a valid number"],
      });
    }

    const validation = await UpdateProductSchema.safeParseAsync(req.body);
    if (!validation.success) {
      const errors: Record<string, string[]> = {};
      validation.error.errors.forEach((err) => {
        const path = err.path[0] as string;
        if (!errors[path]) errors[path] = [];
        errors[path].push(err.message);
      });
      throw new ValidationError("Validation failed", errors);
    }

    const product = await productService.update(id, validation.data);
    return sendSuccess(
      res,
      product,
      "Product updated successfully",
      HTTP_STATUS.OK,
    );
  }

  /**
   * DELETE /api/v1/products/:id
   * Xóa sản phẩm theo ID (chỉ Admin)
   */
  static async delete(req: Request, res: Response) {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new ValidationError("Invalid product ID", {
        id: ["Product ID must be a valid number"],
      });
    }

    const deleted = await productService.delete(id);
    return sendSuccess(
      res,
      deleted,
      `Product "${deleted.name}" deleted successfully`,
      HTTP_STATUS.OK,
    );
  }

  /**
   * POST /api/v1/products/admin/fix-null-slugs
   * Sửa các sản phẩm có slug NULL hoặc rỗng (endpoint Admin/Debug)
   */
  static async fixNullSlugs(_req: Request, res: Response) {
    const result = await productService.fixNullSlugs();
    return sendSuccess(
      res,
      result,
      `Fixed ${result.fixed} products with NULL slugs`,
      HTTP_STATUS.OK,
    );
  }
  /**
   * GET /api/v1/products/featured/best-sellers
   * Lấy danh sách sản phẩm bán chạy nhất cho trang chủ
   */
  static async getBestSellers(req: Request, res: Response) {
    const limit = parseInt(req.query.limit as string) || 8;
    const products = await productService.getBestSellers(limit);
    return sendSuccess(res, products, "Best sellers retrieved successfully", HTTP_STATUS.OK);
  }
}
