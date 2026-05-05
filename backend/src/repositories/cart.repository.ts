import { prisma } from "../config/database";

export class CartRepository {
  async findCartByUserId(userId: number) {
    return prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                price: true,
                imageUrl: true,
                stockQuantity: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  async createCart(userId: number) {
    return prisma.cart.create({ data: { userId } });
  }

  async upsertCartItem(
    cartId: number,
    productId: number,
    size: string,
    color: string,
    quantity: number,
  ) {
    const existingItem = await prisma.cartItem.findFirst({
      where: { cartId, productId, size, color },
    });

    if (existingItem) {
      return prisma.cartItem.update({
        where: { id: existingItem.id },
        data:  { quantity: existingItem.quantity + quantity },
      });
    }

    return prisma.cartItem.create({
      data: { cartId, productId, size, color, quantity },
    });
  }

  async updateItemQty(cartItemId: number, quantity: number) {
    return prisma.cartItem.update({
      where: { id: cartItemId },
      data:  { quantity },
    });
  }

  async removeItem(cartItemId: number) {
    return prisma.cartItem.delete({ where: { id: cartItemId } });
  }

  async clearCart(cartId: number) {
    return prisma.cartItem.deleteMany({ where: { cartId } });
  }
}
