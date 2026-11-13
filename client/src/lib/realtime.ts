// Temps réel : ce qu'un intervenant change apparaît chez les autres sans recharger.
//
// Le serveur émettait déjà les événements (devis:*, intervention:*) dans les salles de la
// société, mais aucun client ne s'y connectait : les écrans restaient figés jusqu'à cinq
// minutes. Ce module ouvre la connexion (authentifiée par le cookie de session) et, à
// chaque événement, invalide les listes concernées — React Query recharge alors ce qui
// est affiché, et seulement ça.
import { io, type Socket } from 'socket.io-client';
import type { QueryClient } from '@tanstack/react-query';

let socket: Socket | null = null;

const INVALIDATIONS: Record<string, string[]> = {
  // Un devis touche aussi les dossiers affichés côté interventions et demandes
  'devis:created': ['devis', 'demandes'],
  'devis:updated': ['devis', 'interventions', 'demandes'],
  'devis:deleted': ['devis', 'interventions', 'demandes'],
  'intervention:created': ['interventions', 'devis', 'demandes'],
  'intervention:updated': ['interventions', 'devis', 'demandes'],
  'intervention:deleted': ['interventions', 'devis', 'demandes'],
  // Notification personnelle : la cloche se recharge, et les missions (l'affectation vient peut-être d'arriver)
  'notification:new': ['notifications', 'interventions'],
};

export function demarrerTempsReel(queryClient: QueryClient): void {
  if (socket) return; // une seule connexion par onglet
  socket = io({ withCredentials: true, reconnectionDelayMax: 30000 });

  for (const [evenement, cles] of Object.entries(INVALIDATIONS)) {
    socket.on(evenement, () => {
      cles.forEach((cle) => queryClient.invalidateQueries({ queryKey: [cle] }));
    });
  }

  // Sans session valable, on n'insiste pas : le rafraîchissement au focus prend le relais
  socket.on('connect_error', () => {
    /* silencieux : la connexion retente d'elle-même, bornée à 30 s */
  });
}

export function arreterTempsReel(): void {
  socket?.disconnect();
  socket = null;
}
