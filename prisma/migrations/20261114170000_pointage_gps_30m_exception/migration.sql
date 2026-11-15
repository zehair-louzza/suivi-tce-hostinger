-- Géolocalisation du pointage matin (périmètre 30 m autour du siège) + dérogations habilitées

ALTER TABLE "pointages_techniciens"
  ADD COLUMN IF NOT EXISTS "latitudeArrivee" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "longitudeArrivee" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "precisionGpsArrivee" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "distanceBureauMetres" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "derogationHorsBureau" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "derogationAccordeePar" TEXT;

CREATE TABLE IF NOT EXISTS "pointages_derogations" (
  "id" SERIAL NOT NULL,
  "companyId" INTEGER NOT NULL,
  "technicien" TEXT NOT NULL,
  "dateJour" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "motif" TEXT,
  "accordeePar" TEXT NOT NULL,
  "accordeeParUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pointages_derogations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pointages_derogations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "pointages_derogations_tech_date_company_key"
  ON "pointages_derogations"("technicien", "dateJour", "companyId");

CREATE INDEX IF NOT EXISTS "pointages_derogations_companyid_idx"
  ON "pointages_derogations"("companyId");

ALTER TABLE "pointages_derogations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "pointages_derogations" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE "pointages_derogations_id_seq" FROM PUBLIC, anon, authenticated;
