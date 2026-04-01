import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...\n");

  // ═══════════════════════════════════════════════════
  // 1. CLEAN UP (xóa dữ liệu cũ trước khi seed)
  // ═══════════════════════════════════════════════════
  console.log("🗑️  Cleaning existing data...");
  await prisma.favorite.deleteMany();
  await prisma.review.deleteMany();
  await prisma.orderDetail.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  console.log("✅ Cleaned.\n");

  // ═══════════════════════════════════════════════════
  // 2. USERS
  // ═══════════════════════════════════════════════════
  console.log("👤 Seeding users...");
  const passwordHash = await bcrypt.hash("Admin@1234", 10);

  const adminUser = await prisma.user.create({
    data: {
      username: "admin",
      email: "admin@maverik.com",
      passwordHash,
      phone: "+84901234567",
      role: "ADMIN",
      address: "123 Đường Lê Lợi, Quận 1, TP.HCM",
    },
  });

  const superAdmin = await prisma.user.create({
    data: {
      username: "superadmin",
      email: "superadmin@maverik.com",
      passwordHash,
      phone: "+84901234568",
      role: "SUPER_ADMIN",
      address: "456 Đường Nguyễn Huệ, Quận 1, TP.HCM",
    },
  });

  const customer1 = await prisma.user.create({
    data: {
      username: "nguyen_van_a",
      email: "customer@gmail.com",
      passwordHash: await bcrypt.hash("Customer@1234", 10),
      phone: "+84901234569",
      role: "CUSTOMER",
      address: "789 Đường Võ Văn Tần, Quận 3, TP.HCM",
    },
  });

  console.log(`✅ Created ${3} users.\n`);

  // ═══════════════════════════════════════════════════
  // 3. CATEGORIES
  // ═══════════════════════════════════════════════════
  console.log("📂 Seeding categories...");
  const categories = await prisma.$transaction([
    prisma.category.create({
      data: {
        name: "Áo Thun",
        slug: "ao-thun",
        description: "Áo thun cotton cao cấp, thiết kế streetwear độc đáo",
      },
    }),
    prisma.category.create({
      data: {
        name: "Áo Hoodie",
        slug: "ao-hoodie",
        description: "Hoodie unisex dày dặn, phù hợp mọi thời tiết",
      },
    }),
    prisma.category.create({
      data: {
        name: "Quần",
        slug: "quan",
        description: "Quần jogger, quần cargo phong cách streetwear",
      },
    }),
    prisma.category.create({
      data: {
        name: "Phụ Kiện",
        slug: "phu-kien",
        description: "Mũ, túi, vớ và các phụ kiện thời trang đi kèm",
      },
    }),
    prisma.category.create({
      data: {
        name: "Custom Design",
        slug: "custom-design",
        description: "Sản phẩm thiết kế riêng theo yêu cầu của khách hàng",
      },
    }),
  ]);

  const [catAoThun, catHoodie, catQuan, catPhuKien, catCustom] = categories;
  console.log(`✅ Created ${categories.length} categories.\n`);

  // ═══════════════════════════════════════════════════
  // 4. PRODUCTS
  // ═══════════════════════════════════════════════════
  console.log("👕 Seeding products...");

  const products = await prisma.$transaction([
    // ── Áo Thun ──────────────────────────────────────
    prisma.product.create({
      data: {
        categoryId: catAoThun.id,
        name: "Áo Thun Maverik Classic Logo",
        slug: "ao-thun-maverik-classic-logo",
        price: 299000,
        stockQuantity: 120,
        description:
          "Áo thun cotton 100% cao cấp với logo Maverik thêu nổi bật trên ngực trái. Form Regular fit, thoáng mát, bền màu sau nhiều lần giặt. Phù hợp phong cách casual hàng ngày.",
        imageUrl: "https://picsum.photos/seed/ao-thun-1/600/600",
      },
    }),
    prisma.product.create({
      data: {
        categoryId: catAoThun.id,
        name: "Áo Thun Oversized Street Culture",
        slug: "ao-thun-oversized-street-culture",
        price: 349000,
        stockQuantity: 85,
        description:
          "Áo thun Oversized in chữ Street Culture phong cách. Chất liệu cotton dày 260gsm, không bai dão. Phù hợp mix cùng quần baggy hoặc jogger.",
        imageUrl: "https://picsum.photos/seed/ao-thun-2/600/600",
      },
    }),
    prisma.product.create({
      data: {
        categoryId: catAoThun.id,
        name: "Áo Thun Graphic Tee Urban",
        slug: "ao-thun-graphic-tee-urban",
        price: 279000,
        stockQuantity: 200,
        description:
          "Áo thun in hình đồ họa phong cách urban. Thiết kế độc quyền của Maverik, in DTG công nghệ cao, màu sắc sắc nét và bền.",
        imageUrl: "https://picsum.photos/seed/ao-thun-3/600/600",
      },
    }),

    // ── Áo Hoodie ────────────────────────────────────
    prisma.product.create({
      data: {
        categoryId: catHoodie.id,
        name: "Hoodie Maverik Signature Black",
        slug: "hoodie-maverik-signature-black",
        price: 649000,
        stockQuantity: 60,
        description:
          "Hoodie màu đen full zip với logo Maverik thêu lớn ở lưng. Chất liệu bông nỉ 320gsm siêu ấm, vải bên trong lót lông cừu mềm mại. Phù hợp mùa lạnh hoặc buổi tối.",
        imageUrl: "https://picsum.photos/seed/hoodie-1/600/600",
      },
    }),
    prisma.product.create({
      data: {
        categoryId: catHoodie.id,
        name: "Hoodie Oversized Wash Vintage",
        slug: "hoodie-oversized-wash-vintage",
        price: 589000,
        stockQuantity: 45,
        description:
          "Hoodie wash vintage tạo hiệu ứng phai màu tự nhiên. Form Oversized unisex, tay raglan, nội địa Việt Nam sản xuất chất lượng cao.",
        imageUrl: "https://picsum.photos/seed/hoodie-2/600/600",
      },
    }),

    // ── Quần ─────────────────────────────────────────
    prisma.product.create({
      data: {
        categoryId: catQuan.id,
        name: "Quần Cargo Streetwear 6 Túi",
        slug: "quan-cargo-streetwear-6-tui",
        price: 549000,
        stockQuantity: 75,
        description:
          "Quần cargo 6 túi phong cách streetwear. Chất liệu kaki dày, đứng form, nhiều túi tiện dụng. Phối được với hầu hết các mẫu áo thun và hoodie Maverik.",
        imageUrl: "https://picsum.photos/seed/quan-1/600/600",
      },
    }),
    prisma.product.create({
      data: {
        categoryId: catQuan.id,
        name: "Quần Jogger Cotton Essential",
        slug: "quan-jogger-cotton-essential",
        price: 399000,
        stockQuantity: 110,
        description:
          "Quần jogger cotton mềm mại, có dây rút eo co giãn. Kiểu dáng đơn giản, dễ phối đồ. Phù hợp thể thao nhẹ và mặc nhà.",
        imageUrl: "https://picsum.photos/seed/quan-2/600/600",
      },
    }),

    // ── Phụ Kiện ─────────────────────────────────────
    prisma.product.create({
      data: {
        categoryId: catPhuKien.id,
        name: "Mũ Snapback Maverik Đen",
        slug: "mu-snapback-maverik-den",
        price: 249000,
        stockQuantity: 150,
        description:
          "Mũ snapback màu đen với logo Maverik thêu nổi bật phía trước. Khóa nhựa điều chỉnh kích thước phía sau. Chất lượng cao, không phai màu.",
        imageUrl: "https://picsum.photos/seed/mu-1/600/600",
      },
    }),
    prisma.product.create({
      data: {
        categoryId: catPhuKien.id,
        name: "Túi Tote Canvas Maverik",
        slug: "tui-tote-canvas-maverik",
        price: 199000,
        stockQuantity: 200,
        description:
          "Túi tote canvas dày dặn, in logo Maverik. Quai vai dài tiện lợi, sức chứa lớn. Phù hợp đi học, đi chơi, đựng đồ mua sắm.",
        imageUrl: "https://picsum.photos/seed/tui-1/600/600",
      },
    }),

    // ── Custom Design ─────────────────────────────────
    prisma.product.create({
      data: {
        categoryId: catCustom.id,
        name: "Áo Custom In Tên Theo Yêu Cầu",
        slug: "ao-custom-in-ten-theo-yeu-cau",
        price: 450000,
        stockQuantity: 999,
        description:
          "Dịch vụ in áo thun theo yêu cầu cá nhân hóa. Bạn có thể chọn màu áo, kiểu chữ, vị trí in và nội dung. Thời gian sản xuất 3-5 ngày làm việc. Tối thiểu 1 cái.",
        imageUrl: "https://picsum.photos/seed/custom-1/600/600",
      },
    }),
  ]);

  console.log(`✅ Created ${products.length} products.\n`);

  // ═══════════════════════════════════════════════════
  // 5. PRODUCT IMAGES (thêm ảnh phụ cho sản phẩm)
  // ═══════════════════════════════════════════════════
  console.log("🖼️  Seeding product images...");
  const [p1, p2, p3, p4, p5] = products;
  await prisma.$transaction([
    // Áo thun classic - 3 ảnh
    prisma.productImage.create({ data: { productId: p1.id, url: "https://picsum.photos/seed/ao-thun-1a/600/600", isPrimary: true } }),
    prisma.productImage.create({ data: { productId: p1.id, url: "https://picsum.photos/seed/ao-thun-1b/600/600", isPrimary: false } }),
    prisma.productImage.create({ data: { productId: p1.id, url: "https://picsum.photos/seed/ao-thun-1c/600/600", isPrimary: false } }),
    // Áo thun oversized - 2 ảnh
    prisma.productImage.create({ data: { productId: p2.id, url: "https://picsum.photos/seed/ao-thun-2a/600/600", isPrimary: true } }),
    prisma.productImage.create({ data: { productId: p2.id, url: "https://picsum.photos/seed/ao-thun-2b/600/600", isPrimary: false } }),
    // Hoodie black - 2 ảnh
    prisma.productImage.create({ data: { productId: p4.id, url: "https://picsum.photos/seed/hoodie-1a/600/600", isPrimary: true } }),
    prisma.productImage.create({ data: { productId: p4.id, url: "https://picsum.photos/seed/hoodie-1b/600/600", isPrimary: false } }),
  ]);
  console.log("✅ Product images seeded.\n");

  // ═══════════════════════════════════════════════════
  // 6. CART (tạo giỏ hàng mẫu cho customer)
  // ═══════════════════════════════════════════════════
  console.log("🛒 Seeding cart...");
  const cart = await prisma.cart.create({ data: { userId: customer1.id } });
  await prisma.cartItem.createMany({
    data: [
      { cartId: cart.id, productId: p1.id, size: "M", color: "Đen", quantity: 2 },
      { cartId: cart.id, productId: p4.id, size: "L", color: "Đen", quantity: 1 },
    ],
  });
  console.log("✅ Cart seeded.\n");

  // ═══════════════════════════════════════════════════
  // 7. REVIEWS (đánh giá mẫu)
  // ═══════════════════════════════════════════════════
  console.log("⭐ Seeding reviews...");
  await prisma.review.createMany({
    data: [
      { userId: customer1.id, productId: p1.id, rating: 5, comment: "Áo đẹp lắm, vải mịn, đúng size, giao hàng nhanh!" },
      { userId: customer1.id, productId: p2.id, rating: 4, comment: "Form áo rộng vừa ý, màu đúng như hình, thích 👍" },
    ],
  });
  console.log("✅ Reviews seeded.\n");

  // ═══════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════
  console.log("━".repeat(50));
  console.log("🎉 Seed completed successfully!\n");
  console.log("📊 Summary:");
  console.log(`   👤 Users     : 3 (1 Admin, 1 Super Admin, 1 Customer)`);
  console.log(`   📂 Categories: ${categories.length}`);
  console.log(`   👕 Products  : ${products.length}`);
  console.log(`   🖼️  Images   : 7`);
  console.log(`   🛒 Cart items: 2`);
  console.log(`   ⭐ Reviews   : 2`);
  console.log("\n🔑 Test Accounts:");
  console.log(`   Admin      : admin@maverik.com / Admin@1234`);
  console.log(`   Customer   : customer@gmail.com / Customer@1234`);
  console.log("━".repeat(50));
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
