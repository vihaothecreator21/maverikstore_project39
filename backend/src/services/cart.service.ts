import { CartRepository } from "../repositories/cart.repository";
import { ProductRepository } from "../repositories/product.repository";
import { APIError } from "../utils/apiResponse";
import type {
  AddToCartInput,
  UpdateCartItemInput,
  SyncCartInput,
} from "../schemas/cart.schema";

export class CartService {
  private cartRepository: CartRepository;
  private productRepository: ProductRepository;

  constructor(
    cartRepository: CartRepository,
    productRepository: ProductRepository,
  ) {
    this.cartRepository = cartRepository;
    this.productRepository = productRepository;
  }

  async getCart(userId: number) {
    let cart = await this.cartRepository.findCartByUserId(userId);

    // Auto-create if not exists
    if (!cart) {
      await this.cartRepository.createCart(userId);
      cart = await this.cartRepository.findCartByUserId(userId);
    }

    let totalPrice = 0;
    const items =
      cart?.items.map((item) => {
        const itemTotal = Number(item.product.price) * item.quantity;
        totalPrice += itemTotal;
        return { ...item, itemTotal };
      }) || [];

    return {
      id:         cart?.id,
      userId:     cart?.userId,
      items,
      totalPrice,
      totalItems: items.reduce((acc, item) => acc + item.quantity, 0),
    };
  }

  async addItem(userId: number, input: AddToCartInput) {
    const product = await this.productRepository.findById(input.productId);
    if (!product)
      throw new APIError(404, "Product not found", {}, "PRODUCT_NOT_FOUND");
    if (product.stockQuantity < input.quantity) {
      throw new APIError(
        400,
        `Not enough stock.`,
        { available: product.stockQuantity },
        "INSUFFICIENT_STOCK",
      );
    }

    let cart = await this.cartRepository.findCartByUserId(userId);
    if (!cart) {
      await this.cartRepository.createCart(userId);
      cart = await this.cartRepository.findCartByUserId(userId);
    }

    await this.cartRepository.upsertCartItem(
      cart!.id,
      input.productId,
      input.size,
      input.color,
      input.quantity,
    );
    return this.getCart(userId);
  }

  async updateItemQty(
    userId: number,
    cartItemId: number,
    input: UpdateCartItemInput,
  ) {
    const cart = await this.cartRepository.findCartByUserId(userId);
    if (!cart) throw new APIError(404, "Cart not found", {}, "CART_NOT_FOUND");

    const itemExists = cart.items.find((item) => item.id === cartItemId);
    if (!itemExists)
      throw new APIError(404, "Item not found", {}, "ITEM_NOT_FOUND");

    const product = await this.productRepository.findById(itemExists.productId);
    if (product && product.stockQuantity < input.quantity) {
      throw new APIError(400, "Not enough stock", {}, "INSUFFICIENT_STOCK");
    }

    await this.cartRepository.updateItemQty(cartItemId, input.quantity);
    return this.getCart(userId);
  }

  async removeItem(userId: number, cartItemId: number) {
    const cart = await this.cartRepository.findCartByUserId(userId);
    if (!cart) throw new APIError(404, "Cart not found", {}, "CART_NOT_FOUND");

    const itemExists = cart.items.find((item) => item.id === cartItemId);
    if (!itemExists)
      throw new APIError(404, "Item not found", {}, "ITEM_NOT_FOUND");

    await this.cartRepository.removeItem(cartItemId);
    return this.getCart(userId);
  }

  // Sync localStorage cart to DB
  async syncLocalStorageCart(userId: number, localItems: any[] = []) {
    try {
      let cart = await this.cartRepository.findCartByUserId(userId);
      if (!cart) {
        await this.cartRepository.createCart(userId);
        cart = await this.cartRepository.findCartByUserId(userId);
      }

      if (localItems && Array.isArray(localItems)) {
        for (const item of localItems) {
          const product = await this.productRepository.findById(item.productId);
          if (!product) {
            console.warn(`Product ${item.productId} not found, skipping`);
            continue;
          }

          const itemSize     = item.size || "One Size";
          const itemColor    = item.color || "Default";
          const requestedQty = Math.min(item.quantity || 1, 999);

          const existingCartItem = cart!.items.find(
            (cartItem) =>
              cartItem.productId === item.productId &&
              cartItem.size === itemSize &&
              cartItem.color === itemColor,
          );

          if (existingCartItem) {
            const newQty = Math.min(existingCartItem.quantity + requestedQty, 999);
            await this.cartRepository.updateItemQty(existingCartItem.id, newQty);
          } else {
            const availableQty =
              product.stockQuantity < requestedQty
                ? Math.min(requestedQty, product.stockQuantity)
                : requestedQty;

            await this.cartRepository.upsertCartItem(
              cart!.id,
              item.productId,
              itemSize,
              itemColor,
              availableQty,
            );
          }
        }
      }

      return this.getCart(userId);
    } catch (err) {
      console.error("Sync cart error:", err);
      throw new APIError(500, "Failed to sync cart", {}, "SYNC_FAILED");
    }
  }
}
