import { Request, Response } from "express";
import { CartService } from "../services/cart.service";
import {
  AddToCartSchema,
  UpdateCartItemSchema,
  SyncCartSchema,
} from "../schemas/cart.schema";
import {
  ValidationError,
  sendSuccess,
  HTTP_STATUS,
} from "../utils/apiResponse";

export class CartController {
  static async getCart(req: Request, res: Response) {
    const cart = await CartService.getCart((req as any).userId);
    return sendSuccess(
      res,
      cart,
      "Cart retrieved successfully",
      HTTP_STATUS.OK,
    );
  }

  static async addItem(req: Request, res: Response) {
    const validation = AddToCartSchema.safeParse(req.body);
    if (!validation.success) throw new ValidationError("Validation failed", {});
    const cart = await CartService.addItem(
      (req as any).userId,
      validation.data,
    );
    return sendSuccess(res, cart, "Item added", HTTP_STATUS.CREATED);
  }

  static async updateItemQty(req: Request, res: Response) {
    const cartItemId = parseInt(req.params.id);
    const validation = UpdateCartItemSchema.safeParse(req.body);
    if (!validation.success) throw new ValidationError("Validation failed", {});
    const cart = await CartService.updateItemQty(
      (req as any).userId,
      cartItemId,
      validation.data,
    );
    return sendSuccess(res, cart, "Item updated", HTTP_STATUS.OK);
  }

  static async removeItem(req: Request, res: Response) {
    const cart = await CartService.removeItem(
      (req as any).userId,
      parseInt(req.params.id),
    );
    return sendSuccess(res, cart, "Item removed", HTTP_STATUS.OK);
  }

  // ✅ NEW: Sync cart endpoint
  static async syncCart(req: Request, res: Response) {
    const validation = SyncCartSchema.safeParse(req.body);
    if (!validation.success) throw new ValidationError("Validation failed", {});

    const userId = (req as any).userId;
    const items = validation.data.items || [];

    const cart = await CartService.syncLocalStorageCart(userId, items);
    return sendSuccess(res, cart, "Cart synced successfully", HTTP_STATUS.OK);
  }
}
