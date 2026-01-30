import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function makeClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no está seteada");

  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
