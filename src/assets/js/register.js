/**
 * register.js — Maverik Store
 * Xử lý đăng ký tài khoản: validate → POST /api/v1/auth/register
 *
 * Address là TÙY CHỌN — có thể bổ sung sau tại trang Tài khoản
 */

const getApiBase = () => {
  const isDev =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  return isDev ? "http://localhost:5000/api/v1" : `${window.location.origin}/api/v1`;
};
const API_BASE = getApiBase();

document.addEventListener("DOMContentLoaded", () => {
  // Redirect nếu đã đăng nhập
  if (localStorage.getItem("authToken")) {
    window.location.href = "index.html";
    return;
  }

  setupPasswordToggles();

  document.getElementById("registerForm")?.addEventListener("submit", handleRegister);
});

// ── Toggle password visibility ──────────────────────────────
function setupPasswordToggles() {
  const pairs = [
    { btn: "togglePassword1", input: "registerPassword" },
    { btn: "togglePassword2", input: "confirmPassword"  },
  ];
  pairs.forEach(({ btn, input }) => {
    document.getElementById(btn)?.addEventListener("click", function () {
      const el   = document.getElementById(input);
      const icon = this.querySelector("i");
      if (!el || !icon) return;
      const isHidden = el.type === "password";
      el.type = isHidden ? "text" : "password";
      icon.classList.toggle("bi-eye",       !isHidden);
      icon.classList.toggle("bi-eye-slash",  isHidden);
    });
  });
}

// ── Main Register Handler ────────────────────────────────────
async function handleRegister(e) {
  e.preventDefault();

  const fullName  = document.getElementById("fullName")?.value.trim();
  const email     = document.getElementById("registerEmail")?.value.trim();
  const phone     = document.getElementById("phone")?.value.trim();
  const address   = document.getElementById("address")?.value.trim() || null; // Optional
  const password  = document.getElementById("registerPassword")?.value;
  const confirm   = document.getElementById("confirmPassword")?.value;
  const newsletter = document.getElementById("newsletter")?.checked;

  // ── Validate ───────────────────────────────────────────────
  let hasError = false;
  const setError = (id, msg) => {
    const el = document.getElementById(id);
    const fb = document.getElementById(id + "Error");
    if (el) el.classList.add("is-invalid");
    if (fb && msg) fb.textContent = msg;
    hasError = true;
  };
  const clearError = (id) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("is-invalid");
  };

  // Họ tên
  if (!fullName || fullName.length < 2) {
    setError("fullName", "Họ tên phải có ít nhất 2 ký tự");
  } else clearError("fullName");

  // Email
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setError("registerEmail", "Email không hợp lệ");
  } else clearError("registerEmail");

  // SĐT Việt Nam
  const phoneClean = phone.replace(/[\s\-\.]/g, "");
  if (!phone || !/^(\+84|84|0)[0-9]{8,10}$/.test(phoneClean)) {
    setError("phone", "Số điện thoại không hợp lệ (VD: 0912345678)");
  } else clearError("phone");

  // Address (optional — chỉ validate nếu có nhập)
  if (address && address.length < 10) {
    setError("address", "Địa chỉ phải có ít nhất 10 ký tự (nếu điền)");
    hasError = true;
  } else clearError("address");

  // Password strength
  const pwOk =
    password &&
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password);
  if (!pwOk) {
    setError("registerPassword", "Mật khẩu phải có ≥8 ký tự, chữ hoa, thường và số");
  } else clearError("registerPassword");

  // Confirm password
  if (password !== confirm) {
    setError("confirmPassword", "Mật khẩu xác nhận không khớp");
  } else clearError("confirmPassword");

  if (hasError) {
    showToast("⚠️ Vui lòng kiểm tra lại thông tin", "error");
    return;
  }

  // ── Submit ─────────────────────────────────────────────────
  const btn     = document.querySelector('button[type="submit"]');
  const spinner = document.getElementById("registerSpinner");
  const btnText = document.getElementById("registerBtnText");
  btn.disabled = true;
  if (spinner) spinner.style.display = "inline-block";
  if (btnText) btnText.textContent = "Đang tạo tài khoản...";

  // Chuẩn hóa SĐT → +84 format
  const normalizedPhone = phoneClean.startsWith("0")
    ? "+84" + phoneClean.slice(1)
    : phoneClean.startsWith("84")
    ? "+" + phoneClean
    : phoneClean;

  const payload = {
    fullName,
    email,
    phone: normalizedPhone,
    password,
    acceptNewsletter: newsletter,
    ...(address ? { address } : {}), // chỉ gửi nếu có
  };

  try {
    const res  = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (res.ok && data.status === "success") {
      showToast("✅ Tạo tài khoản thành công! Đang chuyển sang đăng nhập...", "success");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1500);
    } else {
      // Hiển thị lỗi từ server (vd: email đã tồn tại)
      const msg = data.message || "Đăng ký thất bại. Vui lòng thử lại.";
      showToast(`❌ ${msg}`, "error");
      btn.disabled = false;
      if (spinner) spinner.style.display = "none";
      if (btnText) btnText.textContent = "Tạo tài khoản";
    }
  } catch {
    showToast("❌ Lỗi kết nối. Vui lòng thử lại.", "error");
    btn.disabled = false;
    if (spinner) spinner.style.display = "none";
    if (btnText) btnText.textContent = "Tạo tài khoản";
  }
}

// ── Toast notification ──────────────────────────────────────
let _toastTimer;
function showToast(msg, type = "default") {
  let toast = document.getElementById("reg-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "reg-toast";
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
  }, 4500);
}
