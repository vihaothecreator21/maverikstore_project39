import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...\n");

  // ═══════════════════════════════════════════════════
  // 1. CLEAN UP
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
  const adminHash = await bcrypt.hash("Admin@1234", 10);
  const customerHash = await bcrypt.hash("Customer@1234", 10);

  const adminUser = await prisma.user.create({
    data: {
      username: "admin",
      email: "admin@furnish.vn",
      passwordHash: adminHash,
      phone: "+84901234567",
      role: "ADMIN",
      address: "123 Đường Lê Duẩn, Quận 1, TP.HCM",
    },
  });

  const superAdmin = await prisma.user.create({
    data: {
      username: "superadmin",
      email: "superadmin@furnish.vn",
      passwordHash: adminHash,
      phone: "+84901234568",
      role: "SUPER_ADMIN",
      address: "456 Đường Nguyễn Huệ, Quận 1, TP.HCM",
    },
  });

  const customer1 = await prisma.user.create({
    data: {
      username: "tran_thi_bich",
      email: "customer@gmail.com",
      passwordHash: customerHash,
      phone: "+84912345678",
      role: "CUSTOMER",
      address: "88 Đường Hoàng Văn Thụ, Phú Nhuận, TP.HCM",
    },
  });

  const customer2 = await prisma.user.create({
    data: {
      username: "nguyen_minh_tuan",
      email: "tuan.nguyen@gmail.com",
      passwordHash: customerHash,
      phone: "+84987654321",
      role: "CUSTOMER",
      address: "12 Đường Đinh Tiên Hoàng, Bình Thạnh, TP.HCM",
    },
  });

  console.log(`✅ Created 4 users.\n`);

  // ═══════════════════════════════════════════════════
  // 3. CATEGORIES
  // ═══════════════════════════════════════════════════
  console.log("📂 Seeding categories...");
  const categories = await prisma.$transaction([
    prisma.category.create({
      data: {
        name: "Phòng Khách",
        slug: "phong-khach",
        description: "Sofa, bàn trà, kệ tivi, tủ trang trí cho không gian phòng khách sang trọng",
      },
    }),
    prisma.category.create({
      data: {
        name: "Phòng Ngủ",
        slug: "phong-ngu",
        description: "Giường ngủ, tủ quần áo, bàn phấn, đầu giường và các nội thất phòng ngủ cao cấp",
      },
    }),
    prisma.category.create({
      data: {
        name: "Phòng Bếp & Ăn",
        slug: "phong-bep-an",
        description: "Bàn ăn, ghế ăn, tủ bếp, kệ đựng đồ và nội thất nhà bếp hiện đại",
      },
    }),
    prisma.category.create({
      data: {
        name: "Phòng Làm Việc",
        slug: "phong-lam-viec",
        description: "Bàn làm việc, ghế văn phòng, kệ sách, tủ tài liệu cho không gian làm việc chuyên nghiệp",
      },
    }),
    prisma.category.create({
      data: {
        name: "Trang Trí & Phụ Kiện",
        slug: "trang-tri-phu-kien",
        description: "Đèn trang trí, gương, tranh treo tường, thảm trải sàn và các phụ kiện decor nội thất",
      },
    }),
  ]);

  const [catLiving, catBedroom, catDining, catOffice, catDecor] = categories;
  console.log(`✅ Created ${categories.length} categories.\n`);

  // ═══════════════════════════════════════════════════
  // 4. PRODUCTS
  // ═══════════════════════════════════════════════════
  console.log("🛋️  Seeding products...");

  const products = await prisma.$transaction([

    // ── PHÒNG KHÁCH ───────────────────────────────────
    prisma.product.create({
      data: {
        categoryId: catLiving.id,
        name: "Sofa Góc Chữ L Milan Premium",
        slug: "sofa-goc-chu-l-milan-premium",
        price: 18500000,
        stockQuantity: 12,
        description:
          "Sofa góc chữ L cao cấp phong cách Ý, bọc vải linen cao cấp màu xám nhạt. Khung gỗ sồi tự nhiên chắc chắn, đệm foam density cao 45kg/m³ đàn hồi tốt. Kích thước: 280 x 180 x 85cm. Phù hợp phòng khách từ 25m² trở lên. Bảo hành 2 năm khung và 1 năm đệm.",
        imageUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=600&fit=crop",
      },
    }),
    prisma.product.create({
      data: {
        categoryId: catLiving.id,
        name: "Sofa Đôi Bắc Âu Oslo 2 Chỗ",
        slug: "sofa-doi-bac-au-oslo-2-cho",
        price: 8900000,
        stockQuantity: 25,
        description:
          "Sofa 2 chỗ ngồi phong cách Scandinavia tối giản. Chân gỗ óc chó tự nhiên, bọc nhung màu xanh navy. Kích thước: 150 x 80 x 75cm. Thiết kế thanh lịch, phù hợp căn hộ nhỏ và studio.",
        imageUrl: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&h=600&fit=crop",
      },
    }),
    prisma.product.create({
      data: {
        categoryId: catLiving.id,
        name: "Bàn Trà Mặt Đá Marble Oval",
        slug: "ban-tra-mat-da-marble-oval",
        price: 4200000,
        stockQuantity: 30,
        description:
          "Bàn trà hình oval mặt đá marble trắng vân vàng tự nhiên. Chân kim loại mạ vàng 24k chống gỉ. Kích thước: 110 x 60 x 45cm. Phong cách luxury hiện đại, điểm nhấn hoàn hảo cho phòng khách.",
        imageUrl: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=600&h=600&fit=crop",
      },
    }),
    prisma.product.create({
      data: {
        categoryId: catLiving.id,
        name: "Kệ Tivi Gỗ Walnut Floating",
        slug: "ke-tivi-go-walnut-floating",
        price: 6800000,
        stockQuantity: 18,
        description:
          "Kệ tivi treo tường gỗ walnut tự nhiên phong cách mid-century modern. Có 2 ngăn mở và 2 ngăn có cánh. Chiều dài 160cm, treo được tivi 55-75 inch. Lắp đặt dễ dàng, tặng kèm ốc vít và thanh ray.",
        imageUrl: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600&h=600&fit=crop",
      },
    }),
    prisma.product.create({
      data: {
        categoryId: catLiving.id,
        name: "Ghế Armchair Velvet Đơn",
        slug: "ghe-armchair-velvet-don",
        price: 3600000,
        stockQuantity: 40,
        description:
          "Ghế armchair bọc nhung velvet màu mustard vàng mù tạt. Chân gỗ sồi tự nhiên. Kích thước: 75 x 72 x 82cm. Phong cách retro-chic, thích hợp đặt góc đọc sách hoặc phòng khách.",
        imageUrl: "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=600&h=600&fit=crop",
      },
    }),

    // ── PHÒNG NGỦ ────────────────────────────────────
    prisma.product.create({
      data: {
        categoryId: catBedroom.id,
        name: "Giường Ngủ Đầu Giường Bọc Da Queen Size",
        slug: "giuong-ngu-dau-giuong-boc-da-queen",
        price: 12500000,
        stockQuantity: 8,
        description:
          "Giường Queen size 160x200cm với đầu giường bọc da PU cao cấp màu camel. Khung giường gỗ thông NZ nhập khẩu, dát giường gỗ thông cách nhiệt. Chiều cao giường: 45cm. Thiết kế hiện đại, bền bỉ, dễ vệ sinh.",
        imageUrl: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&h=600&fit=crop",
      },
    }),
    prisma.product.create({
      data: {
        categoryId: catBedroom.id,
        name: "Tủ Quần Áo 4 Cánh Gỗ MDF Acrylic",
        slug: "tu-quan-ao-4-canh-go-mdf-acrylic",
        price: 9800000,
        stockQuantity: 15,
        description:
          "Tủ quần áo 4 cánh cửa trượt, cốt gỗ MDF chống ẩm, mặt phủ acrylic bóng gương trắng. Bên trong có 2 thanh treo, 4 ngăn kệ, 1 ngăn kéo. Kích thước: 200 x 60 x 220cm. Tặng kèm gương soi toàn thân.",
        imageUrl: "https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=600&h=600&fit=crop",
      },
    }),
    prisma.product.create({
      data: {
        categoryId: catBedroom.id,
        name: "Bàn Đầu Giường Gỗ Sồi Tự Nhiên",
        slug: "ban-dau-giuong-go-soi-tu-nhien",
        price: 1850000,
        stockQuantity: 50,
        description:
          "Bàn đầu giường nhỏ gọn làm từ gỗ sồi tự nhiên, hoàn thiện dầu tự nhiên bảo vệ vân gỗ. Có 1 ngăn kéo và 1 ngăn mở phía dưới. Kích thước: 45 x 35 x 55cm. Phù hợp mọi phong cách phòng ngủ.",
        imageUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=600&fit=crop",
      },
    }),
    prisma.product.create({
      data: {
        categoryId: catBedroom.id,
        name: "Gương Toàn Thân Khung Mây Tự Nhiên",
        slug: "guong-toan-than-khung-may-tu-nhien",
        price: 2200000,
        stockQuantity: 35,
        description:
          "Gương soi toàn thân hình vòm, khung đan mây tự nhiên cao cấp màu be. Kích thước: 50 x 150cm. Có thể treo tường hoặc dựng đứng. Tạo điểm nhấn boho-chic cho phòng ngủ hoặc phòng thay đồ.",
        imageUrl: "https://images.unsplash.com/photo-1594042160933-e5dd54e36c6d?w=600&h=600&fit=crop",
      },
    }),

    // ── PHÒNG BẾP & ĂN ────────────────────────────────
    prisma.product.create({
      data: {
        categoryId: catDining.id,
        name: "Bộ Bàn Ăn Gỗ Sồi 6 Ghế Bắc Âu",
        slug: "bo-ban-an-go-soi-6-ghe-bac-au",
        price: 16500000,
        stockQuantity: 6,
        description:
          "Bộ bàn ăn 6 người phong cách Scandinavian. Mặt bàn gỗ sồi tự nhiên nguyên khối, chân thép sơn tĩnh điện đen. Ghế bọc vải linen kem, lưng lưới thông hơi. Kích thước bàn: 180 x 90 x 76cm. Bền chắc, dễ vệ sinh.",
        imageUrl: "https://images.unsplash.com/photo-1615066390971-03e4e1c36ddf?w=600&h=600&fit=crop",
      },
    }),
    prisma.product.create({
      data: {
        categoryId: catDining.id,
        name: "Ghế Ăn Tolix Metal Công Nghiệp",
        slug: "ghe-an-tolix-metal-cong-nghiep",
        price: 890000,
        stockQuantity: 80,
        description:
          "Ghế ăn kim loại phong cách công nghiệp, thiết kế lấy cảm hứng từ ghế Tolix nổi tiếng. Khung thép dày, sơn tĩnh điện bền màu. Có thể xếp chồng tiết kiệm không gian. Màu: Đen / Trắng / Đỏ / Xanh lá. Tải trọng: 150kg.",
        imageUrl: "https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=600&h=600&fit=crop",
      },
    }),
    prisma.product.create({
      data: {
        categoryId: catDining.id,
        name: "Kệ Bếp Đứng Gỗ Thông 5 Tầng",
        slug: "ke-bep-dung-go-thong-5-tang",
        price: 2450000,
        stockQuantity: 22,
        description:
          "Kệ đứng 5 tầng làm từ gỗ thông tự nhiên phủ sơn trắng. Phù hợp để đựng gia vị, dụng cụ bếp, sách dạy nấu ăn. Kích thước: 60 x 30 x 170cm. Lắp ráp đơn giản, tặng kèm hướng dẫn và ốc vít.",
        imageUrl: "https://images.unsplash.com/photo-1556909211-36987daf7b4d?w=600&h=600&fit=crop",
      },
    }),

    // ── PHÒNG LÀM VIỆC ────────────────────────────────
    prisma.product.create({
      data: {
        categoryId: catOffice.id,
        name: "Bàn Làm Việc Gỗ Walnut Nguyên Khối",
        slug: "ban-lam-viec-go-walnut-nguyen-khoi",
        price: 8900000,
        stockQuantity: 10,
        description:
          "Bàn làm việc mặt gỗ walnut nguyên tấm (live edge), chân chữ A bằng thép đen. Kích thước: 150 x 70 x 75cm. Mỗi bàn có vân gỗ độc đáo riêng biệt. Lý tưởng cho không gian làm việc tại nhà phong cách rustic-modern.",
        imageUrl: "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=600&h=600&fit=crop",
      },
    }),
    prisma.product.create({
      data: {
        categoryId: catOffice.id,
        name: "Ghế Văn Phòng Ergonomic Herman",
        slug: "ghe-van-phong-ergonomic-herman",
        price: 7200000,
        stockQuantity: 20,
        description:
          "Ghế văn phòng công thái học cao cấp, lưng lưới thoáng khí, tựa đầu điều chỉnh, tay ghế 4D. Hỗ trợ lưng thắt lưng có thể tùy chỉnh độ cứng. Phù hợp ngồi làm việc 8h+. Bảo hành 3 năm.",
        imageUrl: "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=600&h=600&fit=crop",
      },
    }),
    prisma.product.create({
      data: {
        categoryId: catOffice.id,
        name: "Kệ Sách Gỗ Thông 6 Tầng Modular",
        slug: "ke-sach-go-thong-6-tang-modular",
        price: 3200000,
        stockQuantity: 28,
        description:
          "Kệ sách 6 tầng thiết kế modular có thể kết hợp nhiều kệ với nhau. Gỗ thông tự nhiên phủ dầu, chân thép đen. Kích thước: 80 x 30 x 180cm. Chịu tải mỗi tầng lên 25kg. Phù hợp phòng làm việc và phòng đọc sách.",
        imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=600&fit=crop",
      },
    }),

    // ── TRANG TRÍ & PHỤ KIỆN ──────────────────────────
    prisma.product.create({
      data: {
        categoryId: catDecor.id,
        name: "Đèn Sàn LED Cần Câu Bắc Âu",
        slug: "den-san-led-can-cau-bac-au",
        price: 2800000,
        stockQuantity: 45,
        description:
          "Đèn sàn phong cách Scandinavian, thiết kế cần câu linh hoạt điều chỉnh góc và độ cao. Bóng LED E27 tiết kiệm điện (tặng kèm 1 bóng warm white). Chân đế gang nặng chắc chắn. Phù hợp góc đọc sách, phòng khách.",
        imageUrl: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&h=600&fit=crop",
      },
    }),
    prisma.product.create({
      data: {
        categoryId: catDecor.id,
        name: "Thảm Trang Trí Lông Cừu Moroc",
        slug: "tham-trang-tri-long-cuu-moroc",
        price: 3500000,
        stockQuantity: 20,
        description:
          "Thảm trải sàn handmade từ lông cừu tự nhiên 100%, họa tiết Moroccan truyền thống. Kích thước: 160 x 230cm. Mềm mại, ấm áp, chống trơn trượt. Thích hợp phòng khách, phòng ngủ. Mỗi tấm là tác phẩm thủ công độc đáo.",
        imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=600&fit=crop",
      },
    }),
    prisma.product.create({
      data: {
        categoryId: catDecor.id,
        name: "Tranh Canvas Nghệ Thuật Trừu Tượng Bộ 3",
        slug: "tranh-canvas-nghe-thuat-tru-tuong-bo-3",
        price: 1290000,
        stockQuantity: 60,
        description:
          "Bộ 3 tranh canvas nghệ thuật trừu tượng tone màu earth tones (nâu, be, trắng sữa). Kích thước mỗi tranh: 30 x 40cm. Đã căng khung gỗ sẵn, có móc treo. In chất lượng cao UV không phai màu. Tạo điểm nhấn thẩm mỹ cho mọi không gian.",
        imageUrl: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=600&h=600&fit=crop",
      },
    }),
    prisma.product.create({
      data: {
        categoryId: catDecor.id,
        name: "Bình Gốm Thủ Công Wabi-Sabi Set 3",
        slug: "binh-gom-thu-cong-wabi-sabi-set-3",
        price: 980000,
        stockQuantity: 55,
        description:
          "Bộ 3 bình gốm thủ công phong cách Wabi-Sabi Nhật Bản. Kích thước: S (15cm), M (22cm), L (30cm). Mỗi bình có hình dáng và men sứ độc đáo, không chiếc nào giống nhau. Màu: Trắng sứ / Xám đất / Nâu đất. Dùng để cắm hoa, trang trí kệ sách, bàn ăn.",
        imageUrl: "https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=600&h=600&fit=crop",
      },
    }),
  ]);

  console.log(`✅ Created ${products.length} products.\n`);

  // ═══════════════════════════════════════════════════
  // 5. PRODUCT IMAGES
  // ═══════════════════════════════════════════════════
  console.log("🖼️  Seeding product images...");
  const [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19] = products;

  await prisma.$transaction([
    // Sofa Milan - 3 ảnh
    prisma.productImage.create({ data: { productId: p1.id, url: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&h=800&fit=crop", isPrimary: true } }),
    prisma.productImage.create({ data: { productId: p1.id, url: "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=800&h=800&fit=crop", isPrimary: false } }),
    prisma.productImage.create({ data: { productId: p1.id, url: "https://images.unsplash.com/photo-1550254478-ead40cc54513?w=800&h=800&fit=crop", isPrimary: false } }),
    // Sofa Oslo - 2 ảnh
    prisma.productImage.create({ data: { productId: p2.id, url: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=800&fit=crop", isPrimary: true } }),
    prisma.productImage.create({ data: { productId: p2.id, url: "https://images.unsplash.com/photo-1594736797933-d0401ba2fe65?w=800&h=800&fit=crop", isPrimary: false } }),
    // Bàn trà - 2 ảnh
    prisma.productImage.create({ data: { productId: p3.id, url: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=800&h=800&fit=crop", isPrimary: true } }),
    prisma.productImage.create({ data: { productId: p3.id, url: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&h=800&fit=crop", isPrimary: false } }),
    // Kệ tivi - 2 ảnh
    prisma.productImage.create({ data: { productId: p4.id, url: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&h=800&fit=crop", isPrimary: true } }),
    prisma.productImage.create({ data: { productId: p4.id, url: "https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=800&h=800&fit=crop", isPrimary: false } }),
    // Giường ngủ - 3 ảnh
    prisma.productImage.create({ data: { productId: p6.id, url: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&h=800&fit=crop", isPrimary: true } }),
    prisma.productImage.create({ data: { productId: p6.id, url: "https://images.unsplash.com/photo-1540518614846-7eded433c457?w=800&h=800&fit=crop", isPrimary: false } }),
    prisma.productImage.create({ data: { productId: p6.id, url: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800&h=800&fit=crop", isPrimary: false } }),
    // Bộ bàn ăn - 2 ảnh
    prisma.productImage.create({ data: { productId: p10.id, url: "https://images.unsplash.com/photo-1615066390971-03e4e1c36ddf?w=800&h=800&fit=crop", isPrimary: true } }),
    prisma.productImage.create({ data: { productId: p10.id, url: "https://images.unsplash.com/photo-1449247709967-d4461a6a6103?w=800&h=800&fit=crop", isPrimary: false } }),
    // Bàn làm việc - 2 ảnh
    prisma.productImage.create({ data: { productId: p13.id, url: "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800&h=800&fit=crop", isPrimary: true } }),
    prisma.productImage.create({ data: { productId: p13.id, url: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&h=800&fit=crop", isPrimary: false } }),
    // Đèn sàn - 1 ảnh
    prisma.productImage.create({ data: { productId: p16.id, url: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&h=800&fit=crop", isPrimary: true } }),
  ]);
  console.log("✅ Product images seeded.\n");

  // ═══════════════════════════════════════════════════
  // 6. CART
  // ═══════════════════════════════════════════════════
  console.log("🛒 Seeding cart...");
  const cart = await prisma.cart.create({ data: { userId: customer1.id } });
  await prisma.cartItem.createMany({
    data: [
      { cartId: cart.id, productId: p1.id, size: "280x180cm", color: "Xám Nhạt", quantity: 1 },
      { cartId: cart.id, productId: p3.id, size: "110x60cm", color: "Marble Trắng", quantity: 1 },
      { cartId: cart.id, productId: p16.id, size: "Standard", color: "Đen", quantity: 2 },
    ],
  });
  console.log("✅ Cart seeded.\n");

  // ═══════════════════════════════════════════════════
  // 7. ORDERS
  // ═══════════════════════════════════════════════════
  console.log("📦 Seeding orders...");

  const order1 = await prisma.order.create({
    data: {
      userId: customer1.id,
      totalAmount: 14700000,
      status: "DELIVERED",
      shippingAddress: "88 Đường Hoàng Văn Thụ, Phú Nhuận, TP.HCM",
      shippingPhone: "+84912345678",
    },
  });
  await prisma.orderDetail.createMany({
    data: [
      { orderId: order1.id, productId: p6.id, size: "160x200cm", color: "Camel", quantity: 1, priceAtPurchase: 12500000 },
      { orderId: order1.id, productId: p8.id, size: "45x35cm", color: "Sồi Tự Nhiên", quantity: 2, priceAtPurchase: 1100000 },
    ],
  });
  await prisma.payment.create({
    data: {
      orderId: order1.id,
      paymentMethod: "BANK_TRANSFER",
      paymentStatus: "SUCCESS",
      transactionId: "TXN20240115001",
      amount: 14700000,
    },
  });

  const order2 = await prisma.order.create({
    data: {
      userId: customer2.id,
      totalAmount: 9790000,
      status: "PROCESSING",
      shippingAddress: "12 Đường Đinh Tiên Hoàng, Bình Thạnh, TP.HCM",
      shippingPhone: "+84987654321",
    },
  });
  await prisma.orderDetail.createMany({
    data: [
      { orderId: order2.id, productId: p13.id, size: "150x70cm", color: "Walnut Nâu", quantity: 1, priceAtPurchase: 8900000 },
      { orderId: order2.id, productId: p19.id, size: "S+M+L", color: "Xám Đất", quantity: 1, priceAtPurchase: 890000 },
    ],
  });
  await prisma.payment.create({
    data: {
      orderId: order2.id,
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      amount: 9790000,
    },
  });

  console.log("✅ Orders seeded.\n");

  // ═══════════════════════════════════════════════════
  // 8. REVIEWS
  // ═══════════════════════════════════════════════════
  console.log("⭐ Seeding reviews...");
  await prisma.review.createMany({
    data: [
      {
        userId: customer1.id,
        productId: p6.id,
        rating: 5,
        comment: "Giường rất chắc chắn, giao hàng đúng hẹn, lắp ráp dễ dàng. Đầu giường bọc da nhìn sang trọng, rất hài lòng!",
      },
      {
        userId: customer1.id,
        productId: p8.id,
        rating: 4,
        comment: "Bàn đầu giường vân gỗ đẹp, size vừa vặn. Chỉ tiếc ngăn kéo hơi khó kéo lúc đầu nhưng dùng mãi cũng trơn tru hơn.",
      },
      {
        userId: customer2.id,
        productId: p2.id,
        rating: 5,
        comment: "Sofa nhỏ gọn nhưng ngồi cực êm, màu xanh navy rất hợp căn hộ của mình. Giao hàng nhanh, đóng gói cẩn thận.",
      },
      {
        userId: customer2.id,
        productId: p16.id,
        rating: 4,
        comment: "Đèn đẹp, ánh sáng ấm dịu, điều chỉnh góc linh hoạt. Dây điện hơi ngắn một chút nhưng không đáng kể.",
      },
    ],
  });

  // ═══════════════════════════════════════════════════
  // 9. FAVORITES
  // ═══════════════════════════════════════════════════
  console.log("❤️  Seeding favorites...");
  await prisma.favorite.createMany({
    data: [
      { userId: customer1.id, productId: p1.id },
      { userId: customer1.id, productId: p4.id },
      { userId: customer1.id, productId: p17.id },
      { userId: customer2.id, productId: p1.id },
      { userId: customer2.id, productId: p14.id },
      { userId: customer2.id, productId: p18.id },
    ],
  });
  console.log("✅ Favorites seeded.\n");

  // ═══════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════
  console.log("━".repeat(55));
  console.log("🎉 Seed completed successfully!\n");
  console.log("📊 Summary:");
  console.log(`   👤 Users      : 4 (1 Admin, 1 SuperAdmin, 2 Customers)`);
  console.log(`   📂 Categories : ${categories.length} (Phòng Khách, Ngủ, Bếp, Làm Việc, Trang Trí)`);
  console.log(`   🛋️  Products   : ${products.length}`);
  console.log(`   🖼️  Images    : 17`);
  console.log(`   🛒 Cart items : 3`);
  console.log(`   📦 Orders     : 2`);
  console.log(`   ⭐ Reviews    : 4`);
  console.log(`   ❤️  Favorites  : 6`);
  console.log("\n🔑 Test Accounts:");
  console.log(`   Admin    : admin@furnish.vn       / Admin@1234`);
  console.log(`   Customer : customer@gmail.com     / Customer@1234`);
  console.log(`   Customer : tuan.nguyen@gmail.com  / Customer@1234`);
  console.log("━".repeat(55));
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
