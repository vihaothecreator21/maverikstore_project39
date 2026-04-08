# 🏷️ Category CRUD Implementation Plan (Prisma Only)

**Date**: April 8, 2026  
**Status**: Implementation Phase  
**Environment**: Development (For Demo Purpose)  
**Note**: No admin middleware - Prisma CRUD operations only

---

## 📋 Overview

Implement full CRUD operations for Category management directly with Prisma. No authentication/authorization checks - purely for database operations and API demo.

### Current State vs Target

```
CURRENT:
✅ GET /api/v1/categories          - Get all categories
✅ GET /api/v1/categories/:id      - Get single category
❌ POST /api/v1/categories         - Create (MISSING)
❌ PUT /api/v1/categories/:id      - Update (MISSING)
❌ DELETE /api/v1/categories/:id   - Delete (MISSING)

TARGET:
✅ GET /api/v1/categories          - Get all categories
✅ GET /api/v1/categories/:id      - Get single category
✅ POST /api/v1/categories         - Create (NEW)
✅ PUT /api/v1/categories/:id      - Update (NEW)
✅ DELETE /api/v1/categories/:id   - Delete (NEW)
```

---

## 🏗️ Architecture

```
Frontend (Admin Panel - Future)
        ↓
Express Routes (No Auth Check - Dev Only)
    ├─ POST /       → POST create
    ├─ PUT /:id     → PUT update
    ├─ DELETE /:id  → DELETE delete
    ├─ GET /        → GET all
    └─ GET /:id     → GET by id
        ↓
CategoryService (Business Logic)
    ├─ create()
    ├─ update()
    ├─ delete()
    └─ getById()
        ↓
CategoryRepository (Prisma)
    ├─ create()
    ├─ update()
    ├─ delete()
    └─ countProducts()
        ↓
Prisma Client ORM
        ↓
MySQL Database (Category Table)
```

---

## 📝 Phase 1: Create Validation Schema

### File: `backend/src/schemas/category.schema.ts` (NEW)

```typescript
import { z } from "zod";

/**
 * Schema for creating a new category
 * ✨ NEW: slug is now OPTIONAL - auto-generated from name
 */
export const CreateCategorySchema = z.object({
  name: z
    .string()
    .min(1, "Category name is required")
    .max(100, "Category name must be less than 100 characters"),

  // ✨ UPGRADED: slug is optional - will be auto-generated from name
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(100, "Slug must be less than 100 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain only lowercase letters, numbers, and hyphens",
    )
    .optional(), // ← CAN BE OMITTED - System auto-generates

  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional()
    .nullable(),
});

/**
 * Schema for updating a category (all fields optional)
 */
export const UpdateCategorySchema = CreateCategorySchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "At least one field must be provided for update",
);

// Type exports for TypeScript
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;

/**
 * ✨ Note: Admin does NOT need to input slug manually.
 * System automatically generates slug from name using slugify():
 * - Converts to lowercase
 * - Removes Vietnamese diacritics (á, é, ư, etc.)
 * - Handles collision by appending numbers (e.g., ao-thun → ao-thun-1)
 */
```

---

## 📦 Phase 2: Update CategoryRepository

### File: `backend/src/repositories/category.repository.ts` (MODIFY)

**Keep existing methods, add `findBySlug()` helper if missing, then add these:**

```typescript
import { CreateCategoryInput, UpdateCategoryInput } from "../schemas/category.schema";

/**
 * HELPER - Find category by slug (required for collision detection)
 */
static async findBySlug(slug: string) {
  return prisma.category.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
}

/**
 * CREATE - Add new category
 */
static async create(data: { name: string; slug: string; description?: string }) {
  return prisma.category.create({
    data: {
      name: data.name,
      slug: data.slug,
      description: data.description || null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * UPDATE - Modify existing category
 */
static async update(
  id: number,
  data: Partial<{ name: string; slug: string; description: string | null }>
) {
  return prisma.category.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.slug && { slug: data.slug }),
      ...(data.description !== undefined && { description: data.description }),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * DELETE - Remove category
 */
static async delete(id: number) {
  return prisma.category.delete({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });
}

/**
 * HELPER - Count products in category
 */
static async countProducts(categoryId: number): Promise<number> {
  return prisma.product.count({
    where: { categoryId },
  });
}
```

