/**
 * checkout.js — Maverik Store
 * Xử lý luồng thanh toán: load cart → validate form → POST /api/v1/orders
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

// ── State ─────────────────────────────────────────────────────────
let cartItems = [];
let totalAmount = 0;

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("authToken");

  // Guard: Chưa đăng nhập
  if (!token) {
    showSection("auth-gate");
    return;
  }

  // Load cart từ API
  await loadCart(token);

  // Auto-fill thông tin giao hàng từ profile người dùng
  await prefillFromProfile(token);

  // Setup payment method selection
  setupPaymentCards();

  // Setup submit button
  document.getElementById("btn-place-order")?.addEventListener("click", handlePlaceOrder);

  // Pre-fill từ localStorage nếu có ghi chú cũ
  const savedNote = localStorage.getItem("checkout_note");
  if (savedNote) {
    const noteEl = document.getElementById("order-note");
    if (noteEl) noteEl.value = savedNote;
    localStorage.removeItem("checkout_note");
  }
});

// ── Auto-fill thông tin từ profile ───────────────────────────
async function prefillFromProfile(token) {
  try {
    const res = await fetch(`${API_BASE}/users/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return; // Silently fail — user sẽ nhập tay

    const data = await res.json();
    const user = data.data;
    if (!user) return;

    let filled = 0;
    const nameEl  = document.getElementById("shipping-name");
    const phoneEl = document.getElementById("shipping-phone");
    const addrEl  = document.getElementById("shipping-address");

    if (nameEl && user.username && !nameEl.value) {
      nameEl.value = user.username;
      filled++;
    }
    if (phoneEl && user.phone && !phoneEl.value) {
      phoneEl.value = user.phone;
      filled++;
    }
    if (addrEl && user.address && !addrEl.value) {
      addrEl.value = user.address;
      filled++;
    }

    // Hiện banner nếu có ít nhất 1 field được điền
    if (filled > 0) {
      const banner = document.getElementById("prefill-banner");
      if (banner) banner.classList.remove("d-none");
    }
  } catch {
    // Không throw — checkout vẫn tiếp tục bình thường
  }
}

// ── Load Cart ─────────────────────────────────────────────────────
async function loadCart(token) {
  try {
    const res = await fetch(`${API_BASE}/cart`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      // Token hết hạn hoặc không hợp lệ
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      showSection("auth-gate");
      return;
    }

    if (!res.ok) throw new Error("Failed to fetch cart");

    const data = await res.json();
    cartItems = data.data?.items || [];

    if (cartItems.length === 0) {
      showSection("empty");
      return;
    }

    // Tính total
    totalAmount = cartItems.reduce((sum, item) => {
      const price = Number(item.product?.price ?? item.itemTotal / item.quantity ?? 0);
      return sum + price * item.quantity;
    }, 0);

    renderSummary();
    showSection("content");
  } catch (err) {
    console.error("Load cart error:", err);
    showToast("❌ Không thể tải giỏ hàng. Vui lòng thử lại.", "error");
    showSection("empty");
  }
}

// ── Render Order Summary ──────────────────────────────────────────
function renderSummary() {
  const listEl = document.getElementById("summary-items-list");
  const countEl = document.getElementById("summary-count");
  const subtotalEl = document.getElementById("sum-subtotal");
  const totalEl = document.getElementById("sum-total");

  let totalQty = 0;
  let html = "";

  cartItems.forEach((item) => {
    const price = Number(item.product?.price ?? 0);
    const name = item.product?.name ?? "Sản phẩm";
    const imageUrl = item.product?.imageUrl ?? "./assets/images/product-img-1.jpg";
    totalQty += item.quantity;

    html += `
      <div class="summary-item">
        <div style="position:relative; flex-shrink:0;">
          <img src="${imageUrl}" alt="${name}" class="summary-item-img"
            onerror="this.src='./assets/images/product-img-1.jpg'" />
          <span class="item-qty-badge">${item.quantity}</span>
        </div>
        <div class="summary-item-info">
          <div class="summary-item-name">${name}</div>
          <div class="summary-item-variant">${item.size ?? ""}${item.color && item.color !== "Default" ? " / " + item.color : ""}</div>
          <div class="summary-item-price">${formatVND(price * item.quantity)}đ</div>
        </div>
      </div>
    `;
  });

  listEl.innerHTML = html;
  countEl.textContent = totalQty;
  subtotalEl.textContent = formatVND(totalAmount) + "đ";
  totalEl.textContent = formatVND(totalAmount) + "đ";
}

// ── Payment Card Selection ────────────────────────────────────────
function setupPaymentCards() {
  document.querySelectorAll(".payment-card").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".payment-card").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      const radio = card.querySelector("input[type='radio']");
      if (radio) radio.checked = true;
    });
  });
}

// ── Place Order ───────────────────────────────────────────────────
async function handlePlaceOrder() {
  // 1. Validate form
  const name = document.getElementById("shipping-name")?.value.trim();
  const phone = document.getElementById("shipping-phone")?.value.trim();
  const address = document.getElementById("shipping-address")?.value.trim();
  const note = document.getElementById("order-note")?.value.trim();
  const paymentMethod = document.querySelector("input[name='payment']:checked")?.value ?? "COD";

  let hasError = false;

  // Validate name
  const nameEl = document.getElementById("shipping-name");
  if (!name || name.length < 2) {
    nameEl.classList.add("is-invalid");
    hasError = true;
  } else {
    nameEl.classList.remove("is-invalid");
  }

  // Validate phone (VN format)
  const phoneEl = document.getElementById("shipping-phone");
  const phoneClean = phone.replace(/[\s\-\.]/g, "");
  if (!phone || !/^(\+84|84|0)[0-9]{8,10}$/.test(phoneClean)) {
    phoneEl.classList.add("is-invalid");
    hasError = true;
  } else {
    phoneEl.classList.remove("is-invalid");
  }

  // Validate address (min 10 ký tự)
  const addrEl = document.getElementById("shipping-address");
  if (!address || address.length < 10) {
    addrEl.classList.add("is-invalid");
    hasError = true;
  } else {
    addrEl.classList.remove("is-invalid");
  }

  if (hasError) {
    showToast("⚠️ Vui lòng kiểm tra lại thông tin", "error");
    // Scroll to first error
    document.querySelector(".is-invalid")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  // 2. Build request body — phone đã chuẩn hóa
  const orderPayload = {
    shippingAddress: address,
    shippingPhone: phoneClean.startsWith("0")
      ? "+84" + phoneClean.slice(1)
      : phoneClean.startsWith("84")
      ? "+" + phoneClean
      : phoneClean,
    paymentMethod,
    ...(note && { note }),
  };

  // 3. Submit
  const btn = document.getElementById("btn-place-order");
  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Đang xử lý...`;

  try {
    const token = localStorage.getItem("authToken");
    const res = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const data = await res.json();

    if (!res.ok || data.status !== "success") {
      const message = data.message || "Đặt hàng thất bại. Vui lòng thử lại.";
      showToast("❌ " + message, "error");
      btn.disabled = false;
      btn.innerHTML = originalHTML;
      return;
    }

    const order = data.data;

    // ── VNPay: redirect sang cổng thanh toán ───────────────────────
    if (paymentMethod === "VNPAY") {
      btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Đang chuyển đến VNPay...`;

      const payRes = await fetch(
        `${API_BASE}/payments/vnpay/create?orderId=${order.id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const payData = await payRes.json();

      if (!payRes.ok || !payData.data?.paymentUrl) {
        showToast("❌ Không thể tạo liên kết thanh toán VNPay. Vui lòng thử lại.", "error");
        btn.disabled = false;
        btn.innerHTML = originalHTML;
        return;
      }

      // Redirect sang VNPay Sandbox
      window.location.href = payData.data.paymentUrl;
      return;
    }

    // ── COD / MOMO / BANK_TRANSFER: hiển thị success thẳng ─────────
    document.getElementById("success-order-id").textContent = `#${order.id}`;
    document.getElementById("co-content").classList.add("d-none");
    document.getElementById("co-success").classList.add("show");
    document.getElementById("step3")?.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });

  } catch (err) {
    console.error("Place order error:", err);
    showToast("❌ Lỗi kết nối. Vui lòng thử lại.", "error");
    btn.disabled = false;
    btn.innerHTML = originalHTML;
  }
}

// ── Helpers ───────────────────────────────────────────────────────
function showSection(section) {
  document.getElementById("co-loading")?.classList.add("d-none");
  document.getElementById("co-auth-gate")?.classList.add("d-none");
  document.getElementById("co-empty")?.classList.add("d-none");
  document.getElementById("co-content")?.classList.add("d-none");
  document.getElementById("co-success")?.classList.remove("show");

  if (section === "content") {
    document.getElementById("co-content")?.classList.remove("d-none");
  } else if (section === "auth-gate") {
    document.getElementById("co-auth-gate")?.classList.remove("d-none");
  } else if (section === "empty") {
    document.getElementById("co-empty")?.classList.remove("d-none");
  }
}

function formatVND(amount) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(amount));
}

let toastTimer;
function showToast(msg, type = "default") {
  const toast = document.getElementById("co-toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `co-toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 4000);
}
