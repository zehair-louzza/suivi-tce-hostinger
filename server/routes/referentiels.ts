// Referentiels routes - Administration des listes de choix ANELEC, Compétences Techniciens & Équipes Journalières
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { policy, secureRouter } from '../lib/guard.js';
import { requireCompanyId } from '../lib/tenant.js';
import { loadAccess } from '../lib/loadAccess.js';
import { shapeClientFiche, techMatches } from '../lib/access.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import { socketEvents } from '../socket/index.js';
import {
  ClientProfile,
  DEFAULT_REFERENTIELS,
  DEFAULT_TECHNICIEN_COMPETENCES,
  EquipeJournaliere,
  GpsPositionPayload,
  ReferentielsMap,
  getEffectivePermissions,
} from '../../shared/types.js';

export const referentielsRouter = secureRouter('referentiels');

// GET /api/referentiels - Retourne toutes les listes de choix métier ANELEC + compétences + équipes journalières
referentielsRouter.get(
  '/',
  policy('referentiels.read'),
  asyncHandler(async (req: Request, res: Response) => {
    const acc = await loadAccess(req);
    const companyId = acc.companyId;
    const rows = await prisma.referentiel.findMany({
      where: {
        companyId,
      },
      orderBy: { id: 'asc' },
    });

    // Les listes « maison » ANELEC (clients, fiches donneurs d'ordre, équipe, compétences) ne servent
    // de point de départ qu'à l'entreprise plateforme (id 1). Toute autre entreprise démarre vide :
    // elle ne doit jamais voir les noms, contacts ou SIRET d'une autre société.
    const isPlatform = companyId === 1;
    const result: ReferentielsMap = {
      clients: isPlatform ? [...DEFAULT_REFERENTIELS.clients] : [],
      clients_fiches: isPlatform ? [...(DEFAULT_REFERENTIELS.clients_fiches || [])] : [],
      corps_etat: [...DEFAULT_REFERENTIELS.corps_etat],
      origines: [...DEFAULT_REFERENTIELS.origines],
      responsables: isPlatform ? [...DEFAULT_REFERENTIELS.responsables] : [],
      techniciens: isPlatform ? [...DEFAULT_REFERENTIELS.techniciens] : [],
      motifs_blocage: [...DEFAULT_REFERENTIELS.motifs_blocage],
      resultats_techniques: [...DEFAULT_REFERENTIELS.resultats_techniques],
      technicien_competences: isPlatform ? { ...DEFAULT_TECHNICIEN_COMPETENCES } : {},
      equipes_journalieres: [],
      positions_gps_techniciens: {},
    };

    for (const r of rows) {
      const rawCat = r.categorie === 'corpsEtat' ? 'corps_etat' : r.categorie;
      const key = rawCat as keyof ReferentielsMap;
      if (key === 'technicien_competences') {
        try {
          const parsed = JSON.parse(r.valeurs);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            result.technicien_competences = {
              ...(isPlatform ? DEFAULT_TECHNICIEN_COMPETENCES : {}),
              ...parsed,
            };
          }
        } catch {
          // ignore invalid json
        }
      } else if (key === 'positions_gps_techniciens') {
        try {
          const parsed = JSON.parse(r.valeurs);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            result.positions_gps_techniciens = parsed;
          }
        } catch {
          // ignore invalid json
        }
      } else if (key === 'equipes_journalieres') {
        try {
          const parsed = JSON.parse(r.valeurs);
          if (Array.isArray(parsed)) {
            result.equipes_journalieres = parsed;
          }
        } catch {
          // ignore invalid json
        }
      } else if (key === 'clients_fiches') {
        try {
          const parsed = JSON.parse(r.valeurs);
          if (Array.isArray(parsed) && parsed.length > 0) {
            result.clients_fiches = parsed;
          }
        } catch {
          // ignore invalid json
        }
      } else if (key in result) {
        try {
          const parsed = JSON.parse(r.valeurs);
          if (Array.isArray(parsed) && parsed.length > 0) {
            (result as any)[key] = parsed;
          }
        } catch {
          // ignore invalid json
        }
      }
    }

    // S'assurer que tout client présent dans result.clients a une fiche technique correspondante
    const existingFiches = result.clients_fiches || [];
    const ficheNames = new Set(existingFiches.map((f) => f.nom.toLowerCase()));
    const updatedFiches = [...existingFiches];

    for (const c of result.clients) {
      if (!ficheNames.has(c.toLowerCase())) {
        updatedFiches.push({
          id: c.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          nom: c,
          type: c.toLowerCase().includes('particulier') ? 'PARTICULIER' : 'DONNEUR_ORDRE',
          email: '',
          consignesParticulieres: 'Fiche créée automatiquement depuis les référentiels.',
          active: true,
        });
        ficheNames.add(c.toLowerCase());
      }
    }
    result.clients_fiches = updatedFiches;

    // S'assurer que tout technicien de la liste possède une entrée dans technicien_competences
    const compMap: Record<string, string[]> = { ...(result.technicien_competences || {}) };
    for (const tech of result.techniciens) {
      if (!Array.isArray(compMap[tech])) {
        compMap[tech] = (isPlatform && DEFAULT_TECHNICIEN_COMPETENCES[tech]) || ['Électricité'];
      }
    }
    result.technicien_competences = compMap;

    // Positions GPS de l'équipe : direction et conducteur seulement ; les autres ne voient que la leur
    if (!acc.canSeeTeam) {
      result.positions_gps_techniciens = ownGpsOnly(result.positions_gps_techniciens, acc.boundTech);
    }

    // Fiches clients : tarifs négociés réservés à ceux qui voient les montants ; le terrain ne reçoit que
    // les clients de SES missions (nom, adresse, contact) et ni la liste de l'équipe ni celle des responsables.
    if (acc.isFieldOnly) {
      const bound = acc.boundTech;
      const mineWhere = bound
        ? {
            OR: [
              { entreprise: { contains: bound, mode: 'insensitive' as const } },
              { technicien: { contains: bound, mode: 'insensitive' as const } },
            ],
          }
        : { id: -1 };
      const [myInterventions, myVisits] = await Promise.all([
        prisma.intervention.findMany({ where: { companyId, ...mineWhere }, select: { client: true } }),
        bound
          ? prisma.devis.findMany({
              where: { companyId, visiteTechnicien: { contains: bound, mode: 'insensitive' } },
              select: { client: true },
            })
          : Promise.resolve([] as { client: string | null }[]),
      ]);
      const myClients = new Set(
        [...myInterventions, ...myVisits].map((m: any) => String(m.client || '').trim().toLowerCase()).filter(Boolean)
      );
      result.clients = [];
      result.responsables = [];
      result.techniciens = bound ? [bound] : [];
      result.technicien_competences = bound && result.technicien_competences?.[bound]
        ? { [bound]: result.technicien_competences[bound] }
        : {};
      result.equipes_journalieres = [];
      result.clients_fiches = (result.clients_fiches || [])
        .filter((f) => myClients.has(String(f.nom || '').trim().toLowerCase()))
        .map((f) => shapeClientFiche(acc, f as any) as any);
    } else {
      result.clients_fiches = (result.clients_fiches || []).map((f) => shapeClientFiche(acc, f as any) as any);
    }

    res.json({ data: result });
  })
);

