import { PrismaClient } from "@prisma/client";

/**
 * Prisma Singleton Instance (Mẫu thiết kế Singleton)
 *
 * Vấn đề: Mỗi lần import PrismaClient sẽ tạo ra một kết nối DB mới.
 * Với hot-reload trong development (tsx/nodemon), module bị nạp lại nhiều lần
 * → dẫn đến hàng trăm kết nối mở song song → crash DB.
 *
 * Giải pháp: Lưu instance vào `global` (tồn tại xuyên suốt process).
 * - Lần đầu: tạo PrismaClient mới, gán vào global.
 * - Các lần sau: dùng lại instance từ global.
 *
 * @example
 * import { prisma } from '@/config/database';
 * const user = await prisma.user.findUnique({ where: { id: 1 } });
 */
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Dùng instance từ global nếu đã tồn tại, ngược lại tạo mới
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // Trong môi trường phát triển: log tất cả query, warn, error
    // Trong production: chỉ log lỗi để tránh lộ thông tin nhạy cảm
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

// Chỉ lưu vào global ở môi trường không phải production
// (tránh rò rỉ bộ nhớ trong production)
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Kết nối đến cơ sở dữ liệu
 * Gọi hàm này khi khởi động server (trong server.ts).
 * Nếu kết nối thất bại, ném lỗi để server không chạy với DB thiếu.
 */
export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log("✓ Database connected successfully");
  } catch (error) {
    console.error("✗ Database connection failed:", error);
    throw error; // Để server.ts bắt và tắt process
  }
};

/**
 * Ngắt kết nối khỏi cơ sở dữ liệu
 * Gọi khi server nhận tín hiệu tắt graceful (SIGINT, SIGTERM).
 * Đảm bảo tất cả transaction đang chạy được hoàn thành trước khi ngắt.
 */
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    console.log("✓ Database disconnected successfully");
  } catch (error) {
    console.error("✗ Database disconnection failed:", error);
  }
};

export default prisma;
