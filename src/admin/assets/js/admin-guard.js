/**
 * admin-guard.js — Maverik Admin
 * Kiểm tra quyền Admin trước khi render bất kỳ trang admin nào.
 * Gọi requireAdminAccess() ở đầu mỗi trang admin.
 */

export function requireAdminAccess() {
  const token = localStorage.getItem("authToken");
  const user  = JSON.parse(localStorage.getItem("user") || "{}");

  if (!token || !user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    // Lưu trang hiện tại để redirect về sau
    sessionStorage.setItem("redirectAfterLogin", window.location.href);
    window.location.href = "/login.html";
    return null;
  }
  return { token, user };
}

export function getApiBase() {
  const isDev =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  return isDev ? "http://localhost:5000/api/v1" : `${window.location.origin}/api/v1`;
}

/**
 * Logout utility
 */
export function adminLogout() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("user");
  localStorage.removeItem("userEmail");
  localStorage.removeItem("maverik_cart");
  window.location.href = "/login.html";
}

/**
 * Format VND currency
 */
export function formatVND(amount) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(amount)) + "đ";
}

/**
 * Format date to Vietnamese locale
 */
export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

/**
 * Status map for orders
 */
export const ORDER_STATUS = {
  PENDING:    { label: "Chờ xác nhận", color: "#f59e0b", bg: "#fffbeb" },
  CONFIRMED:  { label: "Đã xác nhận",  color: "#3b82f6", bg: "#eff6ff" },
  PROCESSING: { label: "Đang xử lý",   color: "#6366f1", bg: "#eef2ff" },
  SHIPPING:   { label: "Đang giao",    color: "#0ea5e9", bg: "#f0f9ff" },
  DELIVERED:  { label: "Đã giao",      color: "#22c55e", bg: "#f0fdf4" },
  COMPLETED:  { label: "Hoàn thành",   color: "#16a34a", bg: "#dcfce7" },
  CANCELLED:  { label: "Đã hủy",       color: "#ef4444", bg: "#fef2f2" },
  RETURNED:   { label: "Hoàn trả",     color: "#f97316", bg: "#fff7ed" },
};

/**
 * Show a toast notification
 */
let _toastTimer;
export function showToast(msg, type = "default") {
  let toast = document.getElementById("admin-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "admin-toast";
    toast.style.cssText = [
      "position:fixed; bottom:24px; right:24px; z-index:9999",
      "padding:12px 20px; font-size:.85rem; font-weight:500",
      "border-radius:8px; box-shadow:0 8px 32px rgba(0,0,0,.15)",
      "transform:translateY(20px); opacity:0; transition:all .3s",
      "max-width:380px; color:#fff",
    ].join(";");
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.background =
    type === "error"   ? "#ef4444" :
    type === "success" ? "#22c55e" :
    type === "warning" ? "#f59e0b" : "#1a1a1a";
  toast.style.opacity = "1";
  toast.style.transform = "translateY(0)";
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(20px)";
  }, 4000);
}
