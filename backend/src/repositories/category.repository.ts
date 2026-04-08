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

  static async findBySlug(slug: string) {
    return prisma.category.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, description: true },
    });
  }

  static async create(data: {
    name: string;
    slug: string;
    description?: string;
  }) {
    return prisma.category.create({
      data,
      select: { id: true, name: true, slug: true, description: true },
    });
  }

  static async update(
    id: number,
    data: {
      name?: string;
      slug?: string;
      description?: string;
    }
  ) {
    return prisma.category.update({
      where: { id },
      data,
      select: { id: true, name: true, slug: true, description: true },
    });
  }

  static async delete(id: number) {
    return prisma.category.delete({
      where: { id },
      select: { id: true, name: true, slug: true, description: true },
    });
  }

  static async countProducts(categoryId: number) {
    return prisma.product.count({
      where: { categoryId },
    });
  }
}
