/**
 * admin-revenue.js — Báo cáo Doanh thu + Export CSV/PDF
 *
 * Features:
 *  - Period filter (7d/30d/90d/1y + custom date range)
 *  - Bar chart: Revenue over time
 *  - Doughnut: Revenue by payment method
 *  - Horizontal bar: Revenue by category
 *  - Table: Best sellers + Order detail table
 *  - Export CSV (PapaParse) + PDF (jsPDF + autoTable)
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
initSidebar("revenue");

// ── State ─────────────────────────────────────────────────────
let startDate  = daysAgo(7);
let endDate    = new Date();
let groupBy    = "day";
let exportData = []; // Cache for export

let revenueChart, paymentChart, categoryChart;

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Init date pickers
  document.getElementById("custom-start").value = fmt(startDate);
  document.getElementById("custom-end").value   = fmt(endDate);

  // Period quick-select buttons
  document.querySelectorAll("[data-days]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-days]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const days = parseInt(btn.dataset.days);
      startDate = daysAgo(days);
      endDate   = new Date();
      document.getElementById("custom-start").value = fmt(startDate);
      document.getElementById("custom-end").value   = fmt(endDate);

      // Tự động đề xuất nhóm phù hợp
      const groupSelect = document.getElementById("group-by");
      if (days <= 30)       { groupSelect.value = "day";   groupBy = "day"; }
      else if (days <= 90)  { groupSelect.value = "week";  groupBy = "week"; }
      else                  { groupSelect.value = "month"; groupBy = "month"; }

      loadAll();
    });
  });

  // Custom date range apply
  document.getElementById("btn-apply-custom").addEventListener("click", () => {
    const s = document.getElementById("custom-start").value;
    const e = document.getElementById("custom-end").value;
    if (!s || !e) return showToast("⚠️ Chọn ngày bắt đầu và kết thúc", "warning");
    document.querySelectorAll("[data-days]").forEach((b) => b.classList.remove("active"));
    startDate = new Date(s);
    endDate   = new Date(e + "T23:59:59");
    loadAll();
  });

  // Group by change
  document.getElementById("group-by").addEventListener("change", (e) => {
    groupBy = e.target.value;
    loadRevenueChart();
  });

  // Export buttons
  document.getElementById("btn-export-csv").addEventListener("click", exportCSV);
  document.getElementById("btn-export-pdf").addEventListener("click", exportPDF);

  await loadAll();
});

// ── Load All ──────────────────────────────────────────────────
async function loadAll() {
  groupBy = document.getElementById("group-by").value;
  await Promise.all([
    loadSummary(),
    loadRevenueChart(),
    loadPaymentChart(),
    loadProductStats(),
    loadExportData(),
  ]);
}

// ── Summary Stats (dùng date range đã chọn) ─────────────────────────
async function loadSummary() {
  try {
    // Gọi /admin/revenue với period=day để lấy tất cả đơn trong khoảng thời gian
    const res  = await fetch(
      `${API}/admin/revenue?period=day&start=${fmt(startDate)}&end=${fmt(endDate)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const rows = (await res.json()).data || [];

    // Tính tổng doanh thu trong khoảng
    const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);
    const totalOrders  = rows.reduce((sum, r) => sum + r.orderCount, 0);

    setEl("rev-gross", formatVND(totalRevenue));

    // Thêm số đơn hàng trong khoảng (nếu có element)
    const subEl = document.getElementById("rev-orders-sub");
    if (subEl) subEl.textContent = `${totalOrders} đơn hàng`;

    // Lấy cancel rate từ stats API riêng
    const statsRes = await fetch(`${API}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } });
    const stats = (await statsRes.json()).data;
    setEl("rev-cancel", `${stats?.revenue?.cancelRate ?? 0}%`);
  } catch { showToast("❌ Lỗi tải thống kê", "error"); }
}

// ── Revenue Bar Chart ─────────────────────────────────
async function loadRevenueChart() {
  const ctx = document.getElementById("chart-revenue")?.getContext("2d");
  if (!ctx) return;

  try {
    const res  = await fetch(
      `${API}/admin/revenue?period=${groupBy}&start=${fmt(startDate)}&end=${fmt(endDate)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const rows = (await res.json()).data || [];

    // ── Tạo full range các period và fill missing = 0 ──
    const { labels, revenues, orderCounts } = buildChartData(rows, groupBy, startDate, endDate);

    if (revenueChart) revenueChart.destroy();

    if (!revenues.some((v) => v > 0)) {
      // Hiển thị empty state trên canvas
      revenueChart = null;
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.fillStyle = "#aaa";
      ctx.font = "14px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⚠️ Không có dữ liệu doanh thu trong khoảng thời gian này", ctx.canvas.width / 2, ctx.canvas.height / 2);
      return;
    }

    revenueChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Doanh thu (đ)",
          data: revenues,
          backgroundColor: "rgba(99,102,241,.8)",
          borderColor: "#6366f1",
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) => ` ${new Intl.NumberFormat("vi-VN").format(c.raw)}đ`,
              afterLabel: (c) => {
                const cnt = orderCounts[c.dataIndex];
                return cnt ? `  ${cnt} đơn hàng` : "";
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (v) => v >= 1e6 ? (v / 1e6).toFixed(1).replace(".0", "") + "M" : v >= 1e3 ? (v/1e3).toFixed(0)+"k" : v,
              font: { size: 11 },
            },
            grid: { color: "#f0f2f5" },
          },
          x: { grid: { display: false }, ticks: { font: { size: 11 }, maxRotation: 45 } },
        },
      },
    });
  } catch (e) { console.error("Revenue chart error", e); }
}

// ── Payment Method Doughnut ───────────────────────────────────
async function loadPaymentChart() {
  try {
    const res  = await fetch(`${API}/admin/revenue/payment?start=${fmt(startDate)}&end=${fmt(endDate)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const rows = (await res.json()).data || [];
    if (!rows.length) return;

    const COLORS = { COD:"#f59e0b", BANK_TRANSFER:"#6366f1", MOMO:"#ec4899", ZALOPAY:"#22c55e" };
    const ctx = document.getElementById("chart-payment")?.getContext("2d");
    if (!ctx) return;
    if (paymentChart) paymentChart.destroy();
    paymentChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: rows.map((r) => r.method),
        datasets: [{
          data: rows.map((r) => r.total),
          backgroundColor: rows.map((r) => COLORS[r.method] || "#8b91a7"),
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position:"bottom", labels:{font:{size:11},boxWidth:12} } },
        cutout: "62%",
      },
    });
  } catch {}
}

// ── Product Stats ────────────────────────────────────────────
async function loadProductStats() {
  try {
    const res  = await fetch(`${API}/admin/products/stats?limit=8`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const { bestSellers, byCategory } = data.data;

    // Best sellers table
    const tbody = document.getElementById("bestsellers-tbody");
    tbody.innerHTML = bestSellers.map((b, i) => `
      <tr>
        <td style="font-weight:700;color:#aaa;">${i+1}</td>
        <td style="font-size:.83rem;font-weight:500;">${b.product?.name || "—"}</td>
        <td>${b.totalQuantity}</td>
        <td style="font-weight:600;">${formatVND(b.totalRevenue)}</td>
      </tr>`).join("") || `<tr><td colspan="4" style="text-align:center;color:#aaa;padding:16px;">Chưa có dữ liệu</td></tr>`;

    // Category horizontal bar chart
    if (byCategory.length) {
      const ctx = document.getElementById("chart-category")?.getContext("2d");
      if (!ctx) return;
      if (categoryChart) categoryChart.destroy();
      categoryChart = new Chart(ctx, {
        type: "bar",
        data: {
          labels: byCategory.slice(0,6).map((c) => c.categoryName),
          datasets: [{ label: "Doanh thu", data: byCategory.slice(0,6).map((c) => c.totalRevenue), backgroundColor:"rgba(34,197,94,.75)", borderRadius:6 }],
        },
        options: {
          indexAxis: "y",
          responsive: true, maintainAspectRatio: false,
          plugins: { legend:{display:false}, tooltip:{callbacks:{label:(c)=>` ${new Intl.NumberFormat("vi-VN").format(c.raw)}đ`}} },
          scales: { x:{ticks:{callback:(v)=>v>=1e6?(v/1e6).toFixed(0)+"M":v,font:{size:11}},grid:{color:"#f0f2f5"}}, y:{grid:{display:false},ticks:{font:{size:11}}} },
        },
      });
    }
  } catch { showToast("❌ Lỗi tải thống kê sản phẩm", "error"); }
}

// ── Export Data Table ────────────────────────────────────────
async function loadExportData() {
  const tbody = document.getElementById("export-orders-tbody");
  tbody.innerHTML = `<tr><td colspan="6" class="loading-state"><div class="spinner" style="margin:0 auto;"></div></td></tr>`;

  try {
    const res  = await fetch(`${API}/admin/export/orders?start=${fmt(startDate)}&end=${fmt(endDate)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    exportData = data.data || [];

    document.getElementById("orders-in-range").textContent = `${exportData.length} đơn hàng`;

    tbody.innerHTML = exportData.map((o) => {
      const s = ORDER_STATUS[o.status] || { label: o.status };
      return `
        <tr>
          <td style="font-weight:700;color:#6366f1;">#${o.orderId}</td>
          <td style="font-size:.82rem;color:#8b91a7;">${o.date}</td>
          <td>${o.customerName}</td>
          <td>${o.paymentMethod}</td>
          <td style="font-weight:700;">${formatVND(o.totalAmount)}</td>
          <td><span class="badge badge-${o.status.toLowerCase()}">${s.label}</span></td>
        </tr>`;
    }).join("") || `<tr><td colspan="6" style="text-align:center;padding:24px;color:#aaa;">Không có dữ liệu trong kỳ này</td></tr>`;
  } catch { showToast("❌ Lỗi tải dữ liệu export", "error"); }
}

// ── CSV Export ────────────────────────────────────────────────
function exportCSV() {
  if (!exportData.length) { showToast("⚠️ Không có dữ liệu để xuất", "warning"); return; }

  const csvData = exportData.map((o) => ({
    "Mã đơn":         `#${o.orderId}`,
    "Ngày đặt":       o.date,
    "Khách hàng":     o.customerName,
    "Email":          o.customerEmail,
    "Điện thoại":     o.shippingPhone,
    "Địa chỉ":        o.shippingAddress,
    "Sản phẩm":       o.items,
    "PT Thanh toán":  o.paymentMethod,
    "TT Thanh toán":  o.paymentStatus,
    "Tổng tiền":      o.totalAmount,
    "Trạng thái":     ORDER_STATUS[o.status]?.label || o.status,
    "Ghi chú":        o.note,
  }));

  // UTF-8 BOM để Excel đọc tiếng Việt đúng
  const csv  = "\uFEFF" + Papa.unparse(csvData, { header: true });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href  = url;
  link.download = `maverik-revenue-${fmt(startDate)}-${fmt(endDate)}.csv`;
  link.click();
  URL.revokeObjectURL(url);

  showToast("✅ Đã xuất file CSV", "success");
}

// ── PDF Export ────────────────────────────────────────────────
function exportPDF() {
  if (!exportData.length) { showToast("⚠️ Không có dữ liệu để xuất", "warning"); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Tính summary
  const totalRevenue = exportData.filter((o) => ["COMPLETED","DELIVERED"].includes(o.status)).reduce((s, o) => s + o.totalAmount, 0);
  const totalOrders  = exportData.length;
  const cancelCount  = exportData.filter((o) => o.status === "CANCELLED").length;

  // Header
  doc.setFontSize(16); doc.setFont("helvetica", "bold");
  doc.text("MAVERIK STORE - BAO CAO DOANH THU", 148.5, 16, { align: "center" });
  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  doc.setTextColor(130);
  doc.text(`Tu: ${fmt(startDate)} | Den: ${fmt(endDate)} | Xuat ngay: ${fmt(new Date())}`, 148.5, 23, { align: "center" });
  doc.setTextColor(0);

  // Summary table
  doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text("Tong ket:", 14, 32);
  doc.autoTable({
    startY: 35,
    head: [["Chi so", "Gia tri"]],
    body: [
      ["Doanh thu (COMPLETED + DELIVERED)", new Intl.NumberFormat("vi-VN").format(totalRevenue) + "d"],
      ["Tong so don hang",                  String(totalOrders)],
      ["So don huy",                        String(cancelCount)],
      ["AOV (gia tri don trung binh)",      new Intl.NumberFormat("vi-VN").format(totalOrders > 0 ? Math.round(totalRevenue/totalOrders) : 0) + "d"],
    ],
    theme: "grid",
    headStyles: { fillColor: [99, 102, 241] },
    styles: { fontSize: 9 },
    tableWidth: 100,
  });

  // Orders detail table
  doc.setFont("helvetica", "bold");
  doc.text("Chi tiet don hang:", 14, doc.lastAutoTable.finalY + 10);
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 13,
    head: [["Ma don", "Ngay", "Khach hang", "Dien thoai", "PT TT", "Tong tien", "Trang thai"]],
    body: exportData.map((o) => [
      `#${o.orderId}`,
      o.date,
      o.customerName,
      o.shippingPhone,
      o.paymentMethod,
      new Intl.NumberFormat("vi-VN").format(o.totalAmount) + "d",
      ORDER_STATUS[o.status]?.label || o.status,
    ]),
    theme: "striped",
    headStyles: { fillColor: [30, 33, 48] },
    styles: { fontSize: 8 },
    columnStyles: { 5: { halign: "right" } },
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(160);
    doc.text(`Trang ${i}/${pageCount} - Maverik Admin Dashboard`, 148.5, doc.internal.pageSize.height - 6, { align: "center" });
  }

  doc.save(`maverik-revenue-${fmt(startDate)}-${fmt(endDate)}.pdf`);
  showToast("✅ Đã xuất file PDF", "success");
}

// ── Build chart data với fill missing periods ─────────────────────────
function buildChartData(rows, period, start, end) {
  const dataMap = {};
  rows.forEach((r) => { dataMap[r.period] = { revenue: r.revenue, orderCount: r.orderCount }; });

  const labels      = [];
  const revenues    = [];
  const orderCounts = [];

  if (period === "day") {
    const cur = new Date(start); cur.setHours(0, 0, 0, 0);
    const endD = new Date(end); endD.setHours(23, 59, 59, 999);
    while (cur <= endD) {
      const key = fmt(cur);
      labels.push(cur.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }));
      revenues.push(dataMap[key]?.revenue ?? 0);
      orderCounts.push(dataMap[key]?.orderCount ?? 0);
      cur.setDate(cur.getDate() + 1);
    }
  } else if (period === "week") {
    rows.forEach((r) => {
      const [year, w] = r.period.split("-W");
      labels.push(`Tuần ${w}/${year}`);
      revenues.push(r.revenue);
      orderCounts.push(r.orderCount);
    });
  } else if (period === "month") {
    let y = start.getFullYear(), m = start.getMonth();
    const endY = end.getFullYear(), endM = end.getMonth();
    while (y < endY || (y === endY && m <= endM)) {
      const key = `${y}-${String(m + 1).padStart(2, "0")}`;
      labels.push(`T${m + 1}/${y}`);
      revenues.push(dataMap[key]?.revenue ?? 0);
      orderCounts.push(dataMap[key]?.orderCount ?? 0);
      m++; if (m > 11) { m = 0; y++; }
    }
  } else if (period === "year") {
    for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
      const key = String(y);
      labels.push(key);
      revenues.push(dataMap[key]?.revenue ?? 0);
      orderCounts.push(dataMap[key]?.orderCount ?? 0);
    }
  }

  return { labels, revenues, orderCounts };
}

// ── Helpers ───────────────────────────────────────────────────
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function fmt(d) { return new Date(d).toISOString().slice(0, 10); }
const setEl = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
