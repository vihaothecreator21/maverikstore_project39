/**
 * Input Sanitization Middleware
 *
 * Strips potentially dangerous HTML/script tags from all string fields
 * in request body, query, and params to prevent XSS attacks.
 *
 * ✅ Student-friendly: simple regex-based approach.
 *    For production, consider libraries like `xss` or `DOMPurify`.
 *
 * Usage in server.ts:
 *   app.use(sanitizeInput);
 */

import { Request, Response, NextFunction } from "express";

// ── Core sanitizer ───────────────────────────────────────────────────

/**
 * Remove dangerous HTML tags and attributes from a string.
 * Strips: <script>, <iframe>, <object>, <embed>, <form>, <input>,
 *         on* event handlers (onclick, onerror, etc.)
 *
 * Does NOT strip all HTML — only known dangerous patterns.
 * Safe tags like <b>, <p>, <br> are preserved.
 */
export function sanitizeString(input: string): string {
  if (typeof input !== "string") return input;

  return input
    // Remove <script>...</script> (including multiline)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // Remove <iframe>, <object>, <embed>, <form>, <input>, <textarea>, <select>
    .replace(/<\s*\/?\s*(iframe|object|embed|form|input|textarea|select)\b[^>]*>/gi, "")
    // Remove on* event handlers from any tag (onclick, onerror, onload, etc.)
    .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "")
    // Remove javascript: protocol in href/src
    .replace(/(?:href|src)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, "")
    // Trim whitespace
    .trim();
}

// ── Recursive sanitizer for objects/arrays ────────────────────────────

/**
 * Recursively sanitize all string values in an object or array.
 * Non-string values (numbers, booleans, null) are left untouched.
 */
function sanitizeDeep(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return sanitizeString(obj);
  if (typeof obj !== "object") return obj; // number, boolean, etc.

  if (Array.isArray(obj)) {
    return obj.map(sanitizeDeep);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeDeep(value);
  }
  return sanitized;
}

// ── Express Middleware ───────────────────────────────────────────────

/**
 * Express middleware that sanitizes req.body, req.query, and req.params.
 *
 * Place AFTER body parsers (express.json), BEFORE route handlers.
 *
 * @example
 * // In server.ts
 * app.use(express.json());
 * app.use(sanitizeInput);   // ← add here
 * app.use("/api", apiRoutes);
 */
export const sanitizeInput = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeDeep(req.body);
  }
  if (req.query && typeof req.query === "object") {
    req.query = sanitizeDeep(req.query);
  }
  if (req.params && typeof req.params === "object") {
    req.params = sanitizeDeep(req.params);
  }
  next();
};
