BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS "refInterventionTexte" TEXT,
  ADD COLUMN IF NOT EXISTS "visiteNecessaire" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "visiteTechnicien" TEXT,
  ADD COLUMN IF NOT EXISTS "visiteDate" DATE,
  ADD COLUMN IF NOT EXISTS "visiteHeureDebut" TEXT,
  ADD COLUMN IF NOT EXISTS "visiteHeureFin" TEXT,
  ADD COLUMN IF NOT EXISTS "visiteStatut" TEXT,
  ADD COLUMN IF NOT EXISTS "historiqueJson" TEXT;

ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS "refDevisTexte" TEXT,
  ADD COLUMN IF NOT EXISTS "modePlanification" TEXT,
  ADD COLUMN IF NOT EXISTS "heureDebut" TEXT,
  ADD COLUMN IF NOT EXISTS "heureFin" TEXT,
  ADD COLUMN IF NOT EXISTS "isVisiteDevis" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "historiqueJson" TEXT;

CREATE TABLE IF NOT EXISTS public.referentiels (
  "id" SERIAL PRIMARY KEY,
  "categorie" TEXT NOT NULL UNIQUE,
  "valeurs" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.referentiels ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.referentiels FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.referentiels_id_seq FROM PUBLIC, anon, authenticated;

COMMIT;
