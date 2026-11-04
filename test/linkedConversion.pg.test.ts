import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../server/lib/prisma.js';
import { convertKeepingQuote } from '../server/services/linkedConversion.js';
import { CalendarDate, QuoteBusinessFields } from '../server/domain/businessValidation.js';

const url = new URL(process.env.DATABASE_URL || 'postgresql://invalid');
if(process.env.ANELEC_CI_DATABASE !== 'true' || !['localhost','127.0.0.1'].includes(url.hostname) || url.pathname !== '/anelec_ci') throw new Error('Tests réservés au PostgreSQL CI local anelec_ci. Aucun accès Supabase autorisé.');

test('Conversion liée sur PostgreSQL réel',async t=>{
 const users:number[]=[];
 try {
  const suffix=Date.now().toString();
  const owner=await prisma.user.create({data:{email:`owner-${suffix}@test.invalid`,password:'not-a-login-hash',name:'Fixture',role:'USER'}});users.push(owner.id);
  const other=await prisma.user.create({data:{email:`other-${suffix}@test.invalid`,password:'not-a-login-hash',name:'Fixture',role:'USER'}});users.push(other.id);
  const viewer=await prisma.user.create({data:{email:`viewer-${suffix}@test.invalid`,password:'not-a-login-hash',name:'Fixture',role:'VIEWER'}});users.push(viewer.id);
  const quote=await prisma.devis.create({data:{client:'Client fictif',objet:'Travaux fictifs',dateCreated:new Date('2026-11-04T00:00:00Z'),statutCommercial:'ACCEPTE',userId:owner.id}});
  const body={datePlanifiee:'2026-11-06'};const key=`pg-${suffix}`;
  await t.test('Dates et champs protégés',()=>{assert.equal(CalendarDate.safeParse('2026-02-30').success,false);assert.equal(QuoteBusinessFields.safeParse({userId:other.id}).success,false);});
  let first:any;
  await t.test('Devis conservé, propriétaire et lien',async()=>{first=await convertKeepingQuote(owner.id,quote.id,body,key);assert.equal(first.replayed,false);assert.ok(await prisma.devis.findUnique({where:{id:quote.id}}));const i=await prisma.intervention.findUniqueOrThrow({where:{id:(first.data as any).id}});assert.equal(i.devisId,quote.id);assert.equal(i.userId,owner.id);});
  await t.test('Même demande rejouée',async()=>{const r=await convertKeepingQuote(owner.id,quote.id,body,key);assert.equal(r.replayed,true);assert.deepEqual(r.data,first.data);assert.equal(await prisma.intervention.count({where:{devisId:quote.id}}),1);});
  await t.test('Même clé autre corps refusée',async()=>{await assert.rejects(()=>convertKeepingQuote(owner.id,quote.id,{datePlanifiee:'2026-11-07'},key),(e:any)=>e.statusCode===409);});
  await t.test('Permissions USER et VIEWER',async()=>{await assert.rejects(()=>convertKeepingQuote(other.id,quote.id,body,'other-request-key'),(e:any)=>e.statusCode===404);await assert.rejects(()=>convertKeepingQuote(viewer.id,quote.id,body,'viewer-request-key'),(e:any)=>e.statusCode===403);});
  await t.test('Concurrence sur une nouvelle clé',async()=>{const k=key+'-concurrent';const results=await Promise.allSettled(Array.from({length:4},()=>convertKeepingQuote(owner.id,quote.id,body,k)));const ok=results.filter((r):r is PromiseFulfilledResult<any>=>r.status==='fulfilled');assert.ok(ok.length>=1);assert.equal(ok.filter(r=>!r.value.replayed).length,1);assert.equal(await prisma.conversionRequest.count({where:{actorId:owner.id,key:k}}),1);assert.equal(await prisma.intervention.count({where:{devisId:quote.id}}),2);for(const r of results)if(r.status==='rejected')assert.equal(r.reason.statusCode,409);});
  await t.test('Rejeu après nouvelle connexion',async()=>{await prisma.$disconnect();const r=await convertKeepingQuote(owner.id,quote.id,body,key);assert.equal(r.replayed,true);assert.deepEqual(r.data,first.data);});
 }finally{
  if(users.length){await prisma.conversionRequest.deleteMany({where:{actorId:{in:users}}});await prisma.intervention.deleteMany({where:{userId:{in:users}}});await prisma.devis.deleteMany({where:{userId:{in:users}}});await prisma.user.deleteMany({where:{id:{in:users}}});}
  await prisma.$disconnect();
 }
});
