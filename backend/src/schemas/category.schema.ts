import { z } from 'zod';

export const CreateCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100),
  description: z.string().optional(),
  slug: z.string().optional() // Optional - will be auto-generated if not provided
});

export const UpdateCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100).optional(),
  description: z.string().optional(),
  slug: z.string().optional() // Optional - can override auto-generated slug
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
