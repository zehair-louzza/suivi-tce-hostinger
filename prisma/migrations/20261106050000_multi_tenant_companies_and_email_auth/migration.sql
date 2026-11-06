-- CreateTable
CREATE TABLE IF NOT EXISTS "companies" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "siret" TEXT,
  "siren" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- Insertion de l'entreprise par défaut
INSERT INTO "companies" ("id", "name", "siret", "siren", "active")
VALUES (1, 'ANELEC GROUPE', '933 108 607 00021', '933 108 607', true)
ON CONFLICT ("id") DO NOTHING;

-- Réajustement de la séquence
SELECT setval(pg_get_serial_sequence('"companies"', 'id'), GREATEST(1, COALESCE((SELECT MAX("id") FROM "companies"), 1)));

-- AlterTable users
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "emailConfirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "confirmationToken" TEXT,
  ADD COLUMN IF NOT EXISTS "confirmationSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "termsAcceptedIp" TEXT,
  ADD COLUMN IF NOT EXISTS "companyId" INTEGER;

-- Rétrocompatibilité : l'admin historique ID 1 a son email certifié
UPDATE "users"
SET "emailConfirmed" = true, "active" = true, "companyId" = 1
WHERE "id" = 1;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_companyId_fkey'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "users_companyid_idx" ON "users"("companyId");

-- AlterTable devis
ALTER TABLE "devis"
  ADD COLUMN IF NOT EXISTS "companyId" INTEGER;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'devis_companyId_fkey'
  ) THEN
    ALTER TABLE "devis" ADD CONSTRAINT "devis_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "devis_companyid_idx" ON "devis"("companyId");

-- AlterTable interventions
ALTER TABLE "interventions"
  ADD COLUMN IF NOT EXISTS "companyId" INTEGER;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'interventions_companyId_fkey'
  ) THEN
    ALTER TABLE "interventions" ADD CONSTRAINT "interventions_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "interventions_companyid_idx" ON "interventions"("companyId");

-- AlterTable referentiels
ALTER TABLE "referentiels"
  ADD COLUMN IF NOT EXISTS "companyId" INTEGER;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referentiels_companyId_fkey'
  ) THEN
    ALTER TABLE "referentiels" ADD CONSTRAINT "referentiels_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DROP INDEX IF EXISTS "referentiels_categorie_key";

CREATE UNIQUE INDEX IF NOT EXISTS "referentiels_categorie_companyid_key"
  ON "referentiels"("categorie", "companyId");

-- AlterTable pointages_techniciens
ALTER TABLE "pointages_techniciens"
  ADD COLUMN IF NOT EXISTS "companyId" INTEGER;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pointages_techniciens_companyId_fkey'
  ) THEN
    ALTER TABLE "pointages_techniciens" ADD CONSTRAINT "pointages_techniciens_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DROP INDEX IF EXISTS "pointages_techniciens_technicien_datejour_key";

CREATE UNIQUE INDEX IF NOT EXISTS "pointages_techniciens_technicien_datejour_company_key"
  ON "pointages_techniciens"("technicien", "dateJour", "companyId");

CREATE INDEX IF NOT EXISTS "pointages_techniciens_companyid_idx"
  ON "pointages_techniciens"("companyId");

-- Sécurité Row Level Security pour PostgreSQL / Supabase
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "companies" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE "companies_id_seq" FROM PUBLIC, anon, authenticated;
