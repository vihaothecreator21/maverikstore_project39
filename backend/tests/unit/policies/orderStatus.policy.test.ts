import { OrderStatus } from "@prisma/client";
import {
  canTransition,
  shouldRestoreStock,
} from "../../../src/policies/orderStatus.policy";

describe("order status policy", () => {
  it("allows only production order lifecycle transitions", () => {
    expect(canTransition(OrderStatus.PENDING_PAYMENT, OrderStatus.PENDING)).toBe(true);
    expect(canTransition(OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELLED)).toBe(true);
    expect(canTransition(OrderStatus.PENDING, OrderStatus.CONFIRMED)).toBe(true);
    expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.PROCESSING)).toBe(true);
    expect(canTransition(OrderStatus.PROCESSING, OrderStatus.SHIPPING)).toBe(true);
    expect(canTransition(OrderStatus.SHIPPING, OrderStatus.DELIVERED)).toBe(true);
    expect(canTransition(OrderStatus.DELIVERED, OrderStatus.COMPLETED)).toBe(true);
  });

  it("blocks invalid or backwards transitions", () => {
    expect(canTransition(OrderStatus.PENDING, OrderStatus.SHIPPING)).toBe(false);
    expect(canTransition(OrderStatus.SHIPPING, OrderStatus.PENDING)).toBe(false);
    expect(canTransition(OrderStatus.CANCELLED, OrderStatus.PENDING)).toBe(false);
    expect(canTransition(OrderStatus.COMPLETED, OrderStatus.CANCELLED)).toBe(false);
  });

  it("restores stock only when target status is cancelled", () => {
    expect(shouldRestoreStock(OrderStatus.CANCELLED)).toBe(true);
    expect(shouldRestoreStock(OrderStatus.RETURNED)).toBe(false);
    expect(shouldRestoreStock(OrderStatus.COMPLETED)).toBe(false);
  });
});
