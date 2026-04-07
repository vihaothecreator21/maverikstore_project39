# 🛠️ PLAN: CẢI THIỆN HỆ THỐNG GIỎ HÀNG (CART SYSTEM)

**Status**: Planning Phase ✅  
**Updated**: April 7, 2026  
**Target**: Hỗ trợ Guest (localStorage) + Authenticated Users (DB Sync)

---

## 📌 **TÓM TẮT (TL;DR)**

### Luồng Hoạt Động Mới

| Người Dùng | Thêm Giỏ           | Dữ Liệu Lưu  | Khi Login                   | Checkout             |
| ---------- | ------------------ | ------------ | --------------------------- | -------------------- |
| **Guest**  | ✅ Không cần login | localStorage | N/A                         | Điền thủ công        |
| **User**   | ✅ Bình thường     | API → DB     | Auto sync localStorage → DB | Auto-fill từ profile |
| **Admin**  | 🚧 Phát triển sau  | API → DB     | N/A                         | N/A                  |

### Lợi Ích

- ✅ Guest có thể browse & add-to-cart tự do
- ✅ Dữ liệu guest tự động migrate lên DB khi login
- ✅ User không bị mất cart khi logout/reload
- ✅ Cross-device sync (user đăng nhập thiết bị khác)
- ✅ Backend có dữ liệu để tính toán order

---

## 🎯 **PHASE 1: Frontend - Guest Add-to-Cart (localStorage)**

### ⚙️ Step 1.1: Sửa `products.js` - Remove Login Requirement

**File**: `src/assets/js/products.js`  
**Location**: Line 332-356  
**Người viết**: Frontend Dev

#### Hiện Tại (Lỗi):

```javascript
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".add-to-cart-btn");
  if (!btn) return;

  const token = localStorage.getItem("authToken");
  if (!token) {
    const loginModal = document.getElementById("loginModal");
    new bootstrap.Modal(loginModal).show();
    return; // ❌ DỪNG ở đây nếu không login
  }

  const name = btn.dataset.productName;
  showToast(`✅ Đã thêm "${name}" vào giỏ hàng!`); // ❌ CHỈ TOAST GIẢ, KHÔNG LƯU
});
```

#### Sửa Thành:

```javascript
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".add-to-cart-btn");
  if (!btn) return;

  try {
    const productId = parseInt(btn.dataset.productId);
    const productName = btn.dataset.productName;
    const productPrice = parseFloat(btn.dataset.productPrice);
    const imageUrl =
      btn.dataset.productImage || "./assets/images/product-img-1.jpg";

    // ✅ Tạo item object
    const newItem = {
      id: Date.now(),
      productId: productId,
      name: productName,
      price: productPrice,
      imageUrl: imageUrl,
      size: "One Size", // Default cho products.html
      color: "Default", // Default cho products.html
      quantity: 1,
    };

    // ✅ Lấy cart từ localStorage
    let cart = JSON.parse(localStorage.getItem("maverik_cart") || "[]");

    // ✅ Kiểm tra xem đã có trong giỏ chưa
    const existing = cart.findIndex(
      (item) =>
        item.productId === productId &&
        item.size === newItem.size &&
        item.color === newItem.color,
    );

    if (existing > -1) {
      cart[existing].quantity += 1; // Tăng số lượng
    } else {
      cart.push(newItem); // Thêm mới
    }

    // ✅ Lưu vào localStorage
    localStorage.setItem("maverik_cart", JSON.stringify(cart));

    // ✅ Cập nhật navbar
    window.dispatchEvent(new Event("cartUpdated"));

    // ✅ Hiển thị thông báo
    showToast(`✅ Đã thêm "${productName}" (${cart.length} sản phẩm)`);
  } catch (err) {
    console.error("Error adding to cart:", err);
    showToast("❌ Lỗi khi thêm vào giỏ hàng");
  }
});
```

#### Yêu Cầu HTML (Kiểm Tra):

