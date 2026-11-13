// Automatisation A — technicien : notifications, relance après délai, alerte au planificateur.
//
// Garde-fous (validés avec Zee) :
//  - rien n'est envoyé à l'extérieur : seuls des collaborateurs de la MÊME société sont prévenus ;
//  - le technicien n'est prévenu que dans l'application (cloche + temps réel), jamais par e-mail ;
//  - seules les NOUVELLES affectations sont concernées (rien sur l'existant) ;
//  - chaque action automatique est écrite dans l'historique de l'intervention : « Automatique — raison » ;
//  - aucune suppression automatique ; réglable (actif / délai) par société.
import { prisma } from '../lib/prisma.js';
import { techMatches } from '../lib/access.js';
import { socketEvents } from '../socket/index.js';
import { sendAutomationEmail } from './emailService.js';
import { prochaineAction, normaliserDelai, normaliserDelaiAlerte, suggererRemplacants, type CandidatTechnicien } from '../domain/technicianResponse.js';

const db = prisma as any;

export const ROLES_PLANIFICATION = ['ADMIN', 'CONDUCTEUR_TRAVAUX'];
const STATUTS_TERMINES = ['Terminée - à valider', 'Clôturée', 'Annulée', 'Suspendue'];

type Destinataire = { id: number; name: string | null; email: string; role: string; technicienNom: string | null };

export function ajouterHistorique(existingJson: string | null | undefined, auteur: string, action: string, details?: string): string {
  let list: any[] = [];
  try {
    const parsed = JSON.parse(existingJson || '[]');
    if (Array.isArray(parsed)) list = parsed;
  } catch {
    list = [];
  }
  list.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: new Date().toISOString(),
    auteur,
    action,
    details,
  });
  return JSON.stringify(list.slice(0, 100));
}

export async function reglagesSociete(companyId: number): Promise<{ actif: boolean; delaiMinutes: number }> {
  const c = await db.company.findUnique({
    where: { id: companyId },
    select: { autoTechnicienActif: true, autoTechnicienDelaiMinutes: true },
  });
  return { actif: c ? c.autoTechnicienActif !== false : false, delaiMinutes: normaliserDelai(c?.autoTechnicienDelaiMinutes) };
}

/** Comptes techniciens actifs de la société qui correspondent au nom affecté. */
export async function comptesTechnicien(companyId: number, nom: string): Promise<Destinataire[]> {
  const users: Destinataire[] = await db.user.findMany({
    where: { companyId, active: true, role: 'TECHNICIEN' },
    select: { id: true, name: true, email: true, role: true, technicienNom: true },
  });
  return users.filter((u) => techMatches((u.technicienNom || u.name || '').trim(), nom));
}

export async function comptesPlanification(companyId: number): Promise<Destinataire[]> {
  return db.user.findMany({
    where: { companyId, active: true, role: { in: ROLES_PLANIFICATION } },
    select: { id: true, name: true, email: true, role: true, technicienNom: true },
  });
}

export async function notifier(
  companyId: number,
  destinataires: Destinataire[],
  n: { type: string; titre: string; message?: string; interventionId?: number }
): Promise<void> {
  if (destinataires.length === 0) return;
  const created = await Promise.all(
    destinataires.map((u) =>
      db.notification.create({
        data: {
          companyId,
          userId: u.id,
          type: n.type,
          titre: n.titre,
          message: n.message || null,
          interventionId: n.interventionId ?? null,
          lu: false,
        },
        select: { id: true, userId: true },
      })
    )
  );
  for (const row of created) {
    try {
      socketEvents.notificationNew(row.userId, row);
    } catch {
      /* temps réel indisponible : la cloche se met à jour au prochain rafraîchissement */
    }
  }
}

function libelleDuree(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.round((min / 60) * 10) / 10;
  return `${h} h`;
}

