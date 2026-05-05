import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { HTTP_STATUS, sendError } from "../utils/apiResponse";
import { getEnv } from "../config/env.config";
import { userRepository } from "../container";

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

    req.userId = userExists.id;
    req.userRole = userExists.role as Request["userRole"];

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
  const role = req.userRole;
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