---

## 🎯 Phase 3: Update CategoryService

### File: `backend/src/services/category.service.ts` (MODIFY)

**Install slugify package first:**

```bash
npm install slugify
```

**Add imports and helper function at top:**

```typescript
import slugify from "slugify";

/**
 * ✨ Helper: Auto-generate slug from name with Vietnamese support
 * - Converts to lowercase
 * - Removes Vietnamese diacritics (á, é, ư, etc.)
 * - Removes special characters
 * - Handles collision by appending numbers
 */
private static async generateUniqueSlug(
  name: string,
  excludeId?: number
): Promise<string> {
  // Generate base slug from name
  let baseSlug = slugify(name, {
    lower: true,
    strict: true,
    locale: "vi", // ← Vietnamese support (removes diacritics)
  });

  // Check if slug already exists
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await CategoryRepository.findBySlug(slug);

    // If no conflict or updating same category, use this slug
    if (!existing || (excludeId && existing.id === excludeId)) {
      return slug;
    }

    // Collision: append number and retry
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}
```

**Keep existing methods, then add/update these:**

```typescript
import { CreateCategoryInput, UpdateCategoryInput } from "../schemas/category.schema";
import { APIError } from "../utils/apiResponse";

/**
 * CREATE - Create new category with auto-slug generation
 * ✨ UPGRADED: System auto-generates slug from name
 */
static async create(data: CreateCategoryInput) {
  try {
    // ✨ Auto-generate slug if not provided
    const slug = data.slug || (await this.generateUniqueSlug(data.name));

    // Create category with generated slug
    const category = await CategoryRepository.create({
      ...data,
      slug, // ← Use generated slug
    });
    return category;
  } catch (error: any) {
    // Handle Prisma unique constraint violations (safety check)
    if (error.code === "P2002") {
      const field = error.meta?.target?.[0] === "slug" ? "slug" : "name";
      throw new APIError(
        409,
        `Category with this ${field} already exists`,
        { [field]: [`This ${field} is already in use`] },
        "DUPLICATE_CATEGORY"
      );
    }
    throw error;
  }
}

/**
 * UPDATE - Update existing category
 * ✨ UPGRADED: Auto-regenerate slug if name changes
 */
static async update(id: number, data: UpdateCategoryInput) {
  // Verify category exists first
  const category = await this.getById(id);
  if (!category) {
    throw new APIError(
      404,
      "Category not found",
      { id: ["Category does not exist"] },
      "CATEGORY_NOT_FOUND"
    );
  }

  try {
    // ✨ If name changed but slug not provided, regenerate slug
    let updateData = { ...data };
    if (data.name && !data.slug) {
      updateData.slug = await this.generateUniqueSlug(data.name, id);
    }

    const updated = await CategoryRepository.update(id, updateData);
    return updated;
  } catch (error: any) {
    // Handle Prisma unique constraint violations
    if (error.code === "P2002") {
      const field = error.meta?.target?.[0] === "slug" ? "slug" : "name";
      throw new APIError(
        409,
        `Category with this ${field} already exists`,
        { [field]: [`This ${field} is already in use`] },
        "DUPLICATE_CATEGORY"
      );
    }
    throw error;
  }
}

/**
 * DELETE - Delete category (only if no products)
 */
static async delete(id: number) {
  // Verify category exists
  const category = await this.getById(id);
  if (!category) {
    throw new APIError(
      404,
      "Category not found",
      { id: ["Category does not exist"] },
      "CATEGORY_NOT_FOUND"
    );
  }

  // Check if category has products
  const productCount = await CategoryRepository.countProducts(id);
  if (productCount > 0) {
    throw new APIError(
      409,
      `Cannot delete category with existing products`,
      {
        products: [
          `This category has ${productCount} product(s). Please delete or reassign them first.`,
        ],
      },
      "CATEGORY_HAS_PRODUCTS"
    );
  }

  // Delete from database
  return await CategoryRepository.delete(id);
}
```

---

## 🛣️ Phase 4: Update CategoryRoutes

### File: `backend/src/routes/category.routes.ts` (MODIFY)

