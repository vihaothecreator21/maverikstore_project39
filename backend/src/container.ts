/**
 * Dependency Injection Container — Composition Root
 *
 * Đây là nơi DUY NHẤT tạo instance của repositories và services.
 * Controllers import instance đã sẵn sàng từ đây.
 *
 * Pattern: Manual DI (không dùng framework — đủ đơn giản cho project sinh viên)
 *
 * Flow:
 *   Repositories (dùng prisma) → Services (inject repo) → Controllers (inject service)
 */

// ── Repositories ────────────────────────────────────────────────────
import { OrderRepository }   from "./repositories/order.repository";
import { AdminRepository }   from "./repositories/admin.repository";
import { PaymentRepository } from "./repositories/payment.repository";
import { UserRepository }    from "./repositories/user.repository";
import { ProductRepository } from "./repositories/product.repository";
import { CategoryRepository} from "./repositories/category.repository";
import { CartRepository }    from "./repositories/cart.repository";

export const orderRepository   = new OrderRepository();
export const adminRepository   = new AdminRepository();
export const paymentRepository = new PaymentRepository();
export const userRepository    = new UserRepository();
export const productRepository = new ProductRepository();
export const categoryRepository= new CategoryRepository();
export const cartRepository    = new CartRepository();

// ── Services (inject repositories) ─────────────────────────────────
import { OrderService }       from "./services/order.service";
import { DashboardService }   from "./services/dashboard.service";
import { AdminReportService } from "./services/adminReport.service";
import { PaymentService }     from "./services/payment.service";
import { AuthService }        from "./services/auth.service";
import { UserService }        from "./services/user.service";
import { ProductService }     from "./services/product.service";
import { CategoryService }    from "./services/category.service";
import { CartService }        from "./services/cart.service";

export const orderService       = new OrderService(orderRepository);
export const dashboardService   = new DashboardService(adminRepository);
export const adminReportService = new AdminReportService(adminRepository);
export const paymentService     = new PaymentService(paymentRepository);
export const authService        = new AuthService(userRepository);
export const userService        = new UserService(userRepository);
export const productService     = new ProductService(productRepository);
export const categoryService    = new CategoryService(categoryRepository);
export const cartService        = new CartService(cartRepository, productRepository);
