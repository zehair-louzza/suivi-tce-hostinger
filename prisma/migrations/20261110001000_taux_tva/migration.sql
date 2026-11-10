-- Taux de TVA par pièce, choisi à la saisie.
-- NULL = non renseigné : l'affichage retombe sur la présélection métier
-- (autoliquidation 0 % pour un professionnel, 10 % pour un particulier).
ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "tauxTVA" DOUBLE PRECISION;
ALTER TABLE "interventions" ADD COLUMN IF NOT EXISTS "tauxTVA" DOUBLE PRECISION;
