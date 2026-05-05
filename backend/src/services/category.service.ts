import slugify from "slugify";
import { CategoryRepository } from "../repositories/category.repository";
import { APIError } from "../utils/apiResponse";
import {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "../schemas/category.schema";

// ✅ IMPROVED: Backend fully owns slug generation. Clients only send name + description.
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

  // ── Private: generate slug, handle collisions ──────────────────────
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

  // ── Create ─────────────────────────────────────────────────────────
  async create(data: CreateCategoryInput) {
    // Check name uniqueness first (friendly error before DB constraint)
    const existingName = await this.categoryRepository.findByName(data.name);
    if (existingName) {
      throw new APIError(400, "Tên danh mục đã tồn tại", {}, "CATEGORY_NAME_DUPLICATED");
    }

    // Backend always generates slug — client never sets it
    const slug = await this.generateUniqueSlug(data.name);

    return this.categoryRepository.create({
      name:        data.name,
      slug,
      description: data.description,
    });
  }

  // ── Update ─────────────────────────────────────────────────────────
  async update(id: number, data: UpdateCategoryInput) {
    const existing = await this.getById(id);

    // Regenerate slug only when name changes
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

  // ── Delete ─────────────────────────────────────────────────────────
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
