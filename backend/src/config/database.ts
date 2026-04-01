import { PrismaClient } from "@prisma/client";

/**
 * Prisma Singleton Instance
 * Ensures only one Prisma Client instance is created across the application
 * 
 * @usage
 * import { prisma } from '@/config/database';
 * const user = await prisma.user.findUnique({ where: { id: 1 } });
 */
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Connect to database - call this during server startup
 */
export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log("✓ Database connected successfully");
  } catch (error) {
    console.error("✗ Database connection failed:", error);
    throw error;
  }
};

/**
 * Disconnect from database - call during graceful shutdown
 */
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    console.log("✓ Database disconnected successfully");
  } catch (error) {
    console.error("✗ Database disconnection failed:", error);
  }
};

export default prisma;
