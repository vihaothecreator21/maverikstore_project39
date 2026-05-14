import { z } from "zod";

// Schema này kiểm tra dữ liệu frontend gửi lên chatbot.
// Mục tiêu: chỉ nhận đoạn chat ngắn, tránh gửi payload quá lớn làm tốn token/API cost.
export const SupportChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1200),
});

export const SupportChatRequestSchema = z.object({
  message: z.string().trim().min(1, "Tin nhắn không được để trống").max(1200),
  history: z.array(SupportChatMessageSchema).max(8).optional().default([]),
  context: z
    .object({
      currentPage: z.string().trim().max(120).optional(),
      productId: z.coerce.number().int().positive().optional(),
      productSlug: z.string().trim().max(255).optional(),
    })
    .optional()
    .default({}),
});

export type SupportChatRequestInput = z.infer<typeof SupportChatRequestSchema>;
