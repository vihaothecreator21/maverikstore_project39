import { Router } from "express";
import { CartController } from "../controllers/cart.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { catchAsync } from "../utils/catchAsync";

export const cartRoutes = Router();

cartRoutes.use(authMiddleware);
cartRoutes.get("/", catchAsync(CartController.getCart));
cartRoutes.post("/items", catchAsync(CartController.addItem));
cartRoutes.patch("/items/:id", catchAsync(CartController.updateItemQty));
cartRoutes.delete("/items/:id", catchAsync(CartController.removeItem));

// ✅ NEW: Sync endpoint for guest cart migration
cartRoutes.post("/sync", catchAsync(CartController.syncCart));
