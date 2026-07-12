import { APIError, HTTP_STATUS } from "../utils/apiResponse";
import type { CreateReviewInput } from "../schemas/review.schema";
import type { ReviewRepository } from "../repositories/review.repository";
import type { ProductRepository } from "../repositories/product.repository";

export class ReviewService {
  constructor(
    private readonly reviewRepository: ReviewRepository,
    private readonly productRepository: ProductRepository,
  ) {}

  async getLatest() {
    return this.reviewRepository.findLatest(6);
  }

  async create(userId: number, data: CreateReviewInput) {
    const product = await this.productRepository.productExists(data.productId);
    if (!product) {
      throw new APIError(HTTP_STATUS.NOT_FOUND, "Product not found");
    }

    return this.reviewRepository.upsert(userId, data);
  }
}