```html
<button
  class="btn btn-dark btn-sm add-to-cart-btn"
  data-product-id="123"
  data-product-name="Sản phẩm A"
  data-product-price="500000"
  data-product-image="./path/to/image.jpg"
>
  <i class="bi bi-cart-plus me-1"></i>Thêm giỏ
</button>
```

**✅ Kết Quả**: Guest có thể thêm giỏ mà không bị yêu cầu login

---

### ⚙️ Step 1.2: Tạo Shared Cart Utility

**File**: `src/assets/js/cart-utils.js` (NEW)  
**Người viết**: Frontend Dev

```javascript
/**
 * cart-utils.js - Shared cart functions
 * Tái sử dụng code for products.js & product-detail.js
 */

export function addToCartLocally(
  product,
  quantity = 1,
  size = "One Size",
  color = "Default",
) {
  try {
    // Validate input
    if (!product?.id || !product?.price) {
      console.error("Invalid product:", product);
      return false;
    }

    // Create item
    const newItem = {
      id: Date.now(),
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl:
        product.imageUrl ||
        product.images?.[0]?.url ||
        "./assets/images/product-img-1.jpg",
      size: size,
      color: color,
      quantity: parseInt(quantity),
    };

    // Get existing cart
    let cart = JSON.parse(localStorage.getItem("maverik_cart") || "[]");

    // Check if already exists
    const existingIndex = cart.findIndex(
      (item) =>
        item.productId === product.id &&
        item.size === size &&
        item.color === color,
    );

    if (existingIndex > -1) {
      cart[existingIndex].quantity += newItem.quantity;
    } else {
      cart.push(newItem);
    }

    // Save
    localStorage.setItem("maverik_cart", JSON.stringify(cart));

    // Trigger event
    window.dispatchEvent(new Event("cartUpdated"));

    return true;
  } catch (err) {
    console.error("Error in addToCartLocally:", err);
    return false;
  }
}

export function getCartFromStorage() {
  try {
    return JSON.parse(localStorage.getItem("maverik_cart") || "[]");
  } catch (err) {
    console.error("Error reading cart:", err);
    return [];
  }
}

export function clearCartStorage() {
  localStorage.removeItem("maverik_cart");
  window.dispatchEvent(new Event("cartUpdated"));
}
```

#### Modify `product-detail.js`:

```javascript
import { addToCartLocally } from "./cart-utils.js";

async function handleAddToCart(product) {
  const qty = parseInt(document.getElementById("qty-input").value);
  const addBtn = document.getElementById("btn-add-cart");

  try {
    addBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Đang thêm...`;
    addBtn.disabled = true;

    // ✅ Use shared function
    const success = addToCartLocally(product, qty, selectedSize, selectedColor);

    if (success) {
      // Open offcanvas
      const offcanvasEl = document.getElementById("cartOffcanvas");
      if (offcanvasEl) {
        const oc =
          bootstrap.Offcanvas.getInstance(offcanvasEl) ||
          new bootstrap.Offcanvas(offcanvasEl);
        oc.show();
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    } else {
      showToast("❌ Lỗi khi thêm vào giỏ hàng");
    }
  } catch (err) {
    showToast(`❌ Lỗi: ${err.message}`);
  } finally {
    addBtn.innerHTML = originalText;
    addBtn.disabled = false;
  }
}
```

**✅ Kết Quả**: Code được tái sử dụng, behavior consistent

---

## 🎯 **PHASE 2: Backend - Login Sync Endpoint**

### ⚙️ Step 2.1: Add Schema Validation

**File**: `backend/src/schemas/cart.schema.ts`  
**Người viết**: Backend Dev

```typescript
import { z } from "zod";

// Existing schemas...

