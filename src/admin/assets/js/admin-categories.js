/**
 * admin-categories.js — CRUD Danh mục
 * API: GET/POST/PUT/DELETE /api/v1/categories
 * Response shape:
 *   GET /categories     → { status, data: Category[] }
 *   GET /categories/:id → { status, data: Category }
 *   POST/PUT            → { status, data: Category }
 *   DELETE              → { status, data: Category }
 *
 * Backend delete guard: nếu danh mục có sản phẩm → 400 CATEGORY_HAS_PRODUCTS
 */

import { requireAdminAccess, getApiBase, showToast } from "./admin-guard.js";
import { initSidebar } from "./admin-nav.js";

const auth = requireAdminAccess();
if (!auth) throw new Error("Unauthorized");
const { token, user } = auth;
const API = getApiBase();

document.getElementById("sidebar-initials").textContent = (user.username || user.email || "A")[0].toUpperCase();
document.getElementById("sidebar-username").textContent = user.username || user.email;
document.getElementById("sidebar-role").textContent = user.role === "SUPER_ADMIN" ? "Super Admin" : "Admin";
initSidebar("categories");

let categories = [];
let editingId  = null;
let deletingId = null;

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Logout
  document.getElementById("btn-admin-logout")?.addEventListener("click", () => {
    localStorage.removeItem("authToken"); localStorage.removeItem("user");
    window.location.href = "/login.html";
  });

  await loadCategories();

  document.getElementById("cat-form").addEventListener("submit", handleSave);
  document.getElementById("cat-reset").addEventListener("click", resetForm);

  document.getElementById("cat-delete-cancel").addEventListener("click", () => {
    document.getElementById("cat-delete-modal").classList.remove("open");
    deletingId = null;
  });
  document.getElementById("cat-delete-confirm").addEventListener("click", confirmDelete);

  // Auto-generate slug from name
  const nameEl = document.getElementById("cat-name");
  const slugEl = document.getElementById("cat-slug");
  nameEl.addEventListener("input", function () {
    if (!slugEl.dataset.manual) {
      slugEl.value = this.value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
    }
  });
  slugEl.addEventListener("input", function () {
    this.dataset.manual = "1";
  });

  // Close modal on backdrop click
  document.getElementById("cat-delete-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.classList.remove("open");
      deletingId = null;
    }
  });
});

// ── Load ──────────────────────────────────────────────────────
async function loadCategories() {
  const tbody = document.getElementById("categories-tbody");
  tbody.innerHTML = `<tr><td colspan="5" class="loading-state"><div class="spinner" style="margin:0 auto;"></div></td></tr>`;

  try {
    const res  = await fetch(`${API}/categories`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();

    if (!res.ok) throw new Error(json.message || "Không thể tải danh mục");

    // Response: { status, data: Category[] }
    categories = Array.isArray(json.data) ? json.data : [];
    renderTable();
  } catch (e) {
    console.error("loadCategories error:", e);
    showToast("❌ Không thể tải danh mục", "error");
    document.getElementById("categories-tbody").innerHTML =
      `<tr><td colspan="5" style="text-align:center;padding:24px;color:#ef4444;">Lỗi: ${e.message}</td></tr>`;
  }
}

// ── Render ────────────────────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById("categories-tbody");
  if (categories.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:#aaa;">Chưa có danh mục nào</td></tr>`;
    return;
  }
  tbody.innerHTML = categories.map((c) => `
    <tr>
      <td style="color:#aaa;font-size:.8rem;">#${c.id}</td>
      <td style="font-weight:600;">${c.name}</td>
      <td style="font-size:.8rem;color:#aaa;">${c.slug || "—"}</td>
      <td>
        <span class="badge" style="background:#f5f5f2;color:#555;">
          ${c._count?.products ?? "—"} SP
        </span>
      </td>
      <td>
        <button class="btn btn-outline btn-sm" style="margin-right:6px;" onclick="editCategory(${c.id})">
          <i class="bi bi-pencil"></i> Sửa
        </button>
        <button class="btn btn-danger btn-sm" onclick="deleteCategory(${c.id}, '${c.name.replace(/'/g, "\\'")}')">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>`).join("");
}

// ── Save ──────────────────────────────────────────────────────
async function handleSave(e) {
  e.preventDefault();

  const name = document.getElementById("cat-name").value.trim();
  const desc = document.getElementById("cat-desc").value.trim();
  let   slug = document.getElementById("cat-slug").value.trim();

  if (!name) { showToast("⚠️ Nhập tên danh mục", "warning"); return; }

  // If slug empty, backend will auto-generate via slugify
  const body = { name, ...(slug && { slug }), ...(desc && { description: desc }) };

  const btn = document.getElementById("cat-submit");
  btn.disabled = true;
  btn.textContent = editingId ? "Đang lưu..." : "Đang thêm...";

  try {
    const url = editingId ? `${API}/categories/${editingId}` : `${API}/categories`;
    const res  = await fetch(url, {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await res.json();

    if (res.ok) {
      showToast(editingId ? "✅ Đã cập nhật danh mục" : "✅ Đã thêm danh mục mới", "success");
      resetForm();
      await loadCategories();
    } else {
      showToast(`❌ ${json.message || "Lỗi"}`, "error");
    }
  } catch { showToast("❌ Lỗi kết nối", "error"); }
  finally {
    btn.disabled = false;
    btn.textContent = editingId ? "Lưu thay đổi" : "Thêm danh mục";
  }
}

// ── Edit ──────────────────────────────────────────────────────
window.editCategory = (id) => {
  const c = categories.find((c) => c.id === id);
  if (!c) return;
  editingId = id;
  document.getElementById("cat-id").value   = c.id;
  document.getElementById("cat-name").value = c.name;
  document.getElementById("cat-slug").value = c.slug || "";
  document.getElementById("cat-desc").value = c.description || "";
  document.getElementById("cat-slug").dataset.manual = "1";

  document.getElementById("cat-form-title").textContent = `Chỉnh sửa: ${c.name}`;
  document.getElementById("cat-submit").textContent = "Lưu thay đổi";
  document.getElementById("cat-reset").style.display = "";

  // Scroll form vào view
  document.getElementById("cat-form").scrollIntoView({ behavior: "smooth", block: "start" });
};

function resetForm() {
  editingId = null;
  document.getElementById("cat-form").reset();
  document.getElementById("cat-id").value = "";
  delete document.getElementById("cat-slug").dataset.manual;
  document.getElementById("cat-form-title").textContent = "Thêm danh mục mới";
  document.getElementById("cat-submit").textContent = "Thêm danh mục";
  document.getElementById("cat-reset").style.display = "none";
}

// ── Delete ────────────────────────────────────────────────────
window.deleteCategory = (id, name) => {
  deletingId = id;
  document.getElementById("cat-delete-name").textContent = name;
  document.getElementById("cat-delete-modal").classList.add("open");
};

async function confirmDelete() {
  if (!deletingId) return;
  const btn = document.getElementById("cat-delete-confirm");
  btn.disabled = true; btn.textContent = "Đang xóa...";
  try {
    const res  = await fetch(`${API}/categories/${deletingId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (res.ok) {
      showToast("✅ Đã xóa danh mục", "success");
      document.getElementById("cat-delete-modal").classList.remove("open");
      deletingId = null;
      await loadCategories();
    } else {
      // Backend returns CATEGORY_HAS_PRODUCTS if products exist
      showToast(`❌ ${json.message || "Không thể xóa"}`, "error");
    }
  } catch { showToast("❌ Lỗi kết nối", "error"); }
  finally { btn.disabled = false; btn.textContent = "Xóa"; }
}
