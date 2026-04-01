import { Response } from "express";

/**
 * Standardized API Error Class
 * Extends Error to provide consistent error structure across app
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
 * Validtion Error Class
 * Specialized error for Zod validation failures
 */
export class ValidationError extends APIError {
  constructor(message: string, public errors: Record<string, string[]>) {
    super(400, message, errors, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

/**
 * Generic API Response Interface
 * All successful responses follow this structure
 * 
 * @template T - The data type being returned
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
  status: "success" | "error";
  code: number;
  message: string;
  data?: T;
  details?: Record<string, any>;
  errors?: Record<string, string[]>;
  meta?: {
    /** Current page number (for pagination) */
    page?: number;
    /** Items per page (for pagination) */
    limit?: number;
    /** Total items count (for pagination) */
    total?: number;
    /** Total pages (for pagination) */
    pages?: number;
  };
  timestamp: string;
}

/**
 * Success Response Helper
 * Creates a standardized success response
 * 
 * @template T - Type of data being returned
 * @param res - Express Response object
 * @param data - The data to return
 * @param message - Optional success message
 * @param statusCode - HTTP status code (default: 200)
 * @param meta - Optional metadata (for pagination, etc.)
 * 
 * @example
 * const users = await UserService.getAll();
 * sendSuccess(res, users, 'Users retrieved successfully', 200);
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
 * Error Response Helper
 * Creates a standardized error response
 * Used primarily by error handler middleware
 * 
 * @param res - Express Response object
 * @param error - Error to process
 * @param fallbackMessage - Message if error has no message
 * @param statusCode - HTTP status code (auto-detected if not provided)
 * 
 * @example
 * try {
 *   // ... some operation
 * } catch (error) {
 *   sendError(res, error, 'Operation failed', 400);
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

  if (error instanceof APIError) {
    status = error.statusCode;
    message = error.message;
    details = error.details;
    code = error.code;
  } else if (error instanceof ValidationError) {
    status = error.statusCode;
    message = error.message;
    errors = error.errors;
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
    ...(code && { code }),
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
 * Common HTTP Status Codes & Messages
 */
export const HTTP_STATUS = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Client Error
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,

  // Server Error
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  UNAVAILABLE: 503,
} as const;

/**
 * Error Messages
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