// ✅ NEW: Sync cart from localStorage
// ⚠️ SECURITY: ONLY accept productId, quantity, size, color
// ❌ DO NOT accept price, name, imageUrl from client
// Backend will fetch real data from database
export const SyncCartSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive("Product ID must be positive"),
        quantity: z
          .number()
          .int()
          .min(1, "Quantity must be at least 1")
          .max(999),
        size: z
          .string()
          .max(50, "Size too long")
          .optional()
          .default("One Size"),
        color: z
          .string()
          .max(50, "Color too long")
          .optional()
          .default("Default"),
      }),
    )
    .optional(),
});

export type SyncCartInput = z.infer<typeof SyncCartSchema>;
```

---

### ⚙️ Step 2.2: Add Service Method

**File**: `backend/src/services/cart.service.ts`  
**Người viết**: Backend Dev

```typescript
export class CartService {
  // ... existing methods ...

  // ✅ NEW: Sync localStorage cart to DB
  // 📝 Logic: For each item, check if (productId + size + color) already exists in DB
  //    - If exists: ADD quantities together (accumulate, don't replace)
  //    - If not exists: Create new cart item
  static async syncLocalStorageCart(userId: number, localItems: any[] = []) {
    try {
      // Get or create user's cart
      let cart = await CartRepository.findCartByUserId(userId);
      if (!cart) {
        await CartRepository.createCart(userId);
        cart = await CartRepository.findCartByUserId(userId);
      }

      // Process each localStorage item
      if (localItems && Array.isArray(localItems)) {
        for (const item of localItems) {
          // Validate product exists
          const product = await ProductRepository.findById(item.productId);
          if (!product) {
            console.warn(`Product ${item.productId} not found, skipping`);
            continue;
          }

          const itemSize = item.size || "One Size";
          const itemColor = item.color || "Default";
          const requestedQty = Math.min(item.quantity || 1, 999);

          // ✅ Check if item already exists in DB (same productId + size + color)
          const existingCartItem = await CartRepository.findCartItem(
            cart!.id,
            item.productId,
            itemSize,
            itemColor,
          );

          if (existingCartItem) {
            // ✅ ACCUMULATE: Add quantities together
            const newQty = Math.min(
              existingCartItem.quantity + requestedQty,
              999,
            );
            await CartRepository.updateCartItemQty(existingCartItem.id, newQty);
            console.log(
              `Updated item ${item.productId}: ${existingCartItem.quantity} + ${requestedQty} = ${newQty}`,
            );
          } else {
            // Check stock before adding
            if (product.stockQuantity < requestedQty) {
              const availableQty = Math.min(
                requestedQty,
                product.stockQuantity,
              );
              await CartRepository.addCartItem(
                cart!.id,
                item.productId,
                itemSize,
                itemColor,
                availableQty,
              );
              console.warn(
                `Added ${item.productId} with limited qty: ${availableQty}`,
              );
            } else {
              await CartRepository.addCartItem(
                cart!.id,
                item.productId,
                itemSize,
                itemColor,
                requestedQty,
              );
              console.log(
                `Added new item ${item.productId}: qty ${requestedQty}`,
              );
            }
          }
        }
      }

      // Return updated cart
      return this.getCart(userId);
    } catch (err) {
      console.error("Sync cart error:", err);
      throw new APIError(500, "Failed to sync cart", {}, "SYNC_FAILED");
    }
  }
}
```

---

### ⚙️ Step 2.3: Add Controller Method

**File**: `backend/src/controllers/cart.controller.ts`  
**Người viết**: Backend Dev

```typescript
export class CartController {
  // ... existing methods ...

  // ✅ NEW: Sync cart endpoint
  static async syncCart(req: Request, res: Response) {
    const validation = SyncCartSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ValidationError("Validation failed", {});
    }

    const userId = (req as any).userId;
    const items = validation.data.items || [];

    const cart = await CartService.syncLocalStorageCart(userId, items);
    return sendSuccess(res, cart, "Cart synced successfully", HTTP_STATUS.OK);
  }
}
```

---

### ⚙️ Step 2.4: Add Route

**File**: `backend/src/routes/cart.routes.ts`  
**Người viết**: Backend Dev

```typescript
export const cartRoutes = Router();

