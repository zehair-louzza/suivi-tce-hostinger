-- Add 6-digit confirmation code columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS "confirmationCode" VARCHAR(6);
ALTER TABLE users ADD COLUMN IF NOT EXISTS "confirmationCodeExpires" TIMESTAMP;
