import { Request, Response, NextFunction } from "express";
import { APIError, ValidationError, ApiResponse } from "../utils/apiResponse";

/**
 * Global Error Handler Middleware — Xử lý tập trung mọi lỗi
 *
 * Tại sao cần middleware này?
 * - Thay vì mỗi route tự try/catch và format lỗi theo cách riêng,
 *   tất cả lỗi được chuyển đến đây qua next(error).
 * - Đảm bảo response lỗi có cùng cấu trúc JSON trên toàn bộ API.
 *
 * Vị trí: Phải đặt CUỐI CÙNG, sau tất cả route và middleware khác.
 * 4 tham số (err, req, res, next) → Express nhận diện đây là error handler.
 *
 * @example
 * app.use(notFoundHandler);  // 404 handler
 * app.use(errorHandler);     // Error handler — luôn đặt cuối
 */
export const errorHandler = (
  err: Error | APIError | ValidationError | any,
  req: Request,
  res: Response<ApiResponse<never>>,
  _next: NextFunction
): void => {
  const isDevelopment = process.env.NODE_ENV === "development";
  const timestamp = new Date().toISOString();

  // Ghi log lỗi để debug/monitoring — bao gồm requestId để trace request cụ thể
  console.error("🔴 Error occurred:", {
    timestamp,
    method: req.method,
    path: req.path,
    requestId: req.requestId,
    statusCode: err.statusCode || 500,
    message: err.message,
    // Chỉ log stack trace trong môi trường phát triển
    ...(isDevelopment && { stack: err.stack }),
  });

  // Giá trị mặc định cho lỗi chung (500 Internal Server Error)
  let statusCode = 500;
  let message = "Internal Server Error";
  let code: string | undefined;
  let details: Record<string, any> | undefined;
  let errors: Record<string, string[]> | undefined;

  // Phân loại lỗi để trả về status code và thông điệp phù hợp
  if (err instanceof ValidationError) {
    // Lỗi validation (Zod schema) — 422 Unprocessable Entity
    // Trả về chi tiết từng field bị sai để frontend hiển thị
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
    errors = err.errors;
  } else if (err instanceof APIError) {
    // Lỗi business logic (do code tự ném) — status code do developer định nghĩa
    // Ví dụ: 404 Not Found, 409 Conflict, 401 Unauthorized
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
    details = err.details;
  } else if (err instanceof SyntaxError && "body" in err) {
    // Lỗi JSON không hợp lệ trong request body (vd: thiếu dấu ngoặc)
    // Express body parser ném lỗi này khi parse body thất bại
    statusCode = 400;
    message = "Invalid JSON in request body";
    code = "SYNTAX_ERROR";
  } else if (err.message) {
    // Lỗi JavaScript thuần (Error, TypeError, ...) — giữ message gốc
    message = err.message;
  }

  // Trả về response lỗi theo chuẩn đồng nhất
  res.status(statusCode).json({
    status: "error",
    code: statusCode,
    message,
    // Chỉ đưa vào response nếu có giá trị (spread có điều kiện)
    ...(details && { details }),
    ...(errors && { errors }),
    ...(code && { errorCode: code }),
    ...(req.requestId && { requestId: req.requestId }),
    timestamp,
    // Chỉ trả về stack trace trong môi trường phát triển (không lộ ra production)
    ...(isDevelopment && {
      debug: {
        stack: err.stack,
        type: err.constructor?.name || "UnknownError",
      },
    }),
  });
};

export default errorHandler;
