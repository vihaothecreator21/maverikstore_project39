import { prisma } from "../config/database";
import type { CreateReviewInput } from "../schemas/review.schema";

export class ReviewRepository {
  async findLatest(limit = 6) {
    return prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        user: { select: { id: true, username: true } },
        product: { select: { id: true, name: true } },
      },
    });
  }

  async upsert(userId: number, data: CreateReviewInput) {
    return prisma.review.upsert({
      where: {
        userId_productId: {
          userId,
          productId: data.productId,
        },
      },
      create: {
        userId,
        productId: data.productId,
        rating: data.rating,
        comment: data.comment,
      },
      update: {
        rating: data.rating,
        comment: data.comment,
      },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, username: true } },
        product: { select: { id: true, name: true } },
      },
    });
  }
}
