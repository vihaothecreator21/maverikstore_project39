import { Request, Response, NextFunction } from "express";
import { APIError } from "../utils/apiResponse.js";

/**
 * Rate Limiting — Giới hạn tần suất gọi API theo địa chỉ IP
 *
 * Mục đích: Ngăn chặn tấn công brute-force (thử mật khẩu hàng loạt)
 * và DDoS trên các endpoint nhạy cảm (login, đăng ký OTP...).
 *
 * Cách hoạt động:
 * - Lưu trữ trong bộ nhớ RAM (in-memory Map) theo key = "prefix:IP"
 * - Mỗi IP có bộ đếm (count) và thời điểm reset (resetTime)
 * - Nếu count > maxRequests trong cửa sổ thời gian → trả 429 Too Many Requests
 *
 * ⚠️ Giới hạn: Chỉ hoạt động với 1 server (single-instance).
 * Nếu scale nhiều server → dùng Redis cho distributed rate limiting.
 */
interface RateLimitStore {
  [key: string]: {
    count: number;    // Số lần gọi trong cửa sổ thời gian hiện tại
    resetTime: number; // Thời điểm (epoch ms) cửa sổ thời gian kết thúc
  };
}

// Bộ nhớ tạm lưu trạng thái giới hạn theo IP
const store: RateLimitStore = {};

/**
 * Tạo middleware giới hạn tần suất
 *
 * @param maxRequests - Số request tối đa được phép trong cửa sổ thời gian
 * @param windowMs - Độ dài cửa sổ thời gian (mặc định: 15 phút)
 * @param keyPrefix - Tiền tố key để phân biệt các endpoint khác nhau
 *
 * @example
 * // Giới hạn endpoint login: tối đa 5 lần/15 phút
 * router.post("/login", rateLimit(5, 15 * 60 * 1000, "login"), loginController);
 */
export const rateLimit = (
  maxRequests: number = 5,
  windowMs: number = 15 * 60 * 1000,
  keyPrefix: string = "global",
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Lấy IP của client (dùng socket nếu không có req.ip)
    const ip = req.ip || req.socket.remoteAddress || "unknown";

    // Key dạng "login:192.168.1.1" — phân biệt rate limit theo endpoint + IP
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    // Nếu IP này chưa từng gọi API → tạo record mới và cho qua
    if (!store[key]) {
      store[key] = {
        count: 1,
        resetTime: now + windowMs,
      };
      return next();
    }

    // Nếu cửa sổ thời gian đã hết → reset bộ đếm và bắt đầu cửa sổ mới
    if (now > store[key].resetTime) {
      store[key] = {
        count: 1,
        resetTime: now + windowMs,
      };
      return next();
    }

    // Tăng bộ đếm cho lần gọi hiện tại
    store[key].count++;

    // Kiểm tra có vượt giới hạn không
    if (store[key].count > maxRequests) {
      const resetDate = new Date(store[key].resetTime);
      // Dùng next(err) thay vì throw — Express 4 không bắt throw trong sync middleware
      return next(new APIError(
        429, // Too Many Requests
        `Too many requests from this IP. Try again after ${resetDate.toLocaleTimeString()}`,
        {
          retryAfter: resetDate.toISOString(),
          limit: maxRequests,
          window: Math.round(windowMs / 1000),
        },
        "RATE_LIMIT_EXCEEDED",
      ));
    }

    // Gắn thông tin rate limit vào header để client biết còn bao nhiêu lượt
    res.set("X-RateLimit-Limit", maxRequests.toString());
    res.set(
      "X-RateLimit-Remaining",
      (maxRequests - store[key].count).toString(),
    );
    res.set("X-RateLimit-Reset", new Date(store[key].resetTime).toISOString());

    return next();
  };
};

/**
 * Dọn dẹp các entry đã hết hạn trong store
 *
 * Mục đích: Tránh rò rỉ bộ nhớ khi lưu trữ nhiều địa chỉ IP theo thời gian.
 * Mỗi entry chiếm bộ nhớ nhỏ nhưng nếu server chạy lâu và không dọn
 * thì bộ nhớ sẽ tăng dần → OOM.
 *
 * Gọi hàm này định kỳ (vd: mỗi 1 giờ) từ server.ts:
 * setInterval(cleanupRateLimitStore, 60 * 60 * 1000);
 */
export const cleanupRateLimitStore = () => {
  const now = Date.now();
  for (const key in store) {
    // Xóa entry đã qua thời hạn reset (cửa sổ thời gian đã hết)
    if (now > store[key].resetTime) {
      delete store[key];
    }
  }
};

/**
 * Lưu ý production:
 * Giải pháp in-memory này chỉ phù hợp với single-server.
 * Khi scale nhiều instance (load balancer), cần dùng Redis
 * để chia sẻ state rate limit giữa các server.
 */
export default rateLimit;
