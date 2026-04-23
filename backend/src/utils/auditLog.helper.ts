import { prisma } from "../config/database";
import { Prisma } from "@prisma/client";

type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "CANCEL"
  | "TIMEOUT"
  | "REFUND"
  | "STATUS_CHANGE"
  | "PAYMENT_SUCCESS"
  | "PAYMENT_FAILED";
type AuditEntity = "Order" | "Product" | "Payment";

interface AuditLogInput {
  action: AuditAction;
  entity: AuditEntity;
  entityId: number;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  userId: number;
}

// Fix #4: Dùng đúng type Prisma.TransactionClient thay vì typeof prisma
type PrismaClient = typeof prisma | Prisma.TransactionClient;

/**
 * Ghi log kiểm toán cho mọi thay đổi quan trọng.
 * Tuân thủ PA.md: mỗi thay đổi giá/kho Product hoặc hủy Order phải insert AuditLog.
 *
 * @param input   Dữ liệu audit log
 * @param tx      Prisma transaction client (nếu cần ghi trong cùng transaction)
 */
export const writeAuditLog = async (
  input: AuditLogInput,
  tx?: PrismaClient,
): Promise<void> => {
  const client = (tx ?? prisma) as typeof prisma;
  await client.auditLog.create({
    data: {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      // Fix: Prisma nullable Json dùng Prisma.JsonNull thay vì null JS
      oldValue: (input.oldValue ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      newValue: (input.newValue ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      userId: input.userId,
    },
  });
};
