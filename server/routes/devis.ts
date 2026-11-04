import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { socketEvents } from '../socket/index.js';
import { CalendarDate, QuoteBusinessFields } from '../domain/businessValidation.js';
import { convertKeepingQuote } from '../services/linkedConversion.js';
import { config } from '../config.js';

export const devisRouter = Router();
const Id = z.coerce.number().int().positive().max(2147483647);
const Status = z.preprocess(v => typeof v === 'string' ? v.toUpperCase().replace(/-/g,'_') : v, z.enum(['A_TRAITER','EN_COURS','EN_ATTENTE','BLOQUE','TRAITE']));
const Fields = z.object({
 ...QuoteBusinessFields.shape,
 client:z.string().trim().min(1).max(200),
 amount:z.number().finite().nonnegative(),
 dateCreated:CalendarDate,
 echeance:CalendarDate.nullable(),
 status:Status,
 notes:z.string().max(2000).nullable(),
}).strict();
const Create = Fields.partial().extend({client:Fields.shape.client,dateCreated:CalendarDate,amount:Fields.shape.amount.default(0),status:Status.default('A_TRAITER')});
const Update = Fields.partial().refine(v=>Object.keys(v).length>0,'Modification vide');
function prepare(data: Record<string,unknown>) {
 return Object.fromEntries(Object.entries(data).map(([k,v]) => [k, k.startsWith('date') || k==='echeance' ? (typeof v==='string' ? new Date(v+'T00:00:00.000Z') : v) : v]));
}
function dto(d:any) {
 const result:any={id:d.id,client:d.client,amount:d.amount,dateCreated:d.dateCreated.toISOString().slice(0,10),echeance:d.echeance?.toISOString().slice(0,10)||null,status:d.status.toLowerCase().replace(/_/g,'-'),notes:d.notes,createdAt:d.createdAt.getTime(),updatedAt:d.updatedAt.getTime(),version:d.version,nombreInterventionsLiees:d._count?.interventions??0,premiereInterventionLieeId:d.interventions?.[0]?.id??null};
 for(const key of Object.keys(QuoteBusinessFields.shape)) {
  const value=d[key];
  result[key]=value instanceof Date ? value.toISOString().slice(0,10) : key==='montantHt' && value!=null ? value.toFixed(2) : value ?? null;
 }
 return result;
}
function notify(fn:()=>void){try{fn();}catch{console.error('Donnée conservée ; notification devis non transmise');}}
// Refresh roles from the database, not only from the JWT.
devisRouter.use(asyncHandler(async(req,_res,next)=>{
 const actor=await prisma.user.findUnique({where:{id:req.user!.userId},select:{role:true}});
 if(!actor)throw new AppError(401,'Session invalide','UNAUTHORIZED');
 if(!['ADMIN','USER','VIEWER'].includes(actor.role))throw new AppError(403,'Rôle non autorisé','FORBIDDEN');
 if(req.method!=='GET' && actor.role==='VIEWER')throw new AppError(403,'Lecture seule','FORBIDDEN');
 req.user!.role=actor.role as 'ADMIN'|'USER'|'VIEWER';next();
}));
const scope=(req:any)=>req.user.role==='ADMIN'?{}:{userId:req.user.userId};
// Count in the database, independently of the intervention list pagination.
const linkedInterventions=(req:any)=>({
 _count:{select:{interventions:{where:scope(req)}}},
 interventions:{where:scope(req),select:{id:true},orderBy:{id:'asc' as const},take:1},
});
devisRouter.get('/',asyncHandler(async(req,res)=>{
 const page=z.coerce.number().int().min(1).max(100000).parse(req.query.page??1);
 const limit=z.coerce.number().int().min(1).max(100).parse(req.query.limit??50);
 const search=z.string().max(200).parse(req.query.search??'');
 const status=req.query.status?Status.parse(req.query.status):undefined;
 const where:any={...scope(req),...(status?{status}:{}),...(search?{OR:[{client:{contains:search,mode:'insensitive'}},{objet:{contains:search,mode:'insensitive'}},{notes:{contains:search,mode:'insensitive'}}]}:{})};
 const [items,total]=await prisma.$transaction([prisma.devis.findMany({where,include:linkedInterventions(req),orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(page-1)*limit,take:limit}),prisma.devis.count({where})]);
 res.json({data:items.map(dto),pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}});
}));
devisRouter.get('/stats',asyncHandler(async(req,res)=>{
 const stats=await prisma.devis.groupBy({by:['status'],where:scope(req),_count:true});
 const result:Record<string,number>={'a-traiter':0,'en-cours':0,'en-attente':0,bloque:0,traite:0};
 for(const s of stats)result[s.status.toLowerCase().replace(/_/g,'-')]=s._count;
 res.json(result);
}));
devisRouter.get('/:id',asyncHandler(async(req,res)=>{
 const d=await prisma.devis.findFirst({where:{id:Id.parse(req.params.id),...scope(req)},include:linkedInterventions(req)});
 if(!d)throw new AppError(404,'Devis introuvable','NOT_FOUND');res.json({data:dto(d)});
}));
devisRouter.post('/',asyncHandler(async(req,res)=>{
 const parsed=Create.parse(req.body);
 const d=await prisma.devis.create({data:{...prepare(parsed),client:parsed.client,dateCreated:new Date(parsed.dateCreated+'T00:00:00.000Z'),userId:req.user!.userId} as any,include:linkedInterventions(req)});
 const result=dto(d);notify(()=>socketEvents.devisCreated(d.userId,result));res.status(201).json({data:result,message:'Devis créé'});
}));
devisRouter.patch('/:id',asyncHandler(async(req,res)=>{
 const id=Id.parse(req.params.id),parsed=Update.parse(req.body);
 const d=await prisma.$transaction(async tx=>{
  const existing=await tx.devis.findFirst({where:{id,...scope(req)}});
  if(!existing)throw new AppError(404,'Devis introuvable','NOT_FOUND');
  const changed=await tx.devis.updateMany({where:{id,userId:existing.userId,version:existing.version},data:{...prepare(parsed),version:{increment:1}} as any});
  if(changed.count!==1)throw new AppError(409,'Le devis a changé ; recharger','VERSION_CONFLICT');
  return tx.devis.findUniqueOrThrow({where:{id},include:linkedInterventions(req)});
 });
 const result=dto(d);notify(()=>socketEvents.devisUpdated(d.userId,result));res.json({data:result,message:'Devis mis à jour'});
}));
devisRouter.delete('/:id',asyncHandler(async(req,res)=>{
 const id=Id.parse(req.params.id);
 const ownerId=await prisma.$transaction(async tx=>{
  const d=await tx.devis.findFirst({where:{id,...scope(req)}});
  if(!d)throw new AppError(404,'Devis introuvable','NOT_FOUND');
  if(await tx.intervention.count({where:{devisId:id}}))throw new AppError(409,'Un devis lié à une intervention doit être conservé','QUOTE_LINKED');
  await tx.devis.delete({where:{id}});return d.userId;
 },{isolationLevel:'Serializable'});
 notify(()=>socketEvents.devisDeleted(ownerId,{id}));res.json({message:'Devis supprimé'});
}));
devisRouter.post('/:id/convert',asyncHandler(async(req,res)=>{
 if(req.get('origin')!==config.corsOrigin)throw new AppError(403,'Origine de la demande refusée','ORIGIN_FORBIDDEN');
 const key=req.get('Idempotency-Key');
 if(!key)throw new AppError(400,'Clé de demande requise ; recharger l’interface','IDEMPOTENCY_REQUIRED');
 const result=await convertKeepingQuote(req.user!.userId,Id.parse(req.params.id),req.body,key);
 if(!result.replayed)notify(()=>socketEvents.interventionCreated(result.ownerId,result.data));
 res.status(result.replayed?200:201).json({data:result.data,replayed:result.replayed,message:result.replayed?'Demande déjà réalisée : aucune nouvelle intervention':'Intervention créée ; devis conservé'});
}));
