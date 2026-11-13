-- Un même e-mail peut avoir un compte dans plusieurs entreprises.
-- Le compte est identifié par (e-mail, entreprise) ; l'unicité globale de l'e-mail disparaît.
-- Idempotent : peut être rejoué sans erreur.

DROP INDEX IF EXISTS "users_email_key";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_key";

-- Un seul compte par e-mail dans une même entreprise (insensible à la casse).
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_companyid_key"
  ON "users" (lower("email"), "companyId")
  WHERE "companyId" IS NOT NULL;

-- Comptes sans entreprise (cas résiduel) : un seul par e-mail.
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_sans_entreprise_key"
  ON "users" (lower("email"))
  WHERE "companyId" IS NULL;

-- Recherche par e-mail à la connexion.
CREATE INDEX IF NOT EXISTS "users_email_lower_idx" ON "users" (lower("email"));
