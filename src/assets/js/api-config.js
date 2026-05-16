/**
 * api-config.js — Centralized API configuration
 * Manages API base URL and other endpoint configurations
 *
 * Ghi chú cho backend engineer:
 * - Mọi module frontend nên lấy API base qua getApiBase().
 * - Dev mặc định gọi backend Express tại http://localhost:5000/api/v1.
 * - Production fallback dùng cùng origin với frontend: {domain}/api/v1.
 */

const isDevelopment = !import.meta.env.PROD;
const envApiUrl = import.meta.env.VITE_API_URL;

export const API_CONFIG = {
  BASE_URL: envApiUrl || (isDevelopment
    ? "http://localhost:5000/api/v1"
    : `${window.location.origin}/api/v1`),

  // Endpoint paths
  ENDPOINTS: {
    PRODUCTS: "/products",
    CATEGORIES: "/categories",
    CART: "/cart",
    AUTH: "/auth",
  },

  // Timeout settings
  TIMEOUT: 30000,
};

// Export for use in modules
export const getApiUrl = () => API_CONFIG.BASE_URL;
export const getApiBase = () => API_CONFIG.BASE_URL;
