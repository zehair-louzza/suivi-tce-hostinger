BEGIN;

CREATE TABLE "public"."users" (
  "id" SERIAL NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'USER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."devis" (
  "id" SERIAL NOT NULL,
  "client" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "dateCreated" TIMESTAMP(3) NOT NULL,
  "echeance" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'A_TRAITER',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "userId" INTEGER NOT NULL,
  CONSTRAINT "devis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."interventions" (
  "id" SERIAL NOT NULL,
  "chantier" TEXT NOT NULL,
  "entreprise" TEXT,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "datePlanifiee" TIMESTAMP(3) NOT NULL,
  "dateReelle" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'A_TRAITER',
  "notes" TEXT,
  "origineDevisId" INTEGER,
  "origineDevisClient" TEXT,
  "origineDevisDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "userId" INTEGER NOT NULL,
  "devisId" INTEGER,
  CONSTRAINT "interventions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");
CREATE INDEX "devis_userId_idx" ON "public"."devis"("userId");
CREATE INDEX "devis_status_idx" ON "public"."devis"("status");
CREATE INDEX "devis_dateCreated_idx" ON "public"."devis"("dateCreated");
CREATE INDEX "interventions_userId_idx" ON "public"."interventions"("userId");
CREATE INDEX "interventions_status_idx" ON "public"."interventions"("status");
CREATE INDEX "interventions_datePlanifiee_idx" ON "public"."interventions"("datePlanifiee");
CREATE INDEX "interventions_devisId_idx" ON "public"."interventions"("devisId");

ALTER TABLE "public"."devis" ADD CONSTRAINT "devis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."interventions" ADD CONSTRAINT "interventions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."interventions" ADD CONSTRAINT "interventions_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "public"."devis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backend Prisma only: no public Supabase API policies are granted.
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."devis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."interventions" ENABLE ROW LEVEL SECURITY;

COMMIT;
