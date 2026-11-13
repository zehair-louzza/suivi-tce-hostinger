export async function resolve(spec, ctx, next) {
  if (spec === '@prisma/client') return { url: new URL('./prismaStub.mjs', import.meta.url).href, shortCircuit: true };
  return next(spec, ctx);
}
