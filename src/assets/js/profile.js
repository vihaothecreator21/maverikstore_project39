/**
 * profile.js — Maverik Store
 * Trang cài đặt tài khoản:
 *   Tab 1: Thông tin cá nhân (sửa name/email/phone/address)
 *   Tab 2: Đổi mật khẩu
 *   Tab 3: Lịch sử đơn hàng
 */

const getApiBase = () => {
  const isDev =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  return isDev ? "http://localhost:5000/api/v1" : `${window.location.origin}/api/v1`;
};
const API_BASE = getApiBase();

// ── State ─────────────────────────────────────────────────────────
let currentUser = null;
let authToken   = null;

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  authToken = localStorage.getItem("authToken");

  // Guard — phải đăng nhập
  if (!authToken) {
    sessionStorage.setItem("redirectAfterLogin", "profile.html");
    window.location.href = "login.html";
    return;
  }

  // Load profile
  await loadProfile();

  // Load orders (tab 3 lazy)
  setupTabs();
  setupProfileForm();
  setupPasswordForm();

  // ── Deep link: profile.html#orders → mở tab đơn hàng ngay ──
  if (window.location.hash === "#orders") {
    const ordersTab = document.querySelector('[data-tab="tab-orders"]');
    if (ordersTab) {
      ordersTab.click(); // Trigger tab switch + loadOrders()
    }
  }
});

// ── Load Profile ───────────────────────────────────────────────────
async function loadProfile() {
  try {
    const res = await fetch(`${API_BASE}/users/profile`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (res.status === 401) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      window.location.href = "login.html";
      return;
    }

    const data = await res.json();
    currentUser = data.data;

    // Update localStorage
    localStorage.setItem("user", JSON.stringify(currentUser));

    // Fill UI
    fillProfileUI(currentUser);
  } catch {
    showToast("❌ Không thể tải thông tin tài khoản", "error");
  }
}

function fillProfileUI(user) {
  // Avatar initials
  const initials = (user.username || "U")
    .split("_")
    .map((w) => w[0]?.toUpperCase() || "")
    .slice(0, 2)
    .join("");
  const avatarEl = document.getElementById("avatar-initials");
  if (avatarEl) avatarEl.textContent = initials;

  // Header name/email
  setEl("profile-name",  user.username || "—");
  setEl("profile-email", user.email    || "—");
  setEl("profile-role",  user.role === "ADMIN" ? "Quản trị viên" : "Khách hàng");

  // Form fields
  setVal("inp-fullname",  user.username || "");
  setVal("inp-email",     user.email    || "");
  setVal("inp-phone",     user.phone    || "");
  setVal("inp-address",   user.address  || "");
}

// ── Tabs ──────────────────────────────────────────────────────────
function setupTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  const panes = document.querySelectorAll(".tab-pane");

  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      panes.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const targetId = btn.dataset.tab;
      const pane = document.getElementById(targetId);
      if (pane) pane.classList.add("active");

      // Lazy load orders on tab open
      if (targetId === "tab-orders") {
        loadOrders();
      }
    });
  });
}

