-- Ajoute l'adresse du siège à chaque entreprise (point de départ des tournées)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS "siegeAdresse" TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS "siegeLat" DOUBLE PRECISION;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS "siegeLng" DOUBLE PRECISION;
