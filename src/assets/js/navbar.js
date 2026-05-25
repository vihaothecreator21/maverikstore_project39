import { Modal } from "bootstrap";
import { getApiBase } from "./api-config.js";
import { syncCartAfterLogin } from "./auth-utils.js";

const API_BASE = getApiBase();

/**
 * navbar.js - Navbar state management
 * Handle user login/logout UI updates across all pages
 *
 * Flow chính:
 * - DOMContentLoaded -> chuẩn hóa label navbar, mở modal nếu URL có ?login=1/?register=1.
 * - Login modal submit -> POST /auth/login, lưu authToken + user vào localStorage.
 * - Sau login gọi syncCartAfterLogin() để đẩy giỏ guest lên backend.
 * - Register modal submit -> request OTP, then verify OTP to create account.
 * - updateNavbarState() đổi nút Sign in thành dropdown user/logout.
 */

document.addEventListener("DOMContentLoaded", () => {
  updateActiveNavLink();
  refineNavbarLabels();
  setupTemplateAuthModal();
  openRequestedAuthModal();
  updateNavbarState();
  window.addEventListener("loginSuccess", updateNavbarState);
  window.addEventListener("logoutSuccess", updateNavbarState);
});

function updateActiveNavLink() {
  const currentPage = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  const normalizedPage = currentPage === "" ? "index.html" : currentPage;

  document.querySelectorAll(".navbar-custom .nav-link").forEach((link) => {
    const href = (link.getAttribute("href") || "").split("#")[0].split("?")[0].toLowerCase();
    const linkPage = href === "" ? "index.html" : href;
    const isActive = linkPage === normalizedPage;

    link.classList.toggle("active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function refineNavbarLabels() {
  const loginBtn = document.querySelector('[data-bs-target="#loginModal"]');
  if (loginBtn) {
    loginBtn.innerHTML = '<i class="bi bi-person"></i><span>Sign in</span>';
  }

  const userMenuBtn = document.getElementById("userMenuBtn");
  const userNameDisplay = document.getElementById("userNameDisplay");
  if (userMenuBtn && userNameDisplay) {
    userMenuBtn.innerHTML = "";
    userMenuBtn.appendChild(userNameDisplay);
  }
}

function openRequestedAuthModal() {
  const params = new URLSearchParams(window.location.search);
  const wantsLogin = params.get("login") === "1" || window.location.hash === "#login";
  const wantsRegister = params.get("register") === "1" || window.location.hash === "#register";
  const targetId = wantsRegister ? "registerModal" : wantsLogin ? "loginModal" : "";
  const target = targetId ? document.getElementById(targetId) : null;

  if (target) {
    Modal.getOrCreateInstance(target).show();
  }
}

function setupTemplateAuthModal() {
  document.getElementById("loginFormModal")?.addEventListener("submit", handleModalLogin, true);
  document.getElementById("registerFormModal")?.addEventListener("submit", handleModalRegister, true);
}

async function handleModalLogin(event) {
  event.preventDefault();
  event.stopImmediatePropagation();

  const form = event.currentTarget;
  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }

  const email = document.getElementById("loginEmailModal")?.value.trim();
  const password = document.getElementById("loginPasswordModal")?.value;
  const rememberMe = document.getElementById("rememberMeModal")?.checked;

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();

    if (response.ok && data.status === "success") {
      localStorage.setItem("authToken", data.data.token);
      localStorage.setItem("user", JSON.stringify(data.data.user));
      if (rememberMe) localStorage.setItem("userEmail", email);
      else localStorage.removeItem("userEmail");
      await syncCartAfterLogin(data.data.token);

      const nextPage = sessionStorage.getItem("redirectAfterLogin") || window.location.pathname.split("/").pop() || "index.html";
      sessionStorage.removeItem("redirectAfterLogin");
      window.location.href = nextPage;
      return;
    }

    alert(data.message || "Login failed");
  } catch {
    alert("Network error");
  }
}

async function handleModalRegister(event) {
  event.preventDefault();
  event.stopImmediatePropagation();

  const form = event.currentTarget;
  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    return;
  }

  const fullName = document.getElementById("registerNameModal")?.value.trim();
  const email = document.getElementById("registerEmailModal")?.value.trim();
  const phone = document.getElementById("registerPhoneModal")?.value.trim();
  const password = document.getElementById("registerPasswordModal")?.value;

  try {
    const response = await fetch(`${API_BASE}/auth/register/request-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, phone, password }),
    });
    const data = await response.json();

    if (response.ok && data.status === "success") {
      const passwordInput = document.getElementById("registerPasswordModal");
      if (passwordInput) passwordInput.value = "";
      showRegisterOtpStep(email);
      return;
    }

    alert(data.message || "Unable to send verification code");
  } catch {
    alert("Network error");
  }
}

function showRegisterOtpStep(email) {
  const registerForm = document.getElementById("registerFormModal");
  const modalBody = registerForm?.parentElement;
  if (!registerForm || !modalBody) return;

  registerForm.classList.add("d-none");

  let otpForm = document.getElementById("registerOtpForm");
  if (!otpForm) {
    otpForm = document.createElement("form");
    otpForm.id = "registerOtpForm";
    otpForm.className = "needs-validation";
    otpForm.noValidate = true;
    modalBody.appendChild(otpForm);
  }

  otpForm.innerHTML = `
    <div class="text-center mb-4">
      <h6 class="fw-semibold mb-2">Check your email</h6>
      <p class="text-muted small mb-0">We sent a 6-digit code to <strong>${email}</strong>.</p>
    </div>
    <div class="mb-3">
      <label for="registerOtpCode" class="form-label fw-semibold">Verification code</label>
      <input
        type="text"
        class="form-control text-center"
        id="registerOtpCode"
        inputmode="numeric"
        pattern="[0-9]{6}"
        maxlength="6"
        placeholder="000000"
        required
      >
      <div class="invalid-feedback">Enter the 6-digit code from your email.</div>
    </div>
    <button type="submit" class="btn btn-dark w-100 fw-semibold py-2 mb-2">Verify Account</button>
    <button type="button" class="btn btn-link w-100 text-muted text-decoration-none" id="resendRegisterOtpBtn">
      Resend code
    </button>
  `;

  otpForm.addEventListener("submit", (event) => handleRegisterOtpVerify(event, email), { once: true });
  setupRegisterOtpResend(email);
  startRegisterOtpCooldown();
}

async function handleRegisterOtpVerify(event, email) {
  event.preventDefault();
  event.stopImmediatePropagation();

  const form = event.currentTarget;
  if (!form.checkValidity()) {
    form.classList.add("was-validated");
    form.addEventListener("submit", (nextEvent) => handleRegisterOtpVerify(nextEvent, email), { once: true });
    return;
  }

  const otp = document.getElementById("registerOtpCode")?.value.trim();

  try {
    const response = await fetch(`${API_BASE}/auth/register/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });
    const data = await response.json();

    if (response.ok && data.status === "success") {
      alert("Account created. Please sign in.");
      resetRegisterOtpStep();
      const registerModal = document.getElementById("registerModal");
      const loginModal = document.getElementById("loginModal");
      if (registerModal) Modal.getOrCreateInstance(registerModal).hide();
      if (loginModal) Modal.getOrCreateInstance(loginModal).show();
      return;
    }

    alert(data.message || "Invalid verification code");
    form.addEventListener("submit", (nextEvent) => handleRegisterOtpVerify(nextEvent, email), { once: true });
  } catch {
    alert("Network error");
    form.addEventListener("submit", (nextEvent) => handleRegisterOtpVerify(nextEvent, email), { once: true });
  }
}

