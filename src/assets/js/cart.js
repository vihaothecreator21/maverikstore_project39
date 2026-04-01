

document.addEventListener("DOMContentLoaded", () => {
  injectCartOffcanvas();
  fetchCart();

  window.addEventListener("cartUpdated", fetchCart);
});

function injectCartOffcanvas() {
  const navContainer = document.querySelector(".navbar .d-flex.align-items-center.gap-4");
  if (!navContainer) return;

  // Insert Cart Styling
  const style = document.createElement("style");
  style.innerHTML = `
    .nav-cart-btn {
      position: relative;
      background: none;
      border: none;
      padding: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
    }
    .cart-badge {
      position: absolute;
      top: -4px;
      right: -8px;
      background: #000;
      color: #fff;
      font-size: 0.65rem;
      font-weight: 700;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cart-offcanvas {
      width: 400px !important;
      border-left: none;
    }
    .cart-offcanvas .offcanvas-header {
      border-bottom: 1px solid #f0f0f0;
      padding: 1.25rem 1.5rem;
    }
    .cart-offcanvas .offcanvas-title {
      font-size: 1.1rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .cart-offcanvas .offcanvas-body {
      padding: 0;
      display: flex;
      flex-direction: column;
    }
    .cart-items-wrapper-oc {
      flex: 1;
      overflow-y: auto;
    }
    .oc-item {
      display: flex;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #f9f9f9;
      position: relative;
    }
    .oc-item img {
      width: 72px;
      height: 88px;
      object-fit: cover;
      background: #f5f5f5;
    }
    .oc-item-info {
      padding-left: 1rem;
      flex: 1;
    }
    .oc-name {
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 4px;
      line-height: 1.4;
      padding-right: 20px;
    }
    .oc-variant {
      font-size: 0.8rem;
      color: #888;
      margin-bottom: 8px;
    }
    .oc-price-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .oc-qty {
      font-size: 0.85rem;
      padding: 2px 8px;
      background: #f5f5f5;
      border-radius: 2px;
    }
    .oc-price {
      font-size: 0.95rem;
      font-weight: 700;
    }
    .oc-remove {
      position: absolute;
      top: 1rem;
      right: 1.5rem;
      background: none;
      border: none;
      font-size: 1.25rem;
      color: #999;
      cursor: pointer;
      line-height: 1;
      transition: color 0.2s;
    }
    .oc-remove:hover {
      color: #000;
    }
    .oc-empty {
      padding: 3rem 1.5rem;
      text-align: center;
      color: #777;
    }
    .oc-footer {
      padding: 1.5rem;
      background: #fafafa;
      border-top: 1px solid #eaeaea;
    }
    .oc-total-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 1rem;
      font-size: 1rem;
    }
    .oc-total-val {
      font-weight: 700;
      color: #ff0000;
    }
  `;
  document.head.appendChild(style);

  // Button in Navbar
  const btnWrapper = document.createElement("div");
  btnWrapper.innerHTML = `
    <button class="nav-cart-btn" data-bs-toggle="offcanvas" data-bs-target="#cartOffcanvas">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="21" r="1"></circle>
        <circle cx="20" cy="21" r="1"></circle>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
      </svg>
      <span class="cart-badge" id="navCartBadge">0</span>
    </button>
  `;
  navContainer.appendChild(btnWrapper);

  // Offcanvas Container at end of body
  const ocWrapper = document.createElement("div");
  ocWrapper.innerHTML = `
    <div class="offcanvas offcanvas-end cart-offcanvas" tabindex="-1" id="cartOffcanvas" aria-labelledby="cartOffcanvasLabel">
      <div class="offcanvas-header">
        <h5 class="offcanvas-title" id="cartOffcanvasLabel">Giỏ hàng của bạn</h5>
        <button type="button" class="btn-close text-reset" data-bs-dismiss="offcanvas" aria-label="Close"></button>
      </div>
      <div class="offcanvas-body">
        <div class="cart-items-wrapper-oc" id="ocCartBody">
          <div class="oc-empty">
            <i class="bi bi-cart3" style="font-size:2.5rem;color:#ccc;margin-bottom:12px;display:block;"></i>
            Đang tải dữ liệu...
          </div>
        </div>
        <div class="oc-footer d-none" id="ocCartFooter">
          <div class="oc-total-row">
            <span>TỔNG TIỀN:</span>
            <span class="oc-total-val" id="ocCartTotal">0đ</span>
          <div class="d-flex gap-2 w-100 mt-3 p-3 pt-0">
            <!-- No URL for checkout yet -->
            <a href="cart.html" class="btn btn-outline-dark rounded-0 fw-bold flex-fill py-3 text-uppercase" style="letter-spacing: .08em; font-size: 0.85rem;">XEM GIỎ HÀNG</a>
            <a href="#" class="btn btn-dark rounded-0 fw-bold flex-fill py-3 text-uppercase" style="letter-spacing: .08em; font-size: 0.85rem;">THANH TOÁN</a>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(ocWrapper);
}

// Read from localStorage
function fetchCart() {
  const bodyEl = document.getElementById("ocCartBody");
  const badgeEl = document.getElementById("navCartBadge");
  const footerEl = document.getElementById("ocCartFooter");
  const totalEl = document.getElementById("ocCartTotal");

  try {
    const cart = JSON.parse(localStorage.getItem("maverik_cart") || "[]");
    
    // Calculate totals
    let totalItems = 0;
    let totalPrice = 0;
    cart.forEach(item => {
      totalItems += item.quantity;
      totalPrice += item.price * item.quantity;
    });

    if (badgeEl) badgeEl.textContent = totalItems.toString();
    
    if (cart.length > 0) {
      let html = "";
      cart.forEach(item => {
        html += `
          <div class="oc-item">
            <img src="${item.imageUrl}" alt="${item.name}" onerror="this.src='./assets/images/product-img-1.jpg'" />
            <div class="oc-item-info">
              <div class="oc-name">${item.name}</div>
              <div class="oc-variant">${item.size} / ${item.color || 'Default'}</div>
              <div class="oc-price-row">
                <span class="oc-qty">${item.quantity}</span>
                <span class="oc-price">${formatVND(item.price)}đ</span>
              </div>
            </div>
            <button class="oc-remove" onclick="removeCartItemOc(${item.id})">×</button>
          </div>
        `;
      });
      if(bodyEl) bodyEl.innerHTML = html;
      if(footerEl) footerEl.classList.remove("d-none");
      if(totalEl) totalEl.textContent = formatVND(totalPrice) + "đ";
    } else {
      if(bodyEl) {
        bodyEl.innerHTML = `
          <div class="oc-empty">
            <i class="bi bi-cart3" style="font-size:2.5rem;color:#ccc;margin-bottom:12px;display:block;"></i>
            Hiện chưa có sản phẩm
          </div>
        `;
      }
      if(footerEl) footerEl.classList.add("d-none");
    }
  } catch (err) {
    console.error("Cart rendering error:", err);
  }
}

function formatVND(amount) {
  return new Intl.NumberFormat("vi-VN").format(amount);
}

// Global remove method for the offcanvas
window.removeCartItemOc = function(itemId) {
  try {
    let cart = JSON.parse(localStorage.getItem("maverik_cart") || "[]");
    cart = cart.filter(item => item.id !== itemId);
    localStorage.setItem("maverik_cart", JSON.stringify(cart));
    
    fetchCart();
    window.dispatchEvent(new Event("cartUpdatedGlobal"));
  } catch (err) {
    console.error("Failed to remove item", err);
  }
};
