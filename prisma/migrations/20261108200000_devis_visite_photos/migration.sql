-- Photos prises par le technicien lors d'une visite technique de devis
-- (JSON borné à 10 photos, comme pour les interventions). Colonne nullable : aucune donnée existante touchée.
ALTER TABLE "devis"
  ADD COLUMN IF NOT EXISTS "visitePhotosJson" TEXT;
