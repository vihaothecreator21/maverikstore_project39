import { Prisma } from "@prisma/client";
import { CartService } from "../src/services/cart.service";

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

    expect(cartRepository.updateItemQty).toHaveBeenCalledWith(5, 6);
    expect(cartRepository.upsertCartItem).not.toHaveBeenCalled();
  });
});
