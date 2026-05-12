const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  console.log('Order counts by status:', JSON.stringify(orders, null, 2));

  const latestOrders = await prisma.order.findMany({
    take: 5,
    orderBy: { updatedAt: 'desc' },
    select: { id: true, status: true, createdAt: true, updatedAt: true }
  });
  console.log('Latest 5 orders:', JSON.stringify(latestOrders, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
