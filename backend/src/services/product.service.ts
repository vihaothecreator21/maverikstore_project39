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
  private productRepository: ProductRepository;

  constructor(productRepository: ProductRepository) {
    this.productRepository = productRepository;
  }

  /**
   * Generate a URL-friendly slug from a product name
   * e.g. "Áo Thun Maverik 2024" => "ao-thun-maverik-2024"
   */
  private generateSlug(name: string): string {
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
   */
  private async ensureUniqueSlug(
    baseSlug: string,
    excludeId?: number,
  ): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (await this.productRepository.slugExists(slug, excludeId)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Get all products with pagination and filtering
   */
  async getAll(query: ProductQueryInput) {
    const { page, limit, categoryId, search } = query;
    const { products, total } = await this.productRepository.findAll({
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
  async getById(id: number) {
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new APIError(404, `Product with ID ${id} not found`, {}, "PRODUCT_NOT_FOUND");
    }
    return product;
  }

  /**
   * Get a single product by its slug
   */
  async getBySlug(slug: string) {
    const product = await this.productRepository.findBySlug(slug);
    if (!product) {
      throw new APIError(404, `Product "${slug}" not found`, {}, "PRODUCT_NOT_FOUND");
    }
    return product;
  }

  /**
   * Create a new product (Admin only)
   */
  async create(input: CreateProductInput) {
    const baseSlug = this.generateSlug(input.name);
    const slug = await this.ensureUniqueSlug(baseSlug);
    return this.productRepository.create({ ...input, slug });
  }

  /**
   * Update an existing product by ID (Admin only)
   */
  async update(id: number, input: UpdateProductInput) {
    let slugUpdate: { slug?: string } = {};

    if (input.name) {
      const existing = await this.productRepository.findById(id);
      if (!existing) {
        throw new APIError(404, `Product with ID ${id} not found`, {}, "PRODUCT_NOT_FOUND");
      }

      if (input.name !== existing.name) {
        const baseSlug = this.generateSlug(input.name);
        const slug = await this.ensureUniqueSlug(baseSlug, id);
        slugUpdate = { slug };
      }
    } else {
      const exists = await this.productRepository.productExists(id);
      if (!exists) {
        throw new APIError(404, `Product with ID ${id} not found`, {}, "PRODUCT_NOT_FOUND");
      }
    }

    return this.productRepository.update(id, { ...input, ...slugUpdate });
  }

  /**
   * Delete a product by ID (Admin only)
   */
  async delete(id: number) {
    return this.productRepository.deleteOrThrow(id);
  }

  /**
   * Fix products with NULL or empty slugs
   */
  async fixNullSlugs() {
    return this.productRepository.fixNullSlugs();
  }
}
