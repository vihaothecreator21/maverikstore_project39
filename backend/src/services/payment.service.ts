import { PaymentStatus } from "@prisma/client";
import { buildVNPayPaymentUrl, verifyVNPayReturn, type VNPayVerificationResult } from "../gateways/vnpay.gateway";
import { PaymentRepository } from "../repositories/payment.repository";
import { APIError } from "../utils/apiResponse";

export class PaymentService {
  private paymentRepository: PaymentRepository;

  constructor(paymentRepository: PaymentRepository) {
    this.paymentRepository = paymentRepository;
  }

  async createVNPayUrl(
    orderId: number,
    userId: number,
    clientIp: string,
  ): Promise<string> {
    const order = await this.paymentRepository.findOrderAmount(orderId, userId);

    if (!order) {
      throw new APIError(404, `Don hang #${orderId} khong ton tai`, {}, "ORDER_NOT_FOUND");
    }
    if (order.userId !== userId) {
      throw new APIError(403, "Ban khong co quyen thanh toan don hang nay", {}, "FORBIDDEN");
    }

    const ip =
      clientIp === "::1"
        ? "127.0.0.1"
        : clientIp.replace(/^::ffff:/, "") || "127.0.0.1";

    return buildVNPayPaymentUrl({
      orderId,
      amount: Number(order.totalAmount),
      clientIp: ip,
    });
  }

  verifyReturn(query: Record<string, string>): VNPayVerificationResult {
    return verifyVNPayReturn(query);
  }

  async handleIPN(
    params: Record<string, string>,
  ): Promise<{ RspCode: string; Message: string }> {
    try {
      const verified = this.verifyReturn(params);
      if (!verified.isValid) {
        return { RspCode: "97", Message: "Invalid Signature" };
      }

      const orderId = verified.orderId;
      if (!orderId) {
        return { RspCode: "01", Message: "Order not found" };
      }

      const order = await this.paymentRepository.findOrderWithPayment(orderId);

      if (!order || !order.payment) {
        return { RspCode: "01", Message: "Order not found" };
      }

      if (order.payment.paymentStatus === PaymentStatus.SUCCESS) {
        return { RspCode: "02", Message: "Order already confirmed" };
      }

      const vnpAmount = Number(params.vnp_Amount ?? 0) / 100;
      const orderAmount = Number(order.payment.amount);

      if (Math.abs(vnpAmount - orderAmount) > 1) {
        return { RspCode: "04", Message: "Invalid Amount" };
      }

      const transactionId = params.vnp_TransactionNo ?? null;

      if (!verified.isSuccess) {
        await this.paymentRepository.markPaymentFailed(order.payment.id, transactionId);
        return { RspCode: "00", Message: "Confirm Success" };
      }

      await this.paymentRepository.confirmPaymentAndOrder(
        order.payment.id,
        orderId,
        transactionId,
        order.status,
      );

      return { RspCode: "00", Message: "Confirm Success" };
    } catch (err) {
      console.error("[PaymentService.handleIPN] Unexpected error:", err);
      return { RspCode: "99", Message: "Unknown error" };
    }
  }

  async queryTransaction(): Promise<Record<string, never>> {
    return {};
  }

  async refundTransaction(): Promise<Record<string, never>> {
    return {};
  }
}
