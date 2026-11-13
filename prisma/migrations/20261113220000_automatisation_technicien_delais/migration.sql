-- Délais de l'automatisation technicien : relance à 15 min, alerte 5 min après, heures de bureau réglables.
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "autoTechnicienAlerteMinutes" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "autoTechnicienHeuresBureau" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "companies" ALTER COLUMN "autoTechnicienDelaiMinutes" SET DEFAULT 15;
-- Les sociétés restées sur l'ancienne valeur par défaut (120 min) passent au nouveau délai
UPDATE "companies" SET "autoTechnicienDelaiMinutes" = 15 WHERE "autoTechnicienDelaiMinutes" = 120;
