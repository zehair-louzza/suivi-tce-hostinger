-- Automatisation C : rapport d'intervention client par lien sécurisé (validation ou réserves, jamais de validation tacite).
-- Migration additive et idempotente : aucune donnée existante n'est modifiée.

ALTER TABLE "interventions" ADD COLUMN IF NOT EXISTS "envoiClientLe" TIMESTAMP(3);
ALTER TABLE "interventions" ADD COLUMN IF NOT EXISTS "relanceClientJ3Le" TIMESTAMP(3);
ALTER TABLE "interventions" ADD COLUMN IF NOT EXISTS "relanceClientJ7Le" TIMESTAMP(3);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "autoRapportActif" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "rapport_documents" (
  "id"             SERIAL PRIMARY KEY,
  "companyId"      INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "interventionId" INTEGER NOT NULL REFERENCES "interventions"("id") ON DELETE CASCADE,
  "nomFichier"     TEXT NOT NULL,
  "taille"         INTEGER NOT NULL,
  "sha256"         TEXT NOT NULL,
  "contenu"        BYTEA NOT NULL,
  "origine"        TEXT NOT NULL DEFAULT 'DEPOSE',
  "deposePar"      TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "rapport_documents_interventionid_idx" ON "rapport_documents"("interventionId");
CREATE INDEX IF NOT EXISTS "rapport_documents_companyid_idx" ON "rapport_documents"("companyId");

CREATE TABLE IF NOT EXISTS "rapport_liens_client" (
  "id"             SERIAL PRIMARY KEY,
  "companyId"      INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "interventionId" INTEGER NOT NULL REFERENCES "interventions"("id") ON DELETE CASCADE,
  "documentId"     INTEGER,
  "sel"            TEXT NOT NULL,
  "destinataires"  TEXT NOT NULL,
  "contenuJson"    TEXT NOT NULL,
  "expireLe"       TIMESTAMP(3) NOT NULL,
  "reponse"        TEXT,
  "motif"          TEXT,
  "repondantNom"   TEXT,
  "reponduLe"      TIMESTAMP(3),
  "revoqueLe"      TIMESTAMP(3),
  "revoqueRaison"  TEXT,
  "creePar"        TEXT,
  "dernierAccesLe" TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "rapport_liens_client_interventionid_idx" ON "rapport_liens_client"("interventionId");
CREATE INDEX IF NOT EXISTS "rapport_liens_client_companyid_idx" ON "rapport_liens_client"("companyId");

-- Les accès passent uniquement par le serveur : RLS activée, aucune policy publique.
ALTER TABLE "rapport_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rapport_liens_client" ENABLE ROW LEVEL SECURITY;
