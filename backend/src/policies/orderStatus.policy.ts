import { OrderStatus } from "@prisma/client";

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: [OrderStatus.PENDING, OrderStatus.CANCELLED],
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.SHIPPING],
  SHIPPING: [OrderStatus.DELIVERED],
  DELIVERED: [OrderStatus.COMPLETED, OrderStatus.RETURNED],
  COMPLETED: [],
  CANCELLED: [],
  RETURNED: [],
};

export function allowedTransitions(status: OrderStatus): OrderStatus[] {
  return ORDER_STATUS_TRANSITIONS[status] ?? [];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return allowedTransitions(from).includes(to);
}

export function shouldRestoreStock(status: OrderStatus): boolean {
  return status === OrderStatus.CANCELLED;
}

export function shouldMarkPaymentSuccess(status: OrderStatus): boolean {
  return status === OrderStatus.DELIVERED || status === OrderStatus.COMPLETED;
}
