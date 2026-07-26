import { APIError, HTTP_STATUS } from "../utils/apiResponse.js";
import type { CreateReviewInput } from "../schemas/review.schema.js";
import type { ReviewRepository } from "../repositories/review.repository.js";
import type { ProductRepository } from "../repositories/product.repository.js";

/**
 * ReviewService – lớp chứa business logic của module đánh giá sản phẩm.
 *
 * Phụ thuộc (inject qua constructor):
 *  - reviewRepository  : truy cập CSDL bảng Review.
 *  - productRepository : kiểm tra sự tồn tại của sản phẩm trước khi viết review.
 */
export class ReviewService {
  constructor(
    private readonly reviewRepository: ReviewRepository,
    private readonly productRepository: ProductRepository,
  ) {}

  /**
   * Lấy tối đa 6 review mới nhất – hiển thị trên trang chủ (section testimonials).
   * Không có logic nghiệp vụ đặc biệt, gọi thẳng repository.
   */
  async getLatest() {
    // Giới hạn cứng 6 mục – đủ cho widget homepage, không phân trang
    return this.reviewRepository.findLatest(6);
  }

  /**
   * Tạo mới hoặc cập nhật review của một user cho một sản phẩm.
   *
   * Logic:
   *  1. Kiểm tra sản phẩm có tồn tại không. Nếu không → 404.
   *  2. Upsert review: tạo mới nếu (userId + productId) chưa tồn tại,
   *     ngược lại cập nhật rating & comment hiện có.
   *
   * @param userId  ID người dùng đã đăng nhập (lấy từ JWT qua authMiddleware).
   * @param data    Dữ liệu review đã qua validate: productId, rating, comment.
   */
  async create(userId: number, data: CreateReviewInput) {
    // Bước 1: Xác minh sản phẩm tồn tại trước khi lưu review
    const product = await this.productRepository.productExists(data.productId);
    if (!product) {
      throw new APIError(HTTP_STATUS.NOT_FOUND, "Product not found");
    }

    // Bước 2: Upsert – mỗi user chỉ có được 1 review cho mỗi sản phẩm
    return this.reviewRepository.upsert(userId, data);
  }
}
