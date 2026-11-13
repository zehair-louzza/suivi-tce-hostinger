// Garde d'accès de production : l'appelant est relu dans la base à chaque requête.
import { makePolicy } from './guardCore.js';
import { loadAccess } from './loadAccess.js';

export { secureRouter } from './guardCore.js';
export const policy = makePolicy(loadAccess);
