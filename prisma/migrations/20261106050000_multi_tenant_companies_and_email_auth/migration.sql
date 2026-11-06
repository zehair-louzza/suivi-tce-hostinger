BEGIN;
SET LOCAL lock_timeout = '5s';

-- 1. Table des entreprises (Cloisonnement Multi-Tenant)
CREATE TABLE IF NOT EXISTS public.companies (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "siret" TEXT,
  "siren" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insertion de l'entreprise par défaut (Tenant Racine ANELEC)
INSERT INTO public.companies ("id", "name", "siret", "siren", "active")
VALUES (1, 'ANELEC GROUPE', '933 108 607 00021', '933 108 607', true)
ON CONFLICT ("id") DO NOTHING;

SELECT setval('public.companies_id_seq', (SELECT GREATEST(1, MAX(id)) FROM public.companies));

-- 2. Colonnes Utilisateurs & Activation par Email
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS "emailConfirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "confirmationToken" TEXT,
  ADD COLUMN IF NOT EXISTS "confirmationSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "termsAcceptedIp" TEXT,
  ADD COLUMN IF NOT EXISTS "companyId" INTEGER REFERENCES public.companies("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE public.users
SET "emailConfirmed" = true, "active" = true, "companyId" = 1
WHERE "id" = 1;

CREATE INDEX IF NOT EXISTS users_companyid_idx ON public.users ("companyId");

-- 3. Devis rattachés à une entreprise
ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS "companyId" INTEGER REFERENCES public.companies("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS devis_companyid_idx ON public.devis ("companyId");

-- 4. Interventions rattachées à une entreprise
ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS "companyId" INTEGER REFERENCES public.companies("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS interventions_companyid_idx ON public.interventions ("companyId");

-- 5. Référentiels spécifiques par entreprise
ALTER TABLE public.referentiels
  ADD COLUMN IF NOT EXISTS "companyId" INTEGER REFERENCES public.companies("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.referentiels
  DROP CONSTRAINT IF EXISTS referentiels_categorie_key;

CREATE UNIQUE INDEX IF NOT EXISTS referentiels_categorie_companyid_key
  ON public.referentiels ("categorie", "companyId");

-- 6. Pointages techniciens spécifiques par entreprise
ALTER TABLE public.pointages_techniciens
  ADD COLUMN IF NOT EXISTS "companyId" INTEGER REFERENCES public.companies("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS pointages_techniciens_technicien_datejour_key;

CREATE UNIQUE INDEX IF NOT EXISTS pointages_techniciens_technicien_datejour_company_key
  ON public.pointages_techniciens ("technicien", "dateJour", "companyId");

CREATE INDEX IF NOT EXISTS pointages_techniciens_companyid_idx
  ON public.pointages_techniciens ("companyId");

-- 7. Sécurité & Droits Supabase
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.companies FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.companies_id_seq FROM PUBLIC, anon, authenticated;

COMMIT;
