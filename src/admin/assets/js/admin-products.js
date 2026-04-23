/**
 * admin-products.js — CRUD Sản phẩm
 * Dùng server-side pagination (limit=20) để tránh đơ máy.
 */

import { requireAdminAccess, getApiBase, formatVND, showToast } from "./admin-guard.js";
import { initSidebar } from "./admin-nav.js";

const auth = requireAdminAccess();
if (!auth) throw new Error("Unauthorized");
const { token, user } = auth;
const API = getApiBase();

document.getElementById("sidebar-initials").textContent = (user.username || user.email || "A")[0].toUpperCase();
document.getElementById("sidebar-username").textContent = user.username || user.email;
document.getElementById("sidebar-role").textContent = user.role === "SUPER_ADMIN" ? "Super Admin" : "Admin";
initSidebar("products");

// ── State ─────────────────────────────────────────────────────
let allProducts    = [];   // current page data
let categories     = [];
let currentPage    = 1;
let totalPages     = 1;
let totalCount     = 0;
const PAGE_SIZE    = 20;
let deletingId     = null;
let searchDebounce = null;

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Logout
  document.getElementById("btn-admin-logout")?.addEventListener("click", () => {
    localStorage.removeItem("authToken"); localStorage.removeItem("user");
    window.location.href = "/login.html";
  });

  await loadCategories();
  await loadProducts();

  document.getElementById("btn-add-product").addEventListener("click", openAddModal);
  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  document.getElementById("delete-cancel").addEventListener("click", closeDeleteModal);
  document.getElementById("delete-confirm").addEventListener("click", confirmDelete);
  document.getElementById("product-form").addEventListener("submit", handleSave);

  // Search with debounce to avoid re-fetching on every keystroke
  document.getElementById("search-products").addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => { currentPage = 1; loadProducts(); }, 400);
  });
  document.getElementById("filter-category").addEventListener("change", () => { currentPage = 1; loadProducts(); });
  document.getElementById("filter-stock").addEventListener("change",    () => { currentPage = 1; loadProducts(); });

  document.getElementById("product-modal").addEventListener("click", (e) => { if (e.target === e.currentTarget) closeModal(); });
  document.getElementById("delete-modal").addEventListener("click",  (e) => { if (e.target === e.currentTarget) closeDeleteModal(); });
});

// ── Load Categories ───────────────────────────────────────────
async function loadCategories() {
  try {
    const res  = await fetch(`${API}/categories`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    categories = Array.isArray(json.data) ? json.data : [];

    const opts = categories.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
    document.getElementById("filter-category").insertAdjacentHTML("beforeend", opts);
    document.getElementById("pf-category").insertAdjacentHTML("beforeend", opts);
  } catch { showToast("❌ Không thể tải danh mục", "error"); }
}

// ── Load Products (server-side pagination) ────────────────────
async function loadProducts() {
  const tbody = document.getElementById("products-tbody");
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;"><div class="spinner" style="margin:0 auto;"></div></td></tr>`;

  const search    = document.getElementById("search-products").value.trim();
  const catFilter = document.getElementById("filter-category").value;
  const stock     = document.getElementById("filter-stock").value;

  // Build query string — field names must match ProductQuerySchema
  const params = new URLSearchParams();
  params.set("page",  currentPage);
  params.set("limit", PAGE_SIZE);
  if (search)    params.set("search",     search);     // matches ProductQuerySchema .search
  if (catFilter) params.set("categoryId", catFilter);

  try {
    const res  = await fetch(`${API}/products?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();

    if (!res.ok) throw new Error(json.message || "Lỗi tải dữ liệu");

    allProducts = Array.isArray(json.data) ? json.data : [];
    totalCount  = json.meta?.total ?? allProducts.length;
    totalPages  = json.meta?.pages ?? Math.ceil(totalCount / PAGE_SIZE); // backend uses "pages" not "totalPages"

    renderTable();
    renderPagination();
  } catch (e) {
    console.error("loadProducts:", e);
    showToast(`❌ ${e.message}`, "error");
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:#ef4444;">Lỗi: ${e.message}</td></tr>`;
  }
}

// ── Render Table ─────────────────────────────────────────────
function renderTable() {
  const stock = document.getElementById("filter-stock").value;

  // Client-side stock filter (server API doesn't have stockQuantity range support)
  let rows = allProducts;
  if (stock === "low") rows = rows.filter((p) => p.stockQuantity > 0 && p.stockQuantity < 10);
  if (stock === "out") rows = rows.filter((p) => p.stockQuantity === 0);

  const tbody = document.getElementById("products-tbody");

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:#aaa;">Không tìm thấy sản phẩm nào</td></tr>`;
    return;
  }

  // Build rows as array then join once — faster than template concat
  tbody.innerHTML = rows.map((p) => {
    const cat        = categories.find((c) => c.id === p.categoryId);
    const qty        = Number(p.stockQuantity ?? 0);
    const stockBadge =
      qty === 0 ? `<span class="badge badge-cancelled">Hết hàng</span>` :
      qty <  10 ? `<span class="badge badge-pending">${qty} còn lại</span>` :
                  `<span class="badge badge-completed">${qty}</span>`;

    return `<tr>
      <td style="color:#aaa;font-size:.8rem;">#${p.id}</td>
      <td>${p.imageUrl
        ? `<img src="${p.imageUrl}" alt="" loading="lazy" onerror="this.style.display='none'" style="width:38px;height:48px;object-fit:cover;border-radius:4px;">`
        : `<div style="width:38px;height:48px;background:#f5f5f5;border-radius:4px;display:grid;place-items:center;font-size:.65rem;color:#ccc;">N/A</div>`
      }</td>
      <td style="font-weight:600;font-size:.85rem;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</td>
      <td><span class="badge" style="background:#f5f5f2;color:#555;">${cat?.name ?? "—"}</span></td>
      <td style="font-weight:700;">${formatVND(Number(p.price))}</td>
      <td>${stockBadge}</td>
      <td style="text-align:center;white-space:nowrap;">
        <button class="btn btn-outline btn-sm" style="margin-right:6px;" onclick="window._editProduct(${p.id})"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-danger btn-sm" onclick="window._deleteProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}')"><i class="bi bi-trash"></i></button>
      </td>
    </tr>`;
  }).join("");
}

// ── Pagination ────────────────────────────────────────────────
function renderPagination() {
  const el = document.getElementById("products-pagination");
  if (totalPages <= 1) { el.innerHTML = ""; return; }

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    pages.push(`<button class="page-btn${i === currentPage ? " active" : ""}" onclick="window._goto(${i})">${i}</button>`);
  }

  // Info text
  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end   = Math.min(currentPage * PAGE_SIZE, totalCount);
  el.innerHTML = `<span style="font-size:.78rem;color:#aaa;margin-right:8px;">${start}-${end} / ${totalCount}</span>` + pages.join("");
}

