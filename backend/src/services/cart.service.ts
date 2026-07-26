import { CartRepository } from "../repositories/cart.repository.js";
import { ProductRepository } from "../repositories/product.repository.js";
import { APIError } from "../utils/apiResponse.js";
import { calculateSalePrice, hasDiscount } from "../utils/pricing.helper.js";
import type {
  AddToCartInput,
  UpdateCartItemInput,
} from "../schemas/cart.schema.js";

/**
 * Cart Service — Xử lý nghiệp vụ giỏ hàng
 *
 * Kiến trúc giỏ hàng của Maverik Store:
 * - User đăng nhập → giỏ hàng lưu trong DB (bảng Cart + CartItem)
 * - User chưa đăng nhập → lưu trong localStorage (key: "maverik_cart")
 * - Khi đăng nhập → gọi syncLocalStorageCart() để merge localStorage vào DB
 */
export class CartService {
  private cartRepository: CartRepository;
  private productRepository: ProductRepository;

  constructor(
    cartRepository: CartRepository,
    productRepository: ProductRepository,
  ) {
    this.cartRepository = cartRepository;
    this.productRepository = productRepository;
  }

  /**
   * Lấy giỏ hàng của user (auto-create nếu chưa có)
   * Tính salePrice và hasDiscount cho mỗi sản phẩm trước khi trả về
   */
  async getCart(userId: number) {
    let cart = await this.cartRepository.findCartByUserId(userId);

    // Tự động tạo giỏ hàng trống nếu user chưa có
    if (!cart) {
      await this.cartRepository.createCart(userId);
      cart = await this.cartRepository.findCartByUserId(userId);
    }

    let totalPrice = 0;
    const items =
      cart?.items.map((item) => {
        // Tính giá sau giảm từ DB (áp dụng discountPercent/discountAmount)
        const salePrice = calculateSalePrice(item.product);
        const itemTotal = salePrice * item.quantity;
        totalPrice += itemTotal;
        return {
          ...item,
          product: {
            ...item.product,
            originalPrice: Number(item.product.price), // Giá gốc (Decimal → number)
            salePrice,                                  // Giá sau giảm
            hasDiscount: hasDiscount(item.product),     // Có đang giảm giá không
          },
          itemTotal, // Tổng tiền của dòng này (salePrice × quantity)
        };
      }) || [];

    return {
      id:         cart?.id,
      userId:     cart?.userId,
      items,
      totalPrice,
      totalItems: items.reduce((acc, item) => acc + item.quantity, 0), // Tổng số lượng
    };
  }

  /**
   * Thêm sản phẩm vào giỏ hàng
   * Kiểm tra tồn kho trước khi thêm để tránh thêm sản phẩm hết hàng
   */
  async addItem(userId: number, input: AddToCartInput) {
    // Kiểm tra sản phẩm tồn tại
    const product = await this.productRepository.findById(input.productId);
    if (!product)
      throw new APIError(404, "Product not found", {}, "PRODUCT_NOT_FOUND");

    // Kiểm tra tồn kho đủ không
    if (product.stockQuantity < input.quantity) {
      throw new APIError(400, `Not enough stock.`, { available: product.stockQuantity }, "INSUFFICIENT_STOCK");
    }
    
    // Auto-create giỏ hàng nếu chưa có
    let cart = await this.cartRepository.findCartByUserId(userId);
    if (!cart) {
      await this.cartRepository.createCart(userId);
      cart = await this.cartRepository.findCartByUserId(userId);
    }

    // upsertCartItem: nếu (productId + size + color) đã có → cộng thêm quantity
    // Nếu chưa có → tạo CartItem mới
    const existingCartItem = cart!.items.find(
      (item) =>
        item.productId === input.productId &&
        item.size === input.size &&
        item.color === input.color,
    );
    const nextQuantity = (existingCartItem?.quantity ?? 0) + input.quantity;
    if (nextQuantity > product.stockQuantity) {
      throw new APIError(
        400,
        "Not enough stock",
        {
          available: product.stockQuantity,
          currentQuantity: existingCartItem?.quantity ?? 0,
          requestedQuantity: input.quantity,
        },
        "INSUFFICIENT_STOCK",
      );
    }

    await this.cartRepository.upsertCartItem(
      cart!.id,
      input.productId,
      input.size,
      input.color,
      input.quantity,
    );
    return this.getCart(userId); // Trả về giỏ hàng cập nhật
  }