// PUT /api/referentiels/:categorie - Met à jour une liste de choix, la matrice technicien_competences ou equipes_journalieres
referentielsRouter.put(
  '/:categorie',
  policy('referentiels.write'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.userId) {
      throw new AppError(401, 'Authentification requise', 'UNAUTHORIZED');
    }
    const caller = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, role: true, permissionsJson: true, companyId: true, active: true },
    });
    if (!caller || caller.active === false) {
      throw new AppError(403, 'Compte inactif ou introuvable', 'FORBIDDEN');
    }
    const effectiveRole = caller.id === 1 || caller.role === 'ADMIN' ? 'ADMIN' : caller.role;
    const perms = getEffectivePermissions(effectiveRole as any, caller.permissionsJson);
    const isAdmin = caller.id === 1 || effectiveRole === 'ADMIN' || perms.canManageUsers;

    // Seuls les administrateurs ou les utilisateurs avec droit canManageReferentiels peuvent altérer les référentiels métiers
    if (!isAdmin && !perms.canManageReferentiels) {
      throw new AppError(403, 'Permission insuffisante pour modifier les référentiels de configuration de l’entreprise', 'FORBIDDEN');
    }

    const rawCat = req.params.categorie === 'corpsEtat' ? 'corps_etat' : req.params.categorie;
    const categorie = rawCat as keyof ReferentielsMap;
    const companyId = requireCompanyId(caller.companyId);

    if (categorie === 'technicien_competences') {
      const rawMap = req.body?.competences || req.body?.valeurs || {};
      const cleanedMap: Record<string, string[]> = {};
      if (rawMap && typeof rawMap === 'object' && !Array.isArray(rawMap)) {
        for (const [tech, skills] of Object.entries(rawMap)) {
          if (Array.isArray(skills)) {
            cleanedMap[String(tech).trim()] = skills
              .map((s) => String(s).trim())
              .filter(Boolean);
          }
        }
      }

      const existing = await prisma.referentiel.findFirst({
        where: {
          categorie: 'technicien_competences',
          companyId,
        },
      });

      if (existing) {
        await prisma.referentiel.update({
          where: { id: existing.id },
          data: {
            valeurs: JSON.stringify(cleanedMap),
          },
        });
      } else {
        await prisma.referentiel.create({
          data: {
            categorie: 'technicien_competences',
            valeurs: JSON.stringify(cleanedMap),
            companyId,
          },
        });
      }

      res.json({
        data: { categorie: 'technicien_competences', valeurs: cleanedMap },
        message: 'Compétences techniciens mises à jour avec succès',
      });
      return;
    }

    if (categorie === 'equipes_journalieres') {
      const rawEquipes: EquipeJournaliere[] = Array.isArray(req.body?.equipes)
        ? req.body.equipes
        : Array.isArray(req.body?.valeurs)
        ? req.body.valeurs
        : [];

      const cleanedEquipes: EquipeJournaliere[] = rawEquipes
        .filter((e) => e && Array.isArray(e.membres) && e.membres.length >= 2)
        .map((e) => {
          const membres = Array.from(new Set(e.membres.map((m) => String(m).trim()).filter(Boolean)));
          return {
            id: e.id || `eq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            nomEquipe: e.nomEquipe || membres.join(' + '),
            membres,
            dateDebut: e.dateDebut || new Date().toISOString().slice(0, 10),
            dateFin: e.dateFin || e.dateDebut || new Date().toISOString().slice(0, 10),
            touteLaJournee: e.touteLaJournee !== false,
            heureDebut: e.heureDebut || '07:00',
            heureFin: e.heureFin || '19:00',
            createdAt: e.createdAt || new Date().toISOString(),
          };
        });

      const existing = await prisma.referentiel.findFirst({
        where: {
          categorie: 'equipes_journalieres',
          companyId,
        },
      });

      if (existing) {
        await prisma.referentiel.update({
          where: { id: existing.id },
          data: {
            valeurs: JSON.stringify(cleanedEquipes),
          },
        });
      } else {
        await prisma.referentiel.create({
          data: {
            categorie: 'equipes_journalieres',
            valeurs: JSON.stringify(cleanedEquipes),
            companyId,
          },
        });
      }

      res.json({
        data: { categorie: 'equipes_journalieres', valeurs: cleanedEquipes },
        message: 'Équipes journalières mises à jour avec succès',
      });
      return;
    }

    if (categorie === 'clients_fiches') {
      const rawFiches: ClientProfile[] = Array.isArray(req.body?.fiches)
        ? req.body.fiches
        : Array.isArray(req.body?.valeurs)
        ? req.body.valeurs
        : [];

      const cleanedFiches: ClientProfile[] = rawFiches
        .filter((f) => f && f.nom)
        .map((f) => ({
          id: f.id || String(f.nom).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          nom: String(f.nom).trim(),
          type: f.type || 'DONNEUR_ORDRE',
          email: String(f.email || '').trim().toLowerCase(),
          telephone: f.telephone ? String(f.telephone).trim() : undefined,
          contactNom: f.contactNom ? String(f.contactNom).trim() : undefined,
          contactRole: f.contactRole ? String(f.contactRole).trim() : undefined,
          adresse: f.adresse ? String(f.adresse).trim() : undefined,
          ville: f.ville ? String(f.ville).trim() : undefined,
          codePostal: f.codePostal ? String(f.codePostal).trim() : undefined,
          siret: f.siret ? String(f.siret).trim() : undefined,
          delaiPaiement: f.delaiPaiement ? String(f.delaiPaiement).trim() : undefined,
          tauxHoraireNegocie: typeof f.tauxHoraireNegocie === 'number' ? f.tauxHoraireNegocie : undefined,
          consignesParticulieres: f.consignesParticulieres ? String(f.consignesParticulieres).trim() : undefined,
          notesInternes: f.notesInternes ? String(f.notesInternes).trim() : undefined,
          services: Array.isArray(f.services)
            ? f.services
                .filter((s: any) => s && (s.nomService || s.email))
                .map((s: any, idx: number) => ({
                  id: s.id || `srv-${idx}-${Date.now()}`,
                  nomService: String(s.nomService || 'Service').trim(),
                  email: String(s.email || '').trim().toLowerCase(),
                  contactNom: s.contactNom ? String(s.contactNom).trim() : undefined,
                  contactRole: s.contactRole ? String(s.contactRole).trim() : undefined,
                  telephone: s.telephone ? String(s.telephone).trim() : undefined,
                  recevoirRapports: s.recevoirRapports !== false,
                  recevoirFactures: Boolean(s.recevoirFactures),
                  recevoirDevis: Boolean(s.recevoirDevis),
                }))
            : [],
          active: f.active !== false,
          updatedAt: new Date().toISOString(),
        }));

      const existing = await prisma.referentiel.findFirst({
        where: {
          categorie: 'clients_fiches',
          companyId,
        },
      });

      if (existing) {
        await prisma.referentiel.update({
          where: { id: existing.id },
          data: {
            valeurs: JSON.stringify(cleanedFiches),
          },
        });
      } else {
        await prisma.referentiel.create({
          data: {
            categorie: 'clients_fiches',
            valeurs: JSON.stringify(cleanedFiches),
            companyId,
          },
        });
      }

      // Synchroniser automatiquement les noms avec le référentiel 'clients'
      const clientNames = cleanedFiches.filter((f) => f.active).map((f) => f.nom);
      if (clientNames.length > 0) {
        const existingClientsRow = await prisma.referentiel.findFirst({
          where: { categorie: 'clients', companyId },
        });
        const currentList: string[] = existingClientsRow
          ? JSON.parse(existingClientsRow.valeurs)
          : companyId === 1
            ? [...DEFAULT_REFERENTIELS.clients]
            : [];
        const mergedList = Array.from(new Set([...currentList, ...clientNames]));
        if (existingClientsRow) {
          await prisma.referentiel.update({
            where: { id: existingClientsRow.id },
            data: { valeurs: JSON.stringify(mergedList) },
          });
        }
      }

      res.json({
        data: { categorie: 'clients_fiches', valeurs: cleanedFiches },
        message: "Fiches techniques des Donneurs d'ordre & Clients enregistrées avec succès",
      });
      return;
    }

    const valeurs = Array.isArray(req.body?.valeurs)
      ? req.body.valeurs.map((v: any) => String(v).trim()).filter(Boolean)
      : [];

    const existing = await prisma.referentiel.findFirst({
      where: {
        categorie,
        companyId,
      },
    });

    if (existing) {
      await prisma.referentiel.update({
        where: { id: existing.id },
        data: {
          valeurs: JSON.stringify(valeurs),
        },
      });
    } else {
      await prisma.referentiel.create({
        data: {
          categorie,
          valeurs: JSON.stringify(valeurs),
          companyId,
        },
      });
    }

    res.json({
      data: { categorie, valeurs },
      message: 'Référentiel mis à jour avec succès',
    });
  })
);

/** Ne garde que la position du technicien lui-même (jamais celle de ses collègues). */
function ownGpsOnly<T extends Record<string, { technicien?: string } | any>>(map: T | undefined, boundTech: string): T {
  const out: Record<string, any> = {};
  for (const [key, entry] of Object.entries(map || {})) {
    if (techMatches(boundTech, key) || techMatches(boundTech, (entry as any)?.technicien)) out[key] = entry;
  }
  return out as T;
}

export async function saveTechnicienGpsPosition(
  companyId: number,
  payload: GpsPositionPayload
): Promise<Record<string, GpsPositionPayload>> {
  const existing = await prisma.referentiel.findFirst({
    where: {
      categorie: 'positions_gps_techniciens',
      companyId,
    },
  });

  let currentMap: Record<string, GpsPositionPayload> = {};
  if (existing?.valeurs) {
    try {
      const parsed = JSON.parse(existing.valeurs);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        currentMap = parsed;
      }
    } catch {
      // ignore
    }
  }

  const techKey = String(payload.technicien || '').trim();
  if (techKey && typeof payload.lat === 'number' && typeof payload.lng === 'number') {
    currentMap[techKey] = {
      ...payload,
      technicien: techKey,
      timestamp: payload.timestamp || new Date().toISOString(),
    };

    if (existing) {
      await prisma.referentiel.update({
        where: { id: existing.id },
        data: { valeurs: JSON.stringify(currentMap) },
      });
    } else {
      await prisma.referentiel.create({
        data: {
          categorie: 'positions_gps_techniciens',
          valeurs: JSON.stringify(currentMap),
          companyId,
        },
      });
    }

    try {
      socketEvents.broadcastCompany(companyId, 'technicien:gps_updated', currentMap[techKey]);
    } catch {
      // ignore socket error
    }
  }

  return currentMap;
}

// POST /api/referentiels/gps-position - Enregistre et diffuse en temps réel la position GPS actuelle d'un technicien
referentielsRouter.post(
  '/gps-position',
  policy('gps.post'),
  asyncHandler(async (req: Request, res: Response) => {
    const companyId = requireCompanyId(req.user?.companyId);
    const b = req.body || {};
    let technicien = String(b.technicien || '').trim();

    if (req.user?.userId) {
      const caller = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { id: true, role: true, technicienNom: true, name: true },
      });
      if (caller && (caller.role === 'TECHNICIEN' || caller.technicienNom)) {
        technicien = (caller.technicienNom || caller.name || technicien).trim();
      }
    }

    const lat = Number(b.lat);
    const lng = Number(b.lng);

    if (!technicien || Number.isNaN(lat) || Number.isNaN(lng)) {
      res.status(400).json({ error: 'Technicien et coordonnées GPS (lat, lng) requis' });
      return;
    }

    const payload: GpsPositionPayload = {
      technicien,
      lat,
      lng,
      accuracy: b.accuracy ? Number(b.accuracy) : undefined,
      timestamp: b.timestamp || new Date().toISOString(),
      missionId: b.missionId ? Number(b.missionId) : undefined,
      missionRef: b.missionRef ? String(b.missionRef) : undefined,
      chantier: b.chantier ? String(b.chantier) : undefined,
      client: b.client ? String(b.client) : undefined,
      statut: b.statut || 'EN_SERVICE',
      source: b.source || 'GPS_MOBILE',
    };

    const updatedMap = await saveTechnicienGpsPosition(companyId, payload);
    const acc = await loadAccess(req);
    res.json({
      data: payload,
      positions_gps_techniciens: acc.canSeeTeam ? updatedMap : ownGpsOnly(updatedMap, acc.boundTech),
      message: `Position GPS de ${technicien} transmise au bureau`,
    });
  })
);
