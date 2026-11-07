-- Persistence du thème/apparence (Direction UI/UX)

-- Company : défaut entreprise + autorisation de surcharge par utilisateur
ALTER TABLE "companies"
  ADD COLUMN "defaultTheme" TEXT NOT NULL DEFAULT 'light';

ALTER TABLE "companies"
  ADD COLUMN "allowThemeOverride" BOOLEAN NOT NULL DEFAULT true;

-- User : préférence personnelle (nullable → fallback sur la valeur entreprise)
ALTER TABLE "users"
  ADD COLUMN "themePref" TEXT;
