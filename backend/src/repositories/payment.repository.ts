import { prisma } from "../config/database";
import { OrderStatus, PaymentStatus } from "@prisma/client";

/**
 * Payment Repository — Raw DB queries for payment operations.
 * PaymentService calls this layer, not Prisma directly.
 */
export class PaymentRepository {
  async findOrderWithPayment(orderId: number) {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payment: {
          select: { id: true, paymentStatus: true, amount: true },
        },
      },
    });
  }

  async findOrderAmount(orderId: number, userId: number) {
    return prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, totalAmount: true, userId: true },
    });
  }

  async markPaymentFailed(paymentId: number, transactionId: string | null) {
    return prisma.payment.update({
      where: { id: paymentId },
      data: { paymentStatus: PaymentStatus.FAILED, transactionId },
    });
  }

  /**
   * Atomic: mark payment SUCCESS + move order PENDING_PAYMENT → PENDING (or PENDING → CONFIRMED)
   */
  async confirmPaymentAndOrder(
    paymentId: number,
    orderId: number,
    transactionId: string | null,
    currentOrderStatus: OrderStatus,
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: { paymentStatus: PaymentStatus.SUCCESS, transactionId },
      });

      // PENDING_PAYMENT (VNPay mới) → PENDING (đã thanh toán, chờ admin xác nhận)
      if (currentOrderStatus === OrderStatus.PENDING_PAYMENT) {
        await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.PENDING },
        });
      }
      // PENDING (legacy/fallback) → CONFIRMED
      else if (currentOrderStatus === OrderStatus.PENDING) {
        await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.CONFIRMED },
        });
      }
    });
  }
}
