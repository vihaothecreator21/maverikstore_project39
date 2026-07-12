import { prisma } from "../config/database";
import { OrderStatus, PaymentStatus } from "@prisma/client";

/**
 * Payment Repository — Truy vấn DB thô cho các thao tác thanh toán.
 * PaymentService gọi lấp này, không gọi Prisma trực tiếp.
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
   * Atomic: cập nhật payment SUCCESS + chuyển order PENDING_PAYMENT sang PENDING.
   */
  async confirmPaymentAndOrder(
    paymentId: number,
    orderId: number,
    transactionId: string | null,
    currentOrderStatus: OrderStatus,
  ) {
    return prisma.$transaction(async (tx) => {
      const latest = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          status: true,
          payment: { select: { id: true, paymentStatus: true } },
        },
      });

      if (
        !latest ||
        !latest.payment ||
        latest.payment.id !== paymentId ||
        latest.status !== OrderStatus.PENDING_PAYMENT ||
        latest.payment.paymentStatus !== PaymentStatus.PENDING ||
        currentOrderStatus !== OrderStatus.PENDING_PAYMENT
      ) {
        return { ignored: true };
      }

      const orderUpdate = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.PENDING_PAYMENT },
        data: { status: OrderStatus.PENDING },
      });

      const paymentUpdate = await tx.payment.updateMany({
        where: { id: paymentId, orderId, paymentStatus: PaymentStatus.PENDING },
        data: { paymentStatus: PaymentStatus.SUCCESS, transactionId },
      });

      if (orderUpdate.count !== 1 || paymentUpdate.count !== 1) {
        throw new Error(`PAYMENT_CONFIRM_CONFLICT::${orderId}`);
      }

      return { ignored: false };
    });
  }
}
