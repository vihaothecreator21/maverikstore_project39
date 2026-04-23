 TỔNG HỢP KIẾN TRÚC HỆ THỐNG E-COMMERCE (FULL VERSION)

I. HỆ THỐNG CÁC TÁC NHÂN (ACTORS)


Guest (Khách vãng lai): Duyệt sản phẩm, xem danh mục, tìm kiếm, đăng ký/đăng nhập.

RegisteredUser (Khách hàng): Đặt hàng, theo dõi đơn, hủy đơn (trong 24h), đánh giá, quản lý profile.

Admin (Quản trị viên): Quản lý sản phẩm, danh mục, đơn hàng, tồn kho, báo cáo doanh thu, duyệt hoàn tiền.



II. LUỒNG NGHIỆP VỤ CỐT LÕI (CORE BUSINESS FLOWS)

1. Luồng mua hàng (Customer - Order Journey)


Bước 1: Chọn hàng: Thêm sản phẩm vào giỏ (Validation: Kiểm tra tồn kho thời gian thực).

Bước 2: Đặt hàng (Transaction Atomic):

Kiểm tra lại tồn kho SELECT FOR UPDATE.

Tạo Order (PENDING), OrderDetail, Payment (PENDING).

Trừ tồn kho Product.

Nếu lỗi -> Rollback.



Bước 3: Thanh toán:

Webhook từ cổng thanh toán nhận kết quả.

Update Order -> CONFIRMED, Payment -> SUCCESS.

Nếu lỗi/Timeout -> CANCELLED & Hoàn kho.




2. Luồng Quản trị (Admin - Backend Journey)


Quản lý sản phẩm: CRUD sản phẩm (Admin chỉ được nhập giá > 0, Category bắt buộc).

Quản lý tồn kho: Tự động cảnh báo khi stock < 10. Admin có thể update thủ công (mọi hành động update giá/kho đều ghi AuditLog).

Báo cáo: Filter theo Day/Month/Year trên các đơn hàng trạng thái COMPLETED.



III. BẢNG DANH MỤC USE CASES & RÀNG BUỘC (BUSINESS RULES)

| Module | Use Case | Actor | Ràng buộc chính |
| :--- | :--- | :--- | :--- |
| Auth | Login / Register | Guest | Rate limit: 3/hour/IP, Pass min 8 ký tự |
| Cart | Add to Cart | User | Check inventory trước khi thêm |
| Order | Place Order | User | Atomic transaction, trừ kho ngay |
| Order | Cancel Order | User | Chỉ được hủy trong 24h từ lúc tạo |
| Admin | Manage Products | Admin | Price > 0, bắt buộc có Category |
| Admin | Revenue Report | Admin | Filter: Ngày/Tháng/Năm, đơn COMPLETED |
| Inventory| Monitor Stock | Admin | Cảnh báo tự động nếu stock < 10 |
| Order | Order Timeout | System | Hủy đơn tự động nếu PENDING > 15 phút |



IV. LOGIC KIỂM SOÁT DỮ LIỆU & BẢO MẬT (ENTERPRISE LOGIC)


State Machine (Đơn hàng):
PENDING → CONFIRMED → PROCESSING → SHIPPING → DELIVERED → COMPLETED

Rẽ nhánh: PENDING → CANCELLED (24h), DELIVERED → RETURNED (7 ngày).



Audit Trail (Kiểm toán):
Mỗi thay đổi ở bảng Product (giá, kho) hoặc Order (hủy) phải insert 1 bản ghi vào bảng AuditLog:
{Action, Entity, EntityID, OldValue, NewValue, UserID, Time}.

Concurrency (Xử lý đồng thời):
Sử dụng prisma.$transaction kết hợp SELECT ... FOR UPDATE trong các luồng đặt hàng để chặn đứng tình trạng "bán quá số lượng" (Overselling).

Data Integrity (Toàn vẹn):

Sử dụng kiểu dữ liệu Decimal cho tiền tệ (tuyệt đối không dùng Float).

Sử dụng Enum cho trạng thái đơn hàng và vai trò người dùng.





V. LỘ TRÌNH TRIỂN KHAI CODE (ACTION PLAN)

Để đưa toàn bộ logic này vào project, bạn cần thực hiện theo các bước sau trong code:



Backend Structure:

src/modules/auth: JWT & Role Guard.

src/modules/orders: Order Service (Atomic Transaction Logic).

src/modules/admin: Product/Report Service & Audit Logging.



Cron Jobs (Node-cron):

Chạy mỗi 1 phút: Scan đơn hàng PENDING > 15 phút -> Hủy.

Chạy mỗi ngày: Scan sản phẩm stock < 10 -> Gửi email báo cáo.



Webhook Handler: Tạo route /api/webhook/payment để nhận kết quả từ cổng thanh toán.



GHI CHÚ TỪ SENIOR BA:

Bạn đã có một "Master Blueprint" hoàn hảo. Hiện tại, kiến trúc này đã bao phủ được:



Trải nghiệm khách hàng mượt mà (đặt hàng nhanh, tự động hóa).

Quyền lực quản trị cho Admin (đầy đủ báo cáo, quản lý tồn kho).

Độ an toàn dữ liệu cao (Atomic transaction, Audit log).
