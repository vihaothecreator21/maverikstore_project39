import { prisma } from "../config/database";
import { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";

/**
 * Admin Service — Business Logic for Dashboard, Reports, and Export
 *
 * Aggregates data from existing repositories to power the admin dashboard.
 * All methods require ADMIN/SUPER_ADMIN role (enforced at route level).
 */
export class AdminService {
  // ────────────────────────────────────────────────────────
  // 1. DASHBOARD OVERVIEW STATS
  // ────────────────────────────────────────────────────────

  /**
   * Get complete dashboard statistics for the overview cards
   */
  static async getDashboardStats() {
    // ── Tính khoảng thời gian hôm nay (theo giờ Việt Nam UTC+7) ──
    const now = new Date();
    // Đầu ngày hôm nay: 00:00:00 giờ local
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    // Cuối ngày hôm nay: 23:59:59.999 giờ local
    const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [
      totalOrders,
      ordersByStatus,
      totalProducts,
      totalCustomers,
      revenueCompleted,
      revenueAll,
      lowStockProducts,
      pendingOrders,
      todayRevenueCompleted,
      todayRevenueAll,
      todayOrderCount,
    ] = await Promise.all([
      // Tổng số đơn hàng (all-time)
      prisma.order.count(),

      // Đếm đơn theo từng trạng thái
      prisma.order.groupBy({
        by: ["status"],
        _count: { id: true },
      }),

      // Tổng sản phẩm
      prisma.product.count(),

      // Tổng khách hàng (role = CUSTOMER)
      prisma.user.count({ where: { role: "CUSTOMER" } }),

      // Doanh thu thuần lịch sử (Net Sales) — chỉ COMPLETED (all-time)
      prisma.order.aggregate({
        where: { status: OrderStatus.COMPLETED },
        _sum: { totalAmount: true },
      }),

      // Doanh thu gộp lịch sử (Gross Sales) — tất cả trừ CANCELLED (all-time)
      prisma.order.aggregate({
        where: { status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] } },
        _sum: { totalAmount: true },
      }),

      // Sản phẩm sắp hết hàng (stock < 10)
      prisma.product.count({ where: { stockQuantity: { lt: 10 } } }),

      // Số đơn đang chờ xử lý
      prisma.order.count({ where: { status: OrderStatus.PENDING } }),

      // ── Doanh thu thuần HÔM NAY (chỉ COMPLETED trong ngày hôm nay) ──
      prisma.order.aggregate({
        where: {
          status: OrderStatus.COMPLETED,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
        _sum: { totalAmount: true },
      }),

      // ── Doanh thu gộp HÔM NAY (tất cả trừ CANCELLED trong ngày hôm nay) ──
      prisma.order.aggregate({
        where: {
          status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
          createdAt: { gte: todayStart, lte: todayEnd },
        },
        _sum: { totalAmount: true },
      }),

      // ── Tổng số đơn HÔM NAY ──
      prisma.order.count({
        where: { createdAt: { gte: todayStart, lte: todayEnd } },
      }),
    ]);

    // Map groupBy result thành object dễ đọc
    const statusMap: Record<string, number> = {};
    ordersByStatus.forEach((row) => {
      statusMap[row.status] = row._count.id;
    });

    // ── All-time metrics ──
    const grossRevenue = Number(revenueAll._sum.totalAmount ?? 0);
    const netRevenue   = Number(revenueCompleted._sum.totalAmount ?? 0);
    const totalCompletedOrders = statusMap[OrderStatus.COMPLETED] ?? 0;
    const aov = totalCompletedOrders > 0 ? netRevenue / totalCompletedOrders : 0;

    // ── Today metrics ──
    const todayGross = Number(todayRevenueAll._sum.totalAmount ?? 0);
    const todayNet   = Number(todayRevenueCompleted._sum.totalAmount ?? 0);

    // Tỷ lệ hủy đơn (all-time)
    const cancelledOrders = statusMap[OrderStatus.CANCELLED] ?? 0;
    const cancelRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;

    return {
      revenue: {
        gross: grossRevenue,
        net:   netRevenue,
        aov:   Math.round(aov),
        cancelRate: Math.round(cancelRate * 10) / 10,
      },
      // Doanh thu HÔM NAY — reset về 0 mỗi ngày mới
      today: {
        gross:      todayGross,
        net:        todayNet,
        orderCount: todayOrderCount,
        date:       todayStart.toISOString().slice(0, 10),
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        byStatus: statusMap,
      },
      products: {
        total: totalProducts,
        lowStock: lowStockProducts,
      },
      customers: {
        total: totalCustomers,
      },
    };
  }

  // ────────────────────────────────────────────────────────
  // 2. REVENUE CHARTS — THEO THỜI GIAN
  // ────────────────────────────────────────────────────────

  /**
   * Get revenue grouped by period (day/week/month/year) for bar chart
   * Returns array: [{ period: '2026-04-01', revenue: 1500000, orderCount: 5 }]
   */
  static async getRevenueByPeriod(
    period: "day" | "week" | "month" | "year",
    startDate: Date,
    endDate: Date,
  ) {
    // Fetch completed + delivered orders trong khoảng thời gian
    const orders = await prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.COMPLETED, OrderStatus.DELIVERED] },
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        totalAmount: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Group theo period — dùng giờ local (UTC+7) thay vì UTC
    const grouped: Record<string, { revenue: number; orderCount: number }> = {};

    // Offset múi giờ Việt Nam: +7h = 7 * 60 phút
    const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

    orders.forEach((order) => {
      // Chuyển sang giờ local Việt Nam
      const localDate = new Date(order.createdAt.getTime() + TZ_OFFSET_MS);
      let key: string;

      switch (period) {
        case "day":
          // YYYY-MM-DD theo giờ VN
          key = localDate.toISOString().slice(0, 10);
          break;
        case "week": {
          // ISO week: year-W## theo giờ local
          const d = new Date(localDate);
          d.setUTCHours(0, 0, 0, 0);
          d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
          const week1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
          const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7);
          key = `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
          break;
        }
        case "month":
          // YYYY-MM theo giờ VN
          key = localDate.toISOString().slice(0, 7);
          break;
        case "year":
          // YYYY theo giờ VN
          key = String(localDate.getUTCFullYear());
          break;
      }

      if (!grouped[key]) grouped[key] = { revenue: 0, orderCount: 0 };
      grouped[key].revenue += Number(order.totalAmount);
      grouped[key].orderCount += 1;
    });

    // Sort theo thứ tự thời gian (chronological)
    return Object.entries(grouped)
      .map(([period, data]) => ({
        period,
        revenue: Math.round(data.revenue),
        orderCount: data.orderCount,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  /**
   * Revenue grouped by payment method (for pie chart)
   */
  static async getRevenueByPaymentMethod(startDate: Date, endDate: Date) {
    const payments = await prisma.payment.findMany({
      where: {
        paymentStatus: PaymentStatus.SUCCESS,
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        paymentMethod: true,
        amount: true,
      },
    });

    const grouped: Record<string, { total: number; count: number }> = {};
    payments.forEach(({ paymentMethod, amount }) => {
      if (!grouped[paymentMethod]) grouped[paymentMethod] = { total: 0, count: 0 };
      grouped[paymentMethod].total += Number(amount);
      grouped[paymentMethod].count += 1;
    });

    return Object.entries(grouped).map(([method, data]) => ({
      method,
      total: Math.round(data.total),
      count: data.count,
    }));
  }

  // ────────────────────────────────────────────────────────
  // 3. PRODUCT STATS
  // ────────────────────────────────────────────────────────

  /**
   * Top selling products by quantity + revenue
   */
  static async getBestSellers(limit = 10) {
    const result = await prisma.orderDetail.groupBy({
      by: ["productId"],
      _sum: { quantity: true, priceAtPurchase: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: limit,
    });

    // Enrich with product info
    const productIds = result.map((r) => r.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, imageUrl: true, price: true },
    });
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    return result.map((r) => ({
      productId: r.productId,
      product: productMap[r.productId] ?? null,
      totalQuantity: r._sum.quantity ?? 0,
      totalRevenue:  Math.round(Number(r._sum.priceAtPurchase ?? 0)),
    }));
  }

  /**
   * Products with low stock (stock < threshold)
   */
  static async getLowStockProducts(threshold = 10) {
    return prisma.product.findMany({
      where: { stockQuantity: { lt: threshold } },
      select: {
        id: true,
        name: true,
        stockQuantity: true,
        imageUrl: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: { stockQuantity: "asc" },
    });
  }

  /**
   * Revenue breakdown by product category
   */
  static async getRevenueByCategory() {
    const result = await prisma.orderDetail.groupBy({
      by: ["productId"],
      _sum: { priceAtPurchase: true },
    });

    // Join with product → category
    const productIds = result.map((r) => r.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, categoryId: true, category: { select: { id: true, name: true } } },
    });
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    const categories: Record<number, { name: string; total: number }> = {};
    result.forEach((r) => {
      const product = productMap[r.productId];
      if (!product) return;
      const catId = product.categoryId;
      if (!categories[catId]) {
        categories[catId] = { name: product.category.name, total: 0 };
      }
      categories[catId].total += Number(r._sum.priceAtPurchase ?? 0);
    });

    return Object.entries(categories).map(([id, data]) => ({
      categoryId: Number(id),
      categoryName: data.name,
      totalRevenue: Math.round(data.total),
    })).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  // ────────────────────────────────────────────────────────
  // 4. CUSTOMER STATS
  // ────────────────────────────────────────────────────────

  static async getCustomerStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalCustomers, newThisMonth, topSpenders] = await Promise.all([
      prisma.user.count({ where: { role: "CUSTOMER" } }),

      prisma.user.count({
        where: { role: "CUSTOMER", createdAt: { gte: startOfMonth } },
      }),

      // Top 10 khách hàng chi tiêu nhiều nhất
      prisma.order.groupBy({
        by: ["userId"],
        where: { status: { in: [OrderStatus.COMPLETED, OrderStatus.DELIVERED] } },
        _sum: { totalAmount: true },
        _count: { id: true },
        orderBy: { _sum: { totalAmount: "desc" } },
        take: 10,
      }),
    ]);

    // Enrich topSpenders with user info
    const userIds = topSpenders.map((s) => s.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, email: true, phone: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    return {
      total: totalCustomers,
      newThisMonth,
      topSpenders: topSpenders.map((s) => ({
        user: userMap[s.userId] ?? null,
        totalSpent: Math.round(Number(s._sum.totalAmount ?? 0)),
        orderCount: s._count.id,
      })),
    };
  }

  // ────────────────────────────────────────────────────────
  // 5. EXPORT RAW DATA
  // ────────────────────────────────────────────────────────

  /**
   * Get orders for CSV/PDF export — returns full order rows
   */
  static async getOrdersForExport(startDate: Date, endDate: Date) {
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, username: true, email: true } },
        details: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
        payment: {
          select: { paymentMethod: true, paymentStatus: true, amount: true },
        },
      },
    });

    // Flatten for export
    return orders.map((order) => ({
      orderId:        order.id,
      date:           order.createdAt.toISOString().slice(0, 10),
      customerName:   order.user.username,
      customerEmail:  order.user.email,
      shippingPhone:  order.shippingPhone,
      shippingAddress: order.shippingAddress,
      paymentMethod:  order.payment?.paymentMethod ?? "COD",
      paymentStatus:  order.payment?.paymentStatus ?? "PENDING",
      totalAmount:    Number(order.totalAmount),
      status:         order.status,
      note:           order.note ?? "",
      items: order.details
        .map((d) => `${d.product.name} x${d.quantity} (${d.size}/${d.color})`)
        .join(" | "),
    }));
  }

  /**
   * AOV — Average Order Value in a date range
   */
  static async getAOV(startDate: Date, endDate: Date) {
    const result = await prisma.order.aggregate({
      where: {
        status: { in: [OrderStatus.COMPLETED, OrderStatus.DELIVERED] },
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { totalAmount: true },
      _count: { id: true },
    });
    const total = Number(result._sum.totalAmount ?? 0);
    const count = result._count.id;
    return {
      totalRevenue: Math.round(total),
      orderCount:   count,
      aov:          count > 0 ? Math.round(total / count) : 0,
    };
  }
}
