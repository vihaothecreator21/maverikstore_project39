/**
 * admin-nav.js — Sidebar active state management
 * Import and call initSidebar() on each admin page
 */

import { adminLogout } from "./admin-guard.js";

export function initSidebar(activePage) {
  // Set active link
  document.querySelectorAll(".sidebar-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.page === activePage);
  });

  // Logout button
  document.getElementById("btn-admin-logout")?.addEventListener("click", adminLogout);
}
