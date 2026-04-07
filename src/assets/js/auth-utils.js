/**
 * auth-utils.js - Authentication & sync utilities
 * Handle cart sync on login and other auth-related operations
 */

const getApiBase = () => {
  const isDev =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  return isDev
    ? "http://localhost:5000/api/v1"
    : `${window.location.origin}/api/v1`;
};

const API_BASE = getApiBase();

/**
 * Sync localStorage cart to server after login
 * @param {string} token - JWT auth token
 * @returns {Promise<Object|null>} - Synced cart or null on failure
 * 
 * ✅ Logic:
 * 1. Get localStorage cart
 * 2. Send POST /cart/sync to backend
 * 3. Backend accumulates with existing DB cart
 * 4. Clear localStorage on success
 * 5. Dispatch cartUpdated event for UI to refresh
 */
export async function syncCartAfterLogin(token) {
  try {
    // Get localStorage cart
    const cart = JSON.parse(localStorage.getItem("maverik_cart") || "[]");

    if (!cart || cart.length === 0) {
      console.log("✅ No local cart to sync");
      return null;
    }

    console.log(`📤 Syncing ${cart.length} items to server...`);

    // Send to backend
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
      // Don't throw - let login succeed even if sync fails
      return null;
    }

    const data = await response.json();
    console.log("✅ Cart synced successfully:", data);

    // Clear localStorage after successful sync
    localStorage.removeItem("maverik_cart");
    console.log("🗑️ Local cart cleared after sync");

    // Trigger update event for navbar & cart displays
    window.dispatchEvent(new Event("cartUpdated"));

    return data.data;
  } catch (err) {
    console.error("❌ Error syncing cart:", err);
    // Don't throw - let login succeed even if sync fails
    return null;
  }
}

/**
 * Clear all auth-related data (called on logout)
 */
export function clearAuthData() {
  try {
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("maverik_cart");
    window.dispatchEvent(new Event("cartUpdated"));
  } catch (err) {
    console.error("Error clearing auth data:", err);
  }
}
