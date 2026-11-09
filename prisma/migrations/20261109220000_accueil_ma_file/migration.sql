-- Bascule par société : ouvrir le tableau de bord sur « Ma file » (ce que chaque rôle doit faire).
-- Faux par défaut : l'accueil actuel reste inchangé jusqu'à ce que l'administrateur l'active.
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "accueilMaFile" BOOLEAN NOT NULL DEFAULT false;
