import type { QueryClient } from '@tanstack/react-query';

export type RealtimeResource = 'devis' | 'interventions';
type Subscribe = (event: string, callback: (payload?: unknown) => void) => () => void;

export function subscribeToRealtimeInvalidation(
 on: Subscribe,
 client: Pick<QueryClient, 'invalidateQueries'>,
 resource: RealtimeResource,
 onError: () => void = () => console.error('Actualisation temps réel non terminée ; les requêtes restent à recharger'),
) {
 const refresh = (refreshLinkedQuotes = false) => {
  // The API is the source of truth. Never assume a cached array/envelope shape.
  const requests = [
   client.invalidateQueries({ queryKey: [resource, 'list'] }),
   client.invalidateQueries({ queryKey: [resource, 'stats'] }),
  ];
  if (refreshLinkedQuotes) requests.push(client.invalidateQueries({ queryKey: ['devis', 'list'] }));
  void Promise.all(requests).catch(onError);
 };
 const prefix = resource === 'devis' ? 'devis' : 'intervention';
 const unsubscribe = ['created', 'updated', 'deleted'].map(action => on(`${prefix}:${action}`, () => refresh(resource === 'interventions')));
 // Each resource resynchronizes on reconnect; the devis subscriber refreshes its own badge data.
 unsubscribe.push(on('connect', () => refresh()));
 return () => { unsubscribe.forEach(off => off()); };
}
