import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { HTTP_STATUS, sendError } from "../utils/apiResponse";

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return sendError(res, new Error("No token provided"), "UNAUTHORIZED", HTTP_STATUS.UNAUTHORIZED);
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret") as any;

    (req as any).userId = decoded.userId;
    (req as any).userRole = decoded.role;

    return next();
  } catch (error) {
    return sendError(res, error, "INVALID_TOKEN", HTTP_STATUS.UNAUTHORIZED);
  }
};
