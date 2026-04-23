import { z } from "zod";

/**
 * Schema cho query params khi tạo VNPay URL
 * GET /payments/vnpay/create?orderId=123
 */
export const CreateVNPayUrlSchema = z.object({
  orderId: z.coerce.number().int().positive("orderId phải là số nguyên dương"),
});

/**
 * Schema validate params VNPay redirect về (return URL & IPN)
 * VNPay gửi các trường vnp_* dạng string
 */
export const VNPayCallbackSchema = z.object({
  vnp_TmnCode:       z.string(),
  vnp_Amount:        z.string(),
  vnp_BankCode:      z.string().optional(),
  vnp_BankTranNo:    z.string().optional(),
  vnp_CardType:      z.string().optional(),
  vnp_PayDate:       z.string().optional(),
  vnp_OrderInfo:     z.string(),
  vnp_TransactionNo: z.string().optional(),
  vnp_ResponseCode:  z.string(),
  vnp_TransactionStatus: z.string().optional(),
  vnp_TxnRef:        z.string(),
  vnp_SecureHash:    z.string(),
}).passthrough(); // Cho phép các field phụ VNPay có thể thêm

export type CreateVNPayUrlInput = z.infer<typeof CreateVNPayUrlSchema>;
export type VNPayCallbackInput  = z.infer<typeof VNPayCallbackSchema>;
