/**
 * Middleware Làm sạch Dữ liệu Đầu vào
 *
 * Loại bỏ các thẻ HTML/script nguy hiểm khỏi tất cả trường chuỗi
 * trong request body, query, và params để ngăn chặn tấn công XSS.
 *
 * ✅ Dễ hiểu: dùng regex đơn giản.
 *    Cho môi trường production, cân nhắc dùng thư viện `xss` hoặc `DOMPurify`.
 *
 * Cách dùng trong server.ts:
 *   app.use(sanitizeInput);
 */

import { Request, Response, NextFunction } from "express";

// ── Hàm làm sạch chính ───────────────────────────────────────────────

/**
 * Loại bỏ các thẻ HTML nguy hiểm và thuộc tính khỏi chuỗi.
 * Loại bỏ: <script>, <iframe>, <object>, <embed>, <form>, <input>,
 *          các event handler on* (onclick, onerror, ...)
 *
 * KHÔNG loại tất cả HTML — chỉ các pattern đã biết là nguy hiểm.
 * Các thẻ an toàn như <b>, <p>, <br> vẫn giữ nguyên.
 */
export function sanitizeString(input: string): string {
  if (typeof input !== "string") return input;

  return input
    // Loại bỏ <script>...</script> (bao gồm nhiều dòng)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // Loại bỏ <iframe>, <object>, <embed>, <form>, <input>, <textarea>, <select>
    .replace(/<\s*\/?\s*(iframe|object|embed|form|input|textarea|select)\b[^>]*>/gi, "")
    // Loại bỏ event handler on* khỏi bất kỳ thẻ nào (onclick, onerror, onload, ...)
    .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "")
    // Loại bỏ giao thức javascript: trong href/src
    .replace(/(?:href|src)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, "")
    // Xóa khoảng trắng thừa
    .trim();
}

// ── Hàm làm sạch đệ quy cho object/array ────────────────────────────

/**
 * Làm sạch đệ quy tất cả giá trị chuỗi trong object hoặc array.
 * Các giá trị không phải chuỗi (số, boolean, null) không bị ảnh hưởng.
 */
function sanitizeDeep(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return sanitizeString(obj);
  if (typeof obj !== "object") return obj; // số, boolean, ...

  if (Array.isArray(obj)) {
    return obj.map(sanitizeDeep);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeDeep(value);
  }
  return sanitized;
}

// ── Express Middleware ─────────────────────────────────────────────

/**
 * Express middleware làm sạch req.body, req.query, và req.params.
 *
 * Đặt SAU các body parser (express.json), TRƯỚC các route handler.
 *
 * @example
 * // Trong server.ts
 * app.use(express.json());
 * app.use(sanitizeInput);   // ← thêm vào đây
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
