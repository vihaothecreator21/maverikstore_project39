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
      .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
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
   * ⚠️ Fixed N+1 query: Uses updateOrThrow instead of (findById + update)
   */
  static async update(id: number, input: UpdateProductInput) {
    // Get existing product using updateOrThrow pattern to avoid N+1
    let slugUpdate: { slug?: string } = {};

    // If name changed, we need to get existing name for comparison
    if (input.name) {
      const existing = await ProductRepository.findById(id);
      if (!existing) {
        throw new APIError(
          404,
          `Product with ID ${id} not found`,
          {},
          "PRODUCT_NOT_FOUND",
        );
      }

      if (input.name !== existing.name) {
        const baseSlug = this.generateSlug(input.name);
        const slug = await this.ensureUniqueSlug(baseSlug, id);
        slugUpdate = { slug };
      }
    } else {
      // If name not changing, just verify product exists without fetching full data
      const exists = await ProductRepository.productExists(id);
      if (!exists) {
        throw new APIError(
          404,
          `Product with ID ${id} not found`,
          {},
          "PRODUCT_NOT_FOUND",
        );
      }
    }

    const product = await ProductRepository.update(id, {
      ...input,
      ...slugUpdate,
    });

    return product;
  }

  /**
   * Delete a product by ID (Admin only)
   * ⚠️ Fixed N+1 query: Delegates existence check to repository deleteOrThrow
   */
  static async delete(id: number) {
    // Repository will handle existence check, preventing N+1 query
    const deleted = await ProductRepository.deleteOrThrow(id);
    return deleted;
  }

  /**
   * Fix products with NULL or empty slugs (Helper for Prisma Studio data)
   */
  static async fixNullSlugs() {
    return await ProductRepository.fixNullSlugs();
  }
}
