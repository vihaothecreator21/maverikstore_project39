# CRUD Pattern Guide - Maverik Store

## Quick Reference

**CRUD** = Create (POST), Read (GET), Update (PUT), Delete (DELETE)

---

## Architecture Flow

```
HTTP Request
  ↓ Routes (URL routing)
  ↓ Controllers (validation)
  ↓ Services (business logic)
  ↓ Repositories (data access)
  ↓ Prisma ORM
  ↓ MySQL Database
```

---

## Operation Examples

### CREATE - Add Product

```typescript
// Endpoint: POST /api/v1/products
{
  "categoryId": 1,
  "name": "Áo Phông Maverik",
  "price": 150000,
  "stockQuantity": 10
}

// Flow:
// Controller validates with CreateProductSchema (Zod)
// ↓ Service generates slug: "Áo Phông Maverik" → "ao-phong-maverik"
// ↓ Repository calls: prisma.product.create(data)
// ↓ Response: { id, name, slug, price, createdAt }
```

### READ - Get Products

```typescript
// List with pagination:
GET /api/v1/products?page=1&limit=10&categoryId=2&search=ao

// Flow:
// Controller validates query params
// ↓ Service builds filtering logic
// ↓ Repository executes:
//   - findMany with WHERE, LIMIT, OFFSET
//   - count for total
// ↓ Response: { data: [...products], meta: { page, limit, total, pages } }

// Get by ID:
GET /api/v1/products/1

// Get by slug:
GET /api/v1/products/slug/ao-phong-maverik
```

### UPDATE - Modify Product

```typescript
// Endpoint: PUT /api/v1/products/1
{
  "name": "Áo Phông Maverik New",
  "price": 160000
}

// Flow:
// Controller validates ID + body
// ↓ Service checks if product exists
// ↓ If name changed → regenerate slug (ensure unique)
// ↓ Repository calls: prisma.product.update(id, data)
// ↓ Response: updated product object
```

### DELETE - Remove Product

```typescript
// Endpoint: DELETE /api/v1/products/5

// Flow:
// Controller validates ID (auth required)
// ↓ Service checks if product exists
// ↓ Repository calls: prisma.product.delete(id)
// ↓ Response: { message: "Deleted successfully" } or { id, name }
```

---

## Code Structure Reference

### Controller Pattern

```typescript
static async create(req: Request, res: Response) {
  // 1. Validate input
  const validation = Schema.safeParse(req.body);
  if (!validation.success) throw new ValidationError(...);

  // 2. Call service
  const result = await Service.create(validation.data);

  // 3. Return response
  return sendSuccess(res, result, "Success message", HTTP_STATUS.CREATED);
}
```

### Service Pattern

```typescript
static async create(input: InputType) {
  // Business logic + transformations
  const transformed = transformData(input);

  // Call repository
  return await Repository.create(transformed);
}
```

### Repository Pattern

```typescript
static async create(data: DataType) {
  return prisma.table.create({
    data: {
      ...fields
    },
    select: { id, name, createdAt }  // Only return needed fields
  });
}
```

---

## Key Principles

✅ **Validation at Controller Level**

- Use Zod schemas for input validation
- Clear error messages for invalid inputs

✅ **Business Logic in Services**

- Slug generation
- Stock validation
- Transformations
- Authorization checks

✅ **Raw Queries in Repositories**

- Direct Prisma calls
- Optimize queries (select, where, pagination)
- Reusable query patterns

✅ **Consistent Response Format**

```typescript
{
  status: "success" | "error",
  code: 200 | 201 | 400 | 404 | 500,
  data: result,
  message: "Human-readable message",
  meta?: { page, limit, total }
}
```

---

## Common Patterns

### Pagination

```typescript
const skip = (page - 1) * limit;
const items = await prisma.table.findMany({
  skip,
  take: limit,
  orderBy: { createdAt: "desc" },
});
const total = await prisma.table.count(where);
```

### Filtering

```typescript
const where: any = {};
if (categoryId) where.categoryId = categoryId;
if (search) where.name = { contains: search };

const items = await prisma.table.findMany({ where });
```

### Unique Checks

```typescript
const exists = await prisma.table.findUnique({
  where: { email },
  select: { id: true },
});
```

### Transactions (Multiple Operations)

```typescript
const [item1, item2] = await prisma.$transaction([
  prisma.table1.create(...),
  prisma.table2.create(...)
]);
```

