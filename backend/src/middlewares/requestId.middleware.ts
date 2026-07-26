import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";

export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const incoming = req.header("x-request-id")?.trim();
  const requestId = incoming || randomUUID();

  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
};

export default requestIdMiddleware;
