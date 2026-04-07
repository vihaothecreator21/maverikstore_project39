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

// ✅ NEW: Sync cart from localStorage to DB
// ⚠️ SECURITY: ONLY accept productId, quantity, size, color
// ❌ DO NOT accept price, name, imageUrl from client
export const SyncCartSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive("Product ID must be positive"),
        quantity: z.number().int().min(1, "Quantity must be at least 1").max(999),
        size: z.string().max(50, "Size too long").optional().default("One Size"),
        color: z.string().max(50, "Color too long").optional().default("Default"),
      })
    )
    .optional(),
});

export type AddToCartInput = z.infer<typeof AddToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>;
export type SyncCartInput = z.infer<typeof SyncCartSchema>;
