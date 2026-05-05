/**
 * OrderService Unit Tests
 *
 * ✅ Mục đích: Test logic nghiệp vụ (business rules) TÁCH BIỆT khỏi DB.
 *
 * Cách hoạt động:
 *   - Mock OrderRepository → giả lập dữ liệu trả về, KHÔNG query DB thật.
 *   - Chỉ test logic trong OrderService: validation, error handling, format output.
 *   - Mỗi test case kiểm tra 1 scenario cụ thể.
 *
 * Chạy:
 *   npm test                       → chạy tất cả tests
 *   npm test -- --testNamePattern="placeOrder"  → chạy test cụ thể
 */

import { OrderService } from "../src/services/order.service";
import { OrderRepository } from "../src/repositories/order.repository";
import { APIError } from "../src/utils/apiResponse";
import { Prisma, OrderStatus, PaymentStatus } from "@prisma/client";

// ── Mock OrderRepository ────────────────────────────────────────────
// jest.fn() tạo "giả" cho mỗi method — không gọi DB thật.
// Ta sẽ chỉ định return value cho từng test case.

function createMockOrderRepository(): jest.Mocked<OrderRepository> {
  return {
    findCartForOrder:         jest.fn(),
    createOrderAtomic:        jest.fn(),
    findByUserId:             jest.fn(),
    findAll:                  jest.fn(),
    findById:                 jest.fn(),
    updateStatusWithRollback: jest.fn(),
    cancelExpiredOrders:      jest.fn(),
  } as unknown as jest.Mocked<OrderRepository>;
}

// ── Test Data Fixtures ──────────────────────────────────────────────
// Dữ liệu giả dùng chung — dễ đọc, dễ maintain.

const MOCK_USER_ID = 1;

const MOCK_PLACE_ORDER_INPUT = {
  shippingAddress: "123 Nguyễn Huệ, Q1, TP.HCM",
  shippingPhone: "0901234567",
  paymentMethod: "VNPAY" as "VNPAY" | "COD" | "BANK_TRANSFER" | "MOMO",
  note: "Giao giờ hành chính",
};

const MOCK_CART = {
  id: 10,
  userId: MOCK_USER_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [
    {
      id: 100,
      cartId: 10,
      productId: 1,
      quantity: 2,
      size: "M",
      color: "Đen",
      createdAt: new Date(),
      updatedAt: new Date(),
      product: {
        id: 1,
        name: "Áo thun Basic",
        price: new Prisma.Decimal(250000),
        stockQuantity: 50,
      },
    },
    {
      id: 101,
      cartId: 10,
      productId: 2,
      quantity: 1,
      size: "L",
      color: "Trắng",
      createdAt: new Date(),
      updatedAt: new Date(),
      product: {
        id: 2,
        name: "Quần jeans Slim",
        price: new Prisma.Decimal(450000),
        stockQuantity: 20,
      },
    },
  ],
};

// Kết quả trả về từ createOrderAtomic (giả lập)
const MOCK_CREATED_ORDER = {
  id: 99,
  userId: MOCK_USER_ID,
  totalAmount: new Prisma.Decimal(950000), // 250000*2 + 450000*1
  status: OrderStatus.PENDING,
  shippingAddress: MOCK_PLACE_ORDER_INPUT.shippingAddress,
  shippingPhone: MOCK_PLACE_ORDER_INPUT.shippingPhone,
  note: MOCK_PLACE_ORDER_INPUT.note,
  createdAt: new Date("2026-05-01T10:00:00Z"),
  updatedAt: new Date("2026-05-01T10:00:00Z"),
  details: [
    {
      id: 1,
      orderId: 99,
      productId: 1,
      quantity: 2,
      size: "M",
      color: "Đen",
      priceAtPurchase: new Prisma.Decimal(250000),
      product: { id: 1, name: "Áo thun Basic", imageUrl: null, slug: "ao-thun-basic" },
    },
  ],
  payment: {
    id: 1,
    paymentMethod: "VNPAY",
    paymentStatus: PaymentStatus.PENDING,
    transactionId: null,
    amount: new Prisma.Decimal(950000),
  },
  user: { id: MOCK_USER_ID, username: "vihao", email: "test@example.com", phone: "0901234567" },
};

// ══════════════════════════════════════════════════════════════════════
// TEST SUITE: OrderService.placeOrder()
// ══════════════════════════════════════════════════════════════════════

