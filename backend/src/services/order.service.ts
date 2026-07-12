import { OrderRepository } from "../repositories/order.repository";
import {
  allowedTransitions,
  canTransition,
  shouldRestoreStock,
} from "../policies/orderStatus.policy";
import { APIError } from "../utils/apiResponse";
import { calculateSalePrice } from "../utils/pricing.helper";
import { OrderStatus, Prisma } from "@prisma/client";
import type {
  PlaceOrderInput,
  UpdateOrderStatusInput,
  OrderQueryInput,
} from "../schemas/order.schema";

// Kiểu dữ liệu trả về sau khi đã chuyển Decimal → number
type FormattedOrder = Record<string, unknown> & {
  totalAmount: number;
  details?: Array<Record<string, unknown> & { priceAtPurchase: number }>;
  payment?: (Record<string, unknown> & { amount: number }) | null;
};

/**
 * Order Service — Xử lý nghiệp vụ đơn hàng
 * UC-01: Đặt hàng | UC-02: Lịch sử | UC-03: Chi tiết | UC-04: Hủy | UC-06: Admin cập nhật
 */
export class OrderService {
  private orderRepository: OrderRepository;

  // Dependency Injection qua constructor — dễ thay mock khi test
  constructor(orderRepository: OrderRepository) {
    this.orderRepository = orderRepository;
  }

