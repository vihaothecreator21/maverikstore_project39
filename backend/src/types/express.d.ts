/**
 * Express Request Type Augmentation
 *
 * Thêm các field tùy chỉnh vào Express Request:
 *   - userId: set bởi authMiddleware sau khi verify JWT
 *   - userRole: role thực từ DB (CUSTOMER, ADMIN, SUPER_ADMIN)
 *
 * File này cho TypeScript biết req.userId, req.userRole tồn tại,
 * nên KHÔNG cần `(req as any).userId` nữa.
 *
 * Tham khảo: https://www.typescriptlang.org/docs/handbook/declaration-merging.html
 */

declare namespace Express {
  interface Request {
    /** User ID — set bởi authMiddleware sau khi verify JWT */
    userId?: number;

    /** User role — luôn lấy từ DB (không tin token) */
    userRole?: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN";
  }
}
