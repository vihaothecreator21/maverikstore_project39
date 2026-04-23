import { z } from "zod";
import { OrderStatus } from "@prisma/client";

// ── Place Order ────────────────────────────────────────────────────
export const PlaceOrderSchema = z.object({
  shippingAddress: z
    .string({ required_error: "Địa chỉ giao hàng là bắt buộc" })
    .min(10, "Địa chỉ phải ít nhất 10 ký tự")
    .max(500, "Địa chỉ không vượt quá 500 ký tự"),
  shippingPhone: z
    .string({ required_error: "Số điện thoại là bắt buộc" })
    .regex(/^\+?[0-9]{9,15}$/, "Số điện thoại không hợp lệ"),
  paymentMethod: z.enum(["COD", "BANK_TRANSFER", "MOMO", "VNPAY"], {
    required_error: "Phương thức thanh toán là bắt buộc",
    invalid_type_error: "Phương thức thanh toán không hợp lệ",
  }),
  note: z.string().max(500, "Ghi chú không vượt quá 500 ký tự").optional(),
});

// ── Admin Update Order Status ──────────────────────────────────────
export const UpdateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus, {
    required_error: "Trạng thái đơn hàng là bắt buộc",
    invalid_type_error: "Trạng thái không hợp lệ",
  }),
  note: z.string().max(500).optional(),
});

// ── Get Orders Query ───────────────────────────────────────────────
export const OrderQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().positive().default(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 10))
    .pipe(z.number().int().positive().max(50).default(10)),
  status: z.nativeEnum(OrderStatus).optional(),
});

export type PlaceOrderInput = z.infer<typeof PlaceOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;
export type OrderQueryInput = z.infer<typeof OrderQuerySchema>;
