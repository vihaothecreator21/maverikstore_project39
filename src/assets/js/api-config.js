/**
 * api-config.js — Cấu hình API tập trung cho toàn bộ frontend
 *
 * Tất cả module frontend nên lấy URL API qua getApiBase() thay vì hardcode.
 * Điều này giúp dễ dàng đổi URL khi deploy sang môi trường khác.
 *
 * Logic xác định BASE_URL:
 * 1. Nếu có biến môi trường VITE_API_URL → dùng đó (ưu tiên cao nhất)
 * 2. Nếu là development (npm run dev) → http://localhost:5000/api/v1
 * 3. Nếu là production (build) → {domain hiện tại}/api/v1
 *    (giả định frontend và backend cùng domain, nginx proxy /api → backend)
 */

// Vite inject import.meta.env.PROD = true khi build production
const isDevelopment = !import.meta.env.PROD;

// Biến môi trường tùy chỉnh — định nghĩa trong file .env ở thư mục gốc
// Vite chỉ đưa vào bundle những biến có prefix VITE_
const envApiUrl = import.meta.env.VITE_API_URL;

export const API_CONFIG = {
  // URL gốc của API Backend
  BASE_URL: envApiUrl || (isDevelopment
    ? "http://localhost:5000/api/v1"           // Backend Express dev server
    : `${window.location.origin}/api/v1`),     // Production: cùng domain

  // Các đường dẫn endpoint (dùng để build URL đầy đủ)
  ENDPOINTS: {
    PRODUCTS:   "/products",
    CATEGORIES: "/categories",
    CART:       "/cart",
    AUTH:       "/auth",
  },

  // Timeout tối đa cho mỗi request (ms)
  TIMEOUT: 30000, // 30 giây
};

/** Lấy URL cơ sở của API — dùng trong tất cả module frontend */
export const getApiUrl  = () => API_CONFIG.BASE_URL;
export const getApiBase = () => API_CONFIG.BASE_URL;
