/**
 * admin-orders.js — Quản lý đơn hàng
 * ✅ Features:
 *  - Status filter tabs (includes PENDING_PAYMENT for VNPay orders)
 *  - Date range filter (startDate / endDate)
 *  - Client-side search (ID, username, email, phone)
 *  - Server-side pagination
 *  - Admin status update actions
 */

import { requireAdminAccess, getApiBase, formatVND, formatDate, ORDER_STATUS, showToast } from "./admin-guard.js";
import { initSidebar } from "./admin-nav.js";

const auth = requireAdminAccess();
if (!auth) throw new Error("Unauthorized");
const { token, user } = auth;
const API = getApiBase();

document.getElementById("sidebar-initials").textContent = (user.username || user.email || "A")[0].toUpperCase();
document.getElementById("sidebar-username").textContent = user.username || user.email;
document.getElementById("sidebar-role").textContent = user.role === "SUPER_ADMIN" ? "Super Admin" : "Admin";
initSidebar("orders");

// ── State ─────────────────────────────────────────────────────
let orders      = [];
let currentPage = 1;
let totalPages  = 1;
let totalCount  = 0;
const PAGE_SIZE = 20;
let statusFilter = "";
let startDateFilter = "";
let endDateFilter   = "";
let searchDebounce  = null;

// ✅ Updated: includes PENDING_PAYMENT transitions
const TRANSITIONS = {
  PENDING_PAYMENT: [],  // VNPay auto-processes via IPN — no manual action
  PENDING:    ["CONFIRMED", "CANCELLED"],
  CONFIRMED:  ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPING"],
  SHIPPING:   ["DELIVERED"],
  DELIVERED:  ["COMPLETED", "RETURNED"],
  COMPLETED:  [], CANCELLED: [], RETURNED: [],
};

const ACTION_LABELS = {
  CONFIRMED:  { label: "✅ Xác nhận",   cls: "btn-success" },
  PROCESSING: { label: "🔄 Xử lý",      cls: "btn-primary" },
  SHIPPING:   { label: "🚚 Giao hàng",  cls: "btn-primary" },
  DELIVERED:  { label: "📦 Đã giao",    cls: "btn-success" },
  COMPLETED:  { label: "🏁 Hoàn thành", cls: "btn-success" },
  CANCELLED:  { label: "❌ Hủy đơn",    cls: "btn-danger"  },
  RETURNED:   { label: "↩️ Hoàn trả",  cls: "btn-outline" },
};

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Logout
  document.getElementById("btn-admin-logout")?.addEventListener("click", () => {
    localStorage.removeItem("authToken"); localStorage.removeItem("user");
    window.location.href = "/login.html";
  });

  await loadOrders();

  // Status tab buttons
  document.querySelectorAll("[data-status]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-status]").forEach((b) => {
        b.classList.remove("btn-primary"); b.classList.add("btn-outline");
      });
      btn.classList.remove("btn-outline"); btn.classList.add("btn-primary");
      statusFilter = btn.dataset.status;
      currentPage  = 1;
      loadOrders();
    });
  });

  // Search
  document.getElementById("search-orders")?.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => { currentPage = 1; loadOrders(); }, 400);
  });

  // ✅ Date filter
  document.getElementById("btn-apply-date")?.addEventListener("click", () => {
    startDateFilter = document.getElementById("filter-start-date")?.value || "";
    endDateFilter   = document.getElementById("filter-end-date")?.value || "";
    currentPage = 1;
    loadOrders();
  });

  document.getElementById("btn-clear-date")?.addEventListener("click", () => {
    startDateFilter = "";
    endDateFilter   = "";
    document.getElementById("filter-start-date").value = "";
    document.getElementById("filter-end-date").value   = "";
    currentPage = 1;
    loadOrders();
  });
});

