import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { HTTP_STATUS, sendError } from "../utils/apiResponse";
import { getEnv } from "../config/env.config";
import { prisma } from "../config/database";

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
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

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, getEnv().JWT_SECRET) as {
      userId: number;
      role: string;
    };

    // ✅ Guard: Kiểm tra user thực sự tồn tại trong DB
    // Phòng trường hợp DB reset nhưng token cũ vẫn còn trong localStorage
    const userExists = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true },
    });

    if (!userExists) {
      sendError(
        res,
        new Error("User session expired. Please log in again."),
        "SESSION_EXPIRED",
        HTTP_STATUS.UNAUTHORIZED,
      );
      return;
    }

    (req as any).userId = userExists.id;
    (req as any).userRole = userExists.role; // Luôn lấy role từ DB, không tin token

    next();
  } catch (error) {
    sendError(res, error, "INVALID_TOKEN", HTTP_STATUS.UNAUTHORIZED);
  }
};

/**
 * Middleware kiểm tra quyền Admin hoặc Super Admin
 * Phải dùng sau authMiddleware
 */
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const role = (req as any).userRole;
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
