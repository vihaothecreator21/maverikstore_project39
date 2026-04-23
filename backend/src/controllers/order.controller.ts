import { Request, Response } from "express";
import { OrderService } from "../services/order.service";
import {
  PlaceOrderSchema,
  UpdateOrderStatusSchema,
  OrderQuerySchema,
} from "../schemas/order.schema";
import { sendSuccess, HTTP_STATUS } from "../utils/apiResponse";

export class OrderController {
  // POST /api/v1/orders
  static async placeOrder(req: Request, res: Response) {
    const userId = (req as any).userId as number;
    const input = PlaceOrderSchema.parse(req.body);
    const order = await OrderService.placeOrder(userId, input);
    return sendSuccess(res, order, "Đặt hàng thành công", HTTP_STATUS.CREATED);
  }

  // GET /api/v1/orders
  static async getMyOrders(req: Request, res: Response) {
    const userId = (req as any).userId as number;
    const query = OrderQuerySchema.parse(req.query);
    const result = await OrderService.getMyOrders(userId, query);
    return sendSuccess(res, result, "Lấy danh sách đơn hàng thành công", HTTP_STATUS.OK);
  }

  // GET /api/v1/orders/:id
  static async getOrderById(req: Request, res: Response) {
    const userId = (req as any).userId as number;
    const orderId = parseInt(req.params.id, 10);
    const order = await OrderService.getOrderById(orderId, userId, false);
    return sendSuccess(res, order, "Lấy chi tiết đơn hàng thành công", HTTP_STATUS.OK);
  }

  // PATCH /api/v1/orders/:id/cancel
  static async cancelOrder(req: Request, res: Response) {
    const userId = (req as any).userId as number;
    const orderId = parseInt(req.params.id, 10);
    const order = await OrderService.cancelOrder(orderId, userId);
    return sendSuccess(res, order, "Đơn hàng đã được hủy thành công", HTTP_STATUS.OK);
  }

  // ── Admin handlers ───────────────────────────────────────────────

  // GET /api/v1/admin/orders
  static async adminGetOrders(req: Request, res: Response) {
    const query = OrderQuerySchema.parse(req.query);
    const result = await OrderService.adminGetOrders(query);
    return sendSuccess(res, result, "Lấy tất cả đơn hàng thành công", HTTP_STATUS.OK);
  }

  // GET /api/v1/admin/orders/:id
  static async adminGetOrderById(req: Request, res: Response) {
    const adminId = (req as any).userId as number;
    const orderId = parseInt(req.params.id, 10);
    const order = await OrderService.getOrderById(orderId, adminId, true);
    return sendSuccess(res, order, "Lấy chi tiết đơn hàng thành công", HTTP_STATUS.OK);
  }

  // PATCH /api/v1/admin/orders/:id/status
  static async adminUpdateStatus(req: Request, res: Response) {
    const adminId = (req as any).userId as number;
    const orderId = parseInt(req.params.id, 10);
    const input = UpdateOrderStatusSchema.parse(req.body);
    const order = await OrderService.adminUpdateStatus(orderId, input, adminId);
    return sendSuccess(res, order, "Cập nhật trạng thái đơn hàng thành công", HTTP_STATUS.OK);
  }
}
