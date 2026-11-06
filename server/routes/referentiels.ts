// Referentiels routes - Administration des listes de choix ANELEC, Compétences Techniciens & Équipes Journalières
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  ClientProfile,
  DEFAULT_REFERENTIELS,
  DEFAULT_TECHNICIEN_COMPETENCES,
  EquipeJournaliere,
  ReferentielsMap,
} from '../../shared/types.js';

export const referentielsRouter = Router();

// GET /api/referentiels - Retourne toutes les listes de choix métier ANELEC + compétences + équipes journalières
referentielsRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const companyId = req.user?.companyId || 1;
    const rows = await prisma.referentiel.findMany({
      where: {
        OR: [{ companyId }, { companyId: null }],
      },
      orderBy: { id: 'asc' },
    });

    const result: ReferentielsMap = {
      clients: [...DEFAULT_REFERENTIELS.clients],
      clients_fiches: [...(DEFAULT_REFERENTIELS.clients_fiches || [])],
      corps_etat: [...DEFAULT_REFERENTIELS.corps_etat],
      origines: [...DEFAULT_REFERENTIELS.origines],
      responsables: [...DEFAULT_REFERENTIELS.responsables],
      techniciens: [...DEFAULT_REFERENTIELS.techniciens],
      motifs_blocage: [...DEFAULT_REFERENTIELS.motifs_blocage],
      resultats_techniques: [...DEFAULT_REFERENTIELS.resultats_techniques],
      technicien_competences: { ...DEFAULT_TECHNICIEN_COMPETENCES },
      equipes_journalieres: [],
    };

    for (const r of rows) {
      const rawCat = r.categorie === 'corpsEtat' ? 'corps_etat' : r.categorie;
      const key = rawCat as keyof ReferentielsMap;
      if (key === 'technicien_competences') {
        try {
          const parsed = JSON.parse(r.valeurs);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            result.technicien_competences = {
              ...DEFAULT_TECHNICIEN_COMPETENCES,
              ...parsed,
            };
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
        compMap[tech] = DEFAULT_TECHNICIEN_COMPETENCES[tech] || ['Électricité'];
      }
    }
    result.technicien_competences = compMap;

    res.json({ data: result });
  })
);

// PUT /api/referentiels/:categorie - Met à jour une liste de choix, la matrice technicien_competences ou equipes_journalieres
referentielsRouter.put(
  '/:categorie',
  asyncHandler(async (req: Request, res: Response) => {
    const rawCat = req.params.categorie === 'corpsEtat' ? 'corps_etat' : req.params.categorie;
    const categorie = rawCat as keyof ReferentielsMap;
    const companyId = req.user?.companyId || 1;

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
          OR: [{ companyId }, { companyId: null }],
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
          OR: [{ companyId }, { companyId: null }],
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
          OR: [{ companyId }, { companyId: null }],
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
          where: { categorie: 'clients', OR: [{ companyId }, { companyId: null }] },
        });
        const currentList: string[] = existingClientsRow
          ? JSON.parse(existingClientsRow.valeurs)
          : [...DEFAULT_REFERENTIELS.clients];
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
        OR: [{ companyId }, { companyId: null }],
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
