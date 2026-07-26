import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { HTTP_STATUS, sendError } from "../utils/apiResponse.js";
import { getEnv } from "../config/env.config.js";
import { userRepository } from "../container.js";

/**
 * authMiddleware — Xác thực JWT trên mỗi request
 *
 * Luồng xử lý:
 * 1. Đọc header Authorization: Bearer <token>
 * 2. Giải mã token bằng JWT_SECRET (nếu sai/hết hạn → lỗi 401)
 * 3. Kiểm tra user có tồn tại trong DB không
 *    (bảo vệ trường hợp account bị xóa nhưng token vẫn còn hạn)
 * 4. Gắn userId + userRole vào req để controller dùng
 *
 * Lưu ý: Middleware này phải đặt TRƯỚC route handler.
 * Route không cần auth → KHÔNG dùng middleware này.
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Bước 1: Kiểm tra header Authorization có đúng định dạng "Bearer <token>"
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      sendError(
        res,
        new Error("No token provided"),
        "UNAUTHORIZED",
        HTTP_STATUS.UNAUTHORIZED,
      );
      return;
    }

    // Bước 2: Tách token ra khỏi chuỗi "Bearer <token>"
    const token = authHeader.split(" ")[1];

    // Giải mã và xác minh chữ ký JWT bằng secret key
    // Nếu token hết hạn hoặc bị giả mạo → jwt.verify ném lỗi → vào catch
    const decoded = jwt.verify(token, getEnv().JWT_SECRET) as {
      userId: number;
      role: string;
    };

    // Bước 3: Kiểm tra user có thực sự tồn tại trong DB không
    // Cần thiết vì token có thể vẫn còn hạn nhưng tài khoản đã bị xóa
    const userExists = await userRepository.findById(decoded.userId);

    if (!userExists) {
      sendError(
        res,
        new Error("User session expired. Please log in again."),
        "SESSION_EXPIRED",
        HTTP_STATUS.UNAUTHORIZED,
      );
      return;
    }

    // Bước 4: Gắn thông tin user vào request để các middleware/controller phía sau dùng
    req.userId = userExists.id;
    req.userRole = userExists.role as Request["userRole"];

    next(); // Chuyển sang middleware/route handler tiếp theo
  } catch (error) {
    // Bắt lỗi từ jwt.verify (token sai chữ ký, hết hạn, sai định dạng...)
    sendError(res, error, "INVALID_TOKEN", HTTP_STATUS.UNAUTHORIZED);
  }
};

/**
 * requireAdmin — Middleware kiểm tra quyền quản trị viên
 *
 * Chỉ cho phép user có role ADMIN hoặc SUPER_ADMIN truy cập.
 * Phải đặt SAU authMiddleware vì cần req.userRole đã được gán.
 *
 * @example
 * router.delete("/products/:id", authMiddleware, requireAdmin, ProductController.delete);
 */
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const role = req.userRole;

  // Kiểm tra role: chỉ ADMIN và SUPER_ADMIN được phép
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    sendError(
      res,
      new Error("Access denied. Admin privileges required."),
      "FORBIDDEN",
      HTTP_STATUS.FORBIDDEN,
    );
    return;
  }
  next();
};
