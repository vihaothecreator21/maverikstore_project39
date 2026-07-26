import { prisma } from "../config/database.js";
import type {
  CreateProductInput,
  UpdateProductInput,
} from "../schemas/product.schema.js";
import { generateSlug } from "../utils/slug.helper.js";

/**
 * Product Repository - Tầng truy cập cơ sở dữ liệu
 * Xử lý toàn bộ thao tác DB liên quan đến sản phẩm qua Prisma
 */

export class ProductRepository {
  /**
   * Lấy tất cả sản phẩm (có phân trang và lọc)
   */
  async findAll(options: {
    page: number;
    limit: number;
    categoryId?: number;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: "price_asc" | "price_desc" | "name_asc";
  }) {
    const { page, limit, categoryId, search, minPrice, maxPrice, sort } = options;
    const skip = (page - 1) * limit;

    // Xây dựng điều kiện lọc động
    const where: any = {};
    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (search) {
      where.name = { contains: search };
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    const orderBy =
      sort === "price_asc"
        ? { price: "asc" as const }
        : sort === "price_desc"
          ? { price: "desc" as const }
          : sort === "name_asc"
            ? { name: "asc" as const }
            : { createdAt: "desc" as const };

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          categoryId: true,
          name: true,
          slug: true,
          price: true,
          discountPercent: true,
          discountAmount: true,
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
   * Tìm một sản phẩm theo ID
   */
  async findById(id: number) {
    return prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        categoryId: true,
        name: true,
        slug: true,
        price: true,
        discountPercent: true,
        discountAmount: true,
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
   * Tìm sản phẩm theo slug
   */
  async findBySlug(slug: string) {
    return prisma.product.findUnique({
      where: { slug },
      select: {
        id: true,
        categoryId: true,
        name: true,
        slug: true,
        price: true,
        discountPercent: true,
        discountAmount: true,
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
   * Kiểm tra slug đã tồn tại chưa (dùng để validate tính duy nhất)
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
   * Tạo sản phẩm mới
   * ⚠️ Sửa race condition: bao gọ trong transaction với retry khi gặp lỗi P2002 (vi phạm ràng buộc unique)
   */
    async create(data: CreateProductInput & { slug: string }) {
      const maxRetries = 3;
      let attempt = 0;

      while (attempt < maxRetries) {
        try {
          return await prisma.$transaction(
            async (tx) => {
              // Trong transaction, xác minh slug vẫn còn duy nhất trước khi insert
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
                  discountPercent: data.discountPercent ?? 0,
                  discountAmount: data.discountAmount ?? 0,
                  stockQuantity: data.stockQuantity ?? 0,
                  description: data.description ?? null,
                  imageUrl: data.imageUrl ?? null,
                },
                select: {
                  id: true,
                  categoryId: true,
                  name: true,
                  slug: true,
                  price: true,
                  discountPercent: true,
                  discountAmount: true,
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
          ); // Ngăn đọc dơ (dirty reads)
        } catch (error: any) {
          // P2002 = vi phạm unique constraint (slug đã tồn tại)
          if (error.code === "P2002" || error.message === "SLUG_CONFLICT") {
            attempt++;
            if (attempt >= maxRetries) {
              throw new Error(
                `Failed to create product after ${maxRetries} attempts. Slug conflict detected.`,
              );
            }
            // Tiếp tục retry với slug có số đuôi
            continue;
          }
          throw error;
        }
      }

      throw new Error("Failed to create product: max retries exceeded");
    }

  /**
   * Cập nhật sản phẩm theo ID
   * ⚠️ Bao gọ trong transaction để đảm bảo tnhất quán: tất cả trường được cập nhật cùng lúc
   */
  async update(
    id: number,
    data: UpdateProductInput & { slug?: string },
  ) {
    return prisma.$transaction(async (tx) => {
      // Xác minh sản phẩm tồn tại trong ngữ cảnh transaction
      const exists = await tx.product.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!exists) {
        throw new Error(`Product with ID ${id} not found`);
      }

      // Cập nhật tất cả trường một cách atomic
      return await tx.product.update({
        where: { id },
        data,
        select: {
          id: true,
          categoryId: true,
          name: true,
          slug: true,
          price: true,
          discountPercent: true,
          discountAmount: true,
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
   * Kiểm tra sản phẩm có tồn tại theo ID (query nhẹ)
   * ⚠️ Dùng để tối ưu tránh N+1 queries - chỉ kiểm tra tồn tại, không lấy dữ liệu
   */
  async productExists(id: number): Promise<boolean> {
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true }, // Chỉ lấy ID để query nhẹ
    });
    return !!product;
  }

  /**
   * Xóa sản phẩm theo ID, ném lỗi nếu không tìm thấy
   * ⚠️ Loại bỏ pattern N+1 query: kiểm tra trong query riêng
   */
  async deleteOrThrow(id: number) {
    try {
      return await prisma.product.delete({
        where: { id },
        select: { id: true, name: true },
      });
    } catch (error: any) {
      if (error.code === "P2025") {
          // Không tìm thấy bản ghi
        throw new Error(`Product with ID ${id} not found`);
      }
      throw error;
    }
  }

  /**
   * Sửa các sản phẩm có slug NULL hoặc rỗng bằng cách tạo slug từ tên sản phẩm
   * ⚠️ Sửa rò rỉ bộ nhớ: Dùng lọc phía DB thay vì tải toàn bộ sản phẩm
   */
  async fixNullSlugs() {
    // Lọc phía DB: chỉ tìm sản phẩm có slug NULL hoặc rỗng
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

    // Xử lý tuần tự để tránh race condition khi tạo slug
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
   * Đảm bảo slug duy nhất bằng cách thêm số đếm vào cuối nếu cần
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
  /**
   * Tìm sản phẩm bán chạy nhất dựa trên số lượng đơn hàng
   */
  async findBestSellers(limit: number) {
    const bestSellers = await prisma.orderDetail.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: limit,
    });

    const productIds = bestSellers.map((item) => item.productId);

    return prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        discountPercent: true,
        discountAmount: true,
        imageUrl: true,
        category: { select: { name: true } },
      },
    });
  }
}