cartRoutes.use(authMiddleware); // Existing line

cartRoutes.get("/", catchAsync(CartController.getCart));
cartRoutes.post("/items", catchAsync(CartController.addItem));
cartRoutes.patch("/items/:id", catchAsync(CartController.updateItemQty));
cartRoutes.delete("/items/:id", catchAsync(CartController.removeItem));

// ✅ NEW: Sync endpoint
cartRoutes.post("/sync", catchAsync(CartController.syncCart));
```

**✅ Kết Quả**: Backend có endpoint nhận sync request từ frontend

---

## 🎯 **PHASE 3: Frontend - Auto-Sync When Login**

### ⚙️ Step 3.1: Create Auth Utility

**File**: `src/assets/js/auth-utils.js` (NEW)  
**Người viết**: Frontend Dev

```javascript
/**
 * auth-utils.js - Authentication & sync utilities
 */

const API_BASE = (() => {
  const isDev =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  return isDev
    ? "http://localhost:5000/api/v1"
    : `${window.location.origin}/api/v1`;
})();

export async function syncCartAfterLogin(token) {
  try {
    // Get localStorage cart
    const cart = JSON.parse(localStorage.getItem("maverik_cart") || "[]");

    if (!cart || cart.length === 0) {
      console.log("No cart to sync");
      return null;
    }

    console.log(`Syncing ${cart.length} items to server...`);

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
      console.error("Sync failed:", errorData);
      return null;
    }

    const data = await response.json();
    console.log("Cart synced successfully:", data);

    // Clear localStorage after successful sync
    localStorage.removeItem("maverik_cart");

    // Trigger update
    window.dispatchEvent(new Event("cartUpdated"));

    return data.data;
  } catch (err) {
    console.error("Error syncing cart:", err);
    // Don't throw - let login succeed even if sync fails
    return null;
  }
}
```

---

### ⚙️ Step 3.2: Modify Login Handler

**File**: `src/products.html`  
**Location**: Line 367-431  
**Người viết**: Frontend Dev

#### Hiện Tại:

```javascript
document
  .getElementById("loginFormModal")
  ?.addEventListener("submit", async function (e) {
    // ... validation code ...

    const response = await fetch("http://localhost:5000/api/v1/auth/login", {
      // ... request ...
    });

    const data = await response.json();
    if (response.ok && data.status === "success") {
      localStorage.setItem("authToken", data.data.token);
      if (rememberMe) localStorage.setItem("userEmail", email);
      localStorage.setItem("user", JSON.stringify(data.data.user));
      alert("✅ Login successful!");
      window.location.reload(); // ❌ RELOAD luôn
    }
  });
```

#### Sửa Thành (Với Loading States):

```javascript
import { syncCartAfterLogin } from "./assets/js/auth-utils.js";

let isLoginProcessing = false;

