import { z } from 'zod';
export const CalendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
 const d = new Date(value + 'T00:00:00.000Z');
 return value >= '1900-01-01' && value <= '2199-12-31' && Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === value;
}, 'Date calendaire invalide');
const Text = z.string().trim().max(500).nullable().optional();
const DateField = CalendarDate.nullable().optional();
export const Treatment = z.enum(['A_TRAITER','EN_COURS_DE_TRAITEMENT','EN_ATTENTE_CLIENT','EN_ATTENTE_FOURNISSEUR','EN_ATTENTE_TECHNICIEN','BLOQUE','TRAITE','CLASSE_SANS_SUITE']);
export const Priority = z.enum(['BASSE','NORMALE','HAUTE','URGENTE']);
export const QuoteStatus = z.enum(['A_PREPARER','EN_PREPARATION','A_VALIDER_EN_INTERNE','ENVOYE_AU_CLIENT','EN_NEGOCIATION','ACCEPTE','EXPIRE','REFUSE','ANNULE']);
export const InterventionStatus = z.enum(['NOUVELLE_DEMANDE','A_PLANIFIER','PLANIFIEE','AFFECTEE','EN_ROUTE','SUR_SITE','EN_COURS','SUSPENDUE','TERMINEE_A_VALIDER','CLOTUREE','ANNULEE']);
const common = { referenceMetier:Text, numeroDI:Text, siteAdresse:Text, objet:z.string().trim().min(1).max(4000).optional(), corpsEtat:Text, origine:Text, dateDemande:DateField, traitement:Treatment.nullable().optional(), priorite:Priority.nullable().optional() };
export const QuoteBusinessFields = z.object({ ...common, client:z.string().trim().min(1).max(200).optional(), statutCommercial:QuoteStatus.nullable().optional(), dateLimite:DateField, dateEnvoi:DateField, montantHt:z.string().regex(/^\d{1,12}(\.\d{1,2})?$/).nullable().optional(), validiteJours:z.number().int().min(0).max(36500).nullable().optional(), prochaineAction:Text, dateRelance:DateField, responsable:Text, commentaires:z.string().max(4000).nullable().optional() }).strict();
export const InterventionBusinessFields = z.object({ ...common, client:Text, statutOperationnel:InterventionStatus.nullable().optional(), typeIntervention:Text, technicien:Text, dateDebut:DateField, dateFin:DateField, dateEcheance:DateField, resultatTechnique:Text, motifBlocage:Text, numeroFacture:Text, statutFacture:z.enum(['FACTUREE','NON_FACTUREE']).nullable().optional(), compteRendu:z.string().max(4000).nullable().optional() }).strict();
export const CreateBusinessQuote = QuoteBusinessFields.extend({ client:z.string().trim().min(1).max(200), objet:z.string().trim().min(1).max(4000) });
export const CreateBusinessIntervention = InterventionBusinessFields.extend({ client:z.string().trim().min(1).max(200), objet:z.string().trim().min(1).max(4000), datePlanifiee:CalendarDate });
export const ConversionInput = z.object({ datePlanifiee:CalendarDate, entreprise:z.string().trim().max(200).nullable().optional(), notes:z.string().max(2000).nullable().optional() }).strict();
export function validateChronology(data: {dateDebut?:string|null;dateFin?:string|null}) {
 if(data.dateDebut && data.dateFin && data.dateFin < data.dateDebut) throw new Error('La date de fin précède le début');
}
