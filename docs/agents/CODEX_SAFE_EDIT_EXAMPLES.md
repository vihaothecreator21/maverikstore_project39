# EXAMPLES.md

Các ví dụ này dạy Codex cách sửa project Maverik Store mà không phá kiến trúc, flow, hoặc dữ liệu.

## Golden rule
Sửa đúng việc được yêu cầu, nhỏ nhất có thể, verify được. Không tranh thủ refactor.

## Example 1: Sửa UI text ở products page
User asks: "Đổi chữ nút Add to cart thành Thêm vào giỏ"

Do:
- Inspect `src/products.html` và `src/assets/js/products.js` nếu nút render từ JS.
- Sửa đúng text render nút.
- Chạy `npm run build`.

Don't:
- Đổi layout card.
- Đổi API products.
- Refactor toàn bộ renderProductCard.
- Chuyển sang React component.

## Example 2: Thêm filter category admin
User asks: "Admin products lọc thêm category"

Do:
- Inspect `src/admin/products.html`.
- Inspect `src/admin/assets/js/admin-products.js`.
- Nếu cần backend query, inspect `product.routes.ts -> product.controller.ts -> product.service.ts -> product.repository.ts`.
- Sửa query param nhỏ nhất, giữ response shape hiện tại.

Don't:
- Đổi schema Product.
- Đổi endpoint `/products`.
- Đổi tên field `categoryId` nếu backend đang dùng field đó.
- Refactor admin CSS toàn trang.

## Example 3: Category slug bug
User asks: "Sửa lỗi rename category bị sai slug"

Do:
- Inspect `backend/src/routes/category.routes.ts`.
- Inspect `backend/src/controllers/category.controller.ts`.
- Inspect `backend/src/services/category.service.ts`.
- Inspect `backend/src/repositories/category.repository.ts`.
- Inspect frontend `src/admin/assets/js/admin-categories.js` chỉ để xác nhận payload.
- Giữ rule: backend tự sinh slug, frontend không gửi slug.

Don't:
- Tạo slug ở frontend.
- Đổi Prisma schema khi chưa hỏi.
- Xóa migration.
- Đổi product slug behavior.

## Example 4: Checkout/VNPAY issue
User asks: "VNPAY return bị lỗi"

Do:
- Inspect `src/assets/js/checkout.js` nếu lỗi từ redirect/frontend.
- Inspect `backend/src/routes/payment.routes.ts`.
- Inspect `backend/src/controllers/payment.controller.ts`.
- Inspect `backend/src/services/payment.service.ts`.
- Inspect `backend/src/repositories/payment.repository.ts`.
- Verify signature/order/payment status flow.
- Nêu rõ risk và test case.

Don't:
- Bỏ signature verification.
- Mark payment success chỉ vì có return URL.
- Đổi order status transition bừa.
- Log secret key.
- Đụng COD flow nếu lỗi chỉ ở VNPAY.

## Example 5: Cart sync after login
User asks: "Login xong mất giỏ hàng"

Do:
- Inspect `src/assets/js/auth-utils.js`.
- Inspect `src/assets/js/navbar.js`.
- Inspect cart backend: `cart.routes.ts -> cart.controller.ts -> cart.service.ts -> cart.repository.ts`.
- Kiểm tra localStorage key `maverik_cart`.
- Kiểm tra `POST /cart/sync`.

Don't:
- Đổi key `maverik_cart`.
- Clear cart trước khi sync thành công.
- Đổi auth token storage.
- Đổi toàn bộ login/register flow.

## Example 6: Supabase image storage
User asks: "Migrate ảnh sản phẩm lên Supabase"

Do:
- Inspect `backend/scripts/migrate-product-images-to-supabase.ts`.
- Kiểm tra env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`.
- Hiểu Supabase chỉ dùng làm object storage.
- Chạy dry-run trước nếu script hỗ trợ.

Don't:
- Đưa service role key ra frontend.
- Thay MySQL bằng Supabase DB.
- Update database hàng loạt nếu chưa có dry-run/backup/confirmation.

## Example 7: Dọn file thừa
User asks: "Dọn project an toàn"

Do:
- Tìm reference trước khi xóa.
- Chỉ xóa file chắc chắn không còn import/link/script reference.
- Build lại sau khi xóa.

Don't:
- Xóa file chỉ vì "nhìn thừa".
- Xóa migration, env example, test config, scripts khi chưa hiểu usage.
- Chạy `git reset --hard`.
- Xóa `node_modules` nếu user không yêu cầu.

## Example 8: Thêm comment tiếng Việt
User asks: "Chú thích file frontend cho dễ học"

Do:
- Thêm comment giải thích API, event listener, render DOM.
- Giữ UTF-8 và tiếng Việt có dấu.
- Không đổi logic.

Don't:
- Rewrite function.
- Đổi selector/id.
- Đổi endpoint.
- Dịch UI lung tung ngoài phạm vi.

## Example 9: Khi gặp code ngoài phạm vi có vấn đề
Situation: Đang sửa category nhưng thấy payment code có bug.

Do:
- Không sửa payment.
- Ghi trong final: "Tôi thấy rủi ro ở payment..., chưa sửa vì ngoài scope."

Don't:
- Sửa luôn payment.
- Refactor shared helper.
- Đổi schema để "tiện".

## Example 10: Verify đúng mức
Small docs/comment change:
- Không cần full backend test, nhưng có thể kiểm tra file tồn tại/diff.

Frontend JS/HTML change:
- Chạy `npm run build`.

Backend service/repository change:
- Chạy test liên quan nếu có.
- Nếu không có test, chạy `npm run build` trong `backend`.

Payment/order/schema change:
- Cần test hoặc checklist thủ công rõ ràng.
- Nêu những case đã/không verify.
