// Isolation STRICTE entre entreprises : aucune donnée, aucun événement temps réel ne doit passer d'une
// entreprise à une autre. Pas d'exception (ni super administrateur, ni utilisateur n° 1).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { io as connect, type Socket as ClientSocket } from 'socket.io-client';
import { config } from '../server/config.js';
import { setupSocketHandlers, socketEvents, allowedRoomsFor } from '../server/socket/index.js';
import { requireCompanyId } from '../server/lib/tenant.js';

const token = (userId: number, companyId?: number) =>
  jwt.sign({ userId, email: `u${userId}@test.fr`, role: 'ADMIN', ...(companyId ? { companyId } : {}) }, config.jwtSecret);

const COMPANY_A = 10;
const COMPANY_B = 20;

async function startServer() {
  const server = http.createServer();
  const io = new Server(server, { cors: { origin: '*' } });
  setupSocketHandlers(io);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  const clients: ClientSocket[] = [];
  const open = (jwtToken: string) =>
    new Promise<ClientSocket>((resolve, reject) => {
      const c = connect(`http://localhost:${port}`, { auth: { token: jwtToken }, transports: ['websocket'], reconnection: false });
      clients.push(c);
      c.on('connect', () => resolve(c));
      c.on('connect_error', (e) => reject(e));
    });
  const close = async () => {
    clients.forEach((c) => c.close());
    await io.close();
  };
  return { open, close };
}

/** Lance un serveur de test et le ferme TOUJOURS, même si une assertion échoue. */
async function withServer(run: (ctx: Awaited<ReturnType<typeof startServer>>) => Promise<void>) {
  const ctx = await startServer();
  try {
    await run(ctx);
  } finally {
    await ctx.close();
  }
}

const collect = (c: ClientSocket, events: string[]) => {
  const got: Array<{ event: string; data: unknown }> = [];
  events.forEach((event) => c.on(event, (data) => got.push({ event, data })));
  return got;
};
const settle = () => new Promise((r) => setTimeout(r, 250));
const EVENTS = ['devis:created', 'devis:updated', 'intervention:created', 'intervention:updated', 'technicien:gps_updated'];

test('requireCompanyId : aucun repli sur une entreprise par défaut', () => {
  assert.equal(requireCompanyId(7), 7);
  for (const bad of [undefined, null, 0, -1, 1.5, NaN]) {
    assert.throws(() => requireCompanyId(bad as any), /aucune entreprise/);
  }
});

test('un jeton sans entreprise est refusé par le temps réel (pas de repli sur l\'entreprise 1)', async () => {
  await withServer(async ({ open }) => {
    await assert.rejects(open(token(5)), /company/i);
  });
});

test('les salles autorisées d\'une connexion sont uniquement les siennes', () => {
  assert.deepEqual(allowedRoomsFor({ userId: 3, companyId: COMPANY_A }), ['user:3', `company:${COMPANY_A}`]);
  assert.deepEqual(allowedRoomsFor({ userId: 3 }), ['user:3']);
});

test('une entreprise ne reçoit jamais les événements d\'une autre, même en essayant de rejoindre sa salle', async () => {
  await withServer(async ({ open }) => {
  const a1 = await open(token(1, COMPANY_A));
  const a2 = await open(token(2, COMPANY_A));
  const b1 = await open(token(3, COMPANY_B));
  const gotA2 = collect(a2, EVENTS);
  const gotB1 = collect(b1, EVENTS);

  // B tente d'espionner l'entreprise A : sa salle d'entreprise, et la salle personnelle d'un utilisateur de A
  b1.emit('join:room', `company:${COMPANY_A}`);
  b1.emit('join:room', 'user:1');
  b1.emit('join:room', 'company:1');
  await settle();

  socketEvents.devisCreated(1, COMPANY_A, { id: 100, client: 'Client secret de A' });
  socketEvents.interventionUpdated(1, COMPANY_A, { id: 200 });
  socketEvents.broadcastCompany(COMPANY_A, 'technicien:gps_updated', { lat: 1, lng: 2 });
  await settle();

  assert.equal(gotA2.length, 3, 'un collègue de l\'entreprise A reçoit bien ses 3 événements');
  assert.equal(gotB1.length, 0, 'l\'entreprise B ne reçoit RIEN de l\'entreprise A');
  void a1;
  });
});

test('un événement sans entreprise valide n\'est envoyé à personne (plus de salle « entreprise 1 » par défaut)', async () => {
  await withServer(async ({ open }) => {
  const first = await open(token(1, 1)); // entreprise n° 1 : ne doit rien recevoir d'un événement sans destinataire
  const a1 = await open(token(2, COMPANY_A));
  const gotFirst = collect(first, EVENTS);
  const gotA1 = collect(a1, EVENTS);

  socketEvents.devisCreated(99, undefined as any, { id: 1 });
  socketEvents.interventionCreated(99, 0, { id: 2 });
  socketEvents.broadcastCompany(undefined as any, 'technicien:gps_updated', { lat: 1 });
  await settle();

  assert.equal(gotFirst.length, 0);
  assert.equal(gotA1.length, 0);
  });
});

test('il n\'existe plus de diffusion à toutes les entreprises', () => {
  assert.equal((socketEvents as any).broadcast, undefined);
});

test('le temps réel ne transporte aucune donnée métier : seulement un signal avec l\'identifiant', async () => {
  await withServer(async ({ open }) => {
    const a1 = await open(token(1, COMPANY_A));
    const tech = await open(token(2, COMPANY_A)); // même entreprise : reçoit le signal, mais aucune donnée
    const received: unknown[] = [];
    EVENTS.forEach((e) => tech.on(e, (d) => received.push(d)));
    void a1;

    socketEvents.devisCreated(1, COMPANY_A, { id: 7, client: 'Client secret', amount: 99999, montantHt: 80000 });
    socketEvents.interventionUpdated(1, COMPANY_A, { id: 8, client: 'Autre', amount: 5 });
    socketEvents.broadcastCompany(COMPANY_A, 'technicien:gps_updated', { technicien: 'Sofia', lat: 48.85, lng: 2.35 });
    await settle();

    assert.deepEqual(received, [{ id: 7 }, { id: 8 }, { id: null }]);
    assert.equal(JSON.stringify(received).includes('secret'), false);
    assert.equal(JSON.stringify(received).includes('99999'), false);
    assert.equal(JSON.stringify(received).includes('48.85'), false);
  });
});
