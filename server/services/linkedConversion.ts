import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { ConversionInput } from '../domain/businessValidation.js';

// Not mounted yet. Route and frontend must switch together.
export async function convertKeepingQuote(actorId: number, quoteId: number, body: unknown, key: string) {
 const input = ConversionInput.parse(body);
 if(!Number.isSafeInteger(actorId) || actorId < 1 || !Number.isSafeInteger(quoteId) || quoteId < 1) throw new AppError(400, 'Identifiant invalide', 'VALIDATION_ERROR');
 if(!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) throw new AppError(400, 'Clé de conversion invalide', 'VALIDATION_ERROR');
 const requestHash = createHash('sha256').update(JSON.stringify({quoteId,datePlanifiee:input.datePlanifiee,entreprise:input.entreprise ?? null,notes:input.notes ?? null})).digest('hex');
 for(let attempt=0;attempt<4;attempt++) {
  try {
   return await prisma.$transaction(async tx => {
    const actor = await tx.user.findUnique({where:{id:actorId},select:{id:true,role:true}});
    if(!actor) throw new AppError(401, 'Session invalide', 'UNAUTHORIZED');
    if(actor.role !== 'ADMIN' && actor.role !== 'USER') throw new AppError(403, 'Lecture seule', 'FORBIDDEN');
    const quote = await tx.devis.findFirst({where:{id:quoteId,...(actor.role === 'ADMIN' ? {} : {userId:actor.id})}});
    if(!quote) throw new AppError(404, 'Devis introuvable', 'NOT_FOUND');
    const receipt = await tx.conversionRequest.findUnique({where:{actorId_key:{actorId,key}}});
    if(receipt) {
     if(receipt.requestHash !== requestHash) throw new AppError(409, 'Clé déjà utilisée pour une autre demande', 'IDEMPOTENCY_CONFLICT');
     const linked = await tx.intervention.findFirst({where:{id:receipt.interventionId,userId:quote.userId,devisId:quote.id}});
     if(!linked) throw new AppError(409, 'Le dossier lié a changé ; vérifier avant de relancer', 'LINK_CHANGED');
     return {data:receipt.response,replayed:true,ownerId:quote.userId};
    }
    if(quote.statutCommercial !== 'ACCEPTE') throw new AppError(409, 'Le devis doit être accepté avant conversion', 'QUOTE_NOT_ACCEPTED');
    if(!quote.objet) throw new AppError(409, 'Compléter l’objet du devis avant conversion', 'QUOTE_INCOMPLETE');
    const item = await tx.intervention.create({data:{
     chantier:quote.objet, client:quote.client, objet:quote.objet, siteAdresse:quote.siteAdresse, corpsEtat:quote.corpsEtat, origine:quote.origine, priorite:quote.priorite,
     entreprise:input.entreprise ?? null, datePlanifiee:new Date(input.datePlanifiee + 'T00:00:00.000Z'),
     amount:quote.amount, notes:input.notes ?? quote.notes, statutOperationnel:'PLANIFIEE', traitement:'A_TRAITER', status:'A_TRAITER',
     origineDevisId:quote.id, origineDevisClient:quote.client, origineDevisDate:quote.dateCreated, devisId:quote.id, userId:quote.userId,
     companyId: quote.companyId ?? null,
    }});
    const response = {id:item.id,chantier:item.chantier,entreprise:item.entreprise,amount:item.amount,datePlanifiee:item.datePlanifiee.toISOString().slice(0,10),dateReelle:null,status:'a-traiter',notes:item.notes,origineDevisId:item.origineDevisId,origineDevisClient:item.origineDevisClient,origineDevisDate:quote.dateCreated.toISOString().slice(0,10),createdAt:item.createdAt.getTime(),updatedAt:item.updatedAt.getTime(),devisId:quote.id};
    await tx.conversionRequest.create({data:{actorId,key,requestHash,interventionId:item.id,response}});
    return {data:response,replayed:false,ownerId:quote.userId};
   }, {isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:5000,timeout:15000});
  } catch(error) {
   const e = error as {code?:string;meta?:{target?:unknown}};
   const collision = e.code === 'P2002' && String(e.meta?.target).includes('actorId') && String(e.meta?.target).includes('key');
   if((e.code === 'P2034' || collision) && attempt < 3) {await new Promise(resolve => setTimeout(resolve,25*(attempt+1)));continue;}
   if(e.code === 'P2034' || collision) throw new AppError(409, 'Conflit temporaire ; réessayer avec la même clé', 'RETRY_REQUIRED');
   throw error;
  }
 }
 throw new AppError(409, 'Conversion non finalisée', 'RETRY_REQUIRED');
}
