import { OrderRepository } from "../repositories/order.repository";
import { OrderStatus } from "@prisma/client";
import { writeAuditLog } from "../utils/auditLog.helper";

/**
 * UC-05: Order Timeout Job
 * Chạy mỗi 1 phút: scan đơn PENDING > 15 phút → CANCELLED + hoàn kho
 * Rule: Xử lý từng order riêng biệt, không để 1 lỗi crash toàn bộ job
 */
export const runOrderTimeoutJob = async (): Promise<void> => {
  let timedOut = 0;
  let errors = 0;

  try {
    const expiredOrders = await OrderRepository.findTimedOutOrders();

    if (expiredOrders.length === 0) return;

    console.log(`[OrderTimeout] Found ${expiredOrders.length} expired order(s)`);

    for (const order of expiredOrders) {
      try {
        await OrderRepository.updateStatusWithRollback(
          order.id,
          OrderStatus.CANCELLED,
          true, // hoàn kho
        );

        // Ghi AuditLog — action=TIMEOUT (system thực hiện, userId = userId của order)
        await writeAuditLog({
          action: "TIMEOUT",
          entity: "Order",
          entityId: order.id,
          oldValue: { status: OrderStatus.PENDING },
          newValue: { status: OrderStatus.CANCELLED, reason: "Auto-cancelled after 15 minutes" },
          userId: order.userId,
        });

        timedOut++;
        console.log(`[OrderTimeout] Cancelled order #${order.id}`);
      } catch (err) {
        // Không để 1 order lỗi crash toàn bộ job
        errors++;
        console.error(`[OrderTimeout] Failed to cancel order #${order.id}:`, err);
      }
    }

    if (timedOut > 0 || errors > 0) {
      console.log(`[OrderTimeout] Done: ${timedOut} cancelled, ${errors} errors`);
    }
  } catch (err) {
    console.error("[OrderTimeout] Job failed:", err);
  }
};

/**
 * Khởi động cron job dùng setInterval (không cần thêm dependency node-cron)
 * Gọi hàm này trong server.ts sau khi server start
 */
export const startOrderTimeoutJob = (): void => {
  const INTERVAL_MS = 60 * 1000; // 1 phút
  console.log("[OrderTimeout] Job started — checking every 1 minute");

  // Chạy ngay lần đầu
  runOrderTimeoutJob();

  // Sau đó cứ 1 phút chạy 1 lần
  setInterval(runOrderTimeoutJob, INTERVAL_MS);
};
