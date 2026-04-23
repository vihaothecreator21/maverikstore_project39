/**
 * navbar.js - Navbar state management
 * Handle user login/logout UI updates across all pages
 */

document.addEventListener("DOMContentLoaded", () => {
  updateNavbarState();
  window.addEventListener("loginSuccess", updateNavbarState);
  window.addEventListener("logoutSuccess", updateNavbarState);
});

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
