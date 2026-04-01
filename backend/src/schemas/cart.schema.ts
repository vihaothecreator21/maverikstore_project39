import { z } from "zod";

export const AddToCartSchema = z.object({
  productId: z.number().int().positive("Product ID must be valid"),
  size: z.string().min(1, "Size is required"),
  color: z.string().min(1, "Color is required"),
  quantity: z.number().int().positive("Quantity must be at least 1"),
});

export const UpdateCartItemSchema = z.object({
  quantity: z.number().int().positive("Quantity must be at least 1"),
});

export type AddToCartInput = z.infer<typeof AddToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>;
