import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const productImages = [
  {
    slug: "ban-dau-giuong-go-soi-tu-nhien",
    imageUrl: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=600&h=600&fit=crop",
    images: ["https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800&h=800&fit=crop"],
  },
  {
    slug: "guong-toan-than-khung-may-tu-nhien",
    imageUrl: "https://images.unsplash.com/photo-1618220179428-22790b461013?w=600&h=600&fit=crop",
    images: ["https://images.unsplash.com/photo-1618220179428-22790b461013?w=800&h=800&fit=crop"],
  },
  {
    slug: "ke-sach-go-thong-6-tang-modular",
    imageUrl: "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=600&h=600&fit=crop",
    images: ["https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=800&h=800&fit=crop"],
  },
  {
    slug: "tham-trang-tri-long-cuu-moroc",
    imageUrl: "https://images.unsplash.com/photo-1600166898405-da9535204843?w=600&h=600&fit=crop",
    images: ["https://images.unsplash.com/photo-1600166898405-da9535204843?w=800&h=800&fit=crop"],
  },
];

async function main() {
  for (const item of productImages) {
    const product = await prisma.product.update({
      where: { slug: item.slug },
      data: { imageUrl: item.imageUrl },
      select: { id: true, name: true },
    });

    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.createMany({
      data: item.images.map((url, index) => ({
        productId: product.id,
        url,
        isPrimary: index === 0,
      })),
    });

    console.log(`Updated image for ${product.name}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
