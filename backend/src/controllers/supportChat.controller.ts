import { Request, Response } from "express";
import { supportChatService } from "../container.js";
import { SupportChatRequestSchema } from "../schemas/supportChat.schema.js";
import { HTTP_STATUS, sendSuccess } from "../utils/apiResponse.js";

export class SupportChatController {
  static async chat(req: Request, res: Response): Promise<void> {
    const input = SupportChatRequestSchema.parse(req.body);
    const result = await supportChatService.chat(input);

    sendSuccess(
      res,
      result,
      "Chatbot trả lời thành công",
      HTTP_STATUS.OK,
    );
  }
}