function setupRegisterOtpResend(email) {
  const resendButton = document.getElementById("resendRegisterOtpBtn");
  if (!resendButton) return;

  resendButton.addEventListener("click", async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/register/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (response.ok && data.status === "success") {
        alert("A new verification code has been sent.");
        startRegisterOtpCooldown();
        return;
      }

      alert(data.message || "Unable to resend verification code");
    } catch {
      alert("Network error");
    }
  });
}

function startRegisterOtpCooldown() {
  const resendButton = document.getElementById("resendRegisterOtpBtn");
  if (!resendButton) return;

  let seconds = 60;
  resendButton.disabled = true;
  resendButton.textContent = `Resend code in ${seconds}s`;

  const timer = setInterval(() => {
    seconds -= 1;
    if (seconds <= 0) {
      clearInterval(timer);
      resendButton.disabled = false;
      resendButton.textContent = "Resend code";
      return;
    }
    resendButton.textContent = `Resend code in ${seconds}s`;
  }, 1000);
}

function resetRegisterOtpStep() {
  const registerForm = document.getElementById("registerFormModal");
  const otpForm = document.getElementById("registerOtpForm");
  registerForm?.classList.remove("d-none");
  registerForm?.reset();
  registerForm?.classList.remove("was-validated");
  otpForm?.remove();
}

