// Contrôle serveur de la robustesse des mots de passe (règles : shared/passwordPolicy.ts).
import { AppError } from '../middleware/errorHandler.js';
import { validatePassword, passwordErrorMessage, type PasswordContext } from '../../shared/passwordPolicy.js';

/** Refuse (400) tout mot de passe qui ne respecte pas la politique. Toujours appelé avant le hachage. */
export function assertStrongPassword(password: unknown, ctx: PasswordContext = {}): string {
  const problems = validatePassword(password, ctx);
  if (problems.length > 0) {
    throw new AppError(400, passwordErrorMessage(problems), 'WEAK_PASSWORD');
  }
  return password as string;
}
