import { z } from "zod";

/**
 * Schema validation cho request tạo / cập nhật đánh giá sản phẩm.
 * Sử dụng Zod để kiểm tra dữ liệu đầu vào trước khi chuyển xuống service.
 *
 * Các trường bắt buộc:
 *  - productId : ID sản phẩm cần đánh giá (số nguyên dương, ép kiểu tự động từ string).
 *  - rating    : Điểm đánh giá từ 1 đến 5 sao (số nguyên).
 *  - comment   : Nội dung nhận xét, tối thiểu 3 ký tự, tối đa 1 000 ký tự.
 */
export const CreateReviewSchema = z.object({
  // ID sản phẩm – bắt buộc, tự động chuyển từ string sang number nếu cần
  productId: z.coerce.number().int("Product ID must be an integer").positive("Product ID is required"),

  // Điểm sao – phải là số nguyên trong khoảng [1, 5]
  rating: z.coerce.number().int("Rating must be an integer").min(1).max(5),

  // Nội dung đánh giá – trim khoảng trắng thừa, độ dài 3–1000 ký tự
  comment: z.string().trim().min(3, "Review must be at least 3 characters").max(1000),
});

/** Kiểu TypeScript được tự động suy ra từ CreateReviewSchema */
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;
