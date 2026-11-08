-- Invitations par e-mail + boîte d'envoi par entreprise + journal d'e-mails cloisonné.
-- Additive et idempotente : aucune table ni donnée existante n'est modifiée.

CREATE TABLE IF NOT EXISTS "company_invitations" (
  "id"              SERIAL PRIMARY KEY,
  "companyId"       INTEGER NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "email"           TEXT NOT NULL,
  "role"            TEXT NOT NULL DEFAULT 'CONDUCTEUR_TRAVAUX',
  "technicienNom"   TEXT,
  "permissionsJson" TEXT,
  "tokenHash"       TEXT NOT NULL,
  "invitedById"     INTEGER,
  "invitedByName"   TEXT,
  "expiresAt"       TIMESTAMP(3) NOT NULL,
  "lastSentAt"      TIMESTAMP(3),
  "acceptedAt"      TIMESTAMP(3),
  "revokedAt"       TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "company_invitations_tokenHash_key" ON "company_invitations"("tokenHash");
CREATE INDEX IF NOT EXISTS "company_invitations_companyid_idx" ON "company_invitations"("companyId");
-- Une seule invitation en attente par entreprise et par adresse
CREATE UNIQUE INDEX IF NOT EXISTS "company_invitations_pending_email_key"
  ON "company_invitations"("companyId", lower("email"))
  WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL;

CREATE TABLE IF NOT EXISTS "company_mail_settings" (
  "companyId"   INTEGER PRIMARY KEY REFERENCES "companies"("id") ON DELETE CASCADE,
  "smtpHost"    TEXT NOT NULL,
  "smtpPort"    INTEGER NOT NULL DEFAULT 465,
  "smtpSecure"  BOOLEAN NOT NULL DEFAULT true,
  "smtpUser"    TEXT NOT NULL,
  "smtpPassEnc" TEXT,
  "fromName"    TEXT,
  "replyTo"     TEXT,
  "enabled"     BOOLEAN NOT NULL DEFAULT true,
  "lastTestAt"  TIMESTAMP(3),
  "lastTestOk"  BOOLEAN,
  "lastError"   TEXT,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "email_logs" (
  "id"        SERIAL PRIMARY KEY,
  "companyId" INTEGER REFERENCES "companies"("id") ON DELETE CASCADE,
  "type"      TEXT NOT NULL,
  "toEmail"   TEXT NOT NULL,
  "ccEmail"   TEXT,
  "subject"   TEXT NOT NULL,
  "channel"   TEXT NOT NULL,
  "sent"      BOOLEAN NOT NULL,
  "error"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "email_logs_companyid_createdat_idx" ON "email_logs"("companyId", "createdAt");

-- Même modèle que les autres tables : RLS activée sans politique => inaccessible via l'API Data
-- (anon/authenticated). Le serveur applicatif se connecte avec le rôle propriétaire.
ALTER TABLE "company_invitations"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_mail_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_logs"           ENABLE ROW LEVEL SECURITY;
