import { z } from "zod";

/**
 * Product validation schemas
 * Used to validate input for Product CRUD operations
 */

// Schema for creating a new product
export const CreateProductSchema = z.object({
  categoryId: z
    .number({ required_error: "Category ID is required" })
    .int("Category ID must be an integer")
    .positive("Category ID must be a positive number"),
  name: z
    .string({ required_error: "Product name is required" })
    .min(2, "Product name must be at least 2 characters")
    .max(255, "Product name must be less than 255 characters"),
  price: z
    .number({ required_error: "Price is required" })
    .positive("Price must be a positive number")
    .multipleOf(0.01, "Price can have at most 2 decimal places"),
  stockQuantity: z
    .number()
    .int("Stock quantity must be an integer")
    .min(0, "Stock quantity cannot be negative")
    .default(0),
  description: z
    .string()
    .max(5000, "Description must be less than 5000 characters")
    .optional(),
  imageUrl: z
    .string()
    .url("Image URL must be a valid URL")
    .max(255, "Image URL must be less than 255 characters")
    .optional(),
});

// Schema for updating a product (all fields optional)
export const UpdateProductSchema = z.object({
  categoryId: z
    .number()
    .int("Category ID must be an integer")
    .positive("Category ID must be a positive number")
    .optional(),
  name: z
    .string()
    .min(2, "Product name must be at least 2 characters")
    .max(255, "Product name must be less than 255 characters")
    .optional(),
  price: z
    .number()
    .positive("Price must be a positive number")
    .multipleOf(0.01, "Price can have at most 2 decimal places")
    .optional(),
  stockQuantity: z
    .number()
    .int("Stock quantity must be an integer")
    .min(0, "Stock quantity cannot be negative")
    .optional(),
  description: z
    .string()
    .max(5000, "Description must be less than 5000 characters")
    .optional(),
  imageUrl: z
    .string()
    .url("Image URL must be a valid URL")
    .max(255, "Image URL must be less than 255 characters")
    .optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided for update" },
);

// Schema for query parameters when listing products
export const ProductQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().positive().default(1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 12))
    .pipe(z.number().int().positive().max(100).default(12)),
  categoryId: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .pipe(z.number().int().positive().optional()),
  search: z
    .string()
    .max(100, "Search term must be less than 100 characters")
    .optional(),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type ProductQueryInput = z.infer<typeof ProductQuerySchema>;
