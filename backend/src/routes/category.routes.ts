import { Router, Request, Response } from "express";
import { CategoryService } from "../services/category.service";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess, HTTP_STATUS } from "../utils/apiResponse";

export const categoryRoutes = Router();

// GET /api/v1/categories
categoryRoutes.get(
  "/",
  catchAsync(async (_req: Request, res: Response) => {
    const categories = await CategoryService.getAll();
    return sendSuccess(
      res,
      categories,
      "Categories retrieved successfully",
      HTTP_STATUS.OK,
    );
  }),
);

// GET /api/v1/categories/:id
categoryRoutes.get(
  "/:id",
  catchAsync(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const category = await CategoryService.getById(id);
    return sendSuccess(
      res,
      category,
      "Category retrieved successfully",
      HTTP_STATUS.OK,
    );
  }),
);