function libelleMission(i: { referenceMetier?: string | null; chantier?: string | null; client?: string | null; id: number }): string {
  const ref = i.referenceMetier || `INT-${i.id}`;
  const lieu = [i.client, i.chantier].filter(Boolean).join(' — ');
  return lieu ? `${ref} (${lieu})` : ref;
}

/** Appelé après une NOUVELLE affectation : prévient le technicien et ouvre l'attente de réponse. */
export async function notifierAffectation(companyId: number, intervention: any): Promise<void> {
  const comptes = await comptesTechnicien(companyId, intervention.entreprise || '');
  await notifier(companyId, comptes, {
    type: 'MISSION_AFFECTEE',
    titre: 'Nouvelle mission à confirmer',
    message: `${libelleMission(intervention)} vous a été affectée. Acceptez-la ou refusez-la avec un motif.`,
    interventionId: intervention.id,
  });
}

/** Prévient le planificateur et la direction du refus, avec les remplaçants suggérés. */
export async function notifierRefus(companyId: number, intervention: any, refusant: string, motif: string): Promise<string[]> {
  const suggestions = await suggererPour(companyId, intervention, refusant);
  const noms = suggestions.map((s) => s.nom);
  await notifier(companyId, await comptesPlanification(companyId), {
    type: 'MISSION_REFUSEE',
    titre: 'Mission refusée par le technicien',
    message:
      `${refusant} a refusé ${libelleMission(intervention)} — motif : ${motif}.` +
      (noms.length ? ` Remplaçants suggérés : ${noms.join(', ')}.` : ' Aucun remplaçant disponible à suggérer.'),
    interventionId: intervention.id,
  });
  return noms;
}

export async function suggererPour(companyId: number, intervention: any, refusant: string): Promise<CandidatTechnicien[]> {
  const techs: Destinataire[] = await db.user.findMany({
    where: { companyId, active: true, role: 'TECHNICIEN' },
    select: { id: true, name: true, email: true, role: true, technicienNom: true },
  });
  const noms = techs.map((t) => (t.technicienNom || t.name || '').trim()).filter(Boolean);
  if (noms.length === 0) return [];

  const jour = intervention.datePlanifiee ? new Date(intervention.datePlanifiee) : null;
  let charges: any[] = [];
  if (jour && !Number.isNaN(jour.getTime())) {
    const debut = new Date(jour);
    debut.setUTCHours(0, 0, 0, 0);
    const fin = new Date(debut);
    fin.setUTCDate(fin.getUTCDate() + 1);
    charges = await db.intervention.findMany({
      where: { companyId, datePlanifiee: { gte: debut, lt: fin }, NOT: { statutOperationnel: { in: ['Clôturée', 'Annulée'] } } },
      select: { entreprise: true },
    });
  }

  let competences: Record<string, string[]> = {};
  try {
    const ref = await db.referentiel.findFirst({ where: { companyId, categorie: 'technicien_competences' } });
    if (ref?.valeurs) competences = JSON.parse(ref.valeurs) || {};
  } catch {
    competences = {};
  }

  const candidats: CandidatTechnicien[] = noms.map((nom) => ({
    nom,
    chargeDuJour: charges.filter((c) => techMatches(nom, c.entreprise)).length,
    competences: competences[nom] || [],
  }));
  return suggererRemplacants(candidats, refusant, intervention.corpsEtat, 3);
}

let enCours = false;

