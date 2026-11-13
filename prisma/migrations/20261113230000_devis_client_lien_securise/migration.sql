-- Automatisation B : devis client par lien sécurisé, PDF importé, relances J+3 / J+7, expiration à 30 jours.
-- Migration additive : aucune donnée existante n'est modifiée.

ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "envoiClientLe" TIMESTAMP(3);
ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "relanceClientJ3Le" TIMESTAMP(3);
ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "relanceClientJ7Le" TIMESTAMP(3);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "autoDevisActif" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "devisId" INTEGER;

CREATE TABLE IF NOT EXISTS "devis_documents" (
  "id"         SERIAL PRIMARY KEY,
  "companyId"  INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "devisId"    INTEGER NOT NULL REFERENCES "devis"("id") ON DELETE CASCADE,
  "nomFichier" TEXT NOT NULL,
  "taille"     INTEGER NOT NULL,
  "sha256"     TEXT NOT NULL,
  "contenu"    BYTEA NOT NULL,
  "deposePar"  TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "devis_documents_devisid_idx" ON "devis_documents"("devisId");
CREATE INDEX IF NOT EXISTS "devis_documents_companyid_idx" ON "devis_documents"("companyId");

CREATE TABLE IF NOT EXISTS "devis_liens_client" (
  "id"             SERIAL PRIMARY KEY,
  "companyId"      INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "devisId"        INTEGER NOT NULL REFERENCES "devis"("id") ON DELETE CASCADE,
  "documentId"     INTEGER,
  "sel"            TEXT NOT NULL,
  "destinataires"  TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS "devis_liens_client_devisid_idx" ON "devis_liens_client"("devisId");
CREATE INDEX IF NOT EXISTS "devis_liens_client_companyid_idx" ON "devis_liens_client"("companyId");

-- Les accès passent uniquement par le serveur : RLS activée, aucune policy publique.
ALTER TABLE "devis_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "devis_liens_client" ENABLE ROW LEVEL SECURITY;