**Keep existing GET routes, then add these:**

```typescript
import { Router, Request, Response } from "express";
import { CategoryService } from "../services/category.service";
import {
  CreateCategorySchema,
  UpdateCategorySchema,
} from "../schemas/category.schema";
import { catchAsync } from "../utils/catchAsync";
import {
  sendSuccess,
  ValidationError,
  HTTP_STATUS,
} from "../utils/apiResponse";

// Keep existing:
// categoryRoutes.get("/", ...)
// categoryRoutes.get("/:id", ...)

/**
 * POST /api/v1/categories
 * Create a new category
 */
categoryRoutes.post(
  "/",
  catchAsync(async (req: Request, res: Response) => {
    const validation = await CreateCategorySchema.safeParseAsync(req.body);

    if (!validation.success) {
      const errors: Record<string, string[]> = {};
      validation.error.errors.forEach((err) => {
        const path = err.path[0] as string;
        if (!errors[path]) errors[path] = [];
        errors[path].push(err.message);
      });
      throw new ValidationError("Validation failed", errors);
    }

    const category = await CategoryService.create(validation.data);
    return sendSuccess(
      res,
      category,
      "Category created successfully",
      HTTP_STATUS.CREATED,
    );
  }),
);

/**
 * PUT /api/v1/categories/:id
 * Update an existing category
 */
categoryRoutes.put(
  "/:id",
  catchAsync(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new ValidationError("Invalid category ID", {
        id: ["Category ID must be a valid number"],
      });
    }

    const validation = await UpdateCategorySchema.safeParseAsync(req.body);

    if (!validation.success) {
      const errors: Record<string, string[]> = {};
      validation.error.errors.forEach((err) => {
        const path = err.path[0] as string;
        if (!errors[path]) errors[path] = [];
        errors[path].push(err.message);
      });
      throw new ValidationError("Validation failed", errors);
    }

    const category = await CategoryService.update(id, validation.data);
    return sendSuccess(
      res,
      category,
      "Category updated successfully",
      HTTP_STATUS.OK,
    );
  }),
);

/**
 * DELETE /api/v1/categories/:id
 * Delete a category (only if no products)
 */
categoryRoutes.delete(
  "/:id",
  catchAsync(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new ValidationError("Invalid category ID", {
        id: ["Category ID must be a valid number"],
      });
    }

    const deleted = await CategoryService.delete(id);
    return sendSuccess(
      res,
      deleted,
      "Category deleted successfully",
      HTTP_STATUS.OK,
    );
  }),
);
```

---

## ✅ Implementation Checklist

- [ ] **Phase 1**: Create `backend/src/schemas/category.schema.ts`
  - [ ] CreateCategorySchema
  - [ ] UpdateCategorySchema
  - [ ] Export types

- [ ] **Phase 2**: Update `backend/src/repositories/category.repository.ts`
  - [ ] Add `create()` method
  - [ ] Add `update()` method
  - [ ] Add `delete()` method
  - [ ] Add `countProducts()` helper

- [ ] **Phase 3**: Update `backend/src/services/category.service.ts`
  - [ ] Add `create()` with error handling
  - [ ] Add `update()` with existence check
  - [ ] Add `delete()` with product count check
  - [ ] Import types and APIError

- [ ] **Phase 4**: Update `backend/src/routes/category.routes.ts`
  - [ ] Add POST / route
  - [ ] Add PUT /:id route
  - [ ] Add DELETE /:id route
  - [ ] Import validation schemas

- [ ] **Testing**: Verify all endpoints work
  - [ ] POST create (valid data)
  - [ ] POST create (duplicate slug error)
  - [ ] PUT update (valid data)
  - [ ] PUT update (non-existent category)
  - [ ] DELETE category (no products)
  - [ ] DELETE category (has products error)

---

## 📊 API Endpoints Summary

| Method | Endpoint                 | Status      | Purpose             |
| ------ | ------------------------ | ----------- | ------------------- |
| GET    | `/api/v1/categories`     | ✅ Existing | Get all categories  |
| GET    | `/api/v1/categories/:id` | ✅ Existing | Get single category |
| POST   | `/api/v1/categories`     | 🆕 NEW      | Create new category |
| PUT    | `/api/v1/categories/:id` | 🆕 NEW      | Update category     |
| DELETE | `/api/v1/categories/:id` | 🆕 NEW      | Delete category     |

