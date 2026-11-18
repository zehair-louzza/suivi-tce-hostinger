-- Lot P1 : révocation de sessions par version de jeton et anti-brute-force OTP
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "confirmationCodeAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 1;

COMMIT;