/** Passe périodique : relances et alertes. Idempotente (chaque étape est verrouillée par sa date). */
export async function executerAutomatisationsTechnicien(maintenant: Date = new Date()): Promise<{ relances: number; alertes: number }> {
  if (enCours) return { relances: 0, alertes: 0 };
  enCours = true;
  const bilan = { relances: 0, alertes: 0 };
  try {
    const attente: any[] = await db.intervention.findMany({
      where: {
        reponseTechnicien: 'EN_ATTENTE',
        companyId: { not: null },
        company: { is: { active: true, autoTechnicienActif: true } },
      },
      select: {
        id: true,
        companyId: true,
        entreprise: true,
        statutOperationnel: true,
        referenceMetier: true,
        chantier: true,
        client: true,
        datePlanifiee: true,
        historiqueJson: true,
        affecteLe: true,
        relanceTechnicienLe: true,
        alertePlanificateurLe: true,
        company: { select: { autoTechnicienDelaiMinutes: true, autoTechnicienAlerteMinutes: true, autoTechnicienHeuresBureau: true } },
      },
      take: 500,
    });

    for (const i of attente) {
      const companyId = i.companyId as number;
      // L'affectation n'a plus d'objet : on referme l'attente sans rien envoyer
      if (!i.entreprise || STATUTS_TERMINES.includes(String(i.statutOperationnel || ''))) {
        await db.intervention.update({ where: { id: i.id }, data: { reponseTechnicien: null } });
        continue;
      }
      const action = prochaineAction({
        reponse: 'EN_ATTENTE',
        affecteLe: i.affecteLe,
        relanceLe: i.relanceTechnicienLe,
        alerteLe: i.alertePlanificateurLe,
        maintenant,
        delaiMinutes: i.company?.autoTechnicienDelaiMinutes,
        delaiAlerteMinutes: i.company?.autoTechnicienAlerteMinutes,
        heuresBureauSeulement: i.company?.autoTechnicienHeuresBureau !== false,
      });
      if (action === 'aucune') continue;

      const delai = normaliserDelai(i.company?.autoTechnicienDelaiMinutes);
      if (action === 'relancer_technicien') {
        const comptes = await comptesTechnicien(companyId, i.entreprise);
        await notifier(companyId, comptes, {
          type: 'RELANCE_TECHNICIEN',
          titre: 'Mission en attente de votre réponse',
          message: `${libelleMission(i)} attend votre réponse depuis plus de ${libelleDuree(delai)}.`,
          interventionId: i.id,
        });
        await db.intervention.update({
          where: { id: i.id },
          data: {
            relanceTechnicienLe: maintenant,
            historiqueJson: ajouterHistorique(i.historiqueJson, 'Automatique', 'Automatique — relance du technicien', `${i.entreprise} n'a pas répondu à son affectation depuis ${libelleDuree(delai)}`),
          },
        });
        bilan.relances++;
      } else {
        const planif = await comptesPlanification(companyId);
        await notifier(companyId, planif, {
          type: 'ALERTE_SANS_REPONSE',
          titre: 'Technicien sans réponse',
          message: `${i.entreprise} n'a toujours pas répondu pour ${libelleMission(i)}. Pensez à le joindre ou à réaffecter la mission.`,
          interventionId: i.id,
        });
        for (const u of planif) {
          sendAutomationEmail({
            companyId,
            toEmail: u.email,
            recipientName: u.name || 'collègue',
            subject: `Technicien sans réponse — ${libelleMission(i)}`,
            heading: 'Technicien sans réponse',
            lines: [`${i.entreprise} n'a pas répondu à son affectation pour ${libelleMission(i)}, même après relance.`, 'Joignez-le ou réaffectez la mission.'],
            linkPath: '/',
          }).catch(() => undefined);
        }
        await db.intervention.update({
          where: { id: i.id },
          data: {
            alertePlanificateurLe: maintenant,
            historiqueJson: ajouterHistorique(i.historiqueJson, 'Automatique', 'Automatique — alerte au planificateur', `${i.entreprise} n'a pas répondu après relance`),
          },
        });
        bilan.alertes++;
      }
    }
  } finally {
    enCours = false;
  }
  return bilan;
}

/** Démarre la passe périodique (toutes les 2 minutes). Jamais lancée pendant les tests. */
export function demarrerPlanificateurTechnicien(): void {
  const intervalle = 2 * 60 * 1000;
  const timer = setInterval(() => {
    executerAutomatisationsTechnicien().catch((e) => console.error('⚠ Automatisation technicien :', e?.message || e));
  }, intervalle);
  timer.unref?.();
  console.log('⏱ Automatisation technicien : passe toutes les 2 minutes');
}
