-- Numéro de DI (demande d'intervention) : clé de suivi d'un dossier, commune au devis et à ses interventions.
ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "numeroDI" TEXT;
ALTER TABLE "interventions" ADD COLUMN IF NOT EXISTS "numeroDI" TEXT;
CREATE INDEX IF NOT EXISTS "devis_companyid_numerodi_idx" ON "devis"("companyId", "numeroDI");
CREATE INDEX IF NOT EXISTS "interventions_companyid_numerodi_idx" ON "interventions"("companyId", "numeroDI");
