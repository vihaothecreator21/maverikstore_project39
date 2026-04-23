import { CartRepository } from "../repositories/cart.repository";
import { ProductRepository } from "../repositories/product.repository";
import { APIError } from "../utils/apiResponse";
import type {
  AddToCartInput,
  UpdateCartItemInput,
  SyncCartInput,
} from "../schemas/cart.schema";

export class CartService {
  static async getCart(userId: number) {
    let cart = await CartRepository.findCartByUserId(userId);

    // Auto-create if not exists
    if (!cart) {
      await CartRepository.createCart(userId);
      cart = await CartRepository.findCartByUserId(userId);
    }

    let totalPrice = 0;
    const items =
      cart?.items.map((item) => {
        // ✅ FIX: price là Prisma.Decimal, cần .toNumber() trước khi tính toán
        const itemTotal = Number(item.product.price) * item.quantity;
        totalPrice += itemTotal;
        return { ...item, itemTotal };
      }) || [];

    return {
      id: cart?.id,
      userId: cart?.userId,
      items,
      totalPrice,
      totalItems: items.reduce((acc, item) => acc + item.quantity, 0),
    };
  }

  static async addItem(userId: number, input: AddToCartInput) {
    const product = await ProductRepository.findById(input.productId);
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

    let cart = await CartRepository.findCartByUserId(userId);
    if (!cart) {
      await CartRepository.createCart(userId);
      cart = await CartRepository.findCartByUserId(userId);
    }

    await CartRepository.upsertCartItem(
      cart!.id,
      input.productId,
      input.size,
      input.color,
      input.quantity,
    );
    return this.getCart(userId);
  }

  static async updateItemQty(
    userId: number,
    cartItemId: number,
    input: UpdateCartItemInput,
  ) {
    const cart = await CartRepository.findCartByUserId(userId);
    if (!cart) throw new APIError(404, "Cart not found", {}, "CART_NOT_FOUND");

    const itemExists = cart.items.find((item) => item.id === cartItemId);
    if (!itemExists)
      throw new APIError(404, "Item not found", {}, "ITEM_NOT_FOUND");

    const product = await ProductRepository.findById(itemExists.productId);
    if (product && product.stockQuantity < input.quantity) {
      throw new APIError(400, "Not enough stock", {}, "INSUFFICIENT_STOCK");
    }

    await CartRepository.updateItemQty(cartItemId, input.quantity);
    return this.getCart(userId);
  }

  static async removeItem(userId: number, cartItemId: number) {
    const cart = await CartRepository.findCartByUserId(userId);
    if (!cart) throw new APIError(404, "Cart not found", {}, "CART_NOT_FOUND");

    const itemExists = cart.items.find((item) => item.id === cartItemId);
    if (!itemExists)
      throw new APIError(404, "Item not found", {}, "ITEM_NOT_FOUND");

    await CartRepository.removeItem(cartItemId);
    return this.getCart(userId);
  }

  // ✅ NEW: Sync localStorage cart to DB
  // 📝 Logic: For each item, check if (productId + size + color) already exists in DB
  //    - If exists: ADD quantities together (accumulate, don't replace)
  //    - If not exists: Create new cart item
  static async syncLocalStorageCart(userId: number, localItems: any[] = []) {
    try {
      // Get or create user's cart
      let cart = await CartRepository.findCartByUserId(userId);
      if (!cart) {
        await CartRepository.createCart(userId);
        cart = await CartRepository.findCartByUserId(userId);
      }

      // Process each localStorage item
      if (localItems && Array.isArray(localItems)) {
        for (const item of localItems) {
          // Validate product exists
          const product = await ProductRepository.findById(item.productId);
          if (!product) {
            console.warn(`Product ${item.productId} not found, skipping`);
            continue;
          }

          const itemSize = item.size || "One Size";
          const itemColor = item.color || "Default";
          const requestedQty = Math.min(item.quantity || 1, 999);

          // ✅ Check if item already exists in DB (same productId + size + color)
          const existingCartItem = cart!.items.find(
            (cartItem) =>
              cartItem.productId === item.productId &&
              cartItem.size === itemSize &&
              cartItem.color === itemColor,
          );

          if (existingCartItem) {
            // ✅ ACCUMULATE: Add quantities together
            const newQty = Math.min(
              existingCartItem.quantity + requestedQty,
              999,
            );
            await CartRepository.updateItemQty(existingCartItem.id, newQty);
            console.log(
              `Updated item ${item.productId}: ${existingCartItem.quantity} + ${requestedQty} = ${newQty}`,
            );
          } else {
            // Check stock before adding
            if (product.stockQuantity < requestedQty) {
              const availableQty = Math.min(
                requestedQty,
                product.stockQuantity,
              );
              await CartRepository.upsertCartItem(
                cart!.id,
                item.productId,
                itemSize,
                itemColor,
                availableQty,
              );
              console.warn(
                `Added ${item.productId} with limited qty: ${availableQty}`,
              );
            } else {
              await CartRepository.upsertCartItem(
                cart!.id,
                item.productId,
                itemSize,
                itemColor,
                requestedQty,
              );
              console.log(
                `Added new item ${item.productId}: qty ${requestedQty}`,
              );
            }
          }
        }
      }

      // Return updated cart
      return this.getCart(userId);
    } catch (err) {
      console.error("Sync cart error:", err);
      throw new APIError(500, "Failed to sync cart", {}, "SYNC_FAILED");
    }
  }
}
