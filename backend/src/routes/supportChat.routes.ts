import { Router } from "express";
import { SupportChatController } from "../controllers/supportChat.controller.js";
import { catchAsync } from "../utils/catchAsync.js";

export const supportChatRoutes = Router();

// Public route: khách vãng lai cũng có thể hỏi tư vấn sản phẩm trước khi đăng nhập.
supportChatRoutes.post("/", catchAsync(SupportChatController.chat));
