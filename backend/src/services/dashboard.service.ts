import { OrderStatus } from "@prisma/client";
import { AdminRepository } from "../repositories/admin.repository";

/**
 * Dashboard Service — Business logic for admin overview stats
 * Handles: overview cards, today metrics, status breakdown
 */
export class DashboardService {
  private adminRepository: AdminRepository;

  constructor(adminRepository: AdminRepository) {
    this.adminRepository = adminRepository;
  }

  async getDashboardStats() {
    // ── Khoảng thời gian hôm nay (giờ local) ──────────────────────
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
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
      this.adminRepository.countOrders(),
      this.adminRepository.countOrdersByStatus(),
      this.adminRepository.countProducts(),
      this.adminRepository.countCustomers(),
      // Net revenue (COMPLETED all-time)
      this.adminRepository.sumOrderAmount({ status: OrderStatus.COMPLETED }),
      // Gross revenue (tất cả trừ CANCELLED/RETURNED)
      this.adminRepository.sumOrderAmount({
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
      }),
      this.adminRepository.countLowStockProducts(10),
      this.adminRepository.countOrdersWhere({ where: { status: OrderStatus.PENDING } }),
      // Today net
      this.adminRepository.sumOrderAmount({
        status: OrderStatus.COMPLETED,
        createdAt: { gte: todayStart, lte: todayEnd },
      }),
      // Today gross
      this.adminRepository.sumOrderAmount({
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
        createdAt: { gte: todayStart, lte: todayEnd },
      }),
      this.adminRepository.countOrdersWhere({
        where: { createdAt: { gte: todayStart, lte: todayEnd } },
      }),
    ]);

    // Map groupBy → object
    const statusMap: Record<string, number> = {};
    ordersByStatus.forEach((row) => {
      statusMap[row.status] = row._count.id;
    });

    const grossRevenue = Number(revenueAll._sum.totalAmount ?? 0);
    const netRevenue   = Number(revenueCompleted._sum.totalAmount ?? 0);
    const totalCompletedOrders = statusMap[OrderStatus.COMPLETED] ?? 0;
    const aov = totalCompletedOrders > 0 ? netRevenue / totalCompletedOrders : 0;

    const todayGross = Number(todayRevenueAll._sum.totalAmount ?? 0);
    const todayNet   = Number(todayRevenueCompleted._sum.totalAmount ?? 0);

    const cancelledOrders = statusMap[OrderStatus.CANCELLED] ?? 0;
    const cancelRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;

    return {
      revenue: {
        gross: grossRevenue,
        net:   netRevenue,
        aov:   Math.round(aov),
        cancelRate: Math.round(cancelRate * 10) / 10,
      },
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
}
