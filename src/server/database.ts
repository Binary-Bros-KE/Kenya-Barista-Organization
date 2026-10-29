import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getEnv } from "../lib/env";

const globalDb = globalThis as unknown as { prisma?: PrismaClient };
export function getDb() {
  if (globalDb.prisma) return globalDb.prisma;
  const { DATABASE_URL, DATABASE_POOL_MAX, NODE_ENV } = getEnv();
  if (!DATABASE_URL) throw new Error("DATABASE_URL is required for database operations");
  // The embedded development server needs serialized connections for nested relation reads.
  // Native PostgreSQL deployments use five by default and may explicitly tune the pool.
  globalDb.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL, connectionTimeoutMillis: 3000, max: DATABASE_POOL_MAX ?? (NODE_ENV === "production" ? 5 : 1) }) });
  return globalDb.prisma;
}
