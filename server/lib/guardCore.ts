// Garde d'accès Express — sans base de données dans ce fichier, pour pouvoir être testé de bout en bout.
import { Router, type Request, type RequestHandler } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import { ACTION_LABELS, can, rolesAllowedFor, type Action } from './policy.js';
import { ROLE_LABELS, type Access } from './access.js';

export type CallerAccess = Access & { companyId: number };
export type AccessLoader = (req: Request) => Promise<CallerAccess>;

declare global {
  namespace Express {
    interface Request {
      /** Accès de l'appelant, calculés une fois par la garde de la route */
      access?: CallerAccess;
    }
  }
}

/** Construit la garde `policy('action')` à partir d'un chargeur d'appelant. */
export function makePolicy(load: AccessLoader) {
  return (action: Action): RequestHandler => {
    const guard: RequestHandler = (req, _res, next) => {
      load(req)
        .then((access) => {
          if (!can(access, action)) {
            const roles = rolesAllowedFor(action, ROLE_LABELS).map((r) => ROLE_LABELS[r]);
            throw new AppError(
              403,
              `Votre profil ne permet pas de ${ACTION_LABELS[action]}. Profils autorisés : ${roles.join(' ; ') || 'la direction'}.`,
              'FORBIDDEN'
            );
          }
          req.access = access;
          next();
        })
        .catch(next);
    };
    (guard as RequestHandler & { __policy?: string }).__policy = action;
    return guard;
  };
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

/**
 * Routeur « refus par défaut » : déclarer une route sans garde `policy(...)` fait échouer le démarrage
 * du serveur. Impossible d'ajouter par oubli une route ouverte à tout membre.
 */
export function secureRouter(name = 'routeur'): Router {
  const router = Router();
  for (const method of METHODS) {
    const original = (router as any)[method].bind(router);
    (router as any)[method] = (path: unknown, ...handlers: unknown[]) => {
      const guarded = handlers.some((h) => typeof h === 'function' && (h as any).__policy);
      if (!guarded) {
        throw new Error(`Route sans règle d'accès (${name}) : ${method.toUpperCase()} ${String(path)} — ajoutez policy('action')`);
      }
      return original(path, ...handlers);
    };
  }
  return router;
}
