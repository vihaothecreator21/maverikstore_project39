import { ProductRepository } from "../repositories/product.repository.js";
import { APIError } from "../utils/apiResponse.js";
import type {
  CreateProductInput,
  UpdateProductInput,
  ProductQueryInput,
} from "../schemas/product.schema.js";

/**
 * Product Service - Tầng xử lý nghiệp vụ
 * Xử lý toàn bộ logic liên quan đến sản phẩm
 */
export class ProductService {
  private productRepository: ProductRepository;

  constructor(productRepository: ProductRepository) {
    this.productRepository = productRepository;
  }

  /**
   * Tạo slug thân thiện với URL từ tên sản phẩm
   * Ví dụ: "Áo Thun Maverik 2024" => "ao-thun-maverik-2024"
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Loại bỏ dấu thanh/dấu phụ
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  /**
   * Đảm bảo slug là duy nhất — thêm số đếm vào cuối nếu cần
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
   * Lấy danh sách tất cả sản phẩm (có phân trang và lọc)
   */
  async getAll(query: ProductQueryInput) {
    const { page, limit, categoryId, search, minPrice, maxPrice, sort } = query;
    const { products, total } = await this.productRepository.findAll({
      page,
      limit,
      categoryId,
      search,
      minPrice,
      maxPrice,
      sort,
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
   * Lấy thông tin một sản phẩm theo ID
   */
  async getById(id: number) {
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new APIError(404, `Product with ID ${id} not found`, {}, "PRODUCT_NOT_FOUND");
    }
    return product;
  }

  /**
   * Lấy thông tin một sản phẩm theo slug
   */
  async getBySlug(slug: string) {
    const product = await this.productRepository.findBySlug(slug);
    if (!product) {
      throw new APIError(404, `Product "${slug}" not found`, {}, "PRODUCT_NOT_FOUND");
    }
    return product;
  }

  /**
   * Tạo sản phẩm mới (chỉ Admin)
   */
  async create(input: CreateProductInput) {
    const baseSlug = this.generateSlug(input.name);
    const slug = await this.ensureUniqueSlug(baseSlug);
    return this.productRepository.create({ ...input, slug });
  }

  /**
   * Cập nhật sản phẩm theo ID (chỉ Admin)
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
   * Xóa sản phẩm theo ID (chỉ Admin)
   */
  async delete(id: number) {
    return this.productRepository.deleteOrThrow(id);
  }

  /**
   * Sửa các sản phẩm có slug NULL hoặc rỗng
   */
  async fixNullSlugs() {
    return this.productRepository.fixNullSlugs();
  }
  /**
   * Lấy danh sách sản phẩm bán chạy nhất
   */
  async getBestSellers(limit: number) {
    return this.productRepository.findBestSellers(limit);
  }
}
