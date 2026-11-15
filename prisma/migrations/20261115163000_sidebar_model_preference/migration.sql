-- Persistence du modèle de menu latéral choisi (6 modèles harmonisés avec les 7 directions artistiques)

ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "defaultSidebarModel" TEXT NOT NULL DEFAULT 'classic';

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "sidebarModelPref" TEXT;
