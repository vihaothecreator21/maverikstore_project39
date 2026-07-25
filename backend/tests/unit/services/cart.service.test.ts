import { Prisma } from "@prisma/client";
import { CartService } from "../../../src/services/cart.service";

const product = {
  id: 1,
  name: "Ao thun",
  slug: "ao-thun",
  price: new Prisma.Decimal(100000),
  discountPercent: new Prisma.Decimal(0),
  discountAmount: new Prisma.Decimal(0),
  imageUrl: null,
  stockQuantity: 3,
};

function createCart(id = 10, items: any[] = []) {
  return { id, userId: 1, items };
}

function createRepos() {
  return {
    cartRepository: {
      findCartByUserId: jest.fn(),
      createCart: jest.fn(),
      upsertCartItem: jest.fn(),
      updateItemQty: jest.fn(),
      removeItem: jest.fn(),
    },
    productRepository: {
      findById: jest.fn(),
    },
  };
}

describe("CartService", () => {
  it("creates a cart before syncing localStorage items for a new user", async () => {
    const { cartRepository, productRepository } = createRepos();
    const service = new CartService(cartRepository as any, productRepository as any);

    cartRepository.findCartByUserId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createCart())
      .mockResolvedValueOnce(createCart());
    productRepository.findById.mockResolvedValue(product);

    await service.syncLocalStorageCart(1, [
      { productId: 1, quantity: 2, size: "M", color: "Den" },
    ]);

    expect(cartRepository.createCart).toHaveBeenCalledWith(1);
    expect(cartRepository.upsertCartItem).toHaveBeenCalledWith(10, 1, "M", "Den", 2);
  });

  it("caps synced quantity to available stock for new cart items", async () => {
    const { cartRepository, productRepository } = createRepos();
    const service = new CartService(cartRepository as any, productRepository as any);

    cartRepository.findCartByUserId
      .mockResolvedValueOnce(createCart())
      .mockResolvedValueOnce(createCart());
    productRepository.findById.mockResolvedValue(product);

    await service.syncLocalStorageCart(1, [
      { productId: 1, quantity: 20, size: "M", color: "Den" },
    ]);

    expect(cartRepository.upsertCartItem).toHaveBeenCalledWith(10, 1, "M", "Den", 3);
  });

  it("merges matching localStorage items into an existing cart item", async () => {
    const { cartRepository, productRepository } = createRepos();
    const service = new CartService(cartRepository as any, productRepository as any);
    const existingItem = {
      id: 5,
      productId: 1,
      quantity: 2,
      size: "M",
      color: "Den",
      product,
    };

    cartRepository.findCartByUserId
      .mockResolvedValueOnce(createCart(10, [existingItem]))
      .mockResolvedValueOnce(createCart(10, [existingItem]));
    productRepository.findById.mockResolvedValue(product);

    await service.syncLocalStorageCart(1, [
      { productId: 1, quantity: 4, size: "M", color: "Den" },
    ]);

    expect(cartRepository.updateItemQty).toHaveBeenCalledWith(5, 3);
    expect(cartRepository.upsertCartItem).not.toHaveBeenCalled();
  });

  describe("getCart()", () => {
    it("returns an empty cart and auto-creates it if user has no cart", async () => {
      const { cartRepository, productRepository } = createRepos();
      const service = new CartService(cartRepository as any, productRepository as any);

      cartRepository.findCartByUserId
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 10, userId: 1, items: [] });
      
      const result = await service.getCart(1);

      expect(cartRepository.createCart).toHaveBeenCalledWith(1);
      expect(result.totalItems).toBe(0);
      expect(result.totalPrice).toBe(0);
      expect(result.items).toEqual([]);
    });
  });

  describe("addItem()", () => {
    it("adds a valid product to the cart", async () => {
      const { cartRepository, productRepository } = createRepos();
      const service = new CartService(cartRepository as any, productRepository as any);

      productRepository.findById.mockResolvedValue(product);
      cartRepository.findCartByUserId
        .mockResolvedValueOnce(createCart(10, []))
        .mockResolvedValueOnce(createCart(10, []));

      await service.addItem(1, { productId: 1, size: "M", color: "Den", quantity: 2 });

      expect(cartRepository.upsertCartItem).toHaveBeenCalledWith(10, 1, "M", "Den", 2);
    });

    it("throws PRODUCT_NOT_FOUND when product does not exist", async () => {
      const { cartRepository, productRepository } = createRepos();
      const service = new CartService(cartRepository as any, productRepository as any);

      productRepository.findById.mockResolvedValue(null);

      await expect(
        service.addItem(1, { productId: 999, size: "M", color: "Den", quantity: 1 })
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "PRODUCT_NOT_FOUND"
      });
    });

    it("throws INSUFFICIENT_STOCK when quantity exceeds stock", async () => {
      const { cartRepository, productRepository } = createRepos();
      const service = new CartService(cartRepository as any, productRepository as any);

      productRepository.findById.mockResolvedValue(product); // stockQuantity is 3

      await expect(
        service.addItem(1, { productId: 1, size: "M", color: "Den", quantity: 5 })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "INSUFFICIENT_STOCK"
      });
    });

    it("throws INSUFFICIENT_STOCK when existing plus requested quantity exceeds stock", async () => {
      const { cartRepository, productRepository } = createRepos();
      const service = new CartService(cartRepository as any, productRepository as any);
      const existingItem = {
        id: 5,
        productId: 1,
        quantity: 2,
        size: "M",
        color: "Den",
        product,
      };

      productRepository.findById.mockResolvedValue(product);
      cartRepository.findCartByUserId.mockResolvedValue(createCart(10, [existingItem]));

      await expect(
        service.addItem(1, { productId: 1, size: "M", color: "Den", quantity: 2 })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "INSUFFICIENT_STOCK",
      });
      expect(cartRepository.upsertCartItem).not.toHaveBeenCalled();
    });
  });

  describe("updateItemQty()", () => {
    it("updates quantity of an existing cart item", async () => {
      const { cartRepository, productRepository } = createRepos();
      const service = new CartService(cartRepository as any, productRepository as any);
      
      const existingItem = { id: 5, productId: 1, quantity: 2, size: "M", color: "Den", product };
      cartRepository.findCartByUserId
        .mockResolvedValueOnce(createCart(10, [existingItem]))
        .mockResolvedValueOnce(createCart(10, [{ ...existingItem, quantity: 3 }]));
      productRepository.findById.mockResolvedValue(product);

      await service.updateItemQty(1, 5, { quantity: 3 });

      expect(cartRepository.updateItemQty).toHaveBeenCalledWith(5, 3);
    });

    it("throws INSUFFICIENT_STOCK when updating quantity above stock", async () => {
      const { cartRepository, productRepository } = createRepos();
      const service = new CartService(cartRepository as any, productRepository as any);
      const existingItem = { id: 5, productId: 1, quantity: 2, size: "M", color: "Den", product };

      cartRepository.findCartByUserId.mockResolvedValue(createCart(10, [existingItem]));
      productRepository.findById.mockResolvedValue(product);

      await expect(
        service.updateItemQty(1, 5, { quantity: 4 })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "INSUFFICIENT_STOCK",
      });
      expect(cartRepository.updateItemQty).not.toHaveBeenCalled();
    });
  });

  describe("removeItem()", () => {
    it("removes an existing product from the cart", async () => {
      const { cartRepository, productRepository } = createRepos();
      const service = new CartService(cartRepository as any, productRepository as any);
      
      const existingItem = { id: 5, productId: 1, quantity: 2, size: "M", color: "Den", product };
      cartRepository.findCartByUserId
        .mockResolvedValueOnce(createCart(10, [existingItem]))
        .mockResolvedValueOnce(createCart(10, []));

      await service.removeItem(1, 5);

      expect(cartRepository.removeItem).toHaveBeenCalledWith(5);
    });
  });
});
