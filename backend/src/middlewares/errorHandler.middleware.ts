import { Request, Response, NextFunction } from "express";
import { APIError, ValidationError, ApiResponse } from "../utils/apiResponse";

/**
 * Global Error Handler Middleware
 * Catches and formats all errors in a consistent manner
 * Must be placed AFTER all other middleware and routes, INSIDE app.use() after other handlers
 * 
 * @usage
 * app.use(notFoundHandler);  // 404 handler
 * app.use(errorHandler);     // Error handler (last)
 */
export const errorHandler = (
  err: Error | APIError | ValidationError | any,
  req: Request,
  res: Response<ApiResponse<never>>,
  _next: NextFunction
): void => {
  const isDevelopment = process.env.NODE_ENV === "development";
  const timestamp = new Date().toISOString();

  // Log error for monitoring/debugging
  console.error("🔴 Error occurred:", {
    timestamp,
    method: req.method,
    path: req.path,
    statusCode: err.statusCode || 500,
    message: err.message,
    ...(isDevelopment && { stack: err.stack }),
  });

  // Determine status code and error structure
  let statusCode = 500;
  let message = "Internal Server Error";
  let code: string | undefined;
  let details: Record<string, any> | undefined;
  let errors: Record<string, string[]> | undefined;

  // Handle specific error types
  if (err instanceof ValidationError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
    errors = err.errors;
  } else if (err instanceof APIError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
    details = err.details;
  } else if (err instanceof SyntaxError && "body" in err) {
    // JSON parsing error
    statusCode = 400;
    message = "Invalid JSON in request body";
    code = "SYNTAX_ERROR";
  } else if (err.message) {
    message = err.message;
  }

  // Send standardized error response
  res.status(statusCode).json({
    status: "error",
    code: statusCode,
    message,
    ...(details && { details }),
    ...(errors && { errors }),
    ...(code && { errorCode: code }),
    timestamp,
    ...(isDevelopment && {
      debug: {
        stack: err.stack,
        type: err.constructor?.name || "UnknownError",
      },
    }),
  });
};

export default errorHandler;
