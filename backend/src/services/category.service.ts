import { CategoryRepository } from "../repositories/category.repository";
import { APIError } from "../utils/apiResponse";

export class CategoryService {
  static async getAll() {
    return CategoryRepository.findAll();
  }

  static async getById(id: number) {
    const cat = await CategoryRepository.findById(id);
    if (!cat) throw new APIError(404, `Category not found`, {}, "CATEGORY_NOT_FOUND");
    return cat;
  }
}
