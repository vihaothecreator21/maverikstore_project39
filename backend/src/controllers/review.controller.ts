import { Request, Response } from "express";
import { reviewService } from "../container";
import { CreateReviewSchema } from "../schemas/review.schema";
import { HTTP_STATUS, sendSuccess, ValidationError } from "../utils/apiResponse";

export class ReviewController {
  static async getLatest(_req: Request, res: Response) {
    const reviews = await reviewService.getLatest();
    return sendSuccess(res, reviews, "Latest reviews retrieved", HTTP_STATUS.OK);
  }

  static async create(req: Request, res: Response) {
    const validation = CreateReviewSchema.safeParse(req.body);
    if (!validation.success) {
      const errors: Record<string, string[]> = {};
      validation.error.errors.forEach((err) => {
        const path = String(err.path[0] ?? "review");
        if (!errors[path]) errors[path] = [];
        errors[path].push(err.message);
      });
      throw new ValidationError("Validation failed", errors);
    }

    const review = await reviewService.create(req.userId!, validation.data);
    return sendSuccess(res, review, "Review saved", HTTP_STATUS.CREATED);
  }
}
