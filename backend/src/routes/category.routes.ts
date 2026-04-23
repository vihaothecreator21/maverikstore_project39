import { Router, Request, Response } from "express";
import { CategoryService } from "../services/category.service";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess, HTTP_STATUS } from "../utils/apiResponse";
import {
  CreateCategorySchema,
  UpdateCategorySchema,
} from "../schemas/category.schema";
import { authMiddleware, requireAdmin } from "../middlewares/auth.middleware";

export const categoryRoutes = Router();

// GET /api/v1/categories — Public
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

// GET /api/v1/categories/:id — Public
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

// POST /api/v1/categories — Admin only
// ✅ FIX: Thêm authMiddleware + requireAdmin
categoryRoutes.post(
  "/",
  authMiddleware,
  requireAdmin,
  catchAsync(async (req: Request, res: Response) => {
    const data = CreateCategorySchema.parse(req.body);
    const category = await CategoryService.create(data);
    return sendSuccess(
      res,
      category,
      "Category created successfully",
      HTTP_STATUS.CREATED,
    );
  }),
);

// PUT /api/v1/categories/:id — Admin only
// ✅ FIX: Thêm authMiddleware + requireAdmin
categoryRoutes.put(
  "/:id",
  authMiddleware,
  requireAdmin,
  catchAsync(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const data = UpdateCategorySchema.parse(req.body);
    const category = await CategoryService.update(id, data);
    return sendSuccess(
      res,
      category,
      "Category updated successfully",
      HTTP_STATUS.OK,
    );
  }),
);

// DELETE /api/v1/categories/:id — Admin only
// ✅ FIX: Thêm authMiddleware + requireAdmin
categoryRoutes.delete(
  "/:id",
  authMiddleware,
  requireAdmin,
  catchAsync(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const category = await CategoryService.delete(id);
    return sendSuccess(
      res,
      category,
      "Category deleted successfully",
      HTTP_STATUS.OK,
    );
  }),
);
