import { prisma } from "../config/database";
import { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { writeAuditLog } from "../utils/auditLog.helper";

// ── State Machine ──────────────────────────────────────────────────
export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: [OrderStatus.PENDING, OrderStatus.CANCELLED],  // VNPay IPN success → PENDING
  PENDING:    [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED:  [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.SHIPPING],
  SHIPPING:   [OrderStatus.DELIVERED],
  DELIVERED:  [OrderStatus.COMPLETED, OrderStatus.RETURNED],
  COMPLETED:  [],
  CANCELLED:  [],
  RETURNED:   [],
};

// ── Include preset ─────────────────────────────────────────────────
const orderWithDetails = {
  details: {
    include: {
      product: {
        select: { id: true, name: true, imageUrl: true, slug: true },
      },
    },
  },
  payment: {
    select: {
      id: true,
      paymentMethod: true,
      paymentStatus: true,
      transactionId: true,
      amount: true,
    },
  },
  user: {
    select: { id: true, username: true, email: true, phone: true },
  },
} satisfies Prisma.OrderInclude;

interface StockLockRow {
  id: number;
  name: string;
  stockQuantity: number;
}

// ── Class-based Repository ─────────────────────────────────────────
export class OrderRepository {
  async findCartForOrder(userId: number) {
    return prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, price: true, stockQuantity: true },
            },
          },
        },
      },
    });
  }

  async createOrderAtomic(
    userId: number,
    input: {
      shippingAddress: string;
      shippingPhone: string;
      paymentMethod: string;
      note?: string;
    },
    cartItems: Array<{
      productId: number;
      quantity: number;
      size: string;
      color: string;
      price: Prisma.Decimal;
      productName: string;
    }>,
    cartId: number,
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Lock rows + check stock
      for (const item of cartItems) {
        const locked = await tx.$queryRaw<StockLockRow[]>`
          SELECT id, name, stockQuantity FROM Product WHERE id = ${item.productId} FOR UPDATE
        `;
        if (!locked[0] || locked[0].stockQuantity < item.quantity) {
          const availableQty = locked[0]?.stockQuantity ?? 0;
          throw new Error(`INSUFFICIENT_STOCK::${item.productName}::${availableQty}`);
        }
      }

      // 2. Calculate total server-side
      const totalAmount = cartItems.reduce(
        (sum, item) => sum.add(new Prisma.Decimal(item.price).mul(item.quantity)),
        new Prisma.Decimal(0),
      );

      // 3. Create Order + Details + Payment
      // VNPay orders start as PENDING_PAYMENT — chỉ chuyển PENDING sau khi IPN xác nhận
      const initialStatus = input.paymentMethod === "VNPAY"
        ? OrderStatus.PENDING_PAYMENT
        : OrderStatus.PENDING;

      const order = await tx.order.create({
        data: {
          userId,
          totalAmount,
          status: initialStatus,
          shippingAddress: input.shippingAddress,
          shippingPhone: input.shippingPhone,
          note: input.note,
          details: {
            create: cartItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              size: item.size,
              color: item.color,
              priceAtPurchase: item.price,
            })),
          },
          payment: {
            create: {
              paymentMethod: input.paymentMethod,
              paymentStatus: PaymentStatus.PENDING,
              amount: totalAmount,
            },
          },
        },
        include: orderWithDetails,
      });

      // 4. Decrement stock
      for (const item of cartItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } },
        });
      }

      // 5. Clear cart
      await tx.cartItem.deleteMany({ where: { cartId } });

      return order;
    });
  }

  async findByUserId(userId: number, page: number, limit: number, status?: OrderStatus) {
    const where: Prisma.OrderWhereInput = { userId, ...(status && { status }) };
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          details: {
            select: {
              quantity: true,
              priceAtPurchase: true,
              size: true,
              color: true,
              product: { select: { name: true, imageUrl: true } },
            },
          },
          payment: {
            select: { paymentStatus: true, paymentMethod: true, amount: true },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);
    return { orders, total };
  }

  async findById(id: number) {
    return prisma.order.findUnique({
      where: { id },
      include: orderWithDetails,
    });
  }

  async findAll(
    page: number,
    limit: number,
    status?: OrderStatus,
    startDate?: Date,
    endDate?: Date,
  ) {
    const where: Prisma.OrderWhereInput = {
      ...(status && { status }),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate }),
            },
          }
        : {}),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: orderWithDetails,
      }),
      prisma.order.count({ where }),
    ]);
    return { orders, total };
  }

  async updateStatusWithRollback(
    orderId: number,
    newStatus: OrderStatus,
    shouldRestoreStock: boolean,
    auditData?: {
      action: "CANCEL" | "STATUS_CHANGE" | "TIMEOUT";
      oldStatus: OrderStatus;
      userId: number;
      note?: string;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { details: true },
      });

      if (!order) throw new Error(`Order ${orderId} not found`);

      if (shouldRestoreStock) {
        for (const detail of order.details) {
          await tx.product.update({
            where: { id: detail.productId },
            data: { stockQuantity: { increment: detail.quantity } },
          });
        }
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: newStatus },
        include: orderWithDetails,
      });

      if (auditData) {
        await writeAuditLog(
          {
            action: auditData.action,
            entity: "Order",
            entityId: orderId,
            oldValue: { status: auditData.oldStatus },
            newValue: { status: newStatus, ...(auditData.note && { note: auditData.note }) },
            userId: auditData.userId,
          },
          tx,
        );
      }

      return updated;
    });
  }

  async findTimedOutOrders() {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);
    return prisma.order.findMany({
      where: {
        // Tìm cả PENDING_PAYMENT (VNPay chưa thanh toán) và PENDING (COD) quá 15 phút
        status: { in: [OrderStatus.PENDING_PAYMENT, OrderStatus.PENDING] },
        createdAt: { lt: cutoff },
      },
      select: { id: true, userId: true, status: true },
    });
  }
}
