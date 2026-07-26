import { NextFunction, Request, Response } from "express";

/**
 * Wrapper bắt lỗi Async
 * Bao bỜ các route handler async để bắt các promise rejection chưa xử lý
 * Tự động chuyển lỗi sang Express error handler
 * 
 * @usage
 * import { catchAsync } from '@/utils/catchAsync';
 * router.get('/users', catchAsync(async (req, res) => {
 *   const users = await UserService.getAll();
 *   res.json({ status: 'success', data: users });
 * }));
 */
export const catchAsync =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    // Thực thi hàm async và bắt mọi lỗi phát sinh
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/**
 * Wrapper cho các hàm middleware async
 * Dùng cho global middleware có thao tác async
 * 
 * @usage
 * const authenticateToken = catchAsyncMiddleware(async (req, res, next) => {
 *   const token = req.headers.authorization?.split(' ')[1];
 *   if (!token) throw new APIError(401, 'Token required');
 *   // ... xác minh token
 *   next();
 * });
 */
export const catchAsyncMiddleware =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export default catchAsync;