describe("OrderService", () => {
  let orderService: OrderService;
  let mockRepo: jest.Mocked<OrderRepository>;

  // Trước MỖI test: tạo mock repository mới → đảm bảo test độc lập
  beforeEach(() => {
    mockRepo = createMockOrderRepository();
    orderService = new OrderService(mockRepo);
  });

  // ── placeOrder ──────────────────────────────────────────────────

  describe("placeOrder()", () => {
    /**
     * ✅ Happy path: giỏ hàng có sản phẩm → tạo đơn thành công.
     *
     * Kiểm tra:
     * 1. findCartForOrder() được gọi đúng userId
     * 2. createOrderAtomic() được gọi với đúng dữ liệu
     * 3. Kết quả trả về có totalAmount là number (không phải Decimal)
     */
    it("should create order successfully when cart has items", async () => {
      // ARRANGE — setup mock return values
      mockRepo.findCartForOrder.mockResolvedValue(MOCK_CART);
      mockRepo.createOrderAtomic.mockResolvedValue(MOCK_CREATED_ORDER);

      // ACT — gọi method cần test
      const result = await orderService.placeOrder(MOCK_USER_ID, MOCK_PLACE_ORDER_INPUT);

      // ASSERT — kiểm tra kết quả

      // 1. Repository được gọi đúng?
      expect(mockRepo.findCartForOrder).toHaveBeenCalledWith(MOCK_USER_ID);
      expect(mockRepo.findCartForOrder).toHaveBeenCalledTimes(1);

      // 2. createOrderAtomic nhận đúng tham số?
      expect(mockRepo.createOrderAtomic).toHaveBeenCalledWith(
        MOCK_USER_ID,
        MOCK_PLACE_ORDER_INPUT,
        expect.arrayContaining([
          expect.objectContaining({ productId: 1, quantity: 2 }),
          expect.objectContaining({ productId: 2, quantity: 1 }),
        ]),
        MOCK_CART.id, // cartId
      );

      // 3. Output format đúng? (Decimal → number)
      expect(result.totalAmount).toBe(950000);
      expect(typeof result.totalAmount).toBe("number");
    });

    /**
     * ❌ Error case: giỏ hàng trống → throw APIError CART_EMPTY.
     *
     * Business rule: Không cho đặt hàng khi giỏ rỗng.
     */
    it("should throw CART_EMPTY when cart is empty", async () => {
      // ARRANGE — giỏ hàng không có sản phẩm
      mockRepo.findCartForOrder.mockResolvedValue({
        id: 10,
        userId: MOCK_USER_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [], // ← giỏ trống
      });

      // ACT + ASSERT — expect error
      await expect(
        orderService.placeOrder(MOCK_USER_ID, MOCK_PLACE_ORDER_INPUT),
      ).rejects.toThrow(APIError);

      await expect(
        orderService.placeOrder(MOCK_USER_ID, MOCK_PLACE_ORDER_INPUT),
      ).rejects.toMatchObject({
        code: "CART_EMPTY",
      });

      // createOrderAtomic KHÔNG được gọi nếu giỏ trống
      expect(mockRepo.createOrderAtomic).not.toHaveBeenCalled();
    });

    /**
     * ❌ Error case: giỏ hàng NULL (user chưa có giỏ) → throw CART_EMPTY.
     */
    it("should throw CART_EMPTY when cart does not exist", async () => {
      mockRepo.findCartForOrder.mockResolvedValue(null);

      await expect(
        orderService.placeOrder(MOCK_USER_ID, MOCK_PLACE_ORDER_INPUT),
      ).rejects.toThrow(APIError);
    });

    /**
     * ❌ Error case: hết hàng (INSUFFICIENT_STOCK)
     *
     * Khi repository throw Error "INSUFFICIENT_STOCK::...",
     * service phải chuyển thành APIError 409 với thông tin rõ ràng.
     */
    it("should throw INSUFFICIENT_STOCK when product is out of stock", async () => {
      mockRepo.findCartForOrder.mockResolvedValue(MOCK_CART);

      // Repository throw lỗi hết hàng (Prisma transaction aborted)
      mockRepo.createOrderAtomic.mockRejectedValue(
        new Error("INSUFFICIENT_STOCK::Áo thun Basic::3"),
      );

      await expect(
        orderService.placeOrder(MOCK_USER_ID, MOCK_PLACE_ORDER_INPUT),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "INSUFFICIENT_STOCK",
      });
    });

    /**
     * ❌ Error case: lỗi DB không mong đợi → re-throw nguyên gốc.
     *
     * Service KHÔNG nuốt lỗi — để error handler middleware xử lý.
     */
    it("should re-throw unexpected errors from repository", async () => {
      mockRepo.findCartForOrder.mockResolvedValue(MOCK_CART);
      mockRepo.createOrderAtomic.mockRejectedValue(new Error("DB connection lost"));

      await expect(
        orderService.placeOrder(MOCK_USER_ID, MOCK_PLACE_ORDER_INPUT),
      ).rejects.toThrow("DB connection lost");
    });
  });

  // ── cancelOrder ─────────────────────────────────────────────────

  describe("cancelOrder()", () => {
    const MOCK_PENDING_ORDER = {
      ...MOCK_CREATED_ORDER,
      status: OrderStatus.PENDING,
      createdAt: new Date(), // mới tạo → trong 24h
    };

    /**
     * ❌ Không tìm thấy đơn hàng → throw ORDER_NOT_FOUND
     */
    it("should throw ORDER_NOT_FOUND when order does not exist", async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        orderService.cancelOrder(999, MOCK_USER_ID),
      ).rejects.toMatchObject({
        code: "ORDER_NOT_FOUND",
      });
    });

    /**
     * ❌ User cố hủy đơn của người khác → throw FORBIDDEN
     */
    it("should throw FORBIDDEN when user does not own the order", async () => {
      mockRepo.findById.mockResolvedValue({
        ...MOCK_PENDING_ORDER,
        userId: 999, // ← khác userId
      });

      await expect(
        orderService.cancelOrder(99, MOCK_USER_ID),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    /**
     * ❌ Đơn đã SHIPPING → không thể hủy
     */
    it("should throw INVALID_STATUS_FOR_CANCEL when order is SHIPPING", async () => {
      mockRepo.findById.mockResolvedValue({
        ...MOCK_PENDING_ORDER,
        status: OrderStatus.SHIPPING,
      });

      await expect(
        orderService.cancelOrder(99, MOCK_USER_ID),
      ).rejects.toMatchObject({
        code: "INVALID_STATUS_FOR_CANCEL",
      });
    });
  });
});
