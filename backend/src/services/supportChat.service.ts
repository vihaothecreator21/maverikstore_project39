import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "../config/database.js";
import { getEnv } from "../config/env.config.js";
import type { SupportChatRequestInput } from "../schemas/supportChat.schema.js";
import { APIError } from "../utils/apiResponse.js";
import { calculateSalePrice, hasDiscount } from "../utils/pricing.helper.js";

type ChatProduct = {
  id: number;
  name: string;
  slug: string | null;
  price: any;
  discountPercent: any;
  discountAmount: any;
  stockQuantity: number;
  description: string | null;
  category: { name: string } | null;
};

export class SupportChatService {
  /**
   * Hàm chính của chatbot.
   *
   * Cách hoạt động:
   * 1. Nhận tin nhắn + lịch sử ngắn từ frontend.
   * 2. Lấy thêm dữ liệu sản phẩm từ DB để AI có thông tin thật.
   * 3. Ghép "system prompt" để đặt luật ứng xử cho AI.
   * 4. Gọi Gemini và trả câu trả lời về frontend.
   */
  async chat(input: SupportChatRequestInput) {
    const env = getEnv();

    if (!env.GEMINI_API_KEY) {
      throw new APIError(
        503,
        "Chatbot chưa được cấu hình GEMINI_API_KEY",
        {},
        "GEMINI_NOT_CONFIGURED",
      );
    }

    // Lấy sản phẩm liên quan trước khi hỏi AI.
    // Nhờ vậy AI không phải tự bịa giá, tồn kho, tên sản phẩm.
    const products = await this.findRelevantProducts(input);
    const productContext = this.formatProductContext(products);

    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: env.GEMINI_MODEL,
      systemInstruction: this.buildSystemInstruction(productContext),
    });

    // Chỉ gửi vài tin gần nhất để tiết kiệm token và tránh lịch sử quá dài.
    const historyText = input.history
      .slice(-6)
      .map((item) => `${item.role === "user" ? "Khách" : "Maverik AI"}: ${item.content}`)
      .join("\n");

    const prompt = [
      historyText ? `Lịch sử trò chuyện gần nhất:\n${historyText}` : "",
      `Trang hiện tại: ${input.context.currentPage || "không rõ"}`,
      `Câu hỏi mới của khách: ${input.message}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    return {
      reply: text || "Xin lỗi, hiện tại tôi chưa trả lời được câu hỏi này.",
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        price: Number(product.price),
        salePrice: calculateSalePrice(product),
        hasDiscount: hasDiscount(product),
        stockQuantity: product.stockQuantity,
        url: product.slug ? `/product-detail.html?slug=${product.slug}` : `/product-detail.html?id=${product.id}`,
      })),
    };
  }

  /**
   * Tìm sản phẩm liên quan đến câu hỏi.
   *
   * Nếu frontend đang ở trang chi tiết sản phẩm, ưu tiên lấy đúng productId/productSlug.
   * Nếu là câu hỏi chung, tìm theo từ khóa trong tên sản phẩm.
   */
  private async findRelevantProducts(input: SupportChatRequestInput): Promise<ChatProduct[]> {
    if (input.context.productId) {
      const product = await prisma.product.findUnique({
        where: { id: input.context.productId },
        select: this.productSelect(),
      });
      return product ? [product] : [];
    }

    if (input.context.productSlug) {
      const product = await prisma.product.findUnique({
        where: { slug: input.context.productSlug },
        select: this.productSelect(),
      });
      return product ? [product] : [];
    }

    const keywords = this.extractKeywords(input.message);

    if (keywords.length === 0) {
      return prisma.product.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: this.productSelect(),
      });
    }

    return prisma.product.findMany({
      where: {
        OR: keywords.map((keyword) => ({
          name: { contains: keyword },
        })),
      },
      take: 6,
      orderBy: { createdAt: "desc" },
      select: this.productSelect(),
    });
  }

  /**
   * Select dùng chung để chỉ lấy dữ liệu chatbot cần.
   * Không lấy dữ liệu nhạy cảm, không lấy toàn bộ bảng.
   */
  private productSelect() {
    return {
      id: true,
      name: true,
      slug: true,
      price: true,
      discountPercent: true,
      discountAmount: true,
      stockQuantity: true,
      description: true,
      category: { select: { name: true } },
    } as const;
  }

  /**
   * Tách keyword đơn giản từ câu hỏi.
   * Đây là bản MVP: đủ để tìm theo tên sản phẩm như sofa, bàn, ghế, giường.
   * Sau này có thể nâng cấp bằng full-text search hoặc vector search.
   */
  private extractKeywords(message: string): string[] {
    const stopwords = new Set([
      "toi",
      "tôi",
      "muon",
      "muốn",
      "can",
      "cần",
      "tim",
      "tìm",
      "san",
      "sản",
      "pham",
      "phẩm",
      "gia",
      "giá",
      "co",
      "có",
      "khong",
      "không",
      "cho",
      "va",
      "và",
      "the",
      "is",
      "are",
      "a",
      "an",
      "the",
    ]);

    return message
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length >= 3 && !stopwords.has(word))
      .slice(0, 6);
  }

  /**
   * Chuyển dữ liệu DB thành đoạn text ngắn cho Gemini đọc.
   * Format rõ ràng giúp AI trả lời đúng giá/tồn kho/link hơn.
   */
  private formatProductContext(products: ChatProduct[]): string {
    if (products.length === 0) {
      return "Không tìm thấy sản phẩm liên quan trong DB cho câu hỏi này.";
    }

    return products
      .map((product) => {
        const url = product.slug
          ? `/product-detail.html?slug=${product.slug}`
          : `/product-detail.html?id=${product.id}`;

        return [
          `- ID: ${product.id}`,
          `Tên: ${product.name}`,
          `Danh mục: ${product.category?.name ?? "Không rõ"}`,
          `Giá gốc: ${Number(product.price).toLocaleString("vi-VN")}đ`,
          `Giá sau giảm: ${calculateSalePrice(product).toLocaleString("vi-VN")}đ`,
          `Tồn kho: ${product.stockQuantity}`,
          `Link: ${url}`,
          `Mô tả: ${product.description?.slice(0, 260) ?? "Không có mô tả"}`,
        ].join("\n");
      })
      .join("\n\n");
  }

  /**
   * System instruction là "luật chơi" của chatbot.
   * Đây là phần rất quan trọng để AI không trả lời lung tung hoặc hứa quá mức.
   */
  private buildSystemInstruction(productContext: string): string {
    return `
Bạn là Maverik AI, chatbot hỗ trợ khách hàng của website Maverik Furniture.

Nhiệm vụ:
- Trả lời thân thiện, ngắn gọn, dễ hiểu bằng tiếng Việt nếu khách hỏi tiếng Việt.
- Nếu khách hỏi tiếng Anh, trả lời bằng tiếng Anh.
- Tư vấn sản phẩm nội thất dựa trên dữ liệu sản phẩm được cung cấp bên dưới.
- Có thể nhắc khách rằng VNPay hỗ trợ thẻ quốc tế như Visa, Mastercard, JCB.
- Hướng dẫn khách đặt hàng, thanh toán COD, chuyển khoản ngân hàng, VNPay.

Quy tắc an toàn:
- Không hỏi mật khẩu, mã OTP, số thẻ đầy đủ, CVV.
- Không tự tạo khuyến mãi, giảm giá, chính sách đổi trả nếu dữ liệu không có.
- Không cam kết ngày giao hàng chính xác nếu hệ thống không cung cấp.
- Nếu khách hỏi trạng thái đơn hàng cụ thể, hãy hướng dẫn đăng nhập và vào trang tài khoản/đơn hàng.
- Nếu không chắc, nói rõ "mình chưa có thông tin chắc chắn" và gợi ý liên hệ cửa hàng.

Dữ liệu sản phẩm liên quan từ DB:
${productContext}
`.trim();
  }
}
