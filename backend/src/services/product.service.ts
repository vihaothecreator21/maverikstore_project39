import { ProductRepository } from "../repositories/product.repository";
import { APIError } from "../utils/apiResponse";
import type {
  CreateProductInput,
  UpdateProductInput,
  ProductQueryInput,
} from "../schemas/product.schema";

/**
 * Product Service - Business Logic Layer
 * Handles all product-related business logic
 */

export class ProductService {
  /**
   * Generate a URL-friendly slug from a product name
   * e.g. "Áo Thun Maverik 2024" => "ao-thun-maverik-2024"
   */
  private static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")  // Remove diacritics
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  /**
   * Ensure slug is unique by appending a number if needed
   * e.g. "ao-thun" => "ao-thun-2" if "ao-thun" already exists
   */
  private static async ensureUniqueSlug(
    baseSlug: string,
    excludeId?: number,
  ): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (await ProductRepository.slugExists(slug, excludeId)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Get all products with pagination and filtering
   */
  static async getAll(query: ProductQueryInput) {
    const { page, limit, categoryId, search } = query;

    const { products, total } = await ProductRepository.findAll({
      page,
      limit,
      categoryId,
      search,
    });

    return {
      products,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single product by its ID
   */
  static async getById(id: number) {
    const product = await ProductRepository.findById(id);
    if (!product) {
      throw new APIError(
        404,
        `Product with ID ${id} not found`,
        {},
        "PRODUCT_NOT_FOUND",
      );
    }
    return product;
  }

  /**
   * Get a single product by its slug
   */
  static async getBySlug(slug: string) {
    const product = await ProductRepository.findBySlug(slug);
    if (!product) {
      throw new APIError(
        404,
        `Product "${slug}" not found`,
        {},
        "PRODUCT_NOT_FOUND",
      );
    }
    return product;
  }

  /**
   * Create a new product (Admin only)
   */
  static async create(input: CreateProductInput) {
    // Generate and ensure unique slug from product name
    const baseSlug = this.generateSlug(input.name);
    const slug = await this.ensureUniqueSlug(baseSlug);

    const product = await ProductRepository.create({ ...input, slug });

    return product;
  }

  /**
   * Update an existing product by ID (Admin only)
   */
  static async update(id: number, input: UpdateProductInput) {
    // Make sure product exists
    const existing = await ProductRepository.findById(id);
    if (!existing) {
      throw new APIError(
        404,
        `Product with ID ${id} not found`,
        {},
        "PRODUCT_NOT_FOUND",
      );
    }

    // Re-generate slug only if name changed
    let slugUpdate: { slug?: string } = {};
    if (input.name && input.name !== existing.name) {
      const baseSlug = this.generateSlug(input.name);
      const slug = await this.ensureUniqueSlug(baseSlug, id);
      slugUpdate = { slug };
    }

    const product = await ProductRepository.update(id, {
      ...input,
      ...slugUpdate,
    });

    return product;
  }

  /**
   * Delete a product by ID (Admin only)
   */
  static async delete(id: number) {
    // Make sure product exists before deleting
    const existing = await ProductRepository.findById(id);
    if (!existing) {
      throw new APIError(
        404,
        `Product with ID ${id} not found`,
        {},
        "PRODUCT_NOT_FOUND",
      );
    }

    const deleted = await ProductRepository.delete(id);
    return deleted;
  }
}
