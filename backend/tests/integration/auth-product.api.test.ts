import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../src/app.js";
import { getEnv } from "../../src/config/env.config.js";
import { authService, productService, userRepository } from "../../src/container.js";
import { APIError } from "../../src/utils/apiResponse.js";

jest.mock("../../src/config/database", () => ({
  prisma: {
    category: {
      findUnique: jest.fn().mockResolvedValue({ id: 1 }),
    },
  },
  connectDatabase: jest.fn(),
  disconnectDatabase: jest.fn(),
}));

jest.mock("../../src/container", () => ({
  authService: {
    register: jest.fn(),
    login: jest.fn(),
    getProfile: jest.fn(),
  },
  productService: {
    getAll: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getBestSellers: jest.fn(),
    fixNullSlugs: jest.fn(),
  },
  userRepository: {
    findById: jest.fn(),
  },
}));

describe("Auth, authorization, and product API", () => {
  const customerToken = () =>
    jwt.sign({ userId: 1, role: "CUSTOMER" }, getEnv().JWT_SECRET, { expiresIn: "1h" });
  const adminToken = () =>
    jwt.sign({ userId: 2, role: "ADMIN" }, getEnv().JWT_SECRET, { expiresIn: "1h" });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET /health returns a public health response", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, status: "ok" });
  });

  it("GET /api/health returns a public API health response", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, status: "ok" });
  });

  it("POST /api/v1/auth/register returns accepted for valid registration", async () => {
    (authService.register as jest.Mock).mockResolvedValue({
      email: "new@example.com",
      expiresInSeconds: 300,
      resendAfterSeconds: 60,
    });

    const res = await request(app).post("/api/v1/auth/register").send({
      fullName: "New User",
      email: " New@Example.com ",
      phone: "+84901234567",
      password: "Password1",
    });

    expect(res.status).toBe(202);
    expect(authService.register).toHaveBeenCalledWith(
      expect.objectContaining({ email: "new@example.com" }),
    );
  });

  it("POST /api/v1/auth/register returns 409 for duplicate email", async () => {
    (authService.register as jest.Mock).mockRejectedValue(
      new APIError(409, "Email already registered", {}, "EMAIL_ALREADY_EXISTS"),
    );

    const res = await request(app).post("/api/v1/auth/register").send({
      fullName: "New User",
      email: "new@example.com",
      phone: "+84901234567",
      password: "Password1",
    });

    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe("EMAIL_ALREADY_EXISTS");
  });

  it("POST /api/v1/auth/login returns token for valid credentials", async () => {
    (authService.login as jest.Mock).mockResolvedValue({
      token: "jwt-token",
      user: { id: 1, email: "user@example.com", role: "CUSTOMER" },
    });

    const res = await request(app).post("/api/v1/auth/login").send({
      email: " USER@Example.com ",
      password: "Password1",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBe("jwt-token");
    expect(authService.login).toHaveBeenCalledWith(
      expect.objectContaining({ email: "user@example.com" }),
    );
  });

  it("POST /api/v1/auth/login returns 401 for wrong password", async () => {
    (authService.login as jest.Mock).mockRejectedValue(
      new APIError(401, "Invalid email or password", {}, "INVALID_CREDENTIALS"),
    );

    const res = await request(app).post("/api/v1/auth/login").send({
      email: "user@example.com",
      password: "wrong",
    });

    expect(res.status).toBe(401);
    expect(res.body.errorCode).toBe("INVALID_CREDENTIALS");
  });

  it("GET /api/v1/auth/profile returns 401 without token", async () => {
    const res = await request(app).get("/api/v1/auth/profile");

    expect(res.status).toBe(401);
  });

  it("GET /api/v1/auth/profile returns 401 for invalid token", async () => {
    const res = await request(app)
      .get("/api/v1/auth/profile")
      .set("Authorization", "Bearer invalid-token");

    expect(res.status).toBe(401);
  });

  it("GET /api/v1/auth/profile returns profile for valid token", async () => {
    (userRepository.findById as jest.Mock).mockResolvedValue({ id: 1, role: "CUSTOMER" });
    (authService.getProfile as jest.Mock).mockResolvedValue({
      id: 1,
      email: "user@example.com",
      role: "CUSTOMER",
    });

    const res = await request(app)
      .get("/api/v1/auth/profile")
      .set("Authorization", `Bearer ${customerToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty("passwordHash");
  });

  it("POST /api/v1/products returns 403 for a customer", async () => {
    (userRepository.findById as jest.Mock).mockResolvedValue({ id: 1, role: "CUSTOMER" });

    const res = await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${customerToken()}`)
      .send({});

    expect(res.status).toBe(403);
  });

  it("PUT /api/v1/products/:id returns 403 for a customer", async () => {
    (userRepository.findById as jest.Mock).mockResolvedValue({ id: 1, role: "CUSTOMER" });

    const res = await request(app)
      .put("/api/v1/products/1")
      .set("Authorization", `Bearer ${customerToken()}`)
      .send({ name: "Blocked" });

    expect(res.status).toBe(403);
  });

  it("DELETE /api/v1/products/:id returns 403 for a customer", async () => {
    (userRepository.findById as jest.Mock).mockResolvedValue({ id: 1, role: "CUSTOMER" });

    const res = await request(app)
      .delete("/api/v1/products/1")
      .set("Authorization", `Bearer ${customerToken()}`);

    expect(res.status).toBe(403);
  });

  it("POST /api/v1/products lets an admin create a product", async () => {
    (userRepository.findById as jest.Mock).mockResolvedValue({ id: 2, role: "ADMIN" });
    (productService.create as jest.Mock).mockResolvedValue({ id: 10, name: "Admin Product" });

    const res = await request(app)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({
        categoryId: 1,
        name: "Admin Product",
        price: 100000,
        stockQuantity: 5,
        imageUrl: "https://example.com/product.jpg",
      });

    expect(res.status).toBe(201);
    expect(productService.create).toHaveBeenCalled();
  });

  it("GET /api/v1/products returns a product list", async () => {
    (productService.getAll as jest.Mock).mockResolvedValue({
      products: [{ id: 1, name: "Ao thun" }],
      meta: { page: 1, limit: 12, total: 1, pages: 1 },
    });

    const res = await request(app).get("/api/v1/products");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it("GET /api/v1/products passes pagination to the service", async () => {
    (productService.getAll as jest.Mock).mockResolvedValue({
      products: [],
      meta: { page: 2, limit: 5, total: 0, pages: 0 },
    });

    const res = await request(app).get("/api/v1/products?page=2&limit=5");

    expect(res.status).toBe(200);
    expect(productService.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 5 }),
    );
  });

  it("GET /api/v1/products passes search filters to the service", async () => {
    (productService.getAll as jest.Mock).mockResolvedValue({
      products: [],
      meta: { page: 1, limit: 12, total: 0, pages: 0 },
    });

    const res = await request(app).get("/api/v1/products?search=shirt");

    expect(res.status).toBe(200);
    expect(productService.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ search: "shirt" }),
    );
  });

  it("GET /api/v1/products/:id returns 404 when product is missing", async () => {
    (productService.getById as jest.Mock).mockRejectedValue(
      new APIError(404, "Product with ID 999 not found", {}, "PRODUCT_NOT_FOUND"),
    );

    const res = await request(app).get("/api/v1/products/999");

    expect(res.status).toBe(404);
    expect(res.body.errorCode).toBe("PRODUCT_NOT_FOUND");
  });
});