  /**
   * Cập nhật số lượng của một CartItem
   * Kiểm tra CartItem thuộc về giỏ của user (tránh IDOR)
   */
  async updateItemQty(
    userId: number,
    cartItemId: number,
    input: UpdateCartItemInput,
  ) {
    const cart = await this.cartRepository.findCartByUserId(userId);
    if (!cart) throw new APIError(404, "Cart not found", {}, "CART_NOT_FOUND");

    // Kiểm tra cartItem thuộc giỏ của user này (tránh user A sửa giỏ user B)
    const itemExists = cart.items.find((item) => item.id === cartItemId);
    if (!itemExists)
      throw new APIError(404, "Item not found", {}, "ITEM_NOT_FOUND");

    // Kiểm tra tồn kho trước khi tăng số lượng
    const product = await this.productRepository.findById(itemExists.productId);
    if (product && product.stockQuantity < input.quantity) {
      throw new APIError(400, "Not enough stock", {}, "INSUFFICIENT_STOCK");
    }

    await this.cartRepository.updateItemQty(cartItemId, input.quantity);
    return this.getCart(userId);
  }

  /**
   * Xóa một CartItem khỏi giỏ hàng
   */
  async removeItem(userId: number, cartItemId: number) {
    const cart = await this.cartRepository.findCartByUserId(userId);
    if (!cart) throw new APIError(404, "Cart not found", {}, "CART_NOT_FOUND");

    const itemExists = cart.items.find((item) => item.id === cartItemId);
    if (!itemExists)
      throw new APIError(404, "Item not found", {}, "ITEM_NOT_FOUND");

    await this.cartRepository.removeItem(cartItemId);
    return this.getCart(userId);
  }

  /**
   * Đồng bộ giỏ hàng từ localStorage vào DB sau khi user đăng nhập
   *
   * Logic merge:
   * - Nếu sản phẩm (productId + size + color) đã có trong DB cart
   *   → cộng thêm quantity (giới hạn tối đa 999)
   * - Nếu chưa có → tạo CartItem mới (không vượt tồn kho)
   * - Sản phẩm không tìm thấy trong DB → bỏ qua (log warning)
   */
  async syncLocalStorageCart(userId: number, localItems: any[] = []) {
    try {
      let cart = await this.cartRepository.findCartByUserId(userId);
      if (!cart) {
        await this.cartRepository.createCart(userId);
        cart = await this.cartRepository.findCartByUserId(userId);
      }

      if (localItems && Array.isArray(localItems)) {
        for (const item of localItems) {
          const product = await this.productRepository.findById(item.productId);
          if (!product) {
            // Sản phẩm đã bị xóa khỏi DB → bỏ qua
            console.warn(`Product ${item.productId} not found, skipping`);
            continue;
          }

          // Giá trị mặc định cho size/color nếu không có
          const itemSize     = item.size || "One Size";
          const itemColor    = item.color || "Default";
          const requestedQty = Math.min(item.quantity || 1, 999); // Tối đa 999

          // Tìm CartItem trùng (cùng productId + size + color)
          const existingCartItem = cart!.items.find(
            (cartItem) =>
              cartItem.productId === item.productId &&
              cartItem.size === itemSize &&
              cartItem.color === itemColor,
          );

          if (existingCartItem) {
            // Cộng thêm quantity, không vượt 999
            const newQty = Math.min(
              existingCartItem.quantity + requestedQty,
              product.stockQuantity,
            );
            await this.cartRepository.updateItemQty(existingCartItem.id, newQty);
          } else {
            // Tạo mới — số lượng không vượt tồn kho
            const availableQty =
              product.stockQuantity < requestedQty
                ? Math.min(requestedQty, product.stockQuantity)
                : requestedQty;

            await this.cartRepository.upsertCartItem(
              cart!.id,
              item.productId,
              itemSize,
              itemColor,
              availableQty,
            );
          }
        }
      }

      return this.getCart(userId);
    } catch (err) {
      console.error("Sync cart error:", err);
      throw new APIError(500, "Failed to sync cart", {}, "SYNC_FAILED");
    }
  }
}
