import { NextFunction, Request, Response } from "express";

/**
 * Async Error Wrapper
 * Wraps async route handlers to catch unhandled promise rejections
 * Automatically passes errors to Express error handler
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
    // Execute async function and catch any errors
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/**
 * Wrapper for async middleware functions
 * Used for global middleware that performs async operations
 * 
 * @usage
 * const authenticateToken = catchAsyncMiddleware(async (req, res, next) => {
 *   const token = req.headers.authorization?.split(' ')[1];
 *   if (!token) throw new APIError(401, 'Token required');
 *   // ... verify token
 *   next();
 * });
 */
export const catchAsyncMiddleware =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export default catchAsync;
