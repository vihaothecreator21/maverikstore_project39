import { OrderStatus, Prisma } from "@prisma/client";
import { OrderRepository, VALID_TRANSITIONS } from "../repositories/order.repository";
import { APIError } from "../utils/apiResponse";
import type {
  PlaceOrderInput,
  UpdateOrderStatusInput,
  OrderQueryInput,
} from "../schemas/order.schema";

// Fix #5: Định nghĩa rõ return type thay vì dùng `any`
type FormattedOrder = Record<string, unknown> & {
  totalAmount: number;
  details?: Array<Record<string, unknown> & { priceAtPurchase: number }>;
  payment?: (Record<string, unknown> & { amount: number }) | null;
};

export class OrderService {
  // ── UC-01: Đặt hàng ─────────────────────────────────────────────
  static async placeOrder(userId: number, input: PlaceOrderInput) {
    const cart = await OrderRepository.findCartForOrder(userId);

    if (!cart || cart.items.length === 0) {
      throw new APIError(400, "Giỏ hàng của bạn đang trống", {}, "CART_EMPTY");
    }

    // Fix #1: Truyền productName vào cartItems để không query thêm trong repository
    const cartItems = cart.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      size: item.size,
      color: item.color,
      price: item.product.price, // Prisma.Decimal — giá từ DB
      productName: item.product.name, // Dùng trong error message nếu hết hàng
    }));

    try {
      const order = await OrderRepository.createOrderAtomic(
        userId,
        input,
        cartItems,
        cart.id,
      );
      return OrderService._formatOrder(order);
    } catch (err: unknown) {
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

  // ── UC-02: Lịch sử đơn ──────────────────────────────────────────
  static async getMyOrders(userId: number, query: OrderQueryInput) {
    const { page, limit, status } = query;
    const { orders, total } = await OrderRepository.findByUserId(
      userId, page, limit, status,
    );

    return {
      // Fix #7: _formatOrder xử lý Decimal đúng cho cả list lẫn detail
      orders: orders.map((o) => OrderService._formatOrder(o)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ── UC-02b: Admin — tất cả đơn hàng ────────────────────────────
  static async adminGetOrders(query: OrderQueryInput) {
    const { page, limit, status } = query;
    const { orders, total } = await OrderRepository.findAll(page, limit, status);
    return {
      orders: orders.map((o) => OrderService._formatOrder(o)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ── UC-03: Chi tiết đơn ─────────────────────────────────────────
  static async getOrderById(
    orderId: number,
    userId: number,
    isAdmin = false,
  ) {
    const order = await OrderRepository.findById(orderId);

    if (!order) {
      throw new APIError(404, "Không tìm thấy đơn hàng", {}, "ORDER_NOT_FOUND");
    }

    if (!isAdmin && order.userId !== userId) {
      throw new APIError(
        403,
        "Bạn không có quyền xem đơn hàng này",
        {},
        "FORBIDDEN",
      );
    }

    return OrderService._formatOrder(order);
  }

  // ── UC-04: Hủy đơn (User) ───────────────────────────────────────
  static async cancelOrder(orderId: number, userId: number) {
    const order = await OrderRepository.findById(orderId);

    if (!order) {
      throw new APIError(404, "Không tìm thấy đơn hàng", {}, "ORDER_NOT_FOUND");
    }

    if (order.userId !== userId) {
      throw new APIError(
        403,
        "Bạn không có quyền hủy đơn hàng này",
        {},
        "FORBIDDEN",
      );
    }

    // Rule: Chỉ hủy PENDING hoặc CONFIRMED
    if (
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

    // Rule: Chỉ trong 24 giờ
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

    // Fix #2: Truyền auditData vào updateStatusWithRollback
    // AuditLog được ghi BÊN TRONG transaction — đảm bảo atomicity
    const updated = await OrderRepository.updateStatusWithRollback(
      orderId,
      OrderStatus.CANCELLED,
      true, // hoàn kho
      {
        action: "CANCEL",
        oldStatus: order.status,
        userId,
      },
    );

    return OrderService._formatOrder(updated);
  }

  // ── UC-06: Admin cập nhật status ────────────────────────────────
  static async adminUpdateStatus(
    orderId: number,
    input: UpdateOrderStatusInput,
    adminId: number,
  ) {
    const order = await OrderRepository.findById(orderId);

    if (!order) {
      throw new APIError(404, "Không tìm thấy đơn hàng", {}, "ORDER_NOT_FOUND");
    }

    // Kiểm tra State Machine
    const allowed = VALID_TRANSITIONS[order.status];
    if (!allowed.includes(input.status)) {
      throw new APIError(
        400,
        `Không thể chuyển trạng thái từ "${order.status}" sang "${input.status}"`,
        { currentStatus: order.status, allowed },
        "INVALID_STATUS_TRANSITION",
      );
    }

    const shouldRestoreStock = input.status === OrderStatus.CANCELLED;

    // Fix #2: AuditLog trong transaction
    const updated = await OrderRepository.updateStatusWithRollback(
      orderId,
      input.status,
      shouldRestoreStock,
      {
        action: "STATUS_CHANGE",
        oldStatus: order.status,
        userId: adminId,
        note: input.note,
      },
    );

    return OrderService._formatOrder(updated);
  }




  // Fix #5: Typed helper — không dùng any
  // Fix #7: Convert tất cả Decimal field sang number đúng cách
  private static _formatOrder(order: Record<string, unknown>): FormattedOrder {
    const totalAmount = order.totalAmount instanceof Prisma.Decimal
      ? Number(order.totalAmount)
      : Number(order.totalAmount ?? 0);

    const details = Array.isArray(order.details)
      ? order.details.map((d) => {
          const detail = d as Record<string, unknown>;
          return {
            ...detail,
            priceAtPurchase: detail.priceAtPurchase instanceof Prisma.Decimal
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
          amount: rawPayment.amount instanceof Prisma.Decimal
            ? Number(rawPayment.amount)
            : Number(rawPayment.amount ?? 0),
        }
      : null;

    return { ...order, totalAmount, details, payment };
  }
}
