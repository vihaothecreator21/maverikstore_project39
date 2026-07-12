/**
 * auth-utils.js — Các tiện ích liên quan đến xác thực người dùng
 *
 * Xuất 3 hàm chính:
 * - syncCartAfterLogin(token)  : Merge giỏ hàng localStorage vào DB sau khi đăng nhập
 * - clearAuthData()            : Xóa toàn bộ dữ liệu auth khỏi localStorage (dùng khi logout)
 * - handleExpiredSession()     : Xử lý token hết hạn → redirect về trang login
 *
 * Lưu ý localStorage keys:
 *   "authToken"    — JWT token
 *   "user"         — Thông tin user (JSON)
 *   "userEmail"    — Email user (dùng riêng cho một số nơi)
 *   "maverik_cart" — Giỏ hàng guest (array JSON)
 */

import { getApiBase } from "./api-config.js";

const API_BASE = getApiBase();

/**
 * Đồng bộ giỏ hàng localStorage vào server sau khi đăng nhập thành công
 *
 * Tại sao cần sync?
 * → User chưa đăng nhập thêm hàng vào giỏ (lưu localStorage)
 * → Sau khi đăng nhập, giỏ đó cần được merge vào DB cart của user
 *
 * Luồng xử lý:
 * 1. Đọc maverik_cart từ localStorage
 * 2. Nếu rỗng → không cần sync, return null
 * 3. POST /cart/sync với JWT token
 * 4. Backend merge localStorage cart vào DB cart (cộng quantity nếu trùng)
 * 5. Xóa localStorage cart sau khi sync thành công
 * 6. Phát sự kiện "cartUpdated" để navbar cập nhật số lượng
 *
 * Lưu ý: Không ném lỗi dù sync thất bại → để việc đăng nhập luôn thành công
 *
 * @param {string} token - JWT token nhận được sau khi đăng nhập
 * @returns {Promise<Object|null>} - Giỏ hàng đã sync hoặc null nếu không cần/thất bại
 */
export async function syncCartAfterLogin(token) {
  try {
    // Đọc giỏ hàng guest từ localStorage (mảng các item)
    const cart = JSON.parse(localStorage.getItem("maverik_cart") || "[]");

    if (!cart || cart.length === 0) {
      console.log("✅ No local cart to sync");
      return null;
    }

    console.log(`📤 Syncing ${cart.length} items to server...`);

    // Gửi request POST /cart/sync kèm JWT token trong Authorization header
    const response = await fetch(`${API_BASE}/cart/sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ items: cart }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Sync failed:", errorData);
      // Không throw — để đăng nhập vẫn thành công dù sync thất bại
      return null;
    }

    const data = await response.json();
    console.log("✅ Cart synced successfully:", data);

    // Xóa giỏ localStorage sau khi đã sync lên DB thành công
    localStorage.removeItem("maverik_cart");
    console.log("🗑️ Local cart cleared after sync");

    // Phát sự kiện để navbar và các component khác cập nhật số lượng giỏ hàng
    window.dispatchEvent(new Event("cartUpdated"));

    return data.data;
  } catch (err) {
    console.error("❌ Error syncing cart:", err);
    // Không throw — đăng nhập vẫn thành công
    return null;
  }
}

/**
 * Xóa toàn bộ dữ liệu xác thực khỏi localStorage
 * Gọi hàm này khi user bấm nút Đăng xuất
 *
 * Các key bị xóa:
 * - authToken   → JWT token (user sẽ phải đăng nhập lại)
 * - user        → Thông tin user đã lưu cache
 * - userEmail   → Email đã lưu cache
 * - maverik_cart → Giỏ hàng (xóa để tránh rò rỉ dữ liệu giữa các tài khoản)
 */
export function clearAuthData() {
  try {
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("maverik_cart");
    // Phát sự kiện để navbar cập nhật về trạng thái chưa đăng nhập
    window.dispatchEvent(new Event("cartUpdated"));
  } catch (err) {
    console.error("Error clearing auth data:", err);
  }
}

/**
 * Xử lý khi token JWT đã hết hạn
 *
 * Thường được gọi khi backend trả về 401 Unauthorized.
 * Quy trình:
 * 1. Xóa token và thông tin user khỏi localStorage
 * 2. Lưu trang hiện tại vào sessionStorage để redirect lại sau khi đăng nhập
 * 3. Redirect về trang đăng nhập
 *
 * @param {string} redirectTo - URL trang đăng nhập (mặc định: "index.html?login=1")
 */
export function handleExpiredSession(redirectTo = "index.html?login=1") {
  // Xóa thông tin xác thực hết hạn
  localStorage.removeItem("authToken");
  localStorage.removeItem("user");
  localStorage.removeItem("userEmail");

  // Lưu trang hiện tại để sau khi đăng nhập có thể redirect lại
  sessionStorage.setItem(
    "redirectAfterLogin",
    window.location.pathname.split("/").pop() || "index.html"
  );

  // Phát sự kiện cập nhật UI
  window.dispatchEvent(new Event("cartUpdated"));

  // Chuyển hướng về trang đăng nhập
  window.location.href = redirectTo;
}
