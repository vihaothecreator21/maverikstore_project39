import { Prisma } from "@prisma/client";

type DiscountableProduct = {
  price: Prisma.Decimal | number | string;
  discountPercent?: Prisma.Decimal | number | string | null;
  discountAmount?: Prisma.Decimal | number | string | null;
};

const toNumber = (value: Prisma.Decimal | number | string | null | undefined): number => {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return Number(value ?? 0);
};

export const calculateSalePrice = (product: DiscountableProduct): number => {
  const price = toNumber(product.price);
  const discountPercent = toNumber(product.discountPercent);
  const discountAmount = toNumber(product.discountAmount);

  const rawDiscount =
    discountPercent > 0
      ? price * (discountPercent / 100)
      : discountAmount;

  const salePrice = Math.max(0, price - rawDiscount);
  return Math.round(salePrice);
};

export const hasDiscount = (product: DiscountableProduct): boolean => {
  return calculateSalePrice(product) < toNumber(product.price);
};
