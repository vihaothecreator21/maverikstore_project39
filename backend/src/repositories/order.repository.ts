import { prisma } from "../config/database";
import { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { writeAuditLog } from "../utils/auditLog.helper";

// ── State Machine: transition hợp lệ ──────────────────────────────
export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING:    [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED:  [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.SHIPPING],
  SHIPPING:   [OrderStatus.DELIVERED],
  DELIVERED:  [OrderStatus.COMPLETED, OrderStatus.RETURNED],
  COMPLETED:  [],
  CANCELLED:  [],
  RETURNED:   [],
};

// ── Include preset để tái sử dụng ─────────────────────────────────
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

// ── Raw query result types ─────────────────────────────────────────
interface StockLockRow {
  id: number;
  name: string;
  stockQuantity: number;
}

// ── Queries ────────────────────────────────────────────────────────

export const OrderRepository = {
  /**
   * Lấy giỏ hàng + sản phẩm để chuẩn bị đặt hàng
   */
  async findCartForOrder(userId: number) {
    return prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                stockQuantity: true,
              },
            },
          },
        },
      },
    });
  },

  /**
   * Tạo đơn hàng trong 1 atomic transaction.
   * Fix #1: SELECT FOR UPDATE lấy cả name → không cần query thứ 2
   * Fix #3: Dùng PaymentStatus.PENDING enum thay vì string
   */
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
      productName: string; // Fix #1: truyền name từ ngoài vào, không query thêm
    }>,
    cartId: number,
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Lock từng product row (SELECT FOR UPDATE) + lấy tồn kho hiện tại
      for (const item of cartItems) {
        // Fix #1: Select cả id, name, stockQuantity trong 1 query duy nhất
        const locked = await tx.$queryRaw<StockLockRow[]>`
          SELECT id, name, stockQuantity FROM Product WHERE id = ${item.productId} FOR UPDATE
        `;

        if (!locked[0] || locked[0].stockQuantity < item.quantity) {
          const availableQty = locked[0]?.stockQuantity ?? 0;
          throw new Error(
            `INSUFFICIENT_STOCK::${item.productName}::${availableQty}`,
          );
        }
      }

      // 2. Tính tổng tiền trong server (không tin giá từ client)
      const totalAmount = cartItems.reduce(
        (sum, item) =>
          sum.add(new Prisma.Decimal(item.price).mul(item.quantity)),
        new Prisma.Decimal(0),
      );

      // 3. Tạo Order + OrderDetails + Payment
      const order = await tx.order.create({
        data: {
          userId,
          totalAmount,
          status: OrderStatus.PENDING,
          shippingAddress: input.shippingAddress,
          shippingPhone: input.shippingPhone,
          note: input.note,
          details: {
            create: cartItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              size: item.size,
              color: item.color,
              priceAtPurchase: item.price, // Giá tại thời điểm mua — từ DB
            })),
          },
          payment: {
            create: {
              paymentMethod: input.paymentMethod,
              // Fix #3: Dùng enum PaymentStatus thay vì string "PENDING"
              paymentStatus: PaymentStatus.PENDING,
              amount: totalAmount,
            },
          },
        },
        include: orderWithDetails,
      });

      // 4. Trừ tồn kho
      for (const item of cartItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } },
        });
      }

      // 5. Xóa giỏ hàng
      await tx.cartItem.deleteMany({ where: { cartId } });

      return order;
    });
  },

  /**
   * Lấy danh sách đơn của user (phân trang)
   */
  async findByUserId(
    userId: number,
    page: number,
    limit: number,
    status?: OrderStatus,
  ) {
    const where: Prisma.OrderWhereInput = { userId, ...(status && { status }) };
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          // Fix #7: Include details để _formatOrder có thể map đúng
          details: {
            select: {
              quantity: true,
              priceAtPurchase: true,
              size: true,
              color: true,
              product: {
                select: { name: true, imageUrl: true },
              },
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
  },

  /**
   * Tìm 1 đơn hàng theo id
   */
  async findById(id: number) {
    return prisma.order.findUnique({
      where: { id },
      include: orderWithDetails,
    });
  },

  /**
   * Admin: lấy tất cả đơn có filter
   */
  async findAll(page: number, limit: number, status?: OrderStatus) {
    const where: Prisma.OrderWhereInput = status ? { status } : {};
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
  },

  /**
   * Cập nhật status đơn hàng + hoàn kho + ghi AuditLog — tất cả trong 1 transaction.
   * Fix #2: AuditLog được ghi BÊN TRONG transaction → đảm bảo atomicity
   *
   * @param orderId           ID đơn hàng
   * @param newStatus         Trạng thái mới
   * @param shouldRestoreStock Có hoàn kho không (true khi CANCEL/TIMEOUT)
   * @param auditData         Dữ liệu audit (nếu không truyền thì không ghi log)
   */
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

      // Hoàn kho nếu cần (cancel / timeout)
      // Note #6: Đây là intentional — hoàn đúng số lượng đã trừ khi đặt hàng
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

      // Fix #2: Ghi AuditLog BÊN TRONG transaction — nếu fail thì rollback cả order
      if (auditData) {
        await writeAuditLog(
          {
            action: auditData.action,
            entity: "Order",
            entityId: orderId,
            oldValue: { status: auditData.oldStatus },
            newValue: {
              status: newStatus,
              ...(auditData.note && { note: auditData.note }),
            },
            userId: auditData.userId,
          },
          tx, // Truyền transaction client vào
        );
      }

      return updated;
    });
  },

  /**
   * Cron job: tìm đơn PENDING quá 15 phút
   */
  async findTimedOutOrders() {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);
    return prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        createdAt: { lt: cutoff },
      },
      select: { id: true, userId: true },
    });
  },
};
