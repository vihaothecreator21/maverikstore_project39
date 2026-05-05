import { Request, Response } from "express";
import { cartService } from "../container";
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
    const cart = await cartService.getCart(req.userId!);
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
    const cart = await cartService.addItem(
      req.userId!,
      validation.data,
    );
    return sendSuccess(res, cart, "Item added", HTTP_STATUS.CREATED);
  }

  static async updateItemQty(req: Request, res: Response) {
    const cartItemId = parseInt(req.params.id);
    const validation = UpdateCartItemSchema.safeParse(req.body);
    if (!validation.success) throw new ValidationError("Validation failed", {});
    const cart = await cartService.updateItemQty(
      req.userId!,
      cartItemId,
      validation.data,
    );
    return sendSuccess(res, cart, "Item updated", HTTP_STATUS.OK);
  }

  static async removeItem(req: Request, res: Response) {
    const cart = await cartService.removeItem(
      req.userId!,
      parseInt(req.params.id),
    );
    return sendSuccess(res, cart, "Item removed", HTTP_STATUS.OK);
  }

  // ✅ NEW: Sync cart endpoint
  static async syncCart(req: Request, res: Response) {
    const validation = SyncCartSchema.safeParse(req.body);
    if (!validation.success) throw new ValidationError("Validation failed", {});

    const userId = req.userId!;
    const items = validation.data.items || [];

    const cart = await cartService.syncLocalStorageCart(userId, items);
    return sendSuccess(res, cart, "Cart synced successfully", HTTP_STATUS.OK);
  }
}
