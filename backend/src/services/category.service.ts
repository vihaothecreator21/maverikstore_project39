import slugify from "slugify";
import { CategoryRepository } from "../repositories/category.repository";
import { APIError } from "../utils/apiResponse";
import {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "../schemas/category.schema";

export class CategoryService {
  static async getAll() {
    return CategoryRepository.findAll();
  }

  static async getById(id: number) {
    const cat = await CategoryRepository.findById(id);
    if (!cat)
      throw new APIError(404, `Category not found`, {}, "CATEGORY_NOT_FOUND");
    return cat;
  }

  private static async generateUniqueSlug(
    name: string,
    excludeId?: number,
  ): Promise<string> {
    // Generate base slug with Vietnamese support
    let baseSlug = slugify(name, {
      lower: true,
      strict: true,
      locale: "vi", // Vietnamese support - removes diacritics (á, é, ư, etc.)
    });

    let slug = baseSlug;
    let counter = 1;

    // Check for collision and auto-append numbers if needed
    while (true) {
      const existing = await CategoryRepository.findBySlug(slug);

      // If no existing with this slug, or existing is the same category being updated, use it
      if (!existing || (excludeId && existing.id === excludeId)) {
        return slug;
      }

      // Collision detected, append counter
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  static async create(data: CreateCategoryInput) {
    // Generate slug from name if not provided
    const slug = data.slug || (await this.generateUniqueSlug(data.name));

    return CategoryRepository.create({
      name: data.name,
      slug,
      description: data.description,
    });
  }

  static async update(id: number, data: UpdateCategoryInput) {
    // Verify category exists
    const existing = await this.getById(id);

    // Regenerate slug if name changed
    let slug = data.slug || existing.slug;
    if (data.name && data.name !== existing.name) {
      slug = await this.generateUniqueSlug(data.name, id);
    }

    return CategoryRepository.update(id, {
      name: data.name,
      slug,
      description: data.description,
    });
  }

  static async delete(id: number) {
    // Verify category exists
    await this.getById(id);

    // Check if category has products
    const productCount = await CategoryRepository.countProducts(id);
    if (productCount > 0) {
      throw new APIError(
        400,
        `Cannot delete category with ${productCount} product(s)`,
        {},
        "CATEGORY_HAS_PRODUCTS",
      );
    }

    return CategoryRepository.delete(id);
  }
}