// ── Profile Form ─────────────────────────────────────────────────
function setupProfileForm() {
  document.getElementById("form-profile")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fullName = document.getElementById("inp-fullname")?.value.trim();
    const email    = document.getElementById("inp-email")?.value.trim();
    const phone    = document.getElementById("inp-phone")?.value.trim();
    const address  = document.getElementById("inp-address")?.value.trim() || null;

    // Validate
    let hasError = false;
    if (!fullName || fullName.length < 2) { markError("inp-fullname"); hasError = true; } else clearError("inp-fullname");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { markError("inp-email"); hasError = true; } else clearError("inp-email");
    if (!phone || !/^(\+84|84|0)[0-9]{8,10}$/.test(phone.replace(/[\s\-.]/g,""))) { markError("inp-phone"); hasError = true; } else clearError("inp-phone");

    if (hasError) {
      showToast("⚠️ Kiểm tra lại thông tin", "error");
      return;
    }

    const btn = document.getElementById("btn-save-profile");
    btn.disabled = true;
    btn.textContent = "Đang lưu...";

    try {
      const res = await fetch(`${API_BASE}/users/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ fullName, email, phone, address }),
      });
      const data = await res.json();

      if (res.ok && data.status === "success") {
        currentUser = data.data;
        localStorage.setItem("user", JSON.stringify(currentUser));
        fillProfileUI(currentUser);
        showToast("✅ Cập nhật thông tin thành công!", "success");
      } else {
        showToast(`❌ ${data.message || "Cập nhật thất bại"}`, "error");
      }
    } catch {
      showToast("❌ Lỗi kết nối. Vui lòng thử lại.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Lưu thay đổi";
    }
  });
}

// ── Password Form ─────────────────────────────────────────────────
function setupPasswordForm() {
  document.getElementById("form-password")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const current  = document.getElementById("inp-cur-pw")?.value;
    const newPw    = document.getElementById("inp-new-pw")?.value;
    const confirm  = document.getElementById("inp-confirm-pw")?.value;

    let hasError = false;
    if (!current)         { markError("inp-cur-pw");     hasError = true; } else clearError("inp-cur-pw");
    if (!newPw || newPw.length < 8) { markError("inp-new-pw"); hasError = true; } else clearError("inp-new-pw");
    if (newPw !== confirm) { markError("inp-confirm-pw"); hasError = true; } else clearError("inp-confirm-pw");

    if (hasError) {
      showToast("⚠️ Kiểm tra lại mật khẩu", "error");
      return;
    }

    const btn = document.getElementById("btn-change-pw");
    btn.disabled = true;
    btn.textContent = "Đang xử lý...";

    try {
      const res = await fetch(`${API_BASE}/users/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ currentPassword: current, newPassword: newPw }),
      });
      const data = await res.json();

      if (res.ok && data.status === "success") {
        document.getElementById("form-password").reset();
        showToast("✅ Đổi mật khẩu thành công!", "success");
      } else {
        showToast(`❌ ${data.message || "Đổi mật khẩu thất bại"}`, "error");
      }
    } catch {
      showToast("❌ Lỗi kết nối. Vui lòng thử lại.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Đổi mật khẩu";
    }
  });
}

