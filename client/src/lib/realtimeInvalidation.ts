import type { QueryClient } from '@tanstack/react-query';

export type RealtimeResource = 'devis' | 'interventions';
type Subscribe = (event: string, callback: (payload?: unknown) => void) => () => void;

export function subscribeToRealtimeInvalidation(
 on: Subscribe,
 client: Pick<QueryClient, 'invalidateQueries'>,
 resource: RealtimeResource,
 onError: () => void = () => console.error('Actualisation temps réel non terminée ; les requêtes restent à recharger'),
) {
 const refresh = () => {
  // The API is the source of truth. Never assume a cached array/envelope shape.
  void Promise.all([
   client.invalidateQueries({ queryKey: [resource, 'list'] }),
   client.invalidateQueries({ queryKey: [resource, 'stats'] }),
  ]).catch(onError);
 };
 const prefix = resource === 'devis' ? 'devis' : 'intervention';
 const unsubscribe = ['created', 'updated', 'deleted'].map(action => on(`${prefix}:${action}`, refresh));
 // Socket.IO emits connect after initial connection and each reconnection.
 unsubscribe.push(on('connect', refresh));
 return () => { unsubscribe.forEach(off => off()); };
}
