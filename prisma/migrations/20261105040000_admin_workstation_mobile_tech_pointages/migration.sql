ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "technicienNom" TEXT,
  ADD COLUMN IF NOT EXISTS "permissionsJson" TEXT,
  ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

UPDATE "users"
SET "role" = 'ADMIN'
WHERE "email" = 'louzza.zehair@gmail.com' OR "id" = 1;

ALTER TABLE "interventions"
  ADD COLUMN IF NOT EXISTS "heureDebutReelle" TEXT,
  ADD COLUMN IF NOT EXISTS "heureFinReelle" TEXT,
  ADD COLUMN IF NOT EXISTS "actionsRealiseesJson" TEXT,
  ADD COLUMN IF NOT EXISTS "photosJson" TEXT,
  ADD COLUMN IF NOT EXISTS "elementsChiffrage" TEXT,
  ADD COLUMN IF NOT EXISTS "rapportFinal" TEXT,
  ADD COLUMN IF NOT EXISTS "statutRapport" TEXT;

CREATE TABLE IF NOT EXISTS "pointages_techniciens" (
  "id" SERIAL NOT NULL,
  "technicien" TEXT NOT NULL,
  "userId" INTEGER,
  "dateJour" TEXT NOT NULL,
  "heureArriveeBureau" TEXT,
  "timestampArrivee" TIMESTAMP(3),
  "heureFinJournee" TEXT,
  "timestampFin" TIMESTAMP(3),
  "statutJournee" TEXT NOT NULL DEFAULT 'EN_SERVICE',
  "derniereInterventionRef" TEXT,
  "commentaireJournee" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pointages_techniciens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pointages_techniciens_technicien_datejour_key"
  ON "pointages_techniciens"("technicien", "dateJour");

ALTER TABLE "pointages_techniciens" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "pointages_techniciens" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE "pointages_techniciens_id_seq" FROM PUBLIC, anon, authenticated;
