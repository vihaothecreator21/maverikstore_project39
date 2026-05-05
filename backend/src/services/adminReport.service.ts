import { OrderStatus } from "@prisma/client";
import { AdminRepository } from "../repositories/admin.repository";

/**
 * Admin Report Service — Business logic for charts, product stats, customer stats, export
 * Handles: revenue charts, best sellers, low stock, customer analytics, CSV export
 */
export class AdminReportService {
  private adminRepository: AdminRepository;

  constructor(adminRepository: AdminRepository) {
    this.adminRepository = adminRepository;
  }

  // ── Revenue by Period (bar chart) ────────────────────────────────
  async getRevenueByPeriod(
    period: "day" | "week" | "month" | "year",
    startDate: Date,
    endDate: Date,
  ) {
    const orders = await this.adminRepository.findOrdersForRevenue(startDate, endDate, [
      OrderStatus.COMPLETED,
      OrderStatus.DELIVERED,
    ]);

    const grouped: Record<string, { revenue: number; orderCount: number }> = {};

    // Offset múi giờ Việt Nam: +7h
    const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

    orders.forEach((order) => {
      const localDate = new Date(order.createdAt.getTime() + TZ_OFFSET_MS);
      let key: string;

      switch (period) {
        case "day":
          key = localDate.toISOString().slice(0, 10);
          break;
        case "week": {
          const d = new Date(localDate);
          d.setUTCHours(0, 0, 0, 0);
          d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
          const week1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
          const weekNum =
            1 +
            Math.round(
              ((d.getTime() - week1.getTime()) / 86400000 -
                3 +
                ((week1.getUTCDay() + 6) % 7)) /
                7,
            );
          key = `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
          break;
        }
        case "month":
          key = localDate.toISOString().slice(0, 7);
          break;
        case "year":
          key = String(localDate.getUTCFullYear());
          break;
      }

      if (!grouped[key]) grouped[key] = { revenue: 0, orderCount: 0 };
      grouped[key].revenue += Number(order.totalAmount);
      grouped[key].orderCount += 1;
    });

    return Object.entries(grouped)
      .map(([p, data]) => ({
        period: p,
        revenue: Math.round(data.revenue),
        orderCount: data.orderCount,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  // ── Revenue by Payment Method (pie chart) ───────────────────────
  async getRevenueByPaymentMethod(startDate: Date, endDate: Date) {
    const payments = await this.adminRepository.findPaymentsByMethod(startDate, endDate);

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

  // ── Product Stats ─────────────────────────────────────────────────
  async getBestSellers(limit = 10) {
    const result = await this.adminRepository.groupOrderDetailsByProduct(limit);

    const productIds = result.map((r) => r.productId);
    const products = await this.adminRepository.findProductsByIds(productIds);
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    return result.map((r) => ({
      productId: r.productId,
      product: productMap[r.productId] ?? null,
      totalQuantity: r._sum.quantity ?? 0,
      totalRevenue: Math.round(Number(r._sum.priceAtPurchase ?? 0)),
    }));
  }

  async getLowStockProducts(threshold = 10) {
    return this.adminRepository.findLowStockProducts(threshold);
  }

  async getRevenueByCategory() {
    const result = await this.adminRepository.groupOrderDetailsByCategory();
    const productIds = result.map((r) => r.productId);
    const products = await this.adminRepository.findProductsWithCategory(productIds);
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

    return Object.entries(categories)
      .map(([id, data]) => ({
        categoryId: Number(id),
        categoryName: data.name,
        totalRevenue: Math.round(data.total),
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  // ── Customer Stats ───────────────────────────────────────────────
  async getCustomerStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalCustomers, newThisMonth, topSpenders] = await Promise.all([
      this.adminRepository.countCustomers(),
      this.adminRepository.countNewCustomers(startOfMonth),
      this.adminRepository.findTopSpenders(10, [
        OrderStatus.COMPLETED,
        OrderStatus.DELIVERED,
      ]),
    ]);

    const userIds = topSpenders.map((s) => s.userId);
    const users = await this.adminRepository.findUsersByIds(userIds);
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

  // ── Export ───────────────────────────────────────────────────────
  async getOrdersForExport(startDate: Date, endDate: Date) {
    const orders = await this.adminRepository.findOrdersForExport(startDate, endDate);

    return orders.map((order) => ({
      orderId:         order.id,
      date:            order.createdAt.toISOString().slice(0, 10),
      customerName:    order.user.username,
      customerEmail:   order.user.email,
      shippingPhone:   order.shippingPhone,
      shippingAddress: order.shippingAddress,
      paymentMethod:   order.payment?.paymentMethod ?? "COD",
      paymentStatus:   order.payment?.paymentStatus ?? "PENDING",
      totalAmount:     Number(order.totalAmount),
      status:          order.status,
      note:            order.note ?? "",
      items: order.details
        .map((d) => `${d.product.name} x${d.quantity} (${d.size}/${d.color})`)
        .join(" | "),
    }));
  }

  async getAOV(startDate: Date, endDate: Date) {
    const result = await this.adminRepository.aggregateAOV(startDate, endDate, [
      OrderStatus.COMPLETED,
      OrderStatus.DELIVERED,
    ]);
    const total = Number(result._sum.totalAmount ?? 0);
    const count = result._count.id;
    return {
      totalRevenue: Math.round(total),
      orderCount:   count,
      aov:          count > 0 ? Math.round(total / count) : 0,
    };
  }
}
