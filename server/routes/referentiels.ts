// Referentiels routes - Administration des listes de choix ANELEC (Techniciens, Responsables, Clients, Corps d'état, etc.)
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { DEFAULT_REFERENTIELS, ReferentielsMap } from '../../shared/types.js';

export const referentielsRouter = Router();

// GET /api/referentiels - Retourne toutes les listes de choix métier ANELEC
referentielsRouter.get('/', async (_req: Request, res: Response) => {
  const rows = await prisma.referentiel.findMany();
  const result: ReferentielsMap = {
    clients: [...DEFAULT_REFERENTIELS.clients],
    corps_etat: [...DEFAULT_REFERENTIELS.corps_etat],
    origines: [...DEFAULT_REFERENTIELS.origines],
    responsables: [...DEFAULT_REFERENTIELS.responsables],
    techniciens: [...DEFAULT_REFERENTIELS.techniciens],
    motifs_blocage: [...DEFAULT_REFERENTIELS.motifs_blocage],
    resultats_techniques: [...DEFAULT_REFERENTIELS.resultats_techniques],
  };

  for (const r of rows) {
    const key = r.categorie as keyof ReferentielsMap;
    if (key in result) {
      try {
        const parsed = JSON.parse(r.valeurs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          result[key] = parsed;
        }
      } catch {
        // ignore invalid json
      }
    }
  }

  res.json({ data: result });
});

// PUT /api/referentiels/:categorie - Met à jour une liste de choix
referentielsRouter.put('/:categorie', async (req: Request, res: Response) => {
  const categorie = req.params.categorie as keyof ReferentielsMap;
  const valeurs = Array.isArray(req.body?.valeurs)
    ? req.body.valeurs.map((v: any) => String(v).trim()).filter(Boolean)
    : [];

  await prisma.referentiel.upsert({
    where: { categorie },
    create: {
      categorie,
      valeurs: JSON.stringify(valeurs),
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