document
  .getElementById("loginFormModal")
  ?.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!this.checkValidity()) {
      e.stopPropagation();
      this.classList.add("was-validated");
      return;
    }

    // Prevent multiple submissions
    if (isLoginProcessing) return;
    isLoginProcessing = true;

    const email = document.getElementById("loginEmailModal").value.trim();
    const password = document.getElementById("loginPasswordModal").value;
    const rememberMe = document.getElementById("rememberMeModal").checked;
    const loginBtn = document.getElementById("loginBtn"); // Assuming button has this ID
    const originalBtnText = loginBtn?.innerHTML || "Đăng nhập";

    try {
      // ✅ Show "Đang đăng nhập..." state
      if (loginBtn) {
        loginBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Đang đăng nhập...`;
        loginBtn.disabled = true;
      }

      const response = await fetch("http://localhost:5000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (response.ok && data.status === "success") {
        // Save token & user
        localStorage.setItem("authToken", data.data.token);
        if (rememberMe) localStorage.setItem("userEmail", email);
        localStorage.setItem("user", JSON.stringify(data.data.user));

        // ✅ Show "Đang đồng bộ giỏ hàng..." state
        if (loginBtn) {
          loginBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Đang đồng bộ giỏ hàng...`;
        }

        // Sync cart
        await syncCartAfterLogin(data.data.token);

        // ✅ Show success before reload
        alert("✅ Login & sync successful!");
        window.location.reload();
      } else {
        alert("❌ " + (data.message || "Login failed"));
        // Reset button on error
        if (loginBtn) {
          loginBtn.innerHTML = originalBtnText;
          loginBtn.disabled = false;
          isLoginProcessing = false;
        }
      }
    } catch (error) {
      alert("❌ Network error");
      // Reset button on error
      if (loginBtn) {
        loginBtn.innerHTML = originalBtnText;
        loginBtn.disabled = false;
        isLoginProcessing = false;
      }
    }
  });
```

**✅ Kết Quả**: Khi login → Tự động sync localStorage → DB với loading states

---

### ⚙️ Step 3.3: Add Logout Handler (Clear Cart)

**File**: `src/products.html` hoặc `src/assets/js/navbar.js`  
**Người viết**: Frontend Dev

#### NEW: Logout Button Click Handler

```javascript
/**
 * Logout handler - Clear guest cart when user logs out
 * ✅ Prevents cart pollution on shared devices
 */
window.handleLogout = function () {
  const confirmed = window.confirm("Bạn có chắc muốn đăng xuất?");
  if (!confirmed) return;

  try {
    // Remove all auth related data
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    localStorage.removeItem("userEmail");

    // ✅ CRITICAL: Clear guest cart to prevent pollution
    // Next guest user on shared device gets clean slate
    localStorage.removeItem("maverik_cart");

    // Notify cart system
    window.dispatchEvent(new Event("cartUpdated"));

    // Redirect to home
    alert("✅ Đã đăng xuất");
    window.location.href = "./index.html";
  } catch (err) {
    console.error("Logout error:", err);
    window.location.href = "./index.html";
  }
};

// Attach to logout button (in HTML)
// <button onclick="handleLogout()" class="dropdown-item">Đăng xuất</button>
```

#### In HTML Navbar:

```html
<!-- Inside user dropdown menu -->
<div class="dropdown-menu dropdown-menu-end">
  <a href="./account.html" class="dropdown-item">Profile</a>
  <a href="./orders.html" class="dropdown-item">Orders</a>
  <hr class="dropdown-divider" />
  <!-- ✅ NEW: Logout button with handler -->
  <button
    type="button"
    class="dropdown-item"
    onclick="handleLogout()"
    style="background: none; border: none; cursor: pointer; text-align: left; width: 100%;"
  >
    <i class="bi bi-box-arrow-right me-2"></i>Đăng xuất
  </button>
</div>
```

**✅ Kết Quả**:

- User logouts → All auth data cleared
- ✅ Guest cart also cleared (prevents pollution)
- Next user on shared device → Clean cart
- Security: No leftover data

---

## 🎯 **PHASE 4: Frontend - API Calls for Logged-in Users**

### ⚙️ Step 4.1: Update cart.js (Navbar Offcanvas)

**File**: `src/assets/js/cart.js`  
**Location**: fetchCart function  
**Người viết**: Frontend Dev

#### Hiện Tại (localStorage only):

```javascript
function fetchCart() {
  const cart = JSON.parse(localStorage.getItem("maverik_cart") || "[]");
  // ... render offcanvas ...
}
```

#### Sửa Thành (Check Login):

```javascript
async function fetchCart() {
  const token = localStorage.getItem("authToken");
  let cart = [];

  if (token) {
    // ✅ If logged in, fetch from API
    try {
      const response = await fetch(`${API_BASE}/cart`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.status === "success") {
          cart = data.data.items || [];
        }
      }
    } catch (err) {
      console.error("Error fetching cart from API:", err);
      cart = JSON.parse(localStorage.getItem("maverik_cart") || "[]");
    }
  } else {
    // ✅ If guest, use localStorage
    cart = JSON.parse(localStorage.getItem("maverik_cart") || "[]");
  }

  // ... render offcanvas with cart data ...
  renderOffcanvas(cart);
}

