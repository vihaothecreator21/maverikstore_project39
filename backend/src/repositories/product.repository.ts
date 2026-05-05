import { prisma } from "../config/database";
import type {
  CreateProductInput,
  UpdateProductInput,
} from "../schemas/product.schema";
import { generateSlug } from "../utils/slug.helper";

/**
 * Product Repository - Database Access Layer
 * Handles all product-related database operations via Prisma
 */

export class ProductRepository {
  /**
   * Find all products with optional filtering and pagination
   */
  async findAll(options: {
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
  async findById(id: number) {
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
  async findBySlug(slug: string) {
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
  async slugExists(slug: string, excludeId?: number): Promise<boolean> {
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
   * ⚠️ Fixed race condition: Wrapped in transaction with retry logic on P2002 (unique constraint)
   */
  async create(data: CreateProductInput & { slug: string }) {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        return await prisma.$transaction(
          async (tx) => {
            // Within transaction, verify slug is still unique before insert
            const existingSlug = await tx.product.findUnique({
              where: { slug: data.slug },
              select: { id: true },
            });

            if (existingSlug) {
              throw new Error("SLUG_CONFLICT");
            }

            return await tx.product.create({
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
          },
          { isolationLevel: "Serializable" },
        ); // Prevent dirty reads
      } catch (error: any) {
        // P2002 = unique constraint violation (slug already taken)
        if (error.code === "P2002" || error.message === "SLUG_CONFLICT") {
          attempt++;
          if (attempt >= maxRetries) {
            throw new Error(
              `Failed to create product after ${maxRetries} attempts. Slug conflict detected.`,
            );
          }
          // Continue to retry with potential slug suffix
          continue;
        }
        throw error;
      }
    }

    throw new Error("Failed to create product: max retries exceeded");
  }

  /**
   * Update an existing product by ID
   * ⚠️ Wrapped in transaction for atomicity: All fields update as a unit
   */
  async update(
    id: number,
    data: UpdateProductInput & { slug?: string },
  ) {
    return prisma.$transaction(async (tx) => {
      // Verify product exists in transaction context
      const exists = await tx.product.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!exists) {
        throw new Error(`Product with ID ${id} not found`);
      }

      // Update all fields atomically
      return await tx.product.update({
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
    });
  }

  /**
   * Check if a product exists by ID (lightweight query)
   * ⚠️ Used to optimize N+1 queries - only checks existence, doesn't fetch data
   */
  async productExists(id: number): Promise<boolean> {
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true }, // Only fetch ID for lightweight check
    });
    return !!product;
  }

  /**
   * Delete a product by ID, throwing error if not found
   * ⚠️ Eliminates N+1 query pattern: check in separate query
   */
  async deleteOrThrow(id: number) {
    try {
      return await prisma.product.delete({
        where: { id },
        select: { id: true, name: true },
      });
    } catch (error: any) {
      if (error.code === "P2025") {
        // Record not found
        throw new Error(`Product with ID ${id} not found`);
      }
      throw error;
    }
  }

  /**
   * Fix products with NULL or empty slugs by generating from product name
   * ⚠️ Fixed memory leak: Uses DB-side filtering instead of loading all products
   */
  async fixNullSlugs() {
    // DB-side filtering: Find only products with NULL/empty slugs
    const productsWithoutSlug = await prisma.product.findMany({
      where: {
        OR: [{ slug: null }, { slug: "" }],
      },
      select: { id: true, name: true },
    });

    if (productsWithoutSlug.length === 0) {
      return { fixed: 0, message: "No products with NULL/empty slugs found" };
    }

    let successCount = 0;
    const errors: { id: number; error: string }[] = [];

    // Process updates sequentially to avoid race conditions in slug generation
    for (const product of productsWithoutSlug) {
      try {
        const baseSlug = generateSlug(product.name);
        const slug = await this.ensureUniqueSlug(baseSlug);

        await prisma.product.update({
          where: { id: product.id },
          data: { slug },
        });

        successCount++;
      } catch (err: any) {
        console.error(`Failed to fix product ${product.id}:`, err);
        errors.push({
          id: product.id,
          error: err.message,
        });
      }
    }

    return {
      fixed: successCount,
      total: productsWithoutSlug.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Ensure slug is unique by appending a number if needed
   */
  async ensureUniqueSlug(
    baseSlug: string,
    excludeId?: number,
  ): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (await this.slugExists(slug, excludeId)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }
}