// ── Load Orders ─────────────────────────────────────────────────
let ordersLoaded = false;
async function loadOrders() {
  if (ordersLoaded) return;
  const container = document.getElementById("orders-list");
  if (!container) return;

  container.innerHTML = `<div style="text-align:center;padding:32px;"><div class="spinner-ring"></div><p style="margin-top:10px;font-size:.85rem;color:#aaa;">Đang tải đơn hàng...</p></div>`;

  try {
    const res = await fetch(`${API_BASE}/orders?limit=50`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();
    const orders = data.data?.orders || [];

    if (orders.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:48px 20px; color:#aaa;">
          <i class="bi bi-bag-x" style="font-size:2.8rem;"></i>
          <p style="margin-top:12px;font-size:.9rem;">Bạn chưa có đơn hàng nào</p>
          <a href="products.html" class="btn-small" style="margin-top:12px;display:inline-block;">Mua sắm ngay</a>
        </div>`;
      return;
    }

    const STATUS_MAP = {
      PENDING:    { label: "Chờ xác nhận", color: "#f59e0b" },
      CONFIRMED:  { label: "Đã xác nhận",  color: "#3b82f6" },
      PROCESSING: { label: "Đang xử lý",   color: "#6366f1" },
      SHIPPING:   { label: "Đang giao",    color: "#0ea5e9" },
      DELIVERED:  { label: "Đã giao",      color: "#22c55e" },
      COMPLETED:  { label: "Hoàn thành",   color: "#16a34a" },
      CANCELLED:  { label: "Đã hủy",       color: "#ef4444" },
      RETURNED:   { label: "Hoàn trả",     color: "#f97316" },
    };

    container.innerHTML = orders.map((o) => {
      const s     = STATUS_MAP[o.status] || { label: o.status, color: "#888" };
      const date  = new Date(o.createdAt).toLocaleDateString("vi-VN");
      const total = new Intl.NumberFormat("vi-VN").format(Math.round(Number(o.totalAmount)));

      // Items list
      const itemsHtml = (o.details || []).map((d) => `
        <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #f5f5f5;">
          <img src="${d.product?.imageUrl || ''}" alt="" onerror="this.style.display='none'"
            style="width:40px;height:50px;object-fit:cover;background:#f5f5f5;flex-shrink:0;" />
          <div style="flex:1;min-width:0;">
            <div style="font-size:.82rem;font-weight:600;">${d.product?.name || "Sản phẩm"}</div>
            <div style="font-size:.75rem;color:#aaa;">${d.size || ""}${d.color ? " / " + d.color : ""} × ${d.quantity}</div>
          </div>
          <div style="font-size:.82rem;font-weight:700;flex-shrink:0;">
            ${new Intl.NumberFormat("vi-VN").format(Math.round(Number(d.priceAtPurchase || 0)))}đ
          </div>
        </div>`).join("") || `<p style="color:#aaa;font-size:.82rem;">Không có thông tin sản phẩm</p>`;

      return `
        <div class="order-card" id="order-${o.id}">
          <div class="order-card-header" style="cursor:pointer;" onclick="toggleOrderDetail(${o.id})">
            <span class="order-id">#${o.id}</span>
            <span class="order-date">${date}</span>
            <span class="order-status" style="color:${s.color}; border:1px solid ${s.color}; padding:2px 10px; font-size:.72rem; font-weight:600;">${s.label}</span>
            <span style="margin-left:auto;font-size:.82rem;color:#aaa;" id="arrow-${o.id}">▼</span>
          </div>
          <div class="order-card-body" style="justify-content:space-between;">
            <span style="font-size:.82rem;color:#888;">${o.payment?.paymentMethod ?? "COD"}</span>
            <span class="order-total"><strong>${total}đ</strong></span>
          </div>
          <!-- Expandable detail -->
          <div id="detail-${o.id}" style="display:none;padding:14px 16px 16px;border-top:1px solid #f0f0f0;">
            <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#aaa;margin-bottom:10px;">Chi tiết đơn hàng</div>
            ${itemsHtml}
            <div style="margin-top:12px;font-size:.8rem;color:#888;">
              <i class="bi bi-geo-alt" style="margin-right:4px;"></i>${o.shippingAddress || "—"}
              &nbsp;·&nbsp;
              <i class="bi bi-telephone" style="margin-right:4px;"></i>${o.shippingPhone || "—"}
            </div>
            ${o.note ? `<div style="margin-top:6px;font-size:.78rem;color:#aaa;"><strong>Ghi chú:</strong> ${o.note}</div>` : ""}
          </div>
        </div>`;
    }).join("");

    ordersLoaded = true;
  } catch {
    container.innerHTML = `<p style="color:#e53935;text-align:center;padding:24px;">Không thể tải đơn hàng. Vui lòng thử lại.</p>`;
  }
}

window.toggleOrderDetail = function(id) {
  const detail = document.getElementById(`detail-${id}`);
  const arrow  = document.getElementById(`arrow-${id}`);
  if (!detail) return;
  const isOpen = detail.style.display === "block";
  detail.style.display = isOpen ? "none" : "block";
  if (arrow) arrow.textContent = isOpen ? "▼" : "▲";
};

// ── Logout ────────────────────────────────────────────────────────
document.getElementById("btn-logout")?.addEventListener("click", () => {
  localStorage.removeItem("authToken");
  localStorage.removeItem("user");
  localStorage.removeItem("userEmail");
  localStorage.removeItem("maverik_cart");
  window.location.href = "index.html";
});

// ── Helpers ───────────────────────────────────────────────────────
const setEl  = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
const markError  = (id) => document.getElementById(id)?.classList.add("is-invalid");
const clearError = (id) => document.getElementById(id)?.classList.remove("is-invalid");

let _toastTimer;
function showToast(msg, type = "default") {
  let toast = document.getElementById("profile-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "profile-toast";
    toast.style.cssText = [
      "position:fixed; bottom:28px; right:28px; z-index:9999",
      "padding:14px 22px; font-size:.88rem; font-weight:500",
      "border-radius:4px; box-shadow:0 8px 32px rgba(0,0,0,.18)",
      "transform:translateY(20px); opacity:0; transition:all .3s",
      "max-width:360px; color:#fff",
    ].join(";");
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.background = type === "error" ? "#c43228" : type === "success" ? "#2e7d32" : "#1a1a1a";
  toast.style.opacity = "1";
  toast.style.transform = "translateY(0)";
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(20px)";
  }, 4000);
}
