import { prisma } from "../config/database";

const SELECT_WITH_COUNT = {
  id: true, name: true, slug: true, description: true,
  _count: { select: { products: true } },
} as const;

export class CategoryRepository {
  async findAll() {
    return prisma.category.findMany({
      orderBy: { name: "asc" },
      select: SELECT_WITH_COUNT,
    });
  }

  async findById(id: number) {
    return prisma.category.findUnique({
      where: { id },
      select: SELECT_WITH_COUNT,
    });
  }

  async findBySlug(slug: string) {
    return prisma.category.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, description: true },
    });
  }

  async findByName(name: string) {
    return prisma.category.findUnique({
      where: { name },
      select: { id: true, name: true, slug: true, description: true },
    });
  }

  async create(data: { name: string; slug: string; description?: string }) {
    return prisma.category.create({
      data,
      select: SELECT_WITH_COUNT,
    });
  }

  async update(id: number, data: { name?: string; slug?: string; description?: string }) {
    return prisma.category.update({
      where: { id },
      data,
      select: SELECT_WITH_COUNT,
    });
  }

  async delete(id: number) {
    return prisma.category.delete({
      where: { id },
      select: { id: true, name: true, slug: true },
    });
  }

  async countProducts(categoryId: number) {
    return prisma.product.count({ where: { categoryId } });
  }
}