---

## 🧪 Test Examples

### Create Category (✨ Slug AUTO-GENERATED)

```bash
POST /api/v1/categories
{
  "name": "Áo Thun Nam",
  "description": "T-shirts for men"
  # ← slug OMITTED - system auto-generates: ao-thun-nam
}
# Response: 201 Created
{
  "id": 5,
  "name": "Áo Thun Nam",
  "slug": "ao-thun-nam",  # ← AUTO-GENERATED from name
  "description": "T-shirts for men"
}
```

### Create Category with COLLISION HANDLING

```bash
# First category
POST /api/v1/categories
{"name": "Áo Thun"}
# Creates: slug = "ao-thun"

# Second category (same name)
POST /api/v1/categories
{"name": "Áo Thun"}
# Creates: slug = "ao-thun-1" ← AUTO APPENDS NUMBER

# Third category
POST /api/v1/categories
{"name": "Áo Thun"}
# Creates: slug = "ao-thun-2" ← KEEPS INCREMENTING
```

### Create Category (Override with Custom Slug)

```bash
POST /api/v1/categories
{
  "name": "Áo Thun Nam",
  "slug": "custom-slug",  # ← Optional: Can override auto-generated
  "description": "T-shirts"
}
# Response: 201 Created with custom slug
```

### Update Category (✨ Slug Auto-Updates if Name Changes)

```bash
PUT /api/v1/categories/1
{
  "name": "Áo Thun Nam Cao Cấp"
  # ← slug NOT provided, system auto-generates: ao-thun-nam-cao-cap
}
# Response: 200 OK
{
  "id": 1,
  "name": "Áo Thun Nam Cao Cấp",
  "slug": "ao-thun-nam-cao-cap",  # ← AUTO-UPDATED
  "updatedAt": "2026-04-08T..."
}
```

### Delete Category

```bash
DELETE /api/v1/categories/2
# Response: 200 OK (if no products)
# Response: 409 Conflict (if has products)
```

---

## 📈 Estimated Effort

| Phase     | Task              | Time        |
| --------- | ----------------- | ----------- |
| 1         | Create schema     | 10 min      |
| 2         | Update repository | 15 min      |
| 3         | Update service    | 15 min      |
| 4         | Update routes     | 20 min      |
| Testing   | Test endpoints    | 30 min      |
| **TOTAL** | **Full CRUD**     | **~90 min** |

---

## 🎯 Files to Modify + Dependencies

**Install package first:**

```bash
cd backend
npm install slugify
```

**Files to modify:**

```
backend/
├── package.json                         ← Add:  "slugify": "^1.6.6"
├── src/
│   ├── schemas/
│   │   └── category.schema.ts          ← 🆕 CREATE (slug optional)
│   ├── repositories/
│   │   └── category.repository.ts      ← ✏️ ADD 5 methods (+ findBySlug)
│   ├── services/
│   │   └── category.service.ts         ← ✏️ ADD 4 methods (+ generateUniqueSlug)
│   └── routes/
│       └── category.routes.ts          ← ✏️ ADD 3 routes
```

---

## 💡 Key Features

✅ Full CRUD operations (Create, Read, Update, Delete)  
✅ Zod validation for all inputs  
✅ **✨ Auto-generated Slug from Name** (Admin doesn't type slug manually)  
✅ **✨ Vietnamese Support** (Converts "Áo Thun" → "ao-thun", removes diacritics)  
✅ **✨ Collision Handling** (Auto-appends numbers: ao-thun → ao-thun-1 → ao-thun-2)  
✅ **✨ Slug Override Option** (Admin can still provide custom slug if needed)  
✅ **✨ Smart Update** (When name changes, slug re-generates automatically)  
✅ Product count check before deletion (409 Error if has products)  
✅ Proper HTTP status codes (201 Created, 200 OK, 409 Conflict, 404 Not Found)  
✅ Standardized error responses  
✅ No authentication required (Dev environment)

---

**Ready to implement!** 🚀