window._goto = (n) => { currentPage = n; loadProducts(); };

// ── Modal helpers ─────────────────────────────────────────────
function openAddModal() {
  document.getElementById("modal-title").textContent = "Thêm sản phẩm mới";
  document.getElementById("product-form").reset();
  document.getElementById("product-id").value = "";
  // Reset category select to first option
  document.getElementById("pf-category").value = "";
  document.getElementById("product-modal").classList.add("open");
}

window._editProduct = (id) => {
  const p = allProducts.find((p) => p.id === id);
  if (!p) return;
  document.getElementById("modal-title").textContent  = "Sửa sản phẩm";
  document.getElementById("product-id").value         = p.id;
  document.getElementById("pf-name").value            = p.name;
  document.getElementById("pf-category").value        = p.categoryId;
  document.getElementById("pf-price").value           = Number(p.price);
  document.getElementById("pf-stock").value           = p.stockQuantity;
  document.getElementById("pf-image").value           = p.imageUrl || "";
  document.getElementById("pf-desc").value            = p.description || "";
  document.getElementById("product-modal").classList.add("open");
};

// Keep old name for backward compat
window.editProduct   = window._editProduct;

function closeModal() { document.getElementById("product-modal").classList.remove("open"); }

// ── Save ──────────────────────────────────────────────────────
async function handleSave(e) {
  e.preventDefault();
  const id      = document.getElementById("product-id").value;
  const name    = document.getElementById("pf-name").value.trim();
  const catId   = document.getElementById("pf-category").value;
  const price   = document.getElementById("pf-price").value;
  const stock   = document.getElementById("pf-stock").value;
  const imgUrl  = document.getElementById("pf-image").value.trim();
  const desc    = document.getElementById("pf-desc").value.trim();

  if (!name)  return showToast("⚠️ Nhập tên sản phẩm", "warning");
  if (!catId) return showToast("⚠️ Chọn danh mục", "warning");
  if (!price) return showToast("⚠️ Nhập giá bán", "warning");

  const body = {
    name,
    categoryId:    parseInt(catId),
    price:         parseFloat(price),
    stockQuantity: parseInt(stock) || 0,
    ...(imgUrl && { imageUrl: imgUrl }),
    ...(desc   && { description: desc }),
  };

  const btn = document.getElementById("modal-submit");
  btn.disabled = true; btn.textContent = "Đang lưu...";

  try {
    const res  = await fetch(id ? `${API}/products/${id}` : `${API}/products`, {
      method:  id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify(body),
    });
    const json = await res.json();

    if (res.ok) {
      showToast(id ? "✅ Cập nhật sản phẩm thành công" : "✅ Đã thêm sản phẩm mới", "success");
      closeModal();
      await loadProducts();
    } else {
      const errMsg = json.errors
        ? Object.entries(json.errors).map(([k, v]) => `${k}: ${v}`).join(", ")
        : json.message || "Lỗi không xác định";
      showToast(`❌ ${errMsg}`, "error");
    }
  } catch { showToast("❌ Lỗi kết nối máy chủ", "error"); }
  finally  { btn.disabled = false; btn.textContent = "Lưu sản phẩm"; }
}

// ── Delete ────────────────────────────────────────────────────
window._deleteProduct = (id, name) => {
  deletingId = id;
  document.getElementById("delete-name").textContent = name;
  document.getElementById("delete-modal").classList.add("open");
};
window.deleteProduct = window._deleteProduct;

function closeDeleteModal() {
  document.getElementById("delete-modal").classList.remove("open");
  deletingId = null;
}

async function confirmDelete() {
  if (!deletingId) return;
  const btn = document.getElementById("delete-confirm");
  btn.disabled = true; btn.textContent = "Đang xóa...";
  try {
    const res  = await fetch(`${API}/products/${deletingId}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (res.ok) {
      showToast("✅ Đã xóa sản phẩm", "success");
      closeDeleteModal();
      await loadProducts();
    } else {
      showToast(`❌ ${json.message || "Không thể xóa"}`, "error");
    }
  } catch { showToast("❌ Lỗi kết nối", "error"); }
  finally  { btn.disabled = false; btn.textContent = "Xóa"; }
}
