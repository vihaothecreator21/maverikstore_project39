import { getApiBase } from "./api-config.js";
import { handleExpiredSession } from "./auth-utils.js";
import { showConfirm } from "./ui-feedback.js";

/**
 * cart-page.js
 *
 * Chức năng:
 * - Render trang giỏ hàng đầy đủ tại cart.html.
 * - Nếu đã đăng nhập: kéo dữ liệu từ GET /cart bằng JWT trong localStorage.authToken.
 * - Nếu chưa đăng nhập: đọc giỏ hàng guest từ localStorage.maverik_cart.
 * - Các nút tăng/giảm/xóa item cập nhật API hoặc localStorage tùy trạng thái login.
 * - Nút "THANH TOÁN" lưu ghi chú đơn hàng rồi chuyển sang checkout.html.
 */

const API_BASE = getApiBase();
document.addEventListener("DOMContentLoaded", () => {
  // Khi DOM sẵn sàng: load giỏ hàng lần đầu.
  loadFullCart();

  // Các module khác có thể dispatch event này sau khi thêm/xóa item.
  window.addEventListener("cartUpdatedGlobal", loadFullCart);
});

function loadFullCart() {
  const loading = document.getElementById("cart-loading");
  const content = document.getElementById("cart-content");
  const empty = document.getElementById("cart-empty");
  const token = localStorage.getItem("authToken");

  loading.classList.remove("d-none");
  content.classList.add("d-none");
  empty.classList.add("d-none");

  try {
    if (token) {
      // User đã login -> backend là source of truth cho giỏ hàng.
      fetch(`${API_BASE}/cart`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((response) => {
          if (response.ok) {
            return response.json();
          }
          if (response.status === 401) {
            handleExpiredSession();
            return null;
          }
          throw new Error("Failed to fetch cart");
        })
        .then((data) => {
          if (!data) return;
          if (data.status === "success") {
            const cart = data.data.items || [];
            setTimeout(() => {
              if (cart.length > 0) {
                renderCartItems(cart);
              } else {
                showEmptyState();
              }
            }, 200);
          }
        })
        .catch((err) => {
          console.error("Error fetching cart from API:", err);
          showEmptyState("Đã xảy ra lỗi khi tải giỏ hàng.");
        });
    } else {
      // Guest user -> chỉ đọc giỏ hàng tạm từ localStorage.
      const cart = JSON.parse(localStorage.getItem("maverik_cart") || "[]");

      // Simulate loading delay for smooth UI
      setTimeout(() => {
        if (cart.length > 0) {
          renderCartItems(cart);
        } else {
          showEmptyState();
        }
      }, 200);
    }
  } catch (err) {
    // Cart fetch error - silent fail
    showEmptyState("Đã xảy ra lỗi khi tải giỏ hàng.");
  }
}

function renderCartItems(cartData) {
  const loading = document.getElementById("cart-loading");
  const content = document.getElementById("cart-content");
  const container = document.getElementById("cart-items-container");

  const txtItemCount = document.getElementById("txt-item-count");
  const breadcrumbCount = document.getElementById("breadcrumb-count");
  const summaryTotal = document.getElementById("summary-total");

  let totalItems = 0;
  let totalPrice = 0;

  let html = "";
  cartData.forEach((item) => {
    totalItems += item.quantity;
    // Handle both API format (item.product.salePrice) and localStorage format (item.price)
    const price = item.product?.salePrice || item.price || item.product?.price;
    const name = item.name || item.product?.name;
    const imageUrl = item.imageUrl || item.product?.imageUrl;

    totalPrice += price * item.quantity;

    html += `
      <div class="cart-item-row" id="cart-item-row-${item.id}">
        <img src="${imageUrl}" alt="${name}" class="ci-img" onerror="this.src='./assets/images/product-img-1.jpg'" />
        
        <div class="ci-info">
          <div class="ci-name">${name}</div>
          <div class="ci-variant">${item.size} ${item.color && item.color !== "Default" ? " / " + item.color : ""}</div>
          
          <div class="ci-qty-control mt-3">
            <button class="ci-qty-btn" onclick="updateItemQty(${item.id}, ${item.quantity - 1})">-</button>
            <input type="text" class="ci-qty-input" value="${item.quantity}" readonly />
            <button class="ci-qty-btn" onclick="updateItemQty(${item.id}, ${item.quantity + 1})">+</button>
          </div>
        </div>
        
        <div class="ci-price-col">
          <div class="ci-price">${formatVND(price)}đ</div>
          <div class="ci-total-label">Thành tiền:</div>
          <div class="ci-total">${formatVND(price * item.quantity)}đ</div>
          
          <button class="ci-remove-btn" onclick="removeCartItem(${item.id})" title="Xóa sản phẩm">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </div>
    `;
  });

  txtItemCount.textContent = `${totalItems} sản phẩm`;
  breadcrumbCount.textContent = `Giỏ hàng (${totalItems})`;
  summaryTotal.textContent = formatVND(totalPrice) + "đ";

  container.innerHTML = html;

  loading.classList.add("d-none");
  content.classList.remove("d-none");
}

function showEmptyState(msg) {
  const loading = document.getElementById("cart-loading");
  const content = document.getElementById("cart-content");
  const empty = document.getElementById("cart-empty");

  loading.classList.add("d-none");
  content.classList.add("d-none");
  empty.classList.remove("d-none");

  if (msg) {
    const msgEl = empty.querySelector("h4");
    if (msgEl) msgEl.textContent = msg;
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
      } else {
        console.error("Failed to update qty via API");
      }
    } else {
      // ✅ If guest, use localStorage
      let cart = JSON.parse(localStorage.getItem("maverik_cart") || "[]");
      const idx = cart.findIndex((i) => i.id === itemId);
      if (idx > -1) {
        cart[idx].quantity = newQty;
        localStorage.setItem("maverik_cart", JSON.stringify(cart));
        loadFullCart();
      }
    }

    window.dispatchEvent(new Event("cartUpdatedGlobal"));
  } catch (err) {
    console.error("Error updating qty:", err);
  }
};

window.removeCartItem = async function (itemId) {
  const confirmDelete = await showConfirm("Bạn có chắc muốn xóa sản phẩm này?", { title: "Xóa sản phẩm", confirmText: "Xóa", tone: "danger" });
  if (!confirmDelete) return;

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
      } else {
        console.error("Failed to remove item via API");
      }
    } else {
      // ✅ If guest, use localStorage
      let cart = JSON.parse(localStorage.getItem("maverik_cart") || "[]");
      cart = cart.filter((i) => i.id !== itemId);
      localStorage.setItem("maverik_cart", JSON.stringify(cart));
      loadFullCart();
    }

    window.dispatchEvent(new Event("cartUpdatedGlobal"));
  } catch (err) {
    console.error("Error removing item:", err);
  }
};

document.getElementById("btn-goto-checkout")?.addEventListener("click", () => {
  const note = document.getElementById("order-note")?.value || "";
  if (note) localStorage.setItem("checkout_note", note);

  const token = localStorage.getItem("authToken");
  if (!token) {
    // Chưa đăng nhập → redirect sang checkout (sẽ hiện auth gate)
    window.location.href = "checkout.html";
    return;
  }
  window.location.href = "checkout.html";
});

function formatVND(amount) {
  return new Intl.NumberFormat("vi-VN").format(amount);
}
