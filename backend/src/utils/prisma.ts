import { PrismaClient } from '@prisma/client';


/**
 * Reuse a single client across hot reloads in development — ts-node-dev
 * re-executes modules on change and each new PrismaClient opens its own
 * connection pool, which exhausts SQLite/Postgres connections over a session.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Only 'warn' — 'error' would print a stack for every expected unique-constraint
    // rejection, which is how idempotent inserts (notification dedupeKey, saved
    // scholarships) are intentionally implemented. Real failures are logged by the
    // callers and the central error handler.
    log: ['warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
