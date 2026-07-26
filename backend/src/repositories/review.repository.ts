import { prisma } from "../config/database.js";
import type { CreateReviewInput } from "../schemas/review.schema.js";

/**
 * ReviewRepository – lớp truy cập cơ sở dữ liệu cho bảng Review.
 * Tất cả truy vấn Prisma liên quan đến review được tập trung ở đây.
 */
export class ReviewRepository {
  /**
   * Lấy `limit` review mới nhất (mặc định 6).
   * Kết quả bao gồm thông tin rút gọn của user và sản phẩm liên quan.
   */
  async findLatest(limit = 6) {
    return prisma.review.findMany({
      orderBy: { createdAt: "desc" }, // Sắp xếp mới nhất trước
      take: limit,                    // Chỉ lấy `limit` bản ghi
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        // Chỉ lấy id + username của user, tránh lộ thông tin nhạy cảm (password, email...)
        user: { select: { id: true, username: true } },
        // Chỉ lấy id + name của sản phẩm
        product: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Upsert review theo cặp khóa duy nhất (userId, productId).
   *
   * Hành vi:
   *  - Nếu chưa có review nào của user này cho sản phẩm này → INSERT bản ghi mới.
   *  - Nếu đã tồn tại → UPDATE rating và comment (không tạo bản ghi trùng lặp).
   *
   * Constraint unique `userId_productId` được định nghĩa trong Prisma schema.
   *
   * @param userId  ID người dùng tạo review.
   * @param data    Dữ liệu review gồm productId, rating, comment.
   */
  async upsert(userId: number, data: CreateReviewInput) {
    return prisma.review.upsert({
      where: {
        // Tìm kiếm theo composite unique key: (userId, productId)
        userId_productId: {
          userId,
          productId: data.productId,
        },
      },
      create: {
        // Tạo mới review nếu chưa tồn tại
        userId,
        productId: data.productId,
        rating: data.rating,
        comment: data.comment,
      },
      update: {
        // Cập nhật nếu review đã tồn tại (userId + productId đã có)
        rating: data.rating,
        comment: data.comment,
      },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        updatedAt: true,
        // Chỉ trả thông tin cần thiết của user và sản phẩm
        user: { select: { id: true, username: true } },
        product: { select: { id: true, name: true } },
      },
    });
  }
}
