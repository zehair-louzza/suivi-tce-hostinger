import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../server/lib/prisma.js';
import { convertKeepingQuote } from '../server/services/linkedConversion.js';

const url=new URL(process.env.DATABASE_URL||'postgresql://invalid');
if(process.env.ANELEC_CI_DATABASE!=='true'||!['127.0.0.1','localhost'].includes(url.hostname)||url.pathname!=='/anelec_ci')throw new Error('Base CI locale obligatoire ; ces tests sont interdits sur Supabase.');

test('Cas supplémentaires de conversion PostgreSQL',async t=>{
 const ids:number[]=[];const suffix=randomUUID();
 const rejects=(fn:()=>Promise<unknown>,status:number,code?:string)=>assert.rejects(fn,(e:any)=>e.statusCode===status&&(!code||e.code===code));
 try{
  const owner=await prisma.user.create({data:{email:`extra-owner-${suffix}@test.invalid`,password:'fixture-not-a-login-hash',name:'Fixture extra',role:'USER'}});ids.push(owner.id);
  const admin=await prisma.user.create({data:{email:`extra-admin-${suffix}@test.invalid`,password:'fixture-not-a-login-hash',name:'Fixture extra admin',role:'ADMIN'}});ids.push(admin.id);
  const quote=await prisma.devis.create({data:{userId:owner.id,client:'Client fictif',objet:'Travaux fictifs',statutCommercial:'ACCEPTE',dateCreated:new Date('2026-11-04T00:00:00Z'),notes:'Notes du devis'}});
  const body={datePlanifiee:'2026-11-06'};
  const count=()=>prisma.intervention.count({where:{userId:owner.id}});
  await t.test('Devis non accepté : refus sans création',async()=>{
   const d=await prisma.devis.create({data:{userId:owner.id,client:'Non accepté',objet:'Objet fictif',statutCommercial:'EN_NEGOCIATION',dateCreated:new Date()}});const before=await count();
   await rejects(()=>convertKeepingQuote(owner.id,d.id,body,randomUUID()),409,'QUOTE_NOT_ACCEPTED');assert.equal(await count(),before);assert.ok(await prisma.devis.findUnique({where:{id:d.id}}));
  });
  await t.test('Objet absent : refus sans création',async()=>{
   const d=await prisma.devis.create({data:{userId:owner.id,client:'Sans objet',statutCommercial:'ACCEPTE',dateCreated:new Date()}});const before=await count();
   await rejects(()=>convertKeepingQuote(owner.id,d.id,body,randomUUID()),409,'QUOTE_INCOMPLETE');assert.equal(await count(),before);
  });
  await t.test('Date planifiée manquante : rejet de validation',async()=>{const before=await count();await assert.rejects(()=>convertKeepingQuote(owner.id,quote.id,{},randomUUID()),(e:any)=>e.name==='ZodError');assert.equal(await count(),before);});
  await t.test('Date impossible : rejet de validation',async()=>{const before=await count();await assert.rejects(()=>convertKeepingQuote(owner.id,quote.id,{datePlanifiee:'2026-02-30'},randomUUID()),(e:any)=>e.name==='ZodError');assert.equal(await count(),before);});
  await t.test('Champ propriétaire injecté : rejet strict',async()=>{const before=await count();await assert.rejects(()=>convertKeepingQuote(owner.id,quote.id,{...body,userId:admin.id},randomUUID()),(e:any)=>e.name==='ZodError');assert.equal(await count(),before);});
  await t.test('Clé trop courte : rejet sans écriture',async()=>{const before=await count();await rejects(()=>convertKeepingQuote(owner.id,quote.id,body,'abc'),400,'VALIDATION_ERROR');assert.equal(await count(),before);});
  await t.test('ADMIN conserve le propriétaire réel du devis',async()=>{
   const r=await convertKeepingQuote(admin.id,quote.id,body,randomUUID());const i=await prisma.intervention.findUniqueOrThrow({where:{id:(r.data as any).id}});
   assert.equal(i.userId,owner.id);assert.equal(i.devisId,quote.id);assert.equal(r.ownerId,owner.id);assert.ok(await prisma.devis.findUnique({where:{id:quote.id}}));
  });
  await t.test('Nouvelle demande volontaire : deux clés donnent deux interventions',async()=>{
   const before=await count();const a=await convertKeepingQuote(owner.id,quote.id,body,randomUUID());const b=await convertKeepingQuote(owner.id,quote.id,body,randomUUID());
   assert.notEqual((a.data as any).id,(b.data as any).id);assert.equal(await count(),before+2);
  });
  await t.test('Même clé utilisée pour un autre devis : conflit',async()=>{
   const second=await prisma.devis.create({data:{userId:owner.id,client:'Autre devis',objet:'Autre objet',statutCommercial:'ACCEPTE',dateCreated:new Date()}});const key=randomUUID();
   await convertKeepingQuote(owner.id,quote.id,body,key);const before=await count();await rejects(()=>convertKeepingQuote(owner.id,second.id,body,key),409,'IDEMPOTENCY_CONFLICT');assert.equal(await count(),before);
  });
  await t.test('Réponse mémorisée conservée après modification de l’intervention',async()=>{
   const key=randomUUID();const first=await convertKeepingQuote(owner.id,quote.id,body,key);
   await prisma.intervention.update({where:{id:(first.data as any).id},data:{notes:'Nouvelle note après conversion'}});
   const replay=await convertKeepingQuote(owner.id,quote.id,body,key);assert.equal(replay.replayed,true);assert.deepEqual(replay.data,first.data);
  });
  await t.test('Droit retiré : le rejeu ne contourne pas le rôle actuel',async()=>{
   const key=randomUUID();await convertKeepingQuote(owner.id,quote.id,body,key);await prisma.user.update({where:{id:owner.id},data:{role:'VIEWER'}});
   try{await rejects(()=>convertKeepingQuote(owner.id,quote.id,body,key),403,'FORBIDDEN');}finally{await prisma.user.update({where:{id:owner.id},data:{role:'USER'}});}
  });
  await t.test('Lien modifié : le rejeu demande une vérification',async()=>{
   const key=randomUUID();const first=await convertKeepingQuote(owner.id,quote.id,body,key);
   await prisma.intervention.update({where:{id:(first.data as any).id},data:{devisId:null}});
   await rejects(()=>convertKeepingQuote(owner.id,quote.id,body,key),409,'LINK_CHANGED');
  });
 }finally{
  if(ids.length){await prisma.conversionRequest.deleteMany({where:{actorId:{in:ids}}});await prisma.intervention.deleteMany({where:{userId:{in:ids}}});await prisma.devis.deleteMany({where:{userId:{in:ids}}});await prisma.user.deleteMany({where:{id:{in:ids}}});}
  await prisma.$disconnect();
 }
});