---

## See Also

- [QUICK_START.md](./QUICK_START.md) - Project overview
- [ARCHITECTURE_GRAPH.md](./ARCHITECTURE_GRAPH.md) - System architecture
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Specific implementations

### Response:

```json
{
  "status": "success",
  "data": {
    "id": 1,
    "name": "Áo Phông Maverik New",
    "slug": "ao-phong-maverik-new",
    "price": 160000,
    "updatedAt": "2026-04-04T08:00:00Z"
  },
  "message": "Product updated successfully"
}
```

---

## 4️⃣ DELETE - Xóa sản phẩm

### Route:

```typescript
DELETE / api / v1 / products / 1;
```

---

### Controller:

```typescript
static async delete(req: Request, res: Response) {
  // 1️⃣ VALIDATE ID
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) throw new ValidationError("Invalid ID");

  // 2️⃣ GỌI SERVICE
  const deleted = await ProductService.delete(id);

  // 3️⃣ RESPONSE
  return sendSuccess(
    res,
    deleted,
    `Product "${deleted.name}" deleted successfully`,
    HTTP_STATUS.OK
  );
}
```

---

### Service:

```typescript
static async delete(id: number) {
  // 1️⃣ CHECK sản phẩm exists
  const existing = await ProductRepository.findById(id);
  if (!existing) {
    throw new APIError(404, "Product not found");
  }

  // 2️⃣ DELETE
  const deleted = await ProductRepository.delete(id);

  return deleted;
}
```

---

### Repository:

```typescript
static async delete(id: number) {
  return prisma.product.delete({
    where: { id },
    select: { id: true, name: true },  // ← Return what was deleted
  });
}
```

---

### SQL:

```sql
DELETE FROM Product WHERE id = 1;
```

### Response:

```json
{
  "status": "success",
  "data": {
    "id": 1,
    "name": "Áo Phông Maverik"
  },
  "message": "Product \"Áo Phông Maverik\" deleted successfully"
}
```

---

## 🔄 CRUD Flow Diagram

```
┌─────────────────┐
│  FRONTEND (JS)  │
└────────┬────────┘
         │ fetch(url, options)
         │
         ▼
┌──────────────────────────────────────────┐
│        Express Router                    │
│  POST /products → controller.create()    │
│  GET /products → controller.getAll()     │
│  GET /products/:id → controller.getById()│
│  PUT /products/:id → controller.update() │
│  DELETE /products/:id → controller.delete│
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  Controllers                             │
│  ├─ Validate input (Zod schema)          │
│  ├─ Extract params/body                  │
│  └─ Delegate to Service                  │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  Services (Business Logic)               │
│  ├─ Slug generation                      │
│  ├─ Uniqueness checks                    │
│  ├─ Transformations                      │
│  └─ Call Repository                      │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  Repositories (Data Access)              │
│  ├─ prisma.product.findMany()            │
│  ├─ prisma.product.create()              │
│  ├─ prisma.product.update()              │
│  └─ prisma.product.delete()              │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  Prisma ORM                              │
│  ├─ Build SQL queries                    │
│  ├─ Connection pooling                   │
│  └─ Result mapping                       │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  MySQL Database                          │
│  ├─ INSERT/SELECT/UPDATE/DELETE          │
│  └─ Transactions                         │
└──────────────────────────────────────────┘
```

---

## Error Handling Flow

```typescript
// Nếu có lỗi ở bất kỳ layer nào → bubble up → controller catch

try {
  // Controller
  const result = await ProductService.create(input);
} catch (error) {
  if (error instanceof APIError) {
    // Custom API error
    return sendError(res, error);
  } else if (error instanceof ValidationError) {
    // Validation error
    return sendError(res, error);
  } else {
    // Unexpected error
    return sendError(res, new APIError(500, "Internal server error"));
  }
}
```

---

## Validation Layers (Defense in Depth)

```
┌─ Frontend JS ──────────────────────┐
│  Client-side validation (optional) │
└────────────┬──────────────────────┘
             │
             ▼
┌─ HTTP Middleware ──────────────────┐
│  Body size limit                   │
│  Content-type check                │
└────────────┬──────────────────────┘
             │
             ▼
┌─ Controller ───────────────────────┐
│  Zod schema validation             │
│  Parameter type check              │
└────────────┬──────────────────────┘
             │
             ▼
┌─ Service ──────────────────────────┐
│  Business logic validation         │
│  Duplicate/Conflict checks         │
└────────────┬──────────────────────┘
             │
             ▼
┌─ Repository ───────────────────────┐
│  Database constraints              │
│  Unique indexes                    │
│  Foreign keys                      │
└────────────────────────────────────┘
```

