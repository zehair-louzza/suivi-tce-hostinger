-- Automatisation A : réponse du technicien à son affectation, notifications, réglages par société.
-- Migration additive (colonnes nullables ou avec défaut) : aucune donnée existante n'est modifiée.

ALTER TABLE "interventions" ADD COLUMN IF NOT EXISTS "reponseTechnicien" TEXT;
ALTER TABLE "interventions" ADD COLUMN IF NOT EXISTS "reponseLe" TIMESTAMP(3);
ALTER TABLE "interventions" ADD COLUMN IF NOT EXISTS "motifRefus" TEXT;
ALTER TABLE "interventions" ADD COLUMN IF NOT EXISTS "affecteLe" TIMESTAMP(3);
ALTER TABLE "interventions" ADD COLUMN IF NOT EXISTS "relanceTechnicienLe" TIMESTAMP(3);
ALTER TABLE "interventions" ADD COLUMN IF NOT EXISTS "alertePlanificateurLe" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "interventions_companyid_reponse_idx" ON "interventions"("companyId", "reponseTechnicien");

ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "autoTechnicienActif" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "autoTechnicienDelaiMinutes" INTEGER NOT NULL DEFAULT 120;

CREATE TABLE IF NOT EXISTS "notifications" (
  "id"             SERIAL PRIMARY KEY,
  "companyId"      INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "userId"         INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type"           TEXT NOT NULL,
  "titre"          TEXT NOT NULL,
  "message"        TEXT,
  "interventionId" INTEGER,
  "lu"             BOOLEAN NOT NULL DEFAULT false,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "notifications_user_lu_idx" ON "notifications"("userId", "lu", "createdAt");
CREATE INDEX IF NOT EXISTS "notifications_companyid_idx" ON "notifications"("companyId");
-- Les accès passent uniquement par le serveur (service role) : RLS activée, aucune policy publique.
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