// ── Load (server-side) ────────────────────────────────────────
async function loadOrders() {
  const tbody = document.getElementById("orders-tbody");
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;"><div class="spinner" style="margin:0 auto;"></div></td></tr>`;

  const search = document.getElementById("search-orders")?.value?.trim() || "";
  const params = new URLSearchParams({ page: currentPage, limit: PAGE_SIZE });
  if (statusFilter)   params.set("status", statusFilter);
  if (startDateFilter) params.set("startDate", startDateFilter);
  if (endDateFilter)   params.set("endDate",   endDateFilter);

  try {
    const res  = await fetch(`${API}/admin/orders?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();

    if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);

    // Response: { status, data: { orders: [], pagination: {} } }
    orders     = json.data?.orders || [];
    totalCount = json.data?.pagination?.total ?? orders.length;
    totalPages = json.data?.pagination?.totalPages ?? Math.ceil(totalCount / PAGE_SIZE);

    // Client-side search filter on loaded page
    const filtered = search
      ? orders.filter((o) =>
          String(o.id).includes(search) ||
          (o.user?.username || "").toLowerCase().includes(search.toLowerCase()) ||
          (o.user?.email    || "").toLowerCase().includes(search.toLowerCase()) ||
          (o.user?.phone    || "").toLowerCase().includes(search.toLowerCase())
        )
      : orders;

    renderTable(filtered);
    renderPagination();
  } catch (e) {
    console.error("loadOrders:", e);
    showToast(`❌ Lỗi tải đơn hàng: ${e.message}`, "error");
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:#ef4444;">Lỗi: ${e.message}</td></tr>`;
  }
}

// ── Render ────────────────────────────────────────────────────
function renderTable(filtered) {
  const tbody = document.getElementById("orders-tbody");
  const countEl = document.getElementById("orders-count");
  if (countEl) countEl.textContent = `${totalCount} đơn hàng`;

  if (!filtered || filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:#aaa;">Không có đơn hàng nào</td></tr>`;
    return;
  }

  const rows = [];
  filtered.forEach((o) => {
    const s      = ORDER_STATUS[o.status] || { label: o.status, color: "#888" };
    const badge  = `<span class="badge badge-${o.status.toLowerCase()}">${s.label}</span>`;
    const total  = formatVND(Number(o.totalAmount));
    const date   = formatDate(o.createdAt);
    const transitions = TRANSITIONS[o.status] || [];

    const actionBtns = transitions.map((next) => {
      const a = ACTION_LABELS[next];
      return `<button class="btn ${a.cls} btn-sm" onclick="window._updateStatus(${o.id},'${next}')">${a.label}</button>`;
    }).join("");

    // ✅ Show payment hint for PENDING_PAYMENT orders
    const pendingPaymentNote = o.status === "PENDING_PAYMENT"
      ? `<div style="font-size:.75rem;color:#a855f7;margin-top:4px;">⏳ Đang chờ xác nhận thanh toán VNPay</div>`
      : "";

    const itemsHtml = (o.details || []).map((d) =>
      `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:.82rem;">
         <span>${d.product?.name || "Sản phẩm"} × ${d.quantity}</span>
         <span style="font-weight:600;">${formatVND(Number(d.priceAtPurchase ?? 0))}</span>
       </div>`
    ).join("") || `<p style="color:#aaa;font-size:.82rem;">Không có thông tin</p>`;

    rows.push(`
      <tr style="cursor:default;">
        <td style="font-weight:700;color:#6366f1;">#${o.id}</td>
        <td>
          <div style="font-weight:600;font-size:.85rem;">${o.user?.username || "—"}</div>
          <div style="font-size:.75rem;color:#aaa;">${o.user?.email || ""}</div>
        </td>
        <td style="font-weight:700;">${total}</td>
        <td style="font-size:.82rem;">${o.payment?.paymentMethod || "COD"}</td>
        <td>${badge}${pendingPaymentNote}</td>
        <td style="font-size:.82rem;color:#8b91a7;">${date}</td>
        <td style="text-align:center;">
          <button class="btn btn-outline btn-sm" onclick="window._toggleDetail(${o.id})" title="Chi tiết">
            <i class="bi bi-chevron-down" id="chev-${o.id}"></i>
          </button>
        </td>
      </tr>
      <tr id="odet-${o.id}" style="display:none;background:#fafbfd;">
        <td colspan="7" style="padding:0;">
          <div style="padding:16px 22px;border-top:2px solid #eef2ff;">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-bottom:12px;">
              <div>
                <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#aaa;margin-bottom:6px;">Giao tới</div>
                <div style="font-size:.84rem;">${o.shippingAddress || "—"}</div>
                <div style="font-size:.8rem;color:#6366f1;margin-top:3px;">${o.shippingPhone || "—"}</div>
              </div>
              <div>
                <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#aaa;margin-bottom:6px;">Sản phẩm</div>
                ${itemsHtml}
              </div>
              <div>
                <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#aaa;margin-bottom:6px;">Ghi chú</div>
                <div style="font-size:.82rem;color:#555;">${o.note || "—"}</div>
              </div>
            </div>
            ${transitions.length
              ? `<div style="display:flex;gap:8px;padding-top:12px;border-top:1px solid #f0f0f0;">${actionBtns}</div>`
              : `<div style="font-size:.78rem;color:#aaa;padding-top:8px;">Không có thao tác khả dụng cho trạng thái này</div>`
            }
          </div>
        </td>
      </tr>`);
  });

  tbody.innerHTML = rows.join("");
}

// ── Toggle detail ─────────────────────────────────────────────
window._toggleDetail = (id) => {
  const row  = document.getElementById(`odet-${id}`);
  const icon = document.getElementById(`chev-${id}`);
  if (!row) return;
  const isOpen = row.style.display === "table-row";
  row.style.display = isOpen ? "none" : "table-row";
  if (icon) {
    icon.className = isOpen ? "bi bi-chevron-down" : "bi bi-chevron-up";
  }
};

// ── Update status ─────────────────────────────────────────────
window._updateStatus = async (orderId, newStatus) => {
  try {
    const res  = await fetch(`${API}/admin/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: newStatus }),
    });
    const json = await res.json();
    if (res.ok) {
      showToast(`✅ Đã cập nhật → ${ORDER_STATUS[newStatus]?.label || newStatus}`, "success");
      await loadOrders(); // Reload current page
    } else {
      showToast(`❌ ${json.message || "Không thể cập nhật"}`, "error");
    }
  } catch { showToast("❌ Lỗi kết nối", "error"); }
};

// ── Pagination ────────────────────────────────────────────────
function renderPagination() {
  const el = document.getElementById("orders-pagination");
  if (!el || totalPages <= 1) { if (el) el.innerHTML = ""; return; }

  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end   = Math.min(currentPage * PAGE_SIZE, totalCount);

  let html = `<span style="font-size:.78rem;color:#aaa;margin-right:8px;">${start}-${end} / ${totalCount}</span>`;
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn${i === currentPage ? " active" : ""}" onclick="window._ordersGoto(${i})">${i}</button>`;
  }
  el.innerHTML = html;
}

window._ordersGoto = (n) => { currentPage = n; loadOrders(); };
