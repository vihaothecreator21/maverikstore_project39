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

  loading.classList.remove("d-none");
  content.classList.add("d-none");
  empty.classList.add("d-none");

  try {
    const cart = JSON.parse(localStorage.getItem("maverik_cart") || "[]");

    // Simulate loading delay for smooth UI
    setTimeout(() => {
      if (cart.length > 0) {
        renderCartItems(cart);
      } else {
        showEmptyState();
      }
    }, 200);
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
    totalPrice += item.price * item.quantity;

    html += `
      <div class="cart-item-row" id="cart-item-row-${item.id}">
        <img src="${item.imageUrl}" alt="${item.name}" class="ci-img" onerror="this.src='./assets/images/product-img-1.jpg'" />
        
        <div class="ci-info">
          <div class="ci-name">${item.name}</div>
          <div class="ci-variant">${item.size} ${item.color && item.color !== "Default" ? " / " + item.color : ""}</div>
          
          <div class="ci-qty-control mt-3">
            <button class="ci-qty-btn" onclick="updateItemQty(${item.id}, ${item.quantity - 1})">-</button>
            <input type="text" class="ci-qty-input" value="${item.quantity}" readonly />
            <button class="ci-qty-btn" onclick="updateItemQty(${item.id}, ${item.quantity + 1})">+</button>
          </div>
        </div>
        
        <div class="ci-price-col">
          <div class="ci-price">${formatVND(item.price)}đ</div>
          <div class="ci-total-label">Thành tiền:</div>
          <div class="ci-total">${formatVND(item.price * item.quantity)}đ</div>
          
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

window.updateItemQty = function (itemId, newQty) {
  if (newQty < 1) return;
  try {
    let cart = JSON.parse(localStorage.getItem("maverik_cart") || "[]");
    const idx = cart.findIndex((i) => i.id === itemId);
    if (idx > -1) {
      cart[idx].quantity = newQty;
      localStorage.setItem("maverik_cart", JSON.stringify(cart));

      loadFullCart();
      window.dispatchEvent(new Event("cartUpdatedGlobal"));
    }
  } catch (err) {
    // Silent fail
  }
};

window.removeCartItem = function (itemId) {
  const confirmDelete = confirm("Bạn có chắc muốn xóa sản phẩm này?");
  if (!confirmDelete) return;

  try {
    let cart = JSON.parse(localStorage.getItem("maverik_cart") || "[]");
    cart = cart.filter((i) => i.id !== itemId);
    localStorage.setItem("maverik_cart", JSON.stringify(cart));

    loadFullCart();
    window.dispatchEvent(new Event("cartUpdatedGlobal"));
  } catch (err) {
    // Silent fail
  }
};

document.getElementById("btn-goto-checkout")?.addEventListener("click", () => {
  const note = document.getElementById("order-note")?.value || "";
  localStorage.setItem("checkout_note", note);
  alert(
    "Tính năng Checkout chưa được kích hoạt. Sẽ thực hiện trong tương lai!",
  );
});

function formatVND(amount) {
  return new Intl.NumberFormat("vi-VN").format(amount);
}
