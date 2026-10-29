import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  if (process.env.NODE_ENV !== "development" || process.env.ALLOW_DEV_SEED !== "true") {
    throw new Error("Seed requires NODE_ENV=development and ALLOW_DEV_SEED=true. Never seed production.");
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const hostname = new URL(connectionString).hostname;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname)) {
    throw new Error("Development seed only supports a local database");
  }
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await db.organisation.upsert({
      where: { slug: "demo-coffee-house" },
      update: {},
      create: { name: "Demo Coffee House (development only)", slug: "demo-coffee-house" },
    });
    console.log("Seed complete: development organisation created. No accounts or payments created.");
  } finally {
    await db.$disconnect();
  }
}

main().catch(() => {
  console.error("Seed failed. Check local database configuration and development seed flags.");
  process.exitCode = 1;
});
