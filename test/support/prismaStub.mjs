// Remplace @prisma/client dans les tests de bout en bout : le client est la base simulée en mémoire.
export const PrismaClient = function () {
  return globalThis.__FAKE_PRISMA__;
};
export class PrismaClientKnownRequestError extends Error {
  constructor(message, { code, clientVersion, meta } = {}) {
    super(message);
    this.name = 'PrismaClientKnownRequestError';
    this.code = code;
    this.clientVersion = clientVersion;
    this.meta = meta;
  }
}
export const Prisma = new Proxy(
  { PrismaClientKnownRequestError },
  { get: (target, prop) => (prop in target ? target[prop] : function () {}) }
);
export default { PrismaClient, Prisma };