  // ── UC-01: Đặt hàng ─────────────────────────────────────────────
  async placeOrder(userId: number, input: PlaceOrderInput) {
    const cart = await this.orderRepository.findCartForOrder(userId);

    if (!cart || cart.items.length === 0) {
      throw new APIError(400, "Giỏ hàng của bạn đang trống", {}, "CART_EMPTY");
    }

    // Tính giá từ DB thay vì tin giá từ frontend → tránh gian lận giá
    const cartItems = cart.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      size: item.size,
      color: item.color,
      price: new Prisma.Decimal(calculateSalePrice(item.product)),
      productName: item.product.name,
    }));

    try {
      // Transaction atomic: lock kho → tính tổng → tạo order → trừ kho → xóa cart
      const order = await this.orderRepository.createOrderAtomic(
        userId,
        input,
        cartItems,
        cart.id,
      );
      return this._formatOrder(order);
    } catch (err: unknown) {
      // Bắt lỗi hết hàng từ transaction (format: "INSUFFICIENT_STOCK::tên::số lượng còn")
      if (err instanceof Error && err.message.startsWith("INSUFFICIENT_STOCK::")) {
        const [, productName, available] = err.message.split("::");
        throw new APIError(
          409,
          `Sản phẩm "${productName}" chỉ còn ${available} sản phẩm trong kho`,
          { productName, available: Number(available) },
          "INSUFFICIENT_STOCK",
        );
      }
      throw err;
    }
  }

  // ── UC-02: Lịch sử đơn của user ─────────────────────────────────
  async getMyOrders(userId: number, query: OrderQueryInput) {
    const { page, limit, status } = query;
    const { orders, total } = await this.orderRepository.findByUserId(
      userId, page, limit, status,
    );
    return {
      orders: orders.map((o) => this._formatOrder(o)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── UC-02b: Admin — xem tất cả đơn hàng ────────────────────────
  async adminGetOrders(query: OrderQueryInput) {
    const { page, limit, status, startDate, endDate } = query;
    const { orders, total } = await this.orderRepository.findAll(
      page, limit, status, startDate, endDate,
    );
    return {
      orders: orders.map((o) => this._formatOrder(o)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── UC-03: Chi tiết đơn ─────────────────────────────────────────
  async getOrderById(orderId: number, userId: number, isAdmin = false) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new APIError(404, "Không tìm thấy đơn hàng", {}, "ORDER_NOT_FOUND");

    // User thường chỉ xem được đơn của chính mình; admin xem tất cả (isAdmin=true)
    if (!isAdmin && order.userId !== userId) {
      throw new APIError(403, "Bạn không có quyền xem đơn hàng này", {}, "FORBIDDEN");
    }
    return this._formatOrder(order);
  }

  // ── UC-04: Hủy đơn (User) ───────────────────────────────────────
  async cancelOrder(orderId: number, userId: number) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new APIError(404, "Không tìm thấy đơn hàng", {}, "ORDER_NOT_FOUND");

    // Chỉ chủ đơn mới được hủy
    if (order.userId !== userId) {
      throw new APIError(403, "Bạn không có quyền hủy đơn hàng này", {}, "FORBIDDEN");
    }

    // Chỉ hủy được ở các trạng thái chưa xử lý
    if (
      order.status !== OrderStatus.PENDING_PAYMENT &&
      order.status !== OrderStatus.PENDING &&
      order.status !== OrderStatus.CONFIRMED
    ) {
      throw new APIError(
        400,
        `Không thể hủy đơn đang ở trạng thái "${order.status}"`,
        { currentStatus: order.status },
        "INVALID_STATUS_FOR_CANCEL",
      );
    }

    // Business rule: chỉ hủy trong vòng 24 giờ kể từ khi đặt
    const hoursSinceCreated =
      (Date.now() - order.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreated > 24) {
      throw new APIError(
        400,
        "Đã quá 24 giờ, không thể hủy đơn hàng này",
        { hoursSinceCreated: Math.floor(hoursSinceCreated) },
        "CANCEL_WINDOW_EXPIRED",
      );
    }

    let updated;
    try {
      // atomic: cập nhật status + hoàn kho + ghi AuditLog trong 1 transaction
      updated = await this.orderRepository.updateStatusWithRollback(
        orderId,
        OrderStatus.CANCELLED,
        true, // hoàn kho
        { action: "CANCEL", oldStatus: order.status, userId },
      );
    } catch (err: unknown) {
      // Race condition: ai đó đã đổi trạng thái trước → báo client tải lại
      if (err instanceof Error && err.message.startsWith("ORDER_STATUS_CHANGED::")) {
        throw new APIError(409, "Trạng thái đơn hàng đã thay đổi. Vui lòng tải lại.", { orderId }, "ORDER_STATUS_CHANGED");
      }
      throw err;
    }
    return this._formatOrder(updated);
  }

  // ── UC-06: Admin cập nhật trạng thái theo State Machine ─────────
  async adminUpdateStatus(
    orderId: number,
    input: UpdateOrderStatusInput,
    adminId: number,
  ) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new APIError(404, "Không tìm thấy đơn hàng", {}, "ORDER_NOT_FOUND");

    // Kiểm tra chuyển trạng thái có hợp lệ theo State Machine
    // Ví dụ: PENDING → CONFIRMED ✓ | SHIPPING → PENDING ✗
    const allowed = allowedTransitions(order.status);
    if (!canTransition(order.status, input.status)) {
      throw new APIError(
        400,
        `Không thể chuyển trạng thái từ "${order.status}" sang "${input.status}"`,
        { currentStatus: order.status, allowed },
        "INVALID_STATUS_TRANSITION",
      );
    }

    // Chỉ hoàn kho khi hủy (CANCELLED) hoặc trả hàng (RETURNED)
    const restoreStock = shouldRestoreStock(input.status);

    let updated;
    try {
      updated = await this.orderRepository.updateStatusWithRollback(
        orderId,
        input.status,
        restoreStock,
        { action: "STATUS_CHANGE", oldStatus: order.status, userId: adminId, note: input.note },
      );
    } catch (err: unknown) {
      // Race condition: 2 admin cùng cập nhật 1 đơn → 1 người thắng, người kia nhận 409
      if (err instanceof Error && err.message.startsWith("ORDER_STATUS_CHANGED::")) {
        throw new APIError(409, "Trạng thái đơn hàng đã thay đổi. Vui lòng tải lại.", { orderId }, "ORDER_STATUS_CHANGED");
      }
      throw err;
    }
    return this._formatOrder(updated);
  }

  // ── Private: Chuyển Decimal → number trước khi serialize JSON ───
  /**
   * Prisma dùng kiểu Decimal (decimal.js) cho cột DECIMAL(10,2) trong MySQL
   * để tránh lỗi làm tròn số thực (floating point error).
   * Trước khi gửi về client qua JSON, phải chuyển về number thuần.
   */
  private _formatOrder(order: Record<string, unknown>): FormattedOrder {
    const totalAmount =
      order.totalAmount instanceof Prisma.Decimal
        ? Number(order.totalAmount)
        : Number(order.totalAmount ?? 0);

    const details = Array.isArray(order.details)
      ? order.details.map((d) => {
          const detail = d as Record<string, unknown>;
          return {
            ...detail,
            priceAtPurchase:
              detail.priceAtPurchase instanceof Prisma.Decimal
                ? Number(detail.priceAtPurchase)
                : Number(detail.priceAtPurchase ?? 0),
          };
        })
      : undefined;

    const rawPayment = order.payment as
      | (Record<string, unknown> & { amount: unknown })
      | null
      | undefined;

    const payment = rawPayment
      ? {
          ...rawPayment,
          amount:
            rawPayment.amount instanceof Prisma.Decimal
              ? Number(rawPayment.amount)
              : Number(rawPayment.amount ?? 0),
        }
      : null;

    return { ...order, totalAmount, details, payment };
  }
}
