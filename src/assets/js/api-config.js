/**
 * api-config.js — Centralized API configuration
 * Manages API base URL and other endpoint configurations
 */

const isDevelopment = !import.meta.env.PROD;

export const API_CONFIG = {
  BASE_URL: isDevelopment
    ? "http://localhost:5000/api/v1"
    : `${window.location.origin}/api/v1`,

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
