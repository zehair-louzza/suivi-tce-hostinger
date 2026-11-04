BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.devis
 ADD COLUMN "referenceMetier" TEXT, ADD COLUMN "siteAdresse" TEXT, ADD COLUMN "objet" TEXT, ADD COLUMN "corpsEtat" TEXT, ADD COLUMN "origine" TEXT, ADD COLUMN "dateDemande" DATE, ADD COLUMN "traitement" TEXT, ADD COLUMN "priorite" TEXT, ADD COLUMN "statutCommercial" TEXT, ADD COLUMN "dateLimite" DATE, ADD COLUMN "dateEnvoi" DATE, ADD COLUMN "montantHt" DECIMAL(14,2), ADD COLUMN "validiteJours" INTEGER, ADD COLUMN "prochaineAction" TEXT, ADD COLUMN "dateRelance" DATE, ADD COLUMN "responsable" TEXT, ADD COLUMN "commentaires" TEXT, ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
 ADD CONSTRAINT devis_validite_nonnegative CHECK ("validiteJours" IS NULL OR "validiteJours" >= 0),
 ADD CONSTRAINT devis_montant_ht_nonnegative CHECK ("montantHt" IS NULL OR "montantHt" >= 0);
ALTER TABLE public.interventions
 ADD COLUMN "referenceMetier" TEXT, ADD COLUMN "client" TEXT, ADD COLUMN "siteAdresse" TEXT, ADD COLUMN "objet" TEXT, ADD COLUMN "corpsEtat" TEXT, ADD COLUMN "origine" TEXT, ADD COLUMN "dateDemande" DATE, ADD COLUMN "traitement" TEXT, ADD COLUMN "priorite" TEXT, ADD COLUMN "statutOperationnel" TEXT, ADD COLUMN "typeIntervention" TEXT, ADD COLUMN "technicien" TEXT, ADD COLUMN "dateDebut" DATE, ADD COLUMN "dateFin" DATE, ADD COLUMN "dateEcheance" DATE, ADD COLUMN "resultatTechnique" TEXT, ADD COLUMN "motifBlocage" TEXT, ADD COLUMN "numeroFacture" TEXT, ADD COLUMN "statutFacture" TEXT, ADD COLUMN "compteRendu" TEXT, ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX devis_userId_traitement_idx ON public.devis ("userId", "traitement");
CREATE INDEX devis_userId_statutCommercial_idx ON public.devis ("userId", "statutCommercial");
CREATE INDEX devis_userId_dateRelance_idx ON public.devis ("userId", "dateRelance");
CREATE INDEX interventions_userId_traitement_idx ON public.interventions ("userId", "traitement");
CREATE INDEX interventions_userId_statutOperationnel_idx ON public.interventions ("userId", "statutOperationnel");
CREATE INDEX interventions_userId_dateEcheance_idx ON public.interventions ("userId", "dateEcheance");
CREATE TABLE public.conversion_requests (
 "id" SERIAL PRIMARY KEY,
 "actorId" INTEGER NOT NULL REFERENCES public.users("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "key" VARCHAR(128) NOT NULL,
 "requestHash" VARCHAR(64) NOT NULL,
 "interventionId" INTEGER NOT NULL REFERENCES public.interventions("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "response" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT conversion_requests_hash_format CHECK ("requestHash" ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX conversion_requests_actorId_key_key ON public.conversion_requests ("actorId", "key");
CREATE INDEX conversion_requests_interventionId_idx ON public.conversion_requests ("interventionId");
ALTER TABLE public.conversion_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.conversion_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.conversion_requests_id_seq FROM PUBLIC, anon, authenticated;
COMMIT;
