import { Request, Response } from "express";
import { reviewService } from "../container.js";
import { CreateReviewSchema } from "../schemas/review.schema.js";
import { HTTP_STATUS, sendSuccess, ValidationError } from "../utils/apiResponse.js";

/**
 * Controller xử lý các request liên quan đến đánh giá sản phẩm.
 * Nhận request từ Routes → validate / xử lý → gọi ReviewService → trả response.
 */
export class ReviewController {
  /**
   * [GET /reviews/latest]
   * Lấy danh sách các review mới nhất để hiển thị trên trang chủ.
   * Route này công khai, không cần đăng nhập.
   */
  static async getLatest(_req: Request, res: Response) {
    // Gọi service lấy tối đa 6 review sắp xếp theo thời gian mới nhất
    const reviews = await reviewService.getLatest();
    return sendSuccess(res, reviews, "Latest reviews retrieved", HTTP_STATUS.OK);
  }

  /**
   * [POST /reviews]
   * Tạo mới hoặc cập nhật review của người dùng cho một sản phẩm.
   * Yêu cầu đăng nhập: authMiddleware đã gán req.userId trước khi vào đây.
   */
  static async create(req: Request, res: Response) {
    // Bước 1: Validate body request bằng Zod schema
    const validation = CreateReviewSchema.safeParse(req.body);
    if (!validation.success) {
      // Gộm các lỗi validate theo từng field, trả về 400 ValidationError
      const errors: Record<string, string[]> = {};
      validation.error.errors.forEach((err) => {
        const path = String(err.path[0] ?? "review");
        if (!errors[path]) errors[path] = [];
        errors[path].push(err.message);
      });
      throw new ValidationError("Validation failed", errors);
    }

    // Bước 2: Gọi service để upsert review (tạo mới nếu chưa có, cập nhật nếu đã tồn tại)
    // req.userId! được đảm bảo không null do authMiddleware chạy trước
    const review = await reviewService.create(req.userId!, validation.data);
    return sendSuccess(res, review, "Review saved", HTTP_STATUS.CREATED);
  }
}
