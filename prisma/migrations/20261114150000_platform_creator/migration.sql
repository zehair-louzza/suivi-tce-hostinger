-- Ajout du téléphone sur les utilisateurs et table dédiée du créateur de la plateforme (signé en dur)
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "phone" TEXT;

CREATE TABLE IF NOT EXISTS "platform_creator" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "company_name" TEXT NOT NULL DEFAULT 'ANELEC GROUPE',
  "role" TEXT NOT NULL DEFAULT 'ADMIN',
  "locked" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_creator_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_creator_email_key" ON "platform_creator"("email");

ALTER TABLE "platform_creator" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "platform_creator" FROM PUBLIC, anon, authenticated;

INSERT INTO "platform_creator" ("id", "email", "phone", "name", "company_name", "role", "locked", "created_at", "updated_at")
VALUES (1, 'louzza.zehair@gmail.com', '+33628618628', 'Zehair Louzza', 'ANELEC GROUPE', 'ADMIN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "email" = EXCLUDED."email",
  "phone" = EXCLUDED."phone",
  "name" = EXCLUDED."name",
  "company_name" = EXCLUDED."company_name",
  "role" = EXCLUDED."role",
  "locked" = true,
  "updated_at" = CURRENT_TIMESTAMP;