/**
 * Update navbar based on login state
 */
export function updateNavbarState() {
  const authToken = localStorage.getItem("authToken");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // Find login button (displayed for guests)
  const loginBtn = document.querySelector('[data-bs-target="#loginModal"]');

  // Find user dropdown (displayed for logged-in users)
  const userDropdown = document.getElementById("userNavDropdown");
  const userNameDisplay = document.getElementById("userNameDisplay");
  const userDropdownMenu = document.getElementById("userDropdownMenu");

  if (authToken && user.id) {
    // ── Logged IN ────────────────────────────────────────
    if (loginBtn) {
      // Fix: phải remove d-lg-flex để d-none thực sự hoạt động trên desktop
      loginBtn.classList.remove("d-lg-flex");
      loginBtn.classList.add("d-none");
      loginBtn.style.display = "none"; // failsafe
    }

    if (userDropdown) {
      userDropdown.classList.remove("d-none");

      // Fix: API trả về "username", không phải "name"
      // Ưu tiên: fullName > username > email prefix
      if (userNameDisplay) {
        const displayName =
          user.name ||        // nếu có fullName
          user.username ||    // fallback username
          (user.email ? user.email.split("@")[0] : "User"); // email prefix

        // Lấy tên đầu tiên và viết hoa chữ cái đầu
        const firstName = displayName.split(/[\s_]/)[0];
        const formatted = firstName.charAt(0).toUpperCase() + firstName.slice(1);
        userNameDisplay.textContent = "Hi " + formatted;
      }

      // Build dropdown menu nếu chưa có
      if (userDropdownMenu && userDropdownMenu.children.length === 0) {
        buildUserMenu(userDropdownMenu, user);
      }
    }
  } else {
    // ── Guest ─────────────────────────────────────────────
    if (loginBtn) {
      loginBtn.classList.add("d-lg-flex");
      loginBtn.classList.remove("d-none");
      loginBtn.style.display = ""; // clear failsafe
    }

    if (userDropdown) {
      userDropdown.classList.add("d-none");
    }
  }
}

/**
 * Build user dropdown menu items
 */
function buildUserMenu(container, user) {
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  const items = [
    { label: "📦 Đơn hàng của tôi", href: "profile.html#orders" },
    { label: "👤 Tài khoản", href: "profile.html" },
    ...(isAdmin ? [{ label: "⚙️ Quản trị", href: "admin/index.html" }] : []),
    { divider: true },
    { label: "🚪 Đăng xuất", onclick: "handleLogout()" },
  ];

  items[0].label = "Orders";
  items[1].label = "Account";
  if (isAdmin) items[2].label = "Admin";
  items[items.length - 1].label = "Sign out";

  const html = items
    .map((item) => {
      if (item.divider) {
        return '<li><hr class="dropdown-divider"></li>';
      }
      if (item.onclick) {
        return `<li><button class="dropdown-item" type="button" onclick="${item.onclick}" style="background:none;border:none;cursor:pointer;width:100%;text-align:left;">${item.label}</button></li>`;
      }
      return `<li><a class="dropdown-item" href="${item.href}">${item.label}</a></li>`;
    })
    .join("");

  container.innerHTML = html;
}

/**
 * Export for manual updates
 */
window.updateNavbarState = updateNavbarState;
