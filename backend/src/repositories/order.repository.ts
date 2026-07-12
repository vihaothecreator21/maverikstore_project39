import { prisma } from "../config/database";
import { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { writeAuditLog } from "../utils/auditLog.helper";
import { shouldMarkPaymentSuccess } from "../policies/orderStatus.policy";

// ── Preset include dùng chung cho tất cả query lấy đơn hàng ────────────
// Định nghĩa 1 lần ở đây để tránh lặp code và đảm bảo nhất quán
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

// Kiểu dòng kết quả khi lock bảng Product bằng FOR UPDATE
interface StockLockRow {
  id: number;
  name: string;
  stockQuantity: number;
}

/**
 * Order Repository — Lớp truy cập dữ liệu đơn hàng
 * Chỉ lớp này giao tiếp trực tiếp với Prisma.
 * Service gọi lớp này; không gọi Prisma thẳng từ service.
 */
export class OrderRepository {
  /**
   * Lấy giỏ hàng kèm thông tin sản phẩm để chuẩn bị đặt hàng
   * Cần thông tin giá + tồn kho để tính tổng và kiểm tra stock
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
                discountPercent: true,
                discountAmount: true,
                stockQuantity: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Tạo đơn hàng theo cơ chế atomic (tất cả thành công hoặc tất cả rollback)
   *
   * Các bước trong transaction:
   * 1. Lock từng sản phẩm bằng SELECT ... FOR UPDATE → tránh race condition khi nhiều user cùng mua
   * 2. Kiểm tra tồn kho đủ không → ném lỗi nếu thiếu
   * 3. Tính tổng tiền từ DB (không tin giá frontend)
   * 4. Tạo Order + OrderDetails + Payment trong 1 câu lệnh
   * 5. Trừ tồn kho từng sản phẩm
   * 6. Xóa giỏ hàng
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
      productName: string;
    }>,
    cartId: number,
  ) {
    return prisma.$transaction(async (tx) => {
      // Bước 1: Lock từng sản phẩm và kiểm tra tồn kho
      // SELECT ... FOR UPDATE ngăn transaction khác đọc/ghi cùng lúc
      for (const item of cartItems) {
        const locked = await tx.$queryRaw<StockLockRow[]>`
          SELECT id, name, stockQuantity FROM Product WHERE id = ${item.productId} FOR UPDATE
        `;
        if (!locked[0] || locked[0].stockQuantity < item.quantity) {
          const availableQty = locked[0]?.stockQuantity ?? 0;
          // Ném lỗi có format đặc biệt để service bắt và xử lý
          throw new Error(`INSUFFICIENT_STOCK::${item.productName}::${availableQty}`);
        }
      }

      // Bước 2: Tính tổng tiền server-side bằng Decimal để tránh lỗi làm tròn
      const totalAmount = cartItems.reduce(
        (sum, item) => sum.add(new Prisma.Decimal(item.price).mul(item.quantity)),
        new Prisma.Decimal(0),
      );

      // Bước 3: Xác định trạng thái ban đầu theo phương thức thanh toán
      // VNPAY → PENDING_PAYMENT (chờ IPN xác nhận)
      // COD/BANK → PENDING (chờ admin xác nhận)
      const initialStatus = input.paymentMethod === "VNPAY"
        ? OrderStatus.PENDING_PAYMENT
        : OrderStatus.PENDING;

      // Bước 4: Tạo Order + OrderDetails + Payment trong 1 lệnh Prisma (nested create)
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
              priceAtPurchase: item.price, // Snapshot giá tại thời điểm mua
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

      // Bước 5: Trừ tồn kho từng sản phẩm
      for (const item of cartItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } },
        });
      }

      // Bước 6: Xóa toàn bộ CartItem (giỏ hàng) sau khi đặt hàng thành công
      await tx.cartItem.deleteMany({ where: { cartId } });

      return order;
    });
  }

  /**
   * Lấy danh sách đơn hàng của một user (phân trang)
   * Dùng Promise.all để chạy query count và findMany song song
   */
  async findByUserId(userId: number, page: number, limit: number, status?: OrderStatus) {
    const where: Prisma.OrderWhereInput = { userId, ...(status && { status }) };
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" }, // Mới nhất lên đầu
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

  /** Lấy chi tiết 1 đơn hàng theo ID (bao gồm đầy đủ details, payment, user) */
  async findById(id: number) {
    return prisma.order.findUnique({
      where: { id },
      include: orderWithDetails,
    });
  }

  /**
   * Admin: Lấy tất cả đơn hàng với bộ lọc tùy chọn
   * Hỗ trợ lọc theo status và khoảng thời gian (startDate, endDate)
   */
  async findAll(
    page: number,
    limit: number,
    status?: OrderStatus,
    startDate?: Date,
    endDate?: Date,
  ) {
    const where: Prisma.OrderWhereInput = {
      ...(status && { status }),
      // Chỉ thêm điều kiện thời gian nếu có ít nhất 1 trong 2 giá trị
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

  /**
   * Cập nhật trạng thái đơn hàng với cơ chế phòng race condition (Optimistic Lock)
   *
   * Cách hoạt động:
   * 1. Tìm đơn hàng
   * 2. Dùng updateMany với điều kiện WHERE status = expectedStatus
   *    → Nếu count = 0 (ai đó đã thay đổi status trước) → ném lỗi race condition
   * 3. Hoàn kho nếu cần
   * 4. Cập nhật payment status tương ứng
   * 5. Ghi AuditLog
   *
   * @param shouldRestoreStock - true nếu cần cộng lại tồn kho (khi hủy/trả hàng)
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

      const expectedStatus = auditData?.oldStatus ?? order.status;

      // Optimistic lock: chỉ update nếu status vẫn là expectedStatus
      // count = 0 nghĩa là ai đó đã đổi status → race condition
      const transition = await tx.order.updateMany({
        where: { id: orderId, status: expectedStatus },
        data: { status: newStatus },
      });

      if (transition.count !== 1) {
        throw new Error(`ORDER_STATUS_CHANGED::${orderId}::${expectedStatus}`);
      }

      // Hoàn kho khi hủy đơn hoặc trả hàng
      if (shouldRestoreStock) {
        for (const detail of order.details) {
          await tx.product.update({
            where: { id: detail.productId },
            data: { stockQuantity: { increment: detail.quantity } },
          });
        }
      }

      // Cập nhật payment status khi đơn bị hủy
      if (newStatus === OrderStatus.CANCELLED) {
        await tx.payment.updateMany({
          where: { orderId: orderId },
          data: { paymentStatus: PaymentStatus.FAILED },
        });
      }

      // Đánh dấu payment SUCCESS khi đơn hoàn thành (cho COD - thu tiền mặt)
      if (shouldMarkPaymentSuccess(newStatus)) {
        await tx.payment.updateMany({
          where: { orderId: orderId },
          data: { paymentStatus: PaymentStatus.SUCCESS },
        });
      }

      // Ghi AuditLog để truy vết lịch sử thay đổi
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

      const updated = await tx.order.findUnique({
        where: { id: orderId },
        include: orderWithDetails,
      });

      if (!updated) throw new Error(`Order ${orderId} not found after update`);
      return updated;
    });
  }

  /**
   * Tìm các đơn hàng VNPAY đã hết thời gian chờ thanh toán (>15 phút)
   * Dùng bởi background job orderTimeout để tự động hủy
   *
   * Chỉ hủy đơn PENDING_PAYMENT + phương thức VNPAY
   * → Đơn COD/BANK ở trạng thái PENDING vẫn chờ admin xác nhận (không tự hủy)
   */
  async findTimedOutOrders() {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000); // 15 phút trước
    return prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING_PAYMENT,
        payment: { is: { paymentMethod: "VNPAY" } },
        createdAt: { lt: cutoff }, // Tạo trước thời điểm cutoff
      },
      select: { id: true, userId: true, status: true },
    });
  }
}
