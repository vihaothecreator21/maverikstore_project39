import { prisma } from "../config/database";
import type { CreateProductInput, UpdateProductInput } from "../schemas/product.schema";

/**
 * Product Repository - Database Access Layer
 * Handles all product-related database operations via Prisma
 */

export class ProductRepository {
  /**
   * Find all products with optional filtering and pagination
   */
  static async findAll(options: {
    page: number;
    limit: number;
    categoryId?: number;
    search?: string;
  }) {
    const { page, limit, categoryId, search } = options;
    const skip = (page - 1) * limit;

    // Build dynamic where clause
    const where: any = {};
    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (search) {
      where.name = { contains: search };
    }

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          stockQuantity: true,
          description: true,
          imageUrl: true,
          createdAt: true,
          updatedAt: true,
          category: {
            select: { id: true, name: true, slug: true },
          },
          images: {
            select: { id: true, url: true, isPrimary: true },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return { products, total };
  }

  /**
   * Find a single product by ID
   */
  static async findById(id: number) {
    return prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        stockQuantity: true,
        description: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: { id: true, name: true, slug: true },
        },
        images: {
          select: { id: true, url: true, isPrimary: true },
        },
        reviews: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            user: { select: { id: true, username: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });
  }

  /**
   * Find a product by slug
   */
  static async findBySlug(slug: string) {
    return prisma.product.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        stockQuantity: true,
        description: true,
        imageUrl: true,
        createdAt: true,
        category: {
          select: { id: true, name: true, slug: true },
        },
        images: {
          select: { id: true, url: true, isPrimary: true },
        },
      },
    });
  }

  /**
   * Check if slug already exists (used for unique validation)
   */
  static async slugExists(slug: string, excludeId?: number): Promise<boolean> {
    const product = await prisma.product.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!product) return false;
    if (excludeId && product.id === excludeId) return false;
    return true;
  }

  /**
   * Create a new product
   */
  static async create(data: CreateProductInput & { slug: string }) {
    return prisma.product.create({
      data: {
        categoryId: data.categoryId,
        name: data.name,
        slug: data.slug,
        price: data.price,
        stockQuantity: data.stockQuantity ?? 0,
        description: data.description ?? null,
        imageUrl: data.imageUrl ?? null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        stockQuantity: true,
        description: true,
        imageUrl: true,
        createdAt: true,
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  }

  /**
   * Update an existing product by ID
   */
  static async update(id: number, data: UpdateProductInput & { slug?: string }) {
    return prisma.product.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        stockQuantity: true,
        description: true,
        imageUrl: true,
        updatedAt: true,
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  }

  /**
   * Delete a product by ID
   */
  static async delete(id: number) {
    return prisma.product.delete({
      where: { id },
      select: { id: true, name: true },
    });
  }
}
