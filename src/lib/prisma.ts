import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 7 impose un driver adapter : le client n'embarque plus de moteur Rust.
 * On passe donc par node-postgres (`@prisma/adapter-pg`).
 */
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL est absent. Copiez .env.example vers .env avant de démarrer.",
    );
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

// En développement, Next.js recharge les modules à chaque édition :
// sans ce cache on ouvrirait un pool de connexions par rechargement.
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
