import request from "supertest";
import app from "../../src/app";
import jwt from "jsonwebtoken";
import { getEnv } from "../../src/config/env.config";
import { cartService, orderService, userRepository } from "../../src/container";
import { APIError } from "../../src/utils/apiResponse";

// MOCK SERVICES & REPOSITORIES TRONG CONTAINER
jest.mock("../../src/container", () => ({
  userRepository: {
    findById: jest.fn(),
  },
  cartService: {
    getCart: jest.fn(),
    addItem: jest.fn(),
  },
  orderService: {
    placeOrder: jest.fn(),
    getOrderById: jest.fn(),
  },
}));

describe("Cart and Order API Integration Tests", () => {
  let customerToken: string;
  let otherToken: string;

  beforeAll(() => {
    // Tạo token hợp lệ cho MOCK_USER (Customer)
    customerToken = jwt.sign(
      { userId: 1, role: "CUSTOMER" },
      getEnv().JWT_SECRET,
      { expiresIn: "1h" },
    );

    // Tạo token cho một user khác
    otherToken = jwt.sign(
      { userId: 2, role: "CUSTOMER" },
      getEnv().JWT_SECRET,
      { expiresIn: "1h" },
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Request không có JWT trả về 401
  it("GET /api/v1/cart - should return 401 if no JWT is provided", async () => {
    const res = await request(app).get("/api/v1/cart");
    
    expect(res.status).toBe(401);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("No token provided");
  });

  // 2. Customer đăng nhập có thể lấy cart
  it("GET /api/v1/cart - should return cart for authenticated customer", async () => {
    // Bỏ qua lỗi user do đã bị xoá
    (userRepository.findById as jest.Mock).mockResolvedValue({ id: 1, role: "CUSTOMER" });
    
    const mockCart = { id: 10, userId: 1, items: [], totalPrice: 0, totalItems: 0 };
    (cartService.getCart as jest.Mock).mockResolvedValue(mockCart);

    const res = await request(app)
      .get("/api/v1/cart")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data).toEqual(mockCart);
  });

  // 3. Thêm sản phẩm hợp lệ vào cart
  it("POST /api/v1/cart/items - should add item and return updated cart", async () => {
    (userRepository.findById as jest.Mock).mockResolvedValue({ id: 1, role: "CUSTOMER" });
    
    const mockUpdatedCart = { 
      id: 10, 
      userId: 1, 
      items: [{ productId: 5, quantity: 2, size: "M", color: "Den" }], 
      totalPrice: 500000, 
      totalItems: 2 
    };
    (cartService.addItem as jest.Mock).mockResolvedValue(mockUpdatedCart);

    const res = await request(app)
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        productId: 5,
        quantity: 2,
        size: "M",
        color: "Den"
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("success");
    expect(res.body.data).toEqual(mockUpdatedCart);
    expect(cartService.addItem).toHaveBeenCalledWith(1, {
      productId: 5,
      quantity: 2,
      size: "M",
      color: "Den"
    });
  });

  // 4. Quantity vượt stock trả về lỗi
  it("POST /api/v1/cart/items - should return 400 when quantity exceeds stock", async () => {
    (userRepository.findById as jest.Mock).mockResolvedValue({ id: 1, role: "CUSTOMER" });
    
    (cartService.addItem as jest.Mock).mockRejectedValue(
      new APIError(400, "Not enough stock", { available: 5 }, "INSUFFICIENT_STOCK")
    );

    const res = await request(app)
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        productId: 5,
        quantity: 10,
        size: "M",
        color: "Den"
      });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.errorCode).toBe("INSUFFICIENT_STOCK");
    expect(res.body.details.available).toBe(5);
  });

  // 5. Customer tạo order thành công
  it("POST /api/v1/orders - should create order successfully", async () => {
    (userRepository.findById as jest.Mock).mockResolvedValue({ id: 1, role: "CUSTOMER" });
    
    const mockOrder = { 
      id: 99, 
      status: "PENDING_PAYMENT", 
      totalAmount: 1000000 
    };
    (orderService.placeOrder as jest.Mock).mockResolvedValue(mockOrder);

    const payload = {
      shippingAddress: "123 Street",
      shippingPhone: "0901234567",
      paymentMethod: "VNPAY",
    };

    const res = await request(app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send(payload);

    expect(res.status).toBe(201); // Controller đang setup HTTP_STATUS.CREATED
    expect(res.body.status).toBe("success");
    expect(res.body.data.id).toBe(99);
    expect(orderService.placeOrder).toHaveBeenCalledWith(1, payload);
  });

  // 6. Customer không được xem order của người khác
  it("GET /api/v1/orders/:id - should return 403 when trying to access other's order", async () => {
    (userRepository.findById as jest.Mock).mockResolvedValue({ id: 2, role: "CUSTOMER" }); // Use other user
    
    // Giả sử service trả về FORBIDDEN APIError khi ID user không khớp
    (orderService.getOrderById as jest.Mock).mockRejectedValue(
      new APIError(403, "You do not have permission to view this order.", {}, "FORBIDDEN")
    );

    const res = await request(app)
      .get("/api/v1/orders/99")
      .set("Authorization", `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
    expect(res.body.status).toBe("error");
    expect(res.body.errorCode).toBe("FORBIDDEN");
  });
});