---

## Practical Example: Toàn bộ CREATE Flow

### 1️⃣ Frontend gửi request:

```javascript
// Frontend (main.js)
const response = await fetch("/api/v1/products", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    categoryId: 1,
    name: "Áo Phông Maverik Supreme",
    price: 250000,
    stockQuantity: 50,
    description: "New collection",
  }),
});
const data = await response.json();
console.log(data);
```

### 2️⃣ Express receives → Router matches:

```
Method: POST
URL: /api/v1/products
Matched route: productRoutes.post("/", catchAsync(ProductController.create))
↓
ProductController.create(req, res) invoked
```

### 3️⃣ Controller validates & delegates:

```typescript
const validation = CreateProductSchema.safeParse({
  categoryId: 1,
  name: "Áo Phông Maverik Supreme",
  price: 250000,
  stockQuantity: 50,
  description: "New collection",
});
// ✅ All fields valid

const product = await ProductService.create(validation.data);
```

### 4️⃣ Service generates slug:

```typescript
const baseSlug = generateSlug("Áo Phông Maverik Supreme");
// 'ao-phong-maverik-supreme'

const slug = await ensureUniqueSlug(baseSlug);
// Check: slugExists('ao-phong-maverik-supreme')? NO
// → slug = 'ao-phong-maverik-supreme'
```

### 5️⃣ Repository executes INSERT:

```typescript
await prisma.product.create({
  data: {
    categoryId: 1,
    name: "Áo Phông Maverik Supreme",
    slug: "ao-phong-maverik-supreme",
    price: 250000,
    stockQuantity: 50,
    description: "New collection",
  },
});
```

### 6️⃣ Prisma generates SQL:

```sql
INSERT INTO Product (categoryId, name, slug, price, stockQuantity, description, createdAt, updatedAt)
VALUES (1, 'Áo Phông Maverik Supreme', 'ao-phong-maverik-supreme', 250000, 50, 'New collection', NOW(), NOW());
```

### 7️⃣ MySQL executes → ID generated:

```
✓ Inserted with auto-increment id = 15
```

### 8️⃣ Response back through layers:

```json
{
  "status": "success",
  "code": 201,
  "message": "Product created successfully",
  "data": {
    "id": 15,
    "name": "Áo Phông Maverik Supreme",
    "slug": "ao-phong-maverik-supreme",
    "price": 250000,
    "stockQuantity": 50,
    "createdAt": "2026-04-04T09:00:00Z"
  }
}
```

### 9️⃣ Frontend receives & updates UI:

```javascript
// data.data.id = 15
// data.data.slug = 'ao-phong-maverik-supreme'
// Update product list, show success message, etc.
alert(`Product created: ${data.data.name}`);
```

---

## 📋 CRUD Comparison Table

| Operation    | HTTP   | Endpoint                    | Purpose                         |
| ------------ | ------ | --------------------------- | ------------------------------- |
| **CREATE**   | POST   | `/products`                 | Thêm sản phẩm mới vào database  |
| **READ All** | GET    | `/products?page=1&limit=10` | Lấy danh sách sản phẩm          |
| **READ One** | GET    | `/products/1`               | Lấy chi tiết 1 sản phẩm by ID   |
| **READ One** | GET    | `/products/slug/ao-phong`   | Lấy chi tiết 1 sản phẩm by slug |
| **UPDATE**   | PUT    | `/products/1`               | Cập nhật sản phẩm               |
| **DELETE**   | DELETE | `/products/1`               | Xóa sản phẩm                    |

---

## 🎓 Key Takeaways

✅ **Separation of Concerns**: Mỗi layer có trách nhiệm riêng
✅ **Validation**: Multi-layer validation từ frontend → database
✅ **Error Handling**: Errors bubble up, được catch và format lại
✅ **Reusability**: Services/Repositories có thể reuse ở nhiều places
✅ **Testability**: Dễ viết unit tests cho từng layer
✅ **Maintainability**: Dễ debug, modify logic, add features

---

**Last Updated**: April 4, 2026
