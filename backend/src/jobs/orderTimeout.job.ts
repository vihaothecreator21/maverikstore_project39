import { orderRepository } from "../container";
import { OrderStatus } from "@prisma/client";

/**
 * UC-05: Order Timeout Background Job
 *
 * Mục đích: Tự động hủy các đơn hàng VNPAY không được thanh toán trong 15 phút
 *
 * Tại sao cần job này?
 * - Khi user chọn VNPAY → đơn được tạo với status PENDING_PAYMENT
 * - Nếu user không hoàn tất thanh toán (đóng tab, timeout...) → đơn treo mãi
 * - Job này scan định kỳ và hủy các đơn treo, đồng thời hoàn lại tồn kho
 *
 * Tần suất: Chạy mỗi 1 phút (setInterval trong startOrderTimeoutJob)
 */
export const runOrderTimeoutJob = async (): Promise<void> => {
  let timedOut = 0; // Số đơn đã hủy thành công
  let errors = 0;   // Số đơn hủy thất bại

  try {
    // Tìm tất cả đơn VNPAY đã quá 15 phút chưa thanh toán
    const expiredOrders = await orderRepository.findTimedOutOrders();

    // Không có đơn nào hết hạn → thoát sớm, không log gì
    if (expiredOrders.length === 0) return;

    console.log(`[OrderTimeout] Found ${expiredOrders.length} expired order(s)`);

    // Xử lý từng đơn riêng biệt trong try/catch riêng
    // → 1 đơn lỗi không crash toàn bộ job, các đơn khác vẫn được xử lý
    for (const order of expiredOrders) {
      try {
        await orderRepository.updateStatusWithRollback(
          order.id,
          OrderStatus.CANCELLED,
          true, // hoàn kho: true vì đã trừ kho lúc đặt hàng
          {
            action: "TIMEOUT",
            oldStatus: order.status,
            userId: order.userId, // Dùng userId của chủ đơn để ghi AuditLog
          },
        );

        timedOut++;
        console.log(`[OrderTimeout] Cancelled order #${order.id}`);
      } catch (err) {
        // Lỗi có thể xảy ra: race condition (user vừa thanh toán trước job chạy)
        // → updateStatusWithRollback sẽ ném ORDER_STATUS_CHANGED → bỏ qua, không phải lỗi thật
        errors++;
        console.error(`[OrderTimeout] Failed to cancel order #${order.id}:`, err);
      }
    }

    if (timedOut > 0 || errors > 0) {
      console.log(`[OrderTimeout] Done: ${timedOut} cancelled, ${errors} errors`);
    }
  } catch (err) {
    // Lỗi ở cấp query (DB down, network...) → log và chờ lần chạy tiếp theo
    console.error("[OrderTimeout] Job failed:", err);
  }
};

/**
 * Khởi động Order Timeout Job bằng setInterval
 *
 * Tại sao dùng setInterval thay vì node-cron?
 * → Đơn giản, không thêm dependency, đủ dùng cho tần suất 1 phút
 * → Với production scale lớn hơn, nên dùng BullMQ hoặc Agenda
 *
 * Gọi hàm này trong server.ts ngay sau khi server start và DB connect thành công
 */
export const startOrderTimeoutJob = (): void => {
  const INTERVAL_MS = 60 * 1000; // 1 phút = 60.000 ms
  console.log("[OrderTimeout] Job started — checking every 1 minute");

  // Chạy ngay lập tức khi server khởi động (không đợi đến phút đầu tiên)
  runOrderTimeoutJob();

  // Sau đó cứ mỗi 1 phút chạy 1 lần
  setInterval(runOrderTimeoutJob, INTERVAL_MS);
};
