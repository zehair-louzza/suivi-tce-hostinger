// Remplace @prisma/client dans les tests de bout en bout : le client est la base simulée en mémoire.
export const PrismaClient = function () {
  return globalThis.__FAKE_PRISMA__;
};
export const Prisma = new Proxy({}, { get: () => function () {} });
export default { PrismaClient, Prisma };
