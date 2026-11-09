-- AlterTable
ALTER TABLE "pointages_techniciens" ADD CONSTRAINT "pointages_techniciens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "pointages_techniciens_userid_idx" ON "pointages_techniciens"("userId");

-- AlterTable
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "company_invitations_invitedbyid_idx" ON "company_invitations"("invitedById");
