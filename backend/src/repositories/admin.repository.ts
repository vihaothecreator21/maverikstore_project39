import { prisma } from "../config/database";
import { OrderStatus, PaymentStatus } from "@prisma/client";

/**
 * Admin Repository — Raw DB queries for admin analytics & reports
 * Only this layer talks to Prisma. Services call this layer.
 */
export class AdminRepository {
  // ── Dashboard counts ─────────────────────────────────────────────

  async countOrders() {
    return prisma.order.count();
  }

  async countOrdersByStatus() {
    return prisma.order.groupBy({
      by: ["status"],
      _count: { id: true },
    });
  }

  async countProducts() {
    return prisma.product.count();
  }

  async countCustomers() {
    return prisma.user.count({ where: { role: "CUSTOMER" } });
  }

  async sumOrderAmount(where: Parameters<typeof prisma.order.aggregate>[0]["where"]) {
    return prisma.order.aggregate({ where, _sum: { totalAmount: true } });
  }

  async countOrdersWhere(where: Parameters<typeof prisma.order.count>[0]) {
    return prisma.order.count(where);
  }

  async countLowStockProducts(threshold: number) {
    return prisma.product.count({ where: { stockQuantity: { lt: threshold } } });
  }

  // ── Revenue charts ───────────────────────────────────────────────

  async findOrdersForRevenue(
    startDate: Date,
    endDate: Date,
    statuses: OrderStatus[],
  ) {
    return prisma.order.findMany({
      where: {
        status: { in: statuses },
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { totalAmount: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async findPaymentsByMethod(startDate: Date, endDate: Date) {
    return prisma.payment.findMany({
      where: {
        paymentStatus: PaymentStatus.SUCCESS,
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { paymentMethod: true, amount: true },
    });
  }

  // ── Product stats ────────────────────────────────────────────────

  async groupOrderDetailsByProduct(limit: number) {
    return prisma.orderDetail.groupBy({
      by: ["productId"],
      _sum: { quantity: true, priceAtPurchase: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: limit,
    });
  }

  async findProductsByIds(ids: number[]) {
    return prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, imageUrl: true, price: true },
    });
  }

  async findLowStockProducts(threshold: number) {
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

  async groupOrderDetailsByCategory() {
    return prisma.orderDetail.groupBy({
      by: ["productId"],
      _sum: { priceAtPurchase: true },
    });
  }

  async findProductsWithCategory(ids: number[]) {
    return prisma.product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        categoryId: true,
        category: { select: { id: true, name: true } },
      },
    });
  }

  // ── Customer stats ───────────────────────────────────────────────

  async countNewCustomers(since: Date) {
    return prisma.user.count({
      where: { role: "CUSTOMER", createdAt: { gte: since } },
    });
  }

  async findTopSpenders(limit: number, statuses: OrderStatus[]) {
    return prisma.order.groupBy({
      by: ["userId"],
      where: { status: { in: statuses } },
      _sum: { totalAmount: true },
      _count: { id: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take: limit,
    });
  }

  async findUsersByIds(ids: number[]) {
    return prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, username: true, email: true, phone: true },
    });
  }

  // ── Export ───────────────────────────────────────────────────────

  async findOrdersForExport(startDate: Date, endDate: Date) {
    return prisma.order.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, username: true, email: true } },
        details: { include: { product: { select: { id: true, name: true } } } },
        payment: {
          select: { paymentMethod: true, paymentStatus: true, amount: true },
        },
      },
    });
  }

  async aggregateAOV(
    startDate: Date,
    endDate: Date,
    statuses: OrderStatus[],
  ) {
    return prisma.order.aggregate({
      where: {
        status: { in: statuses },
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { totalAmount: true },
      _count: { id: true },
    });
  }
}
