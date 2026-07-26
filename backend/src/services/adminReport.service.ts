import { OrderStatus } from "@prisma/client";
import { AdminRepository } from "../repositories/admin.repository.js";

export interface AdminOrderExportDTO {
  orderId: number;
  date: string;
  customerName: string;
  customerEmail: string;
  shippingPhone: string;
  shippingAddress: string;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: number;
  status: string;
  statusCode: OrderStatus;
  statusLabel: string;
  note: string;
  items: string;
}

/**
 * Admin Report Service — Logic nghiệp vụ cho biểu đồ, thống kê sản phẩm, khách hàng, xuất dữ liệu
 * Xử lý: biểu đồ doanh thu, sản phẩm bán chạy, hàng sắp hết, phân tích khách hàng, xuất CSV
 */
export class AdminReportService {
  private adminRepository: AdminRepository;

  constructor(adminRepository: AdminRepository) {
    this.adminRepository = adminRepository;
  }

  // ── Doanh thu theo khoảng thời gian (biểu đồ cột) ───────────────
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
      const localDate = new Date(order.updatedAt.getTime() + TZ_OFFSET_MS);
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

    // ── Điền các khoảng trống với giá trị 0 ────────────────────────
    const result: Array<{ period: string; revenue: number; orderCount: number }> = [];
    const current = new Date(startDate);

    // Đảm bảo không bị lặp vô tận
    let safetyCounter = 0;
    while (current <= endDate && safetyCounter < 1000) {
      safetyCounter++;
      let key: string;
      const localDate = new Date(current.getTime() + TZ_OFFSET_MS);

      switch (period) {
        case "day":
          key = localDate.toISOString().slice(0, 10);
          current.setUTCDate(current.getUTCDate() + 1);
          break;
        case "month":
          key = localDate.toISOString().slice(0, 7);
          current.setUTCMonth(current.getUTCMonth() + 1);
          break;
        case "year":
          key = String(localDate.getUTCFullYear());
          current.setUTCFullYear(current.getUTCFullYear() + 1);
          break;
        case "week": {
          const d = new Date(localDate);
          d.setUTCHours(0, 0, 0, 0);
          d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
          const week1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
          const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7);
          key = `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
          current.setUTCDate(current.getUTCDate() + 7);
          break;
        }
        default:
          key = "";
      }

      if (key && !result.find(r => r.period === key)) {
        const data = grouped[key] || { revenue: 0, orderCount: 0 };
        result.push({
          period: key,
          revenue: Math.round(data.revenue),
          orderCount: data.orderCount,
        });
      }

      // Nếu period không phải day, tránh việc set date bị lệch
      if (period !== "day") {
        current.setUTCHours(0, 0, 0, 0);
      }
    }

    return result.sort((a, b) => a.period.localeCompare(b.period));
  }

  // ── Doanh thu theo phương thức thanh toán (biểu đồ tròn) ────────
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

  // ── Thống kê sản phẩm ─────────────────────────────────────────────
  async getBestSellers(limit = 10) {
    const result = await this.adminRepository.groupOrderDetailsByProduct(limit);

    const productIds = result.map((r) => r.productId);
    const products = await this.adminRepository.findProductsByIds(productIds);
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    return result.map((r) => ({
      productId: r.productId,
      product: productMap[r.productId] ?? null,
      totalQuantity: Number(r.totalQuantity ?? 0),
      totalRevenue: Math.round(Number(r.totalRevenue ?? 0)),
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
      categories[catId].total += Number(r.totalRevenue ?? 0);
    });

    return Object.entries(categories)
      .map(([id, data]) => ({
        categoryId: Number(id),
        categoryName: data.name,
        totalRevenue: Math.round(data.total),
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  // ── Thống kê khách hàng ──────────────────────────────────────────
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

  // ── Xuất dữ liệu ─────────────────────────────────────────────────
  async getOrdersForExport(startDate: Date, endDate: Date): Promise<AdminOrderExportDTO[]> {
    const orders = await this.adminRepository.findOrdersForExport(startDate, endDate);

    const ORDER_STATUS_LABELS: Record<string, string> = {
      PENDING_PAYMENT: "Chờ thanh toán VNPay",
      PENDING: "Chờ xác nhận",
      CONFIRMED: "Đã xác nhận",
      PROCESSING: "Đang chuẩn bị",
      SHIPPING: "Đang giao hàng",
      DELIVERED: "Đã giao",
      COMPLETED: "Hoàn thành",                                              
      CANCELLED: "Đã hủy",
      RETURNED: "Trả hàng",
    };

    const PAYMENT_STATUS_LABELS: Record<string, string> = {
      PENDING: "Chờ thanh toán",
      SUCCESS: "Thành công",
      FAILED: "Thất bại",
      REFUNDED: "Đã hoàn tiền",
    };

    return orders.map((order) => ({
      orderId:         order.id,
      date:            order.createdAt.toISOString().slice(0, 10),
      customerName:    order.user.username,
      customerEmail:   order.user.email,
      shippingPhone:   order.shippingPhone,
      shippingAddress: order.shippingAddress,
      paymentMethod:   order.payment?.paymentMethod ?? "COD",
      paymentStatus: (order.status === "DELIVERED" || order.status === "COMPLETED")
        ? "Thành công"
        : (order.status === "CANCELLED" ? "Thất bại" : (PAYMENT_STATUS_LABELS[order.payment?.paymentStatus ?? "PENDING"] || "Chờ thanh toán")),
      totalAmount:     Number(order.totalAmount),
      status:          ORDER_STATUS_LABELS[order.status] || order.status,
      statusCode:      order.status,
      statusLabel:     ORDER_STATUS_LABELS[order.status] || order.status,
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