// Global remove for logged-in users
window.removeCartItemOc = async function (itemId) {
  const token = localStorage.getItem("authToken");

  if (token) {
    // ✅ If logged in, call API
    try {
      const response = await fetch(`${API_BASE}/cart/items/${itemId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        fetchCart(); // Refresh
      }
    } catch (err) {
      console.error("Error removing item:", err);
    }
  } else {
    // ✅ If guest, use localStorage
    let cart = JSON.parse(localStorage.getItem("maverik_cart") || "[]");
    cart = cart.filter((item) => item.id !== itemId);
    localStorage.setItem("maverik_cart", JSON.stringify(cart));
    fetchCart();
  }
};
```

---

### ⚙️ Step 4.2: Update cart-page.js

**File**: `src/assets/js/cart-page.js`  
**Location**: loadFullCart function  
**Người viết**: Frontend Dev

#### Modify:

```javascript
async function loadFullCart() {
  const token = localStorage.getItem("authToken");
  let cart = [];

  try {
    if (token) {
      // ✅ If logged in, fetch from API
      const response = await fetch(`${API_BASE}/cart`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.status === "success") {
          cart = data.data.items || [];
        }
      }
    } else {
      // ✅ If guest, use localStorage
      cart = JSON.parse(localStorage.getItem("maverik_cart") || "[]");
    }

    renderCartItems(cart);
  } catch (err) {
    showEmptyState("Lỗi khi tải giỏ hàng");
  }
}

window.updateItemQty = async function (itemId, newQty) {
  if (newQty < 1) return;

  const token = localStorage.getItem("authToken");

  try {
    if (token) {
      // ✅ If logged in, call API
      const response = await fetch(`${API_BASE}/cart/items/${itemId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ quantity: newQty }),
      });
      if (response.ok) {
        loadFullCart(); // Refresh
      }
    } else {
      // ✅ If guest, use localStorage
      let cart = JSON.parse(localStorage.getItem("maverik_cart") || "[]");
      const item = cart.find((i) => i.id === itemId);
      if (item) {
        item.quantity = newQty;
        localStorage.setItem("maverik_cart", JSON.stringify(cart));
        loadFullCart();
      }
    }
  } catch (err) {
    console.error("Error updating qty:", err);
  }
};

