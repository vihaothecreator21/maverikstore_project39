/**
 * admin-dashboard.js — Maverik Admin Dashboard
 * Trang tổng quan: Stats cards + Revenue bar chart + Order distribution pie + Recent orders table
 */

import { requireAdminAccess, getApiBase, formatVND, formatDate, ORDER_STATUS, showToast } from "./admin-guard.js";
import { initSidebar } from "./admin-nav.js";

const auth = requireAdminAccess();
if (!auth) throw new Error("Unauthorized");

const { token, user } = auth;
const API = getApiBase();

// Fill user info in sidebar
document.getElementById("sidebar-username").textContent = user.username || user.email;
document.getElementById("sidebar-role").textContent = user.role === "SUPER_ADMIN" ? "Super Admin" : "Admin";
document.getElementById("sidebar-initials").textContent =
  (user.username || user.email || "A")[0].toUpperCase();

initSidebar("dashboard");

// ── Load on ready ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([loadStats(), loadRecentOrders()]);
});

// ── Stats Cards ────────────────────────────────────────────────
async function loadStats() {
  try {
    const res  = await fetch(`${API}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    const s = data.data;

    // Hiển thị doanh thu GỘP HÔM NAY (reset về 0 mỗi ngày mới)
    setEl("stat-revenue",   formatVND(s.today?.gross ?? 0));
    setEl("stat-orders",    s.orders.total.toLocaleString());
    setEl("stat-customers", s.customers.total.toLocaleString());
    setEl("stat-lowstock",  s.products.lowStock.toLocaleString());
    setEl("stat-pending",   `${s.orders.pending} đơn chờ`);

    // Phụ đề — số đơn và ngày hôm nay
    const todayLabel = s.today?.date
      ? new Date(s.today.date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
      : new Date().toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
    setEl("stat-revenue-sub", `${(s.today?.orderCount ?? 0)} đơn • ${todayLabel}`);

    // Revenue chart (7 days)
    await loadRevenueChart();

    // Order status pie
    renderOrderPie(s.orders.byStatus);
  } catch (e) {
    showToast("❌ Không thể tải dữ liệu tổng quan", "error");
    console.error(e);
  }
}

// ── Revenue Bar Chart (Chart.js) ───────────────────────────────
async function loadRevenueChart() {
  const end   = new Date();
  const start = new Date(); start.setDate(start.getDate() - 6);
  const fmt   = (d) => d.toISOString().slice(0, 10);

  try {
    const res  = await fetch(`${API}/admin/revenue?period=day&start=${fmt(start)}&end=${fmt(end)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    const rows = data.data || [];

    // Fill missing days
    const dayMap = {};
    rows.forEach((r) => { dayMap[r.period] = r.revenue; });

    const labels   = [];
    const revenues = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = fmt(d);
      labels.push(d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }));
      revenues.push(dayMap[k] || 0);
    }

    const ctx = document.getElementById("revenue-chart")?.getContext("2d");
    if (!ctx) return;
    new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Doanh thu (đ)",
          data: revenues,
          backgroundColor: "rgba(99,102,241,.8)",
          borderColor: "#6366f1",
          borderWidth: 0,
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (c) => ` ${new Intl.NumberFormat("vi-VN").format(c.raw)}đ` },
          },
        },
        scales: {
          y: {
            ticks: {
              callback: (v) => v >= 1e6 ? (v / 1e6).toFixed(0) + "M" : v.toLocaleString(),
              font: { size: 11 },
            },
            grid: { color: "#f0f2f5" },
          },
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        },
      },
    });
  } catch (e) {
    console.error("Revenue chart error", e);
  }
}

// ── Order Status Doughnut ──────────────────────────────────────
function renderOrderPie(byStatus) {
  const display = [
    { key: "PENDING",    label: "Chờ XN",    color: "#f59e0b" },
    { key: "CONFIRMED",  label: "Đã XN",     color: "#3b82f6" },
    { key: "PROCESSING", label: "Xử lý",     color: "#6366f1" },
    { key: "SHIPPING",   label: "Đang giao", color: "#0ea5e9" },
    { key: "DELIVERED",  label: "Đã giao",   color: "#22c55e" },
    { key: "COMPLETED",  label: "HT",        color: "#16a34a" },
    { key: "CANCELLED",  label: "Hủy",       color: "#ef4444" },
  ];
  const labels = display.map((d) => d.label);
  const values = display.map((d) => byStatus[d.key] || 0);
  const colors = display.map((d) => d.color);

  const ctx = document.getElementById("status-chart")?.getContext("2d");
  if (!ctx) return;
  new Chart(ctx, {
    type: "doughnut",
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { font: { size: 11 }, boxWidth: 12 } } },
      cutout: "65%",
    },
  });
}

// ── Recent Orders Table ────────────────────────────────────────
async function loadRecentOrders() {
  try {
    const res  = await fetch(`${API}/admin/orders?limit=8&page=1`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const orders = data.data?.orders || [];

    const tbody = document.getElementById("recent-orders-body");
    if (!tbody) return;

    tbody.innerHTML = orders.map((o) => {
      const s = ORDER_STATUS[o.status] || { label: o.status, color: "#888", bg: "#eee" };
      return `
        <tr>
          <td><a href="orders.html" style="font-weight:700;color:#6366f1;text-decoration:none;">#${o.id}</a></td>
          <td>${o.user?.username || "—"}</td>
          <td>${formatDate(o.createdAt)}</td>
          <td><span class="badge badge-${o.status.toLowerCase()}">${s.label}</span></td>
          <td style="font-weight:700;">${formatVND(o.totalAmount)}</td>
        </tr>`;
    }).join("") || `<tr><td colspan="5" style="text-align:center;color:#aaa;padding:24px;">Chưa có đơn hàng</td></tr>`;
  } catch (e) {
    showToast("❌ Không thể tải đơn hàng gần đây", "error");
  }
}

// ── Helper ────────────────────────────────────────────────────
const setEl = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
