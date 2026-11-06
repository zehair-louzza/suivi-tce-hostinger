// Referentiels routes - Administration des listes de choix ANELEC, Compétences Techniciens & Équipes Journalières
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  DEFAULT_REFERENTIELS,
  DEFAULT_TECHNICIEN_COMPETENCES,
  EquipeJournaliere,
  ReferentielsMap,
} from '../../shared/types.js';

export const referentielsRouter = Router();

// GET /api/referentiels - Retourne toutes les listes de choix métier ANELEC + compétences + équipes journalières
referentielsRouter.get('/', async (req: Request, res: Response) => {
  const companyId = req.user?.companyId || 1;
  const rows = await prisma.referentiel.findMany({ where: { companyId } });
  const result: ReferentielsMap = {
    clients: [...DEFAULT_REFERENTIELS.clients],
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
    const key = r.categorie as keyof ReferentielsMap;
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

  // S'assurer que tout technicien de la liste possède une entrée dans technicien_competences
  const compMap: Record<string, string[]> = { ...(result.technicien_competences || {}) };
  for (const tech of result.techniciens) {
    if (!Array.isArray(compMap[tech])) {
      compMap[tech] = DEFAULT_TECHNICIEN_COMPETENCES[tech] || ['Électricité'];
    }
  }
  result.technicien_competences = compMap;

  res.json({ data: result });
});

// PUT /api/referentiels/:categorie - Met à jour une liste de choix, la matrice technicien_competences ou equipes_journalieres
referentielsRouter.put('/:categorie', async (req: Request, res: Response) => {
  const categorie = req.params.categorie as keyof ReferentielsMap;
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

    await prisma.referentiel.upsert({
      where: { categorie_companyId: { categorie: 'technicien_competences', companyId } },
      create: {
        categorie: 'technicien_competences',
        valeurs: JSON.stringify(cleanedMap),
        companyId,
      },
      update: {
        valeurs: JSON.stringify(cleanedMap),
      },
    });

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

    await prisma.referentiel.upsert({
      where: { categorie_companyId: { categorie: 'equipes_journalieres', companyId } },
      create: {
        categorie: 'equipes_journalieres',
        valeurs: JSON.stringify(cleanedEquipes),
        companyId,
      },
      update: {
        valeurs: JSON.stringify(cleanedEquipes),
      },
    });

    res.json({
      data: { categorie: 'equipes_journalieres', valeurs: cleanedEquipes },
      message: 'Équipes journalières mises à jour avec succès',
    });
    return;
  }

  const valeurs = Array.isArray(req.body?.valeurs)
    ? req.body.valeurs.map((v: any) => String(v).trim()).filter(Boolean)
    : [];

  await prisma.referentiel.upsert({
    where: { categorie_companyId: { categorie, companyId } },
    create: {
      categorie,
      valeurs: JSON.stringify(valeurs),
      companyId,
    },
    update: {
      valeurs: JSON.stringify(valeurs),
    },
  });

  res.json({
    data: { categorie, valeurs },
    message: 'Référentiel mis à jour avec succès',
  });
});