window.removeCartItem = async function (itemId) {
  const confirm = window.confirm("Bạn có chắc muốn xóa?");
  if (!confirm) return;

  const token = localStorage.getItem("authToken");

  try {
    if (token) {
      // ✅ If logged in, call API
      const response = await fetch(`${API_BASE}/cart/items/${itemId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        loadFullCart(); // Refresh
      }
    } else {
      // ✅ If guest, use localStorage
      let cart = JSON.parse(localStorage.getItem("maverik_cart") || "[]");
      cart = cart.filter((i) => i.id !== itemId);
      localStorage.setItem("maverik_cart", JSON.stringify(cart));
      loadFullCart();
    }
  } catch (err) {
    console.error("Error removing item:", err);
  }
};
```

---

### ⚙️ Step 4.3: Update product-detail.js

**File**: `src/assets/js/product-detail.js`  
**Location**: handleAddToCart function  
**Người viết**: Frontend Dev

#### Modify:

```javascript
import { addToCartLocally } from "./cart-utils.js";

async function handleAddToCart(product) {
  const qty = parseInt(document.getElementById("qty-input").value);
  const addBtn = document.getElementById("btn-add-cart");
  const originalText = addBtn.innerHTML;
  const token = localStorage.getItem("authToken");

  try {
    addBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Đang thêm...`;
    addBtn.disabled = true;

    if (token) {
      // ✅ If logged in, call API
      const response = await fetch(`${API_BASE}/cart/items`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: product.id,
          quantity: qty,
          size: selectedSize,
          color: selectedColor,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        window.dispatchEvent(new Event("cartUpdated"));

        const offcanvasEl = document.getElementById("cartOffcanvas");
        if (offcanvasEl) {
          const oc =
            bootstrap.Offcanvas.getInstance(offcanvasEl) ||
            new bootstrap.Offcanvas(offcanvasEl);
          oc.show();
        }
        showToast("✅ Đã thêm vào giỏ hàng!");
      } else {
        const errorData = await response.json();
        showToast("❌ " + (errorData.message || "Lỗi thêm giỏ"));
      }
    } else {
      // ✅ If guest, use localStorage
      const success = addToCartLocally(
        product,
        qty,
        selectedSize,
        selectedColor,
      );
      if (success) {
        const offcanvasEl = document.getElementById("cartOffcanvas");
        if (offcanvasEl) {
          const oc =
            bootstrap.Offcanvas.getInstance(offcanvasEl) ||
            new bootstrap.Offcanvas(offcanvasEl);
          oc.show();
        }
        showToast("✅ Đã thêm vào giỏ hàng!");
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  } catch (err) {
    showToast(`❌ Lỗi: ${err.message}`);
  } finally {
    addBtn.innerHTML = originalText;
    addBtn.disabled = false;
  }
}
```

**✅ Kết Quả**: Logged-in users → API, Guest → localStorage

---

## 📋 **SUMMARY: Các File Cần Sửa**

| Priority  | Phase | File                                         | Changes                                    | Status   |
| --------- | ----- | -------------------------------------------- | ------------------------------------------ | -------- |
| 🔴 HIGH   | 1     | `src/assets/js/products.js`                  | Remove login check, add localStorage logic | 📝 To-do |
| 🟡 MEDIUM | 1     | `src/assets/js/cart-utils.js`                | [NEW] Shared functions                     | 📝 To-do |
| 🔴 HIGH   | 2     | `backend/src/schemas/cart.schema.ts`         | Add SyncCartSchema (security: no price)    | 📝 To-do |
| 🔴 HIGH   | 2     | `backend/src/services/cart.service.ts`       | Add syncLocalStorageCart() with accum.     | 📝 To-do |
| 🔴 HIGH   | 2     | `backend/src/controllers/cart.controller.ts` | Add syncCart()                             | 📝 To-do |
| 🔴 HIGH   | 2     | `backend/src/routes/cart.routes.ts`          | Add POST /sync                             | 📝 To-do |
| 🟡 MEDIUM | 3     | `src/assets/js/auth-utils.js`                | [NEW] syncCartAfterLogin()                 | 📝 To-do |
| 🟡 MEDIUM | 3     | `src/products.html`                          | Modify login handler (add loading states)  | 📝 To-do |
| 🟡 MEDIUM | 3     | `src/products.html` or navbar.js             | [NEW] Logout handler (clear cart)          | 📝 To-do |
| 🟡 MEDIUM | 4     | `src/assets/js/cart.js`                      | Add API support                            | 📝 To-do |
| 🟡 MEDIUM | 4     | `src/assets/js/cart-page.js`                 | Add API support                            | 📝 To-do |
| 🟡 MEDIUM | 4     | `src/assets/js/product-detail.js`            | Add API support                            | 📝 To-do |

---

## 🧪 **VERIFICATION CHECKLIST**

### ✅ **Test 1: Guest Add-to-Cart**

- [ ] Open products.html (not logged in)
- [ ] Click "Thêm giỏ" on any product
- [ ] Toast should show success
- [ ] Navbar badge updates
- [ ] Check DevTools → localStorage `maverik_cart` has item
- [ ] Reload page → Items still visible
- [ ] Open cart.html → Items visible

### ✅ **Test 2: Guest → Login → Sync**

- [ ] Guest adds 3 items (localStorage)
- [ ] Open products.html modal, login
- [ ] Check backend database: Cart table should have items
- [ ] localStorage should be cleared
- [ ] Reload page → Cart data from API (not localStorage)
- [ ] Navbar badge still shows count

### ✅ **Test 3: Logged-in User Add-to-Cart**

- [ ] Already logged-in user
- [ ] Click "Thêm giỏ" on product
- [ ] Database Cart table should update
- [ ] Navbar updates immediately
- [ ] Open different tab/browser → Same cart visible
- [ ] Reload page → Cart from DB (not localStorage)

### ✅ **Test 4: Cart Operations (Logged-in)**

- [ ] Update quantity in cart → API call → DB updates
- [ ] Remove item → API call → DB updates
- [ ] Empty cart → API call → DB updates

### ✅ **Test 5: Cart Operations (Guest)**

- [ ] Update quantity → localStorage updates
- [ ] Remove item → localStorage updates
- [ ] Reload page → Changes persist

### ✅ **Test 6: Quantity Accumulation on Sync**

- [ ] Guest adds 2x Product A (same size/color)
- [ ] localStorage shows: 1 item with qty=2 ✅
- [ ] Guest adds 1 more of same product
- [ ] localStorage shows: 1 item with qty=3 ✅
- [ ] Login (sync triggered)
- [ ] Backend DB check: Cart has 1 CartItem with quantity=3 (accumulated, not replaced)
- [ ] Reload page → Shows qty=3 from API

### ✅ **Test 7: Logout Clears Cart**

- [ ] Login as User A
- [ ] Add 5 items to cart (stored in DB)
- [ ] Navigate to navbar → Click Logout button
- [ ] Confirm logout dialog
- [ ] Check localStorage: `maverik_cart` key is gone ✅
- [ ] Check DbT: User A's cart items still in DB (not deleted, just local cache cleared)
- [ ] New Guest user opens site
- [ ] Navbar cart badge shows 0 ✅
- [ ] localStorage is clean (no leftover items)

### ✅ **Test 8: Loading States During Login/Sync**

- [ ] Guest adds items
- [ ] Click login button
- [ ] Button shows spinner + \"\u0110ang \u0111\u0103ng nh\u1eadp...\" text ✅
- [ ] Wait for response
- [ ] Button shows spinner + \"\u0110ang \u0111\u1ed3ng b\u1ed9 gi\u1ecf h\u00e0ng...\" text ✅
- [ ] Sync completes
- [ ] Page reloads, button back to original state
- [ ] User sees feedback throughout process (no hanging)

### ✅ **Test 9: Backend Rejects Price Field**

- [ ] Manually craft POST /sync request with `{price: 999}` in item
- [ ] Send request with authToken
- [ ] Backend should:\*\*Zod validation passes (price not in schema)
- [ ] Backend uses PRODUCT PRICE from DB (not client value)
- [ ] Cart item saves with correct DB price (not 999)
- [ ] Verify: No price tampering possible

---

## 📌 **IMPORTANT NOTES**

1. **Stock Validation**: Sync endpoint checks stock before adding
2. **Quantity Limits**: Max 999 items per product to prevent abuse
3. **Error Handling**: All operations have try-catch, errors logged
4. **Backward Compatibility**: Old localhost carts auto-migrate on login
5. **No Breaking Changes**: Existing APIs untouched, only added new sync endpoint

---

## 🚀 **NEXT STEPS (After Cart Fix)**

1. Create Order module (Checkout flow)
2. Add Admin Dashboard
3. Add Payment Gateway Integration
4. Add Order Tracking
5. Add Email Notifications

---

**Last Updated**: April 7, 2026  
**Status**: Ready for Implementation ✅
