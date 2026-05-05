import { Request, Response } from "express";
import { dashboardService, adminReportService } from "../container";
import { sendSuccess, HTTP_STATUS, APIError } from "../utils/apiResponse";

/**
 * Admin Controller — Dashboard, Reports, Export
 * All handlers require ADMIN/SUPER_ADMIN (enforced by requireAdmin middleware)
 */
export class AdminController {
  /**
   * GET /api/v1/admin/stats
   * Dashboard overview: revenue, orders, products, customers
   */
  static async getDashboardStats(_req: Request, res: Response) {
    const stats = await dashboardService.getDashboardStats();
    return sendSuccess(res, stats, "Dashboard statistics retrieved", HTTP_STATUS.OK);
  }

  /**
   * GET /api/v1/admin/revenue
   * Revenue by period for bar chart
   * Query: ?period=day|week|month|year&start=YYYY-MM-DD&end=YYYY-MM-DD
   */
  static async getRevenue(req: Request, res: Response) {
    const period = (req.query.period as string) || "day";
    if (!["day", "week", "month", "year"].includes(period)) {
      throw new APIError(400, "period phải là day, week, month hoặc year", {}, "INVALID_PERIOD");
    }

    const { startDate, endDate } = AdminController._parseDateRange(req);
    const data = await adminReportService.getRevenueByPeriod(
      period as "day" | "week" | "month" | "year",
      startDate,
      endDate,
    );
    return sendSuccess(res, data, "Revenue data retrieved", HTTP_STATUS.OK);
  }

  /**
   * GET /api/v1/admin/revenue/payment
   * Revenue breakdown by payment method
   * Query: ?start=YYYY-MM-DD&end=YYYY-MM-DD
   */
  static async getRevenueByPayment(req: Request, res: Response) {
    const { startDate, endDate } = AdminController._parseDateRange(req);
    const data = await adminReportService.getRevenueByPaymentMethod(startDate, endDate);
    return sendSuccess(res, data, "Revenue by payment method retrieved", HTTP_STATUS.OK);
  }

  /**
   * GET /api/v1/admin/products/stats
   * Best sellers, low stock products, revenue by category
   */
  static async getProductStats(req: Request, res: Response) {
    const limit     = parseInt(req.query.limit as string) || 10;
    const threshold = parseInt(req.query.threshold as string) || 10;

    const [bestSellers, lowStock, byCategory] = await Promise.all([
      adminReportService.getBestSellers(limit),
      adminReportService.getLowStockProducts(threshold),
      adminReportService.getRevenueByCategory(),
    ]);

    return sendSuccess(
      res,
      { bestSellers, lowStock, byCategory },
      "Product statistics retrieved",
      HTTP_STATUS.OK,
    );
  }

  /**
   * GET /api/v1/admin/customers/stats
   * Total customers, new this month, top spenders
   */
  static async getCustomerStats(_req: Request, res: Response) {
    const stats = await adminReportService.getCustomerStats();
    return sendSuccess(res, stats, "Customer statistics retrieved", HTTP_STATUS.OK);
  }

  /**
   * GET /api/v1/admin/export/orders
   * Raw order data for CSV/PDF export
   * Query: ?start=YYYY-MM-DD&end=YYYY-MM-DD
   */
  static async exportOrders(req: Request, res: Response) {
    const { startDate, endDate } = AdminController._parseDateRange(req);
    const data = await adminReportService.getOrdersForExport(startDate, endDate);
    return sendSuccess(res, data, `${data.length} orders ready for export`, HTTP_STATUS.OK);
  }

  // ── Private Helpers ──────────────────────────────────────────────

  /**
   * Parse start/end date from query params
   * Defaults: last 30 days
   */
  private static _parseDateRange(req: Request): { startDate: Date; endDate: Date } {
    const now = new Date();

    const defaultStart = new Date(now);
    defaultStart.setDate(defaultStart.getDate() - 30);

    const startStr = req.query.start as string;
    const endStr   = req.query.end   as string;

    const startDate = startStr ? new Date(startStr + "T00:00:00+07:00") : defaultStart;
    const endDate   = endStr   ? new Date(endStr   + "T23:59:59+07:00") : now;

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new APIError(400, "Ngày không hợp lệ. Dùng định dạng YYYY-MM-DD", {}, "INVALID_DATE");
    }

    return { startDate, endDate };
  }
}
