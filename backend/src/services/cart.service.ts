import { CartRepository } from "../repositories/cart.repository";
import { ProductRepository } from "../repositories/product.repository";
import { APIError } from "../utils/apiResponse";
import type { AddToCartInput, UpdateCartItemInput } from "../schemas/cart.schema";

export class CartService {
  static async getCart(userId: number) {
    let cart = await CartRepository.findCartByUserId(userId);
    
    // Auto-create if not exists
    if (!cart) {
      await CartRepository.createCart(userId);
      cart = await CartRepository.findCartByUserId(userId);
    }
    
    let totalPrice = 0;
    const items = cart?.items.map(item => {
      const itemTotal = item.product.price * item.quantity;
      totalPrice += itemTotal;
      return { ...item, itemTotal };
    }) || [];

    return {
      id: cart?.id,
      userId: cart?.userId,
      items,
      totalPrice,
      totalItems: items.reduce((acc, item) => acc + item.quantity, 0)
    };
  }

  static async addItem(userId: number, input: AddToCartInput) {
    const product = await ProductRepository.findById(input.productId);
    if (!product) throw new APIError(404, "Product not found", {}, "PRODUCT_NOT_FOUND");
    if (product.stockQuantity < input.quantity) {
      throw new APIError(400, `Not enough stock.`, { available: product.stockQuantity }, "INSUFFICIENT_STOCK");
    }

    let cart = await CartRepository.findCartByUserId(userId);
    if (!cart) {
      await CartRepository.createCart(userId);
      cart = await CartRepository.findCartByUserId(userId);
    }

    await CartRepository.upsertCartItem(cart!.id, input.productId, input.size, input.color, input.quantity);
    return this.getCart(userId);
  }

  static async updateItemQty(userId: number, cartItemId: number, input: UpdateCartItemInput) {
    const cart = await CartRepository.findCartByUserId(userId);
    if (!cart) throw new APIError(404, "Cart not found", {}, "CART_NOT_FOUND");

    const itemExists = cart.items.find(item => item.id === cartItemId);
    if (!itemExists) throw new APIError(404, "Item not found", {}, "ITEM_NOT_FOUND");

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

    const itemExists = cart.items.find(item => item.id === cartItemId);
    if (!itemExists) throw new APIError(404, "Item not found", {}, "ITEM_NOT_FOUND");

    await CartRepository.removeItem(cartItemId);
    return this.getCart(userId);
  }
}
