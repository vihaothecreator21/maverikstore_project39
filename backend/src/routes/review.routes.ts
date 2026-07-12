import { Router } from "express";
import { ReviewController } from "../controllers/review.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { catchAsync } from "../utils/catchAsync";

export const reviewRoutes = Router();

reviewRoutes.get("/latest", catchAsync(ReviewController.getLatest));
reviewRoutes.post("/", authMiddleware, catchAsync(ReviewController.create));
