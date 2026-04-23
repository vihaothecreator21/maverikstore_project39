const getApiBase = () => {
  const isDev =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  return isDev
    ? "http://localhost:5000/api/v1"
    : `${window.location.origin}/api/v1`;
};
const API_BASE = getApiBase();
document.addEventListener("DOMContentLoaded", () => {
  loadFullCart();
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
      // ✅ If logged in, fetch from API
      fetch(`${API_BASE}/cart`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((response) => {
          if (response.ok) {
            return response.json();
          }
          throw new Error("Failed to fetch cart");
        })
        .then((data) => {
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
      // ✅ If guest, use localStorage
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
    // Handle both API format (item.product.price) and localStorage format (item.price)
    const price = item.price || item.product?.price;
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
  const confirmDelete = confirm("Bạn có chắc muốn xóa sản phẩm này?");
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
