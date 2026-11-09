-- Table « demandes » : la demande reçue du donneur d'ordre, avant qu'elle devienne devis ou intervention.
--
-- Pourquoi une table à part : sans elle, une intervention directe obligerait à créer un devis
-- fantôme pour porter le numéro de DI, ce qui polluerait la comptabilité.
--
-- Le numéro de DI est émis par le donneur d'ordre : il n'est unique que chez lui, donc la clé de
-- suivi est le couple (client + numeroDI). Les particuliers (B2C) n'ont pas de DI et sont suivis
-- par une référence interne.

CREATE TABLE IF NOT EXISTS "demandes" (
  "id"                SERIAL       PRIMARY KEY,
  "typeDemandeur"     TEXT         NOT NULL DEFAULT 'DONNEUR_ORDRE',
  "client"            TEXT         NOT NULL,
  "numeroDI"          TEXT,
  "referenceInterne"  TEXT,
  "site"              TEXT,
  "objet"             TEXT,
  "corpsEtat"         TEXT,
  "priorite"          TEXT         NOT NULL DEFAULT 'Normale',
  "canalReception"    TEXT,
  "dateReception"     DATE         NOT NULL,
  "echeanceSouhaitee" DATE,
  "notes"             TEXT,
  "statut"            TEXT         NOT NULL DEFAULT 'A_DECIDER',
  "decision"          TEXT,
  "decidedAt"         TIMESTAMPTZ,
  "devisId"           INTEGER,
  "interventionId"    INTEGER,
  "historiqueJson"    TEXT,
  "userId"            INTEGER      NOT NULL,
  "companyId"         INTEGER,
  "createdAt"         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Clés étrangères : une demande survit à la suppression du devis ou de l'intervention qu'elle a produits
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'demandes_userId_fkey') THEN
    ALTER TABLE "demandes" ADD CONSTRAINT "demandes_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'demandes_companyId_fkey') THEN
    ALTER TABLE "demandes" ADD CONSTRAINT "demandes_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'demandes_devisId_fkey') THEN
    ALTER TABLE "demandes" ADD CONSTRAINT "demandes_devisId_fkey"
      FOREIGN KEY ("devisId") REFERENCES "devis"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'demandes_interventionId_fkey') THEN
    ALTER TABLE "demandes" ADD CONSTRAINT "demandes_interventionId_fkey"
      FOREIGN KEY ("interventionId") REFERENCES "interventions"("id") ON DELETE SET NULL;
  END IF;
  -- Un donneur d'ordre fournit toujours un numéro de DI ; un particulier n'en a pas
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'demandes_di_requis_en_b2b') THEN
    ALTER TABLE "demandes" ADD CONSTRAINT "demandes_di_requis_en_b2b"
      CHECK ("typeDemandeur" = 'PARTICULIER' OR "numeroDI" IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'demandes_statut_connu') THEN
    ALTER TABLE "demandes" ADD CONSTRAINT "demandes_statut_connu"
      CHECK ("statut" IN ('A_DECIDER', 'ORIENTEE', 'ANNULEE'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'demandes_type_connu') THEN
    ALTER TABLE "demandes" ADD CONSTRAINT "demandes_type_connu"
      CHECK ("typeDemandeur" IN ('DONNEUR_ORDRE', 'ENTREPRISE', 'PARTICULIER', 'SOUS_TRAITANT'));
  END IF;
END $$;

-- La file d'attente de l'écran « Demandes reçues » : société puis statut, date en dernier
CREATE INDEX IF NOT EXISTS "demandes_companyid_statut_date_idx"
  ON "demandes" ("companyId", "statut", "dateReception");
-- Recherche du dossier par sa clé réelle (client + DI)
CREATE INDEX IF NOT EXISTS "demandes_companyid_client_di_idx"
  ON "demandes" ("companyId", "client", "numeroDI");
-- Index des clés étrangères (JOIN et cascades)
CREATE INDEX IF NOT EXISTS "demandes_userid_idx" ON "demandes" ("userId");
CREATE INDEX IF NOT EXISTS "demandes_devisid_idx" ON "demandes" ("devisId");
CREATE INDEX IF NOT EXISTS "demandes_interventionid_idx" ON "demandes" ("interventionId");

-- Même verrouillage que les autres tables : RLS actif sans policy, l'application passe par
-- la connexion privilégiée de Prisma ; anon et authenticated ne reçoivent aucun droit.
ALTER TABLE "demandes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "demandes" FROM anon, authenticated;
