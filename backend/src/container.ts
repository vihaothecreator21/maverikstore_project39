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
import { OrderRepository }   from "./repositories/order.repository.js";
import { AdminRepository }   from "./repositories/admin.repository.js";
import { PaymentRepository } from "./repositories/payment.repository.js";
import { UserRepository }    from "./repositories/user.repository.js";
import { PendingRegistrationRepository } from "./repositories/pending-registration.repository.js";
import { ProductRepository } from "./repositories/product.repository.js";
import { CategoryRepository} from "./repositories/category.repository.js";
import { CartRepository }    from "./repositories/cart.repository.js";
import { ReviewRepository }  from "./repositories/review.repository.js";

export const orderRepository   = new OrderRepository();
export const adminRepository   = new AdminRepository();
export const paymentRepository = new PaymentRepository();
export const userRepository    = new UserRepository();
export const pendingRegistrationRepository = new PendingRegistrationRepository();
export const productRepository = new ProductRepository();
export const categoryRepository= new CategoryRepository();
export const cartRepository    = new CartRepository();
export const reviewRepository  = new ReviewRepository();

// ── Services (inject repositories) ─────────────────────────────────
import { OrderService }       from "./services/order.service.js";
import { DashboardService }   from "./services/dashboard.service.js";
import { AdminReportService } from "./services/adminReport.service.js";
import { PaymentService }     from "./services/payment.service.js";
import { AuthService }        from "./services/auth.service.js";
import { EmailService }       from "./services/email.service.js";
import { OtpService }         from "./services/otp.service.js";
import { UserService }        from "./services/user.service.js";
import { ProductService }     from "./services/product.service.js";
import { CategoryService }    from "./services/category.service.js";
import { CartService }        from "./services/cart.service.js";
import { SupportChatService } from "./services/supportChat.service.js";
import { ReviewService }      from "./services/review.service.js";

export const orderService       = new OrderService(orderRepository);
export const dashboardService   = new DashboardService(adminRepository);
export const adminReportService = new AdminReportService(adminRepository);
export const paymentService     = new PaymentService(paymentRepository);
export const emailService       = new EmailService();
export const otpService         = new OtpService();
export const authService        = new AuthService(
  userRepository,
  pendingRegistrationRepository,
  emailService,
  otpService,
);
export const userService        = new UserService(userRepository);
export const productService     = new ProductService(productRepository);
export const categoryService    = new CategoryService(categoryRepository);
export const cartService        = new CartService(cartRepository, productRepository);
export const supportChatService = new SupportChatService();
export const reviewService      = new ReviewService(reviewRepository, productRepository);
