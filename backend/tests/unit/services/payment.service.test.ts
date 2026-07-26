import { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { PaymentService } from "../../../src/services/payment.service.js";

jest.mock("../../../src/gateways/vnpay.gateway", () => ({
  buildVNPayPaymentUrl: jest.fn(() => "https://vnpay.test/pay"),
  verifyVNPayReturn: jest.fn(),
}));

const { buildVNPayPaymentUrl, verifyVNPayReturn } = jest.requireMock("../../../src/gateways/vnpay.gateway") as {
  buildVNPayPaymentUrl: jest.Mock;
  verifyVNPayReturn: jest.Mock;
};

function createRepo() {
  return {
    findOrderAmount: jest.fn(),
    findOrderWithPayment: jest.fn(),
    markPaymentFailed: jest.fn(),
    confirmPaymentAndOrder: jest.fn(),
  };
}

describe("PaymentService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes INTCARD bankCode to gateway when creating VNPay URL", async () => {
    const repo = createRepo();
    const service = new PaymentService(repo as any);

    repo.findOrderAmount.mockResolvedValue({
      id: 7,
      userId: 10,
      totalAmount: new Prisma.Decimal(125000),
    });

    const result = await service.createVNPayUrl(7, 10, "::1", "INTCARD");

    expect(result).toBe("https://vnpay.test/pay");
    expect(buildVNPayPaymentUrl).toHaveBeenCalledWith({
      orderId: 7,
      amount: 125000,
      clientIp: "127.0.0.1",
      bankCode: "INTCARD",
    });
  });

  it("keeps default VNPay URL creation unchanged without bankCode", async () => {
    const repo = createRepo();
    const service = new PaymentService(repo as any);

    repo.findOrderAmount.mockResolvedValue({
      id: 8,
      userId: 10,
      totalAmount: new Prisma.Decimal(500000),
    });

    const result = await service.createVNPayUrl(8, 10, "203.0.113.10");

    expect(result).toBe("https://vnpay.test/pay");
    expect(buildVNPayPaymentUrl).toHaveBeenCalledWith({
      orderId: 8,
      amount: 500000,
      clientIp: "203.0.113.10",
    });
  });

  it("confirms payment and order when VNPay IPN is valid and successful", async () => {
    const repo = createRepo();
    const service = new PaymentService(repo as any);

    verifyVNPayReturn.mockReturnValue({
      isValid: true,
      isSuccess: true,
      orderId: 99,
      amount: 950000,
      responseCode: "00",
      message: "OK",
    });
    repo.findOrderWithPayment.mockResolvedValue({
      id: 99,
      status: OrderStatus.PENDING_PAYMENT,
      payment: {
        id: 1,
        amount: new Prisma.Decimal(950000),
        paymentStatus: PaymentStatus.PENDING,
      },
    });

    const result = await service.handleIPN({
      vnp_Amount: "95000000",
      vnp_TransactionNo: "TX123",
    });

    expect(result).toEqual({ RspCode: "00", Message: "Confirm Success" });
    expect(repo.confirmPaymentAndOrder).toHaveBeenCalledWith(
      1,
      99,
      "TX123",
      OrderStatus.PENDING_PAYMENT,
    );
    expect(repo.markPaymentFailed).not.toHaveBeenCalled();
  });

  it("does not update DB when VNPay signature is invalid", async () => {
    const repo = createRepo();
    const service = new PaymentService(repo as any);

    verifyVNPayReturn.mockReturnValue({ isValid: false });

    const result = await service.handleIPN({ vnp_Amount: "95000000" });

    expect(result).toEqual({ RspCode: "97", Message: "Invalid Signature" });
    expect(repo.findOrderWithPayment).not.toHaveBeenCalled();
    expect(repo.confirmPaymentAndOrder).not.toHaveBeenCalled();
  });

  it("marks payment failed when VNPay verifies a failed transaction", async () => {
    const repo = createRepo();
    const service = new PaymentService(repo as any);

    verifyVNPayReturn.mockReturnValue({
      isValid: true,
      isSuccess: false,
      isCancelled: false,
      orderId: 99,
      responseCode: "99",
      message: "Failed",
    });
    repo.findOrderWithPayment.mockResolvedValue({
      id: 99,
      status: OrderStatus.PENDING_PAYMENT,
      payment: {
        id: 1,
        amount: new Prisma.Decimal(950000),
        paymentStatus: PaymentStatus.PENDING,
      },
    });

    const result = await service.handleIPN({
      vnp_Amount: "95000000",
      vnp_TransactionNo: "TX124",
    });

    expect(result).toEqual({ RspCode: "00", Message: "Confirm Success" });
    expect(repo.markPaymentFailed).toHaveBeenCalledWith(1, "TX124");
    expect(repo.confirmPaymentAndOrder).not.toHaveBeenCalled();
  });

  it("keeps payment pending when VNPay reports user cancellation", async () => {
    const repo = createRepo();
    const service = new PaymentService(repo as any);

    verifyVNPayReturn.mockReturnValue({
      isValid: true,
      isSuccess: false,
      isCancelled: true,
      orderId: 99,
      responseCode: "24",
      message: "Cancelled",
    });
    repo.findOrderWithPayment.mockResolvedValue({
      id: 99,
      status: OrderStatus.PENDING_PAYMENT,
      payment: {
        id: 1,
        amount: new Prisma.Decimal(950000),
        paymentStatus: PaymentStatus.PENDING,
      },
    });

    const result = await service.handleIPN({
      vnp_Amount: "95000000",
      vnp_TransactionNo: "TX125",
      vnp_BankCode: "INTCARD",
    });

    expect(result).toEqual({ RspCode: "00", Message: "Confirm Success" });
    expect(repo.markPaymentFailed).not.toHaveBeenCalled();
    expect(repo.confirmPaymentAndOrder).not.toHaveBeenCalled();
  });
});
