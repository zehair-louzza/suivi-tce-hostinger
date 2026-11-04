import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import { subscribeToRealtimeInvalidation } from '../client/src/lib/realtimeInvalidation.js';

function socketFixture() {
 const listeners = new Map<string, Set<(payload?: unknown) => void>>();
 const on = (event: string, callback: (payload?: unknown) => void) => {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(callback);
  return () => { listeners.get(event)?.delete(callback); };
 };
 return { on, emit: (event: string, payload?: unknown) => { listeners.get(event)?.forEach(fn => fn(payload)); } };
}
for (const resource of ['devis', 'interventions'] as const) {
 for (const action of ['created', 'updated', 'deleted']) {
  test(`${resource}:${action} invalide listes/statistiques sans transformer les tableaux`, () => {
   const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
   const socket = socketFixture();
   const key = [resource, 'list'];
   const data = [{ id: 1 }];
   client.setQueryData(key, data);
   client.setQueryData([resource, 'stats'], { traite: 1 });
   client.setQueryData(['unrelated'], ['intact']);
   const off = subscribeToRealtimeInvalidation(socket.on, client, resource);
   const prefix = resource === 'devis' ? 'devis' : 'intervention';
   assert.doesNotThrow(() => socket.emit(`${prefix}:${action}`, { id: 2 }));
   assert.strictEqual(client.getQueryData(key), data);
   assert.equal(client.getQueryState(key)?.isInvalidated, true);
   assert.equal(client.getQueryState([resource, 'stats'])?.isInvalidated, true);
   assert.equal(client.getQueryState(['unrelated'])?.isInvalidated, false);
   off(); client.clear();
  });
 }
}
test('Un cache absent ne déclenche pas data is not iterable', () => {
 const client = new QueryClient(); const socket = socketFixture();
 const off = subscribeToRealtimeInvalidation(socket.on, client, 'interventions');
 assert.doesNotThrow(() => socket.emit('intervention:created', { id: 2 }));
 assert.equal(client.getQueryData(['interventions', 'list']), undefined);
 off(); client.clear();
});
test('Les enveloppes paginées restent intactes et les variantes de liste sont invalidées', () => {
 const client = new QueryClient(); const socket = socketFixture();
 const key = ['devis', 'list', { page: 2, search: 'abc' }];
 const data = { data: [{ id: 7 }], pagination: { total: 40 } };
 client.setQueryData(key, data);
 const off = subscribeToRealtimeInvalidation(socket.on, client, 'devis');
 socket.emit('devis:updated', { id: 7 });
 assert.strictEqual(client.getQueryData(key), data);
 assert.equal(client.getQueryState(key)?.isInvalidated, true);
 off(); client.clear();
});
test('Reconnexion : devis et interventions sont resynchronisés', () => {
 const calls: unknown[] = [];
 const client = { invalidateQueries: (filters: any) => { calls.push(filters.queryKey); return Promise.resolve(); } };
 const socket = socketFixture();
 const a = subscribeToRealtimeInvalidation(socket.on, client, 'devis');
 const b = subscribeToRealtimeInvalidation(socket.on, client, 'interventions');
 socket.emit('connect');
 assert.deepEqual(calls, [['devis','list'],['devis','stats'],['interventions','list'],['interventions','stats']]);
 a(); b();
});
test('Nettoyage : aucun rappel conservé après désabonnement', () => {
 let calls = 0; const client = { invalidateQueries: () => { calls++; return Promise.resolve(); } };
 const socket = socketFixture();
 const off = subscribeToRealtimeInvalidation(socket.on, client, 'devis'); off();
 socket.emit('devis:created'); socket.emit('devis:updated'); socket.emit('devis:deleted'); socket.emit('connect');
 assert.equal(calls, 0);
});
test('Une invalidation rejetée est prise en charge sans promesse non gérée', async () => {
 let errors = 0; const socket = socketFixture();
 const client = { invalidateQueries: () => Promise.reject(new Error('fixture')) };
 const off = subscribeToRealtimeInvalidation(socket.on, client, 'devis', () => { errors++; });
 socket.emit('devis:created');
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(errors, 1); off();
});
