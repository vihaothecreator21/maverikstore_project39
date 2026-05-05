import { z } from "zod";

// ✅ FIX: Removed client-side `slug` — backend generates slug from name
// ✅ FIX: Added proper validation (min/max length, trimming)

export const CreateCategorySchema = z.object({
  name: z
    .string({ required_error: "Tên danh mục là bắt buộc" })
    .trim()
    .min(2, "Tên danh mục phải ít nhất 2 ký tự")
    .max(100, "Tên danh mục không quá 100 ký tự"),
  description: z
    .string()
    .trim()
    .max(500, "Mô tả không quá 500 ký tự")
    .optional(),
});

export const UpdateCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Tên danh mục phải ít nhất 2 ký tự")
    .max(100, "Tên danh mục không quá 100 ký tự")
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "Mô tả không quá 500 ký tự")
    .optional(),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
