import slugify from "slugify";
import { CategoryRepository } from "../repositories/category.repository";
import { APIError } from "../utils/apiResponse";
import {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "../schemas/category.schema";

// ✅ CẢI TIẾN: Backend tự quản lý việc tạo slug. Client chỉ gửi name + description.
export class CategoryService {
  private categoryRepository: CategoryRepository;

  constructor(categoryRepository: CategoryRepository) {
    this.categoryRepository = categoryRepository;
  }

  async getAll() {
    return this.categoryRepository.findAll();
  }

  async getById(id: number) {
    const cat = await this.categoryRepository.findById(id);
    if (!cat)
      throw new APIError(404, `Danh mục không tồn tại`, {}, "CATEGORY_NOT_FOUND");
    return cat;
  }

  // ── Nội bộ: tạo slug, xử lý trùng lặp ─────────────────────────────
  private async generateUniqueSlug(
    name: string,
    excludeId?: number,
  ): Promise<string> {
    const baseSlug = slugify(name, {
      lower: true,
      strict: true,
      locale: "vi",
    });

    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.categoryRepository.findBySlug(slug);
      if (!existing || (excludeId && existing.id === excludeId)) {
        return slug;
      }
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  // ── Tạo mới ────────────────────────────────────────────────────────
  async create(data: CreateCategoryInput) {
    // Kiểm tra tên danh mục chưa trùng trước (báo lỗi thân thiện trước DB)
    const existingName = await this.categoryRepository.findByName(data.name);
    if (existingName) {
      throw new APIError(400, "Tên danh mục đã tồn tại", {}, "CATEGORY_NAME_DUPLICATED");
    }

    // Backend luôn tự tạo slug — client không được truyền slug
    const slug = await this.generateUniqueSlug(data.name);

    return this.categoryRepository.create({
      name:        data.name,
      slug,
      description: data.description,
    });
  }

  // ── Cập nhật ────────────────────────────────────────────────────────
  async update(id: number, data: UpdateCategoryInput) {
    const existing = await this.getById(id);

    // Chỉ tạo lại slug khi tên thay đổi
    let slug = existing.slug;
    if (data.name && data.name !== existing.name) {
      const existingName = await this.categoryRepository.findByName(data.name);
      if (existingName) {
        throw new APIError(400, "Tên danh mục đã tồn tại", {}, "CATEGORY_NAME_DUPLICATED");
      }
      slug = await this.generateUniqueSlug(data.name, id);
    }

    return this.categoryRepository.update(id, {
      name:        data.name,
      slug,
      description: data.description,
    });
  }

  // ── Xóa ─────────────────────────────────────────────────────────────
  async delete(id: number) {
    await this.getById(id);

    const productCount = await this.categoryRepository.countProducts(id);
    if (productCount > 0) {
      throw new APIError(
        400,
        `Không thể xóa danh mục đang có ${productCount} sản phẩm`,
        { productCount },
        "CATEGORY_HAS_PRODUCTS",
      );
    }

    return this.categoryRepository.delete(id);
  }
}
