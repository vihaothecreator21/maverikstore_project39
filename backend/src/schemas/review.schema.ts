import { z } from "zod";

export const CreateReviewSchema = z.object({
  productId: z.coerce.number().int("Product ID must be an integer").positive("Product ID is required"),
  rating: z.coerce.number().int("Rating must be an integer").min(1).max(5),
  comment: z.string().trim().min(3, "Review must be at least 3 characters").max(1000),
});

export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;
