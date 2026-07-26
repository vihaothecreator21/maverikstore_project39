import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SampleProduct = {
  categorySlug: string;
  name: string;
  slug: string;
  price: number;
  stockQuantity: number;
  description: string;
  imageUrl: string;
  images: string[];
};

const img = (name: string) => `/assets/images/${name}`;

const sampleProducts: SampleProduct[] = [
  {
    categorySlug: "noi-that-phong-khach",
    name: "Sofa Góc Chữ L Milan Premium",
    slug: "sofa-goc-chu-l-milan-premium",
    price: 18500000,
    stockQuantity: 12,
    description:
      "Sofa góc chữ L bọc vải linen cao cấp, khung gỗ chắc chắn, phù hợp phòng khách hiện đại từ 25m2 trở lên.",
    imageUrl: img("product-img-1.jpg"),
    images: [img("product-img-1.jpg"), img("product-img-2.jpg"), img("product-img-3.jpg")],
  },
  {
    categorySlug: "noi-that-phong-khach",
    name: "Bàn Trà Mặt Đá Marble Oval",
    slug: "ban-tra-mat-da-marble-oval",
    price: 4200000,
    stockQuantity: 30,
    description:
      "Bàn trà dáng oval, mặt đá marble sáng, chân kim loại thanh mảnh tạo điểm nhấn sang trọng cho phòng khách.",
    imageUrl: img("product-img-2.jpg"),
    images: [img("product-img-2.jpg"), img("product-img-4.jpg")],
  },
  {
    categorySlug: "noi-that-phong-khach",
    name: "Kệ Tivi Gỗ Walnut Floating",
    slug: "ke-tivi-go-walnut-floating",
    price: 6800000,
    stockQuantity: 18,
    description:
      "Kệ tivi gỗ walnut treo tường, có ngăn chứa dây và phụ kiện, hợp TV 55-75 inch.",
    imageUrl: img("product-img-3.jpg"),
    images: [img("product-img-3.jpg"), img("product-img-5.jpg")],
  },
  {
    categorySlug: "noi-that-phong-ngu",
    name: "Giường Ngủ Đầu Giường Bọc Da Queen Size",
    slug: "giuong-ngu-dau-giuong-boc-da-queen",
    price: 12500000,
    stockQuantity: 10,
    description:
      "Giường queen size 160x200cm, đầu giường bọc da mềm, khung gỗ vững chắc cho phòng ngủ cao cấp.",
    imageUrl: img("product-img-4.jpg"),
    images: [img("product-img-4.jpg"), img("product-img-6.jpg")],
  },
  {
    categorySlug: "noi-that-phong-ngu",
    name: "Tủ Quần Áo 4 Cánh Gỗ MDF Acrylic",
    slug: "tu-quan-ao-4-canh-go-mdf-acrylic",
    price: 9800000,
    stockQuantity: 15,
    description:
      "Tủ quần áo 4 cánh phủ acrylic, nhiều khoang treo và ngăn xếp, tối ưu lưu trữ cho gia đình.",
    imageUrl: img("product-img-5.jpg"),
    images: [img("product-img-5.jpg"), img("product-img-7.jpg")],
  },
  {
    categorySlug: "noi-that-phong-ngu",
    name: "Bàn Đầu Giường Gỗ Sồi Tự Nhiên",
    slug: "ban-dau-giuong-go-soi-tu-nhien",
    price: 1850000,
    stockQuantity: 50,
    description:
      "Bàn đầu giường nhỏ gọn bằng gỗ sồi, có ngăn kéo tiện dụng để đèn ngủ, sách và vật dụng cá nhân.",
    imageUrl: img("product-img-6.jpg"),
    images: [img("product-img-6.jpg"), img("product-img-8.jpg")],
  },
  {
    categorySlug: "noi-that-phong-bep",
    name: "Bộ Bàn Ăn Gỗ Sồi 6 Ghế Bắc Âu",
    slug: "bo-ban-an-go-soi-6-ghe-bac-au",
    price: 16500000,
    stockQuantity: 8,
    description:
      "Bộ bàn ăn 6 ghế phong cách Bắc Âu, mặt bàn gỗ sồi, ghế bọc nệm êm cho bữa ăn gia đình.",
    imageUrl: img("product-img-7.jpg"),
    images: [img("product-img-7.jpg"), img("product-img-1.jpg")],
  },
  {
    categorySlug: "noi-that-phong-bep",
    name: "Ghế Ăn Tolix Metal Công Nghiệp",
    slug: "ghe-an-tolix-metal-cong-nghiep",
    price: 890000,
    stockQuantity: 80,
    description:
      "Ghế ăn kim loại sơn tĩnh điện, kiểu dáng gọn nhẹ, dễ phối với bàn ăn gỗ hoặc không gian bếp hiện đại.",
    imageUrl: img("product-img-8.jpg"),
    images: [img("product-img-8.jpg"), img("product-img-2.jpg")],
  },
  {
    categorySlug: "noi-that-phong-bep",
    name: "Kệ Bếp Đứng Gỗ Thông 5 Tầng",
    slug: "ke-bep-dung-go-thong-5-tang",
    price: 2450000,
    stockQuantity: 25,
    description:
      "Kệ bếp 5 tầng bằng gỗ thông, dùng để gia vị, nồi nhỏ, sách nấu ăn và phụ kiện bếp.",
    imageUrl: img("product-img-1.jpg"),
    images: [img("product-img-1.jpg"), img("product-img-3.jpg")],
  },
  {
    categorySlug: "noi-that-phong-lam-viec",
    name: "Bàn Làm Việc Gỗ Walnut Nguyên Khối",
    slug: "ban-lam-viec-go-walnut-nguyen-khoi",
    price: 8900000,
    stockQuantity: 10,
    description:
      "Bàn làm việc mặt gỗ walnut, chân thép đen, mặt bàn rộng cho laptop, màn hình và tài liệu.",
    imageUrl: img("product-img-2.jpg"),
    images: [img("product-img-2.jpg"), img("product-img-4.jpg")],
  },
  {
    categorySlug: "noi-that-phong-lam-viec",
    name: "Ghế Văn Phòng Ergonomic Herman",
    slug: "ghe-van-phong-ergonomic-herman",
    price: 7200000,
    stockQuantity: 20,
    description:
      "Ghế công thái học lưng lưới, tựa đầu và tay ghế điều chỉnh, hỗ trợ ngồi làm việc dài giờ.",
    imageUrl: img("product-img-3.jpg"),
    images: [img("product-img-3.jpg"), img("product-img-5.jpg")],
  },
  {
    categorySlug: "noi-that-phong-lam-viec",
    name: "Kệ Sách Gỗ Thông 6 Tầng Modular",
    slug: "ke-sach-go-thong-6-tang-modular",
    price: 3200000,
    stockQuantity: 28,
    description:
      "Kệ sách modular 6 tầng, khung chắc, phù hợp phòng làm việc, phòng đọc sách hoặc góc học tập.",
    imageUrl: img("product-img-4.jpg"),
    images: [img("product-img-4.jpg"), img("product-img-6.jpg")],
  },
  {
    categorySlug: "noi-that-cao-cap",
    name: "Đèn Sàn LED Cần Câu Bắc Âu",
    slug: "den-san-led-can-cau-bac-au",
    price: 2800000,
    stockQuantity: 45,
    description:
      "Đèn sàn cần câu ánh sáng ấm, thân kim loại thanh mảnh, hợp góc sofa, phòng đọc hoặc phòng ngủ.",
    imageUrl: img("product-img-5.jpg"),
    images: [img("product-img-5.jpg"), img("product-img-7.jpg")],
  },
  {
    categorySlug: "noi-that-cao-cap",
    name: "Thảm Trang Trí Lông Cừu Moroc",
    slug: "tham-trang-tri-long-cuu-moroc",
    price: 3500000,
    stockQuantity: 20,
    description:
      "Thảm trang trí họa tiết Moroccan, bề mặt mềm, giúp phòng khách hoặc phòng ngủ thêm ấm áp.",
    imageUrl: img("product-img-6.jpg"),
    images: [img("product-img-6.jpg"), img("product-img-8.jpg")],
  },
  {
    categorySlug: "noi-that-cao-cap",
    name: "Tranh Canvas Nghệ Thuật Trừu Tượng Bộ 3",
    slug: "tranh-canvas-nghe-thuat-tru-tuong-bo-3",
    price: 1290000,
    stockQuantity: 60,
    description:
      "Bộ 3 tranh canvas tone trung tính, dễ phối cùng nội thất cao cấp và phong cách hiện đại.",
    imageUrl: img("product-img-7.jpg"),
    images: [img("product-img-7.jpg"), img("product-img-1.jpg")],
  },
  {
    categorySlug: "noi-that-phong-hoi-nghi",
    name: "Bàn Hội Nghị Gỗ Walnut 10 Ghế",
    slug: "ban-hoi-nghi-go-walnut-10-ghe",
    price: 24500000,
    stockQuantity: 6,
    description:
      "Bàn hội nghị dài phủ veneer walnut, tích hợp hộp điện âm bàn, phù hợp phòng họp 8-10 người.",
    imageUrl: img("product-img-8.jpg"),
    images: [img("product-img-8.jpg"), img("product-img-2.jpg")],
  },
  {
    categorySlug: "noi-that-phong-hoi-nghi",
    name: "Ghế Hội Nghị Lưng Lưới Premium",
    slug: "ghe-hoi-nghi-lung-luoi-premium",
    price: 2450000,
    stockQuantity: 36,
    description:
      "Ghế hội nghị lưng lưới thoáng khí, đệm ngồi êm, chân quỳ mạ chrome, hợp không gian họp chuyên nghiệp.",
    imageUrl: img("product-img-3.jpg"),
    images: [img("product-img-3.jpg"), img("product-img-5.jpg")],
  },
  {
    categorySlug: "noi-that-phong-hoi-nghi",
    name: "Tủ Hồ Sơ Hội Nghị Cánh Kính",
    slug: "tu-ho-so-hoi-nghi-canh-kinh",
    price: 5900000,
    stockQuantity: 14,
    description:
      "Tủ hồ sơ cánh kính khung gỗ, dùng lưu tài liệu họp, mẫu vật và thiết bị trình chiếu nhỏ.",
    imageUrl: img("product-img-4.jpg"),
    images: [img("product-img-4.jpg"), img("product-img-6.jpg")],
  },
];

async function main() {
  let upserted = 0;
  for (const product of sampleProducts) {
    const category = await prisma.category.findUnique({ where: { slug: product.categorySlug } });
    if (!category) {
      console.warn(`Skip ${product.slug}: missing category ${product.categorySlug}`);
      continue;
    }

    const saved = await prisma.product.upsert({
      where: { slug: product.slug },
      create: {
        categoryId: category.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        stockQuantity: product.stockQuantity,
        description: product.description,
        imageUrl: product.imageUrl,
      },
      update: {
        categoryId: category.id,
        name: product.name,
        price: product.price,
        stockQuantity: product.stockQuantity,
        description: product.description,
        imageUrl: product.imageUrl,
      },
    });

    await prisma.productImage.deleteMany({ where: { productId: saved.id } });
    await prisma.productImage.createMany({
      data: product.images.map((url, index) => ({
        productId: saved.id,
        url,
        isPrimary: index === 0,
      })),
    });
    upserted += 1;
  }

  console.log(`Upserted ${upserted} sample products.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
