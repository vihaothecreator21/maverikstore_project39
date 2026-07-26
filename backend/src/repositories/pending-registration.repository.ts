import { Prisma } from "@prisma/client";
import { prisma } from "../config/database.js";

type PrismaTx = Prisma.TransactionClient;

export class PendingRegistrationRepository {
  async findByEmail(email: string) {
    return prisma.pendingRegistration.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async deleteByEmail(email: string) {
    return prisma.pendingRegistration.deleteMany({
      where: { email: email.toLowerCase() },
    });
  }

  async deleteExpired(now: Date) {
    return prisma.pendingRegistration.deleteMany({
      where: { expiresAt: { lt: now } },
    });
  }

  async upsertForRequest(data: {
    name: string;
    email: string;
    phone?: string;
    passwordHash: string;
    otpHash: string;
    expiresAt: Date;
    lastSentAt: Date;
  }) {
    return prisma.pendingRegistration.upsert({
      where: { email: data.email.toLowerCase() },
      create: {
        name: data.name,
        email: data.email.toLowerCase(),
        phone: data.phone,
        passwordHash: data.passwordHash,
        otpHash: data.otpHash,
        attempts: 0,
        resendCount: 0,
        lastSentAt: data.lastSentAt,
        expiresAt: data.expiresAt,
        usedAt: null,
      },
      update: {
        name: data.name,
        phone: data.phone,
        passwordHash: data.passwordHash,
        otpHash: data.otpHash,
        attempts: 0,
        lastSentAt: data.lastSentAt,
        expiresAt: data.expiresAt,
        usedAt: null,
      },
    });
  }

  async updateForResend(email: string, data: {
    otpHash: string;
    expiresAt: Date;
    lastSentAt: Date;
  }) {
    return prisma.pendingRegistration.update({
      where: { email: email.toLowerCase() },
      data: {
        otpHash: data.otpHash,
        attempts: 0,
        expiresAt: data.expiresAt,
        lastSentAt: data.lastSentAt,
        resendCount: { increment: 1 },
        usedAt: null,
      },
    });
  }

  async incrementAttempts(id: number, tx: PrismaTx = prisma) {
    return tx.pendingRegistration.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  }

  async markUsed(id: number, tx: PrismaTx = prisma) {
    return tx.pendingRegistration.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }
}

