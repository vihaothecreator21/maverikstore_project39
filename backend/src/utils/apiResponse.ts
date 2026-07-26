import { Response } from "express";

/**
 * Lớp lỗi API chuẩn hóa
 * Kế thừa Error để cung cấp cấu trúc lỗi nhất quán trên toàn bộ ứng dụng
 */
export class APIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: Record<string, any>,
    public code?: string
  ) {
    super(message);
    this.name = "APIError";
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

/**
 * Lớp lỗi Validation
 * Lỗi chuyên biệt cho các trường hợp Zod validation thất bại
 */
export class ValidationError extends APIError {
  constructor(message: string, public errors: Record<string, string[]>) {
    super(400, message, errors, "VALIDATION_ERROR");
    this.name = "ValidationError";
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Interface Response API chung
 * Tất cả response thành công đều theo cấu trúc này
 * 
 * @template T - Kiểu dữ liệu trả về
 * 
 * @example
 * interface ApiResponse<User> {
 *   status: 'success';
 *   data: User;
 *   message?: string;
 *   meta?: { page: number; limit: number };
 * }
 */
export interface ApiResponse<T> {
  success?: boolean;
  status: "success" | "error";
  code: number;
  errorCode?: string;
  message: string;
  data?: T;
  details?: Record<string, any>;
  errors?: Record<string, string[]>;
  meta?: {
    /** Số trang hiện tại (dùng cho phân trang) */
    page?: number;
    /** Số mục mỗi trang (dùng cho phân trang) */
    limit?: number;
    /** Tổng số mục (dùng cho phân trang) */
    total?: number;
    /** Tổng số trang (dùng cho phân trang) */
    pages?: number;
  };
  timestamp: string;
}

/**
 * Hàm trợ giúp Response Thành công
 * Tạo response thành công theo chuẩn định sẵn
 * 
 * @template T - Kiểu dữ liệu trả về
 * @param res - Đối tượng Response của Express
 * @param data - Dữ liệu cần trả về
 * @param message - Thông điệp thành công (tùy chọn)
 * @param statusCode - Mã HTTP status (mặc định: 200)
 * @param meta - Metadata tùy chọn (dùng cho phân trang, ...)
 * 
 * @example
 * const users = await UserService.getAll();
 * sendSuccess(res, users, 'Lấy danh sách thành công', 200);
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message: string = "Operation successful",
  statusCode: number = 200,
  meta?: ApiResponse<T>["meta"]
): Response<ApiResponse<T>> => {
  return res.status(statusCode).json({
    status: "success",
    code: statusCode,
    message,
    data,
    timestamp: new Date().toISOString(),
    ...(meta && { meta }),
  });
};

/**
 * Hàm trợ giúp Response Lỗi
 * Tạo response lỗi theo chuẩn định sẵn
 * Được dùng chủ yếu bởi middleware xử lý lỗi
 * 
 * @param res - Đối tượng Response của Express
 * @param error - Lỗi cần xử lý
 * @param fallbackMessage - Thông điệp dự phòng nếu lỗi không có message
 * @param statusCode - Mã HTTP status (tự phát hiện nếu không truyền)
 * 
 * @example
 * try {
 *   // ... một thao tác nào đó
 * } catch (error) {
 *   sendError(res, error, 'Thao tác thất bại', 400);
 * }
 */
export const sendError = (
  res: Response,
  error: APIError | ValidationError | Error | any,
  fallbackMessage: string = "Internal Server Error",
  statusCode?: number
): Response<ApiResponse<never>> => {
  let status = statusCode || 500;
  let message = fallbackMessage;
  let details: Record<string, any> | undefined;
  let code: string | undefined;
  let errors: Record<string, string[]> | undefined;
  const isDevelopment = process.env.NODE_ENV === "development";

  if (error instanceof ValidationError) {
    status = error.statusCode;
    message = error.message;
    errors = error.errors;
    code = error.code;
  } else if (error instanceof APIError) {
    status = error.statusCode;
    message = error.message;
    details = error.details;
    code = error.code;
  } else if (error instanceof SyntaxError) {
    status = 400;
    message = "Invalid JSON in request body";
  } else if (error.message) {
    message = error.message;
  }

  return res.status(status).json({
    status: "error",
    code: status,
    message,
    ...(details && { details }),
    ...(errors && { errors }),
    ...(code && { errorCode: code }),
    timestamp: new Date().toISOString(),
    ...(isDevelopment && {
      debug: {
        stack: error.stack,
        type: error.constructor?.name || "Unknown",
      },
    }),
  });
};

/**
 * Các mã HTTP Status phổ biến
 */
export const HTTP_STATUS = {
  // Thành công
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Lỗi phía Client
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,

  // Lỗi phía Server
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  UNAVAILABLE: 503,
} as const;

/**
 * Các thông điệp lỗi chuẩn
 */
export const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: "Invalid email or password",
  UNAUTHORIZED: "Unauthorized access",
  FORBIDDEN: "Forbidden resource",
  NOT_FOUND: "Resource not found",
  VALIDATION_FAILED: "Validation failed",
  INTERNAL_ERROR: "Internal server error",
  DATABASE_ERROR: "Database operation failed",
  CONFLICT: "Resource already exists",
} as const;

export default {
  APIError,
  ValidationError,
  sendSuccess,
  sendError,
  HTTP_STATUS,
  ERROR_MESSAGES,
};
