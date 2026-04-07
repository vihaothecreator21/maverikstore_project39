/**
 * navbar.js - Navbar state management
 * Handle user login/logout UI updates across all pages
 */

document.addEventListener('DOMContentLoaded', () => {
  updateNavbarState();
  window.addEventListener('loginSuccess', updateNavbarState);
  window.addEventListener('logoutSuccess', updateNavbarState);
});

/**
 * Update navbar based on login state
 */
export function updateNavbarState() {
  const authToken = localStorage.getItem('authToken');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  // Find login button (displayed for guests)
  const loginBtn = document.querySelector('[data-bs-target="#loginModal"]');
  
  // Find user dropdown (displayed for logged-in users)
  const userDropdown = document.getElementById('userNavDropdown');
  const userNameDisplay = document.getElementById('userNameDisplay');
  const userDropdownMenu = document.getElementById('userDropdownMenu');

  if (authToken && user.id) {
    // User is logged in
    if (loginBtn) {
      loginBtn.classList.add('d-none');
    }
    
    if (userDropdown) {
      userDropdown.classList.remove('d-none');
      
      // Update user name
      if (userNameDisplay && user.name) {
        const firstName = user.name.split(' ')[0];
        userNameDisplay.textContent = firstName;
      }
      
      // Build user dropdown menu if needed
      if (userDropdownMenu && userDropdownMenu.children.length === 0) {
        buildUserMenu(userDropdownMenu, user);
      }
    }
  } else {
    // User is guest
    if (loginBtn) {
      loginBtn.classList.remove('d-none');
    }
    
    if (userDropdown) {
      userDropdown.classList.add('d-none');
    }
  }
}

/**
 * Build user dropdown menu items
 */
function buildUserMenu(container, user) {
  const items = [
    { label: '👤 Profile', href: 'account.html' },
    { label: '📦 Orders', href: 'orders.html' },
    { label: '⚙️ Settings', href: 'settings.html' },
    { divider: true },
    { label: '🚪 Logout', onclick: 'handleLogout()' },
  ];

  const html = items
    .map((item) => {
      if (item.divider) {
        return '<li><hr class="dropdown-divider"></li>';
      }
      if (item.onclick) {
        return `<li><button class="dropdown-item" type="button" onclick="${item.onclick}" style="background: none; border: none; cursor: pointer; width: 100%; text-align: left;">${item.label}</button></li>`;
      }
      return `<li><a class="dropdown-item" href="${item.href}">${item.label}</a></li>`;
    })
    .join('');

  container.innerHTML = html;
}

/**
 * Export for manual updates
 */
window.updateNavbarState = updateNavbarState;
