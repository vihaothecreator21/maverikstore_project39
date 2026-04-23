/**
 * login.js — Maverik Store
 * Xử lý đăng nhập: validate → POST /api/v1/auth/login → redirect theo role
 *
 * Thay thế JS inline trong login.html
 */

import { syncCartAfterLogin } from "./auth-utils.js";

const getApiBase = () => {
  const isDev =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  return isDev ? "http://localhost:5000/api/v1" : `${window.location.origin}/api/v1`;
};
const API_BASE = getApiBase();

// ── Auto-fill email nếu "Nhớ tôi" đã được check trước đó ──
document.addEventListener("DOMContentLoaded", () => {
  // Redirect nếu đã đăng nhập
  const token = localStorage.getItem("authToken");
  const user  = JSON.parse(localStorage.getItem("user") || "{}");
  if (token && user?.role) {
    _redirectByRole(user.role);
    return;
  }

  // Restore remembered email
  const savedEmail = localStorage.getItem("userEmail");
  if (savedEmail) {
    const el = document.getElementById("email");
    const rm = document.getElementById("rememberMe");
    if (el) el.value = savedEmail;
    if (rm) rm.checked = true;
  }

  // Toggle password visibility
  const toggleBtn = document.getElementById("togglePassword");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const input = document.getElementById("password");
      const icon  = toggleBtn.querySelector("i");
      if (!input || !icon) return;
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      icon.classList.toggle("bi-eye",       !isHidden);
      icon.classList.toggle("bi-eye-slash",  isHidden);
    });
  }

  // Form submit
  document.getElementById("loginForm")?.addEventListener("submit", handleLogin);
});

// ── Main Login Handler ─────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const form = e.currentTarget;

  const email    = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value;
  const remember = document.getElementById("rememberMe")?.checked;

  // Client-side validation
  let hasError = false;
  const emailEl    = document.getElementById("email");
  const passwordEl = document.getElementById("password");

  const emailIsValid = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailIsValid) {
    emailEl.classList.add("is-invalid");
    hasError = true;
  } else {
    emailEl.classList.remove("is-invalid");
  }

  if (!password || password.length < 1) {
    passwordEl.classList.add("is-invalid");
    hasError = true;
  } else {
    passwordEl.classList.remove("is-invalid");
  }

  if (hasError) return;

  // Show loading
  const btn     = form.querySelector('button[type="submit"]');
  const spinner = document.getElementById("loginSpinner");
  const btnText = document.getElementById("loginBtnText");
  btn.disabled = true;
  if (spinner) spinner.style.display = "inline-block";
  if (btnText) btnText.textContent = "Đang đăng nhập...";

  try {
    const res  = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (res.ok && data.status === "success") {
      const { token, user } = data.data;

      // Lưu thông tin auth
      localStorage.setItem("authToken", token);
      localStorage.setItem("user", JSON.stringify(user));
      if (remember) {
        localStorage.setItem("userEmail", email);
      } else {
        localStorage.removeItem("userEmail");
      }

      // Sync giỏ hàng localStorage → server
      await syncCartAfterLogin(token);

      showToast("Đăng nhập thành công! Đang chuyển hướng...", "success");

      // Redirect theo role sau 800ms
      setTimeout(() => _redirectByRole(user.role), 800);
    } else {
      const msg = data.message || "Đăng nhập thất bại. Vui lòng thử lại.";
      showToast(`❌ ${msg}`, "error");
      btn.disabled = false;
      if (spinner) spinner.style.display = "none";
      if (btnText) btnText.textContent = "Đăng nhập";
    }
  } catch {
    showToast("❌ Lỗi kết nối. Vui lòng thử lại.", "error");
    btn.disabled = false;
    if (spinner) spinner.style.display = "none";
    if (btnText) btnText.textContent = "Đăng nhập";
  }
}

// ── Redirect theo role ──────────────────────────────────────
function _redirectByRole(role) {
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    window.location.href = "/admin/index.html";
  } else {
    // Về trang trước nếu có, nếu không về trang chủ
    const prevPage = sessionStorage.getItem("redirectAfterLogin") || "index.html";
    sessionStorage.removeItem("redirectAfterLogin");
    window.location.href = prevPage;
  }
}

// ── Toast notification ──────────────────────────────────────
let _toastTimer;
function showToast(msg, type = "default") {
  let toast = document.getElementById("login-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "login-toast";
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
