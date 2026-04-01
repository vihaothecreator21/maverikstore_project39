import { prisma } from "../config/database";

export class CategoryRepository {
  static async findAll() {
    return prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, description: true },
    });
  }

  static async findById(id: number) {
    return prisma.category.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, description: true },
    });
  }
}
