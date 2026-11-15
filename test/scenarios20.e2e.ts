// Suite E2E : 20 scénarios métiers & sécurité distincts pour vérifier les réactions complètes de l'application
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import http from 'node:http';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import express from 'express';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

// ── Env déterministe + mini-serveur SMTP AVANT import des modules serveur ─────
process.env.JWT_SECRET = process.env.JWT_SECRET || 'scenarios20-secret-jwt-key';
process.env.NODE_ENV = 'test';

interface CapturedEmail {
  mailFrom: string;
  rcptTo: string[];
  raw: string;
  subject: string;
  bodyText: string;
}
const sentEmails: CapturedEmail[] = [];

function startMockSmtpServer(): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      let buffer = '';
      let inData = false;
      let dataBuf = '';
      let mailFrom = '';
      const rcptTo: string[] = [];

      socket.write('220 localhost ESMTP MockSMTP\r\n');
      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        while (buffer.length > 0) {
          if (inData) {
            const endIdx = buffer.indexOf('\r\n.\r\n');
            if (endIdx === -1) {
              dataBuf += buffer;
              buffer = '';
              break;
            }
            dataBuf += buffer.slice(0, endIdx);
            buffer = buffer.slice(endIdx + 5);
            inData = false;
            const subjMatch = dataBuf.match(/^Subject:\s*(.+)$/im);
            const rawDecoded = dataBuf
              .replace(/=\r?\n/g, '')
              .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
            sentEmails.push({
              mailFrom,
              rcptTo: [...rcptTo],
              raw: dataBuf,
              subject: subjMatch ? subjMatch[1].trim() : '',
              bodyText: rawDecoded,
            });
            dataBuf = '';
            socket.write('250 2.0.0 OK message queued\r\n');
            continue;
          }
          const nl = buffer.indexOf('\r\n');
          if (nl === -1) break;
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 2);
          const upper = line.toUpperCase();
          if (upper.startsWith('EHLO') || upper.startsWith('HELO')) {
            socket.write('250-localhost\r\n250 OK\r\n');
          } else if (upper.startsWith('MAIL FROM:')) {
            mailFrom = line.slice(10).trim();
            socket.write('250 OK\r\n');
          } else if (upper.startsWith('RCPT TO:')) {
            rcptTo.push(line.slice(8).trim());
            socket.write('250 OK\r\n');
          } else if (upper === 'DATA') {
            inData = true;
            dataBuf = '';
            socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
          } else if (upper === 'QUIT') {
            socket.write('221 Bye\r\n');
            socket.end();
          } else {
            socket.write('250 OK\r\n');
          }
        }
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as net.AddressInfo;
      resolve({
        port: addr.port,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}

const smtpServer = await startMockSmtpServer();
process.env.SMTP_HOST = '127.0.0.1';
process.env.SMTP_PORT = String(smtpServer.port);
process.env.SMTP_SECURE = 'false';
process.env.SMTP_USER = 'noreply@anelec.fr';
process.env.SMTP_PASS = 'mock-smtp-pass';
process.env.SMTP_FROM = 'ANELEC <noreply@anelec.fr>';

// ── Base Prisma en mémoire enrichie (composite keys, createMany, startsWith) ─
function cloneRow<T>(v: T): T {
  return v === undefined ? v : structuredClone(v);
}

function matchScalar(val: any, cond: any): boolean {
  if (cond === undefined) return true;
  if (cond === null) return val === null || val === undefined;
  if (typeof cond !== 'object' || cond instanceof Date || Buffer.isBuffer(cond)) {
    if (val instanceof Date && cond instanceof Date) return val.getTime() === cond.getTime();
    return val === cond;
  }
  const s = val == null ? '' : String(val);
  if ('equals' in cond) {
    if (cond.mode === 'insensitive') return s.toLowerCase() === String(cond.equals ?? '').toLowerCase();
    return val === cond.equals;
  }
  if ('contains' in cond) {
    const needle = String(cond.contains ?? '');
    return cond.mode === 'insensitive' ? s.toLowerCase().includes(needle.toLowerCase()) : s.includes(needle);
  }
  if ('startsWith' in cond) return s.startsWith(String(cond.startsWith ?? ''));
  if ('not' in cond) return !matchScalar(val, cond.not);
  if ('in' in cond && Array.isArray(cond.in)) return cond.in.includes(val);
  if ('gt' in cond && (val == null || new Date(val).getTime() <= new Date(cond.gt).getTime())) return false;
  if ('gte' in cond && (val == null || new Date(val).getTime() < new Date(cond.gte).getTime())) return false;
  if ('lte' in cond && (val == null || new Date(val).getTime() > new Date(cond.lte).getTime())) return false;
  return true;
}

function matchWhere(row: any, where: any): boolean {
  if (!where) return true;
  for (const [k, v] of Object.entries(where)) {
    if (v === undefined) continue;
    if (k === 'OR' && Array.isArray(v)) {
      if (!v.some((sub) => matchWhere(row, sub))) return false;
      continue;
    }
    if (k === 'AND' && Array.isArray(v)) {
      if (!v.every((sub) => matchWhere(row, sub))) return false;
      continue;
    }
    if (k.includes('_') && v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !Buffer.isBuffer(v)) {
      if (!matchWhere(row, v)) return false;
      continue;
    }
    if (!matchScalar(row[k], v)) return false;
  }
  return true;
}

function applySelect(row: any, select?: Record<string, boolean>) {
  if (!row || !select) return row;
  const out: any = {};
  for (const [k, enabled] of Object.entries(select)) {
    if (enabled) out[k] = row[k];
  }
  return out;
}

function applyMutation(existing: any, data: Record<string, any>) {
  const next = { ...existing };
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !Buffer.isBuffer(v) && 'increment' in v) {
      next[k] = Number(next[k] || 0) + Number((v as any).increment || 0);
    } else if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !Buffer.isBuffer(v) && 'connect' in v) {
      next[`${k}Id`] = (v as any).connect.id;
    } else if (v !== undefined) {
      next[k] = cloneRow(v);
    }
  }
  if ('updatedAt' in next || existing.updatedAt !== undefined) next.updatedAt = new Date();
  return next;
}

class LocalTable {
  rows: any[] = [];
  seq = 1;
  private defaults: () => Record<string, any>;

  constructor(defaults: () => Record<string, any> = () => ({})) {
    this.defaults = defaults;
  }

  seed(rows: any[]) {
    for (const r of rows) {
      const id = r.id ?? this.seq++;
      this.seq = Math.max(this.seq, id + 1);
      this.rows.push({
        id,
        createdAt: r.createdAt || new Date(),
        updatedAt: r.updatedAt || new Date(),
        ...cloneRow(r),
      });
    }
  }

  private resolveIncludes(row: any, include?: any, dbRef?: any): any {
    if (!row || !include || !dbRef) return cloneRow(row);
    const copy = cloneRow(row);
    if (include.company && copy.companyId != null) {
      copy.company = cloneRow(dbRef.company.rows.find((c: any) => c.id === copy.companyId) || null);
    }
    if (include.interventions) {
      copy.interventions = dbRef.intervention.rows.filter((i: any) => i.devisId === copy.id).map(cloneRow);
    }
    if (include.user && copy.userId != null) {
      copy.user = cloneRow(dbRef.user.rows.find((u: any) => u.id === copy.userId) || null);
    }
    return copy;
  }

  attachDb(dbRef: any) {
    (this as any)._dbRef = dbRef;
    return this;
  }

  async findMany(args: any = {}) {
    let res = this.rows.filter((r) => matchWhere(r, args.where));
    if (args.orderBy) {
      const orders = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy];
      res = [...res].sort((a, b) => {
        for (const o of orders) {
          const [[field, dir]] = Object.entries(o);
          const av = a[field] ?? '';
          const bv = b[field] ?? '';
          if (av < bv) return dir === 'desc' ? 1 : -1;
          if (av > bv) return dir === 'desc' ? -1 : 1;
        }
        return 0;
      });
    }
    if (typeof args.take === 'number') res = res.slice(0, args.take);
    return res.map((r) => {
      const full = this.resolveIncludes(r, args.include, (this as any)._dbRef);
      return args.select ? applySelect(full, args.select) : full;
    });
  }

  async findFirst(args: any = {}) {
    const list = await this.findMany({ ...args, take: 1 });
    return list[0] || null;
  }

  async findUnique(args: any = {}) {
    return this.findFirst(args);
  }

  async count(args: any = {}) {
    return this.rows.filter((r) => matchWhere(r, args.where)).length;
  }

  async create(args: any) {
    const data = args.data || {};
    const id = data.id ?? this.seq++;
    this.seq = Math.max(this.seq, id + 1);
    const now = new Date();
    const row = applyMutation(
      { id, createdAt: now, updatedAt: now, ...this.defaults() },
      data
    );
    row.id = id;
    this.rows.push(row);
    const full = this.resolveIncludes(row, args.include, (this as any)._dbRef);
    return args.select ? applySelect(full, args.select) : full;
  }

  async createMany(args: any) {
    const list = Array.isArray(args?.data) ? args.data : [];
    for (const d of list) {
      await this.create({ data: d });
    }
    return { count: list.length };
  }

  async update(args: any) {
    const idx = this.rows.findIndex((r) => matchWhere(r, args.where));
    if (idx === -1) throw new Error(`Record not found on update: ${JSON.stringify(args.where)}`);
    this.rows[idx] = applyMutation(this.rows[idx], args.data || {});
    const full = this.resolveIncludes(this.rows[idx], args.include, (this as any)._dbRef);
    return args.select ? applySelect(full, args.select) : full;
  }

  async updateMany(args: any) {
    let count = 0;
    for (let i = 0; i < this.rows.length; i++) {
      if (matchWhere(this.rows[i], args.where)) {
        this.rows[i] = applyMutation(this.rows[i], args.data || {});
        count++;
      }
    }
    return { count };
  }

  async upsert(args: any) {
    const idx = this.rows.findIndex((r) => matchWhere(r, args.where));
    if (idx !== -1) {
      this.rows[idx] = applyMutation(this.rows[idx], args.update || {});
      return cloneRow(this.rows[idx]);
    }
    return this.create({ data: args.create });
  }

  async delete(args: any) {
    const idx = this.rows.findIndex((r) => matchWhere(r, args.where));
    if (idx === -1) throw new Error(`Record not found on delete`);
    const [removed] = this.rows.splice(idx, 1);
    return cloneRow(removed);
  }

  async deleteMany(args: any = {}) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !matchWhere(r, args.where));
    return { count: before - this.rows.length };
  }
}

function createExtendedFakeDb() {
  const db: any = {
    company: new LocalTable(() => ({ active: true, defaultTheme: 'light', allowThemeOverride: true })),
    user: new LocalTable(() => ({ active: true, permissionsJson: null })),
    platformCreator: new LocalTable(),
    demande: new LocalTable(() => ({ statut: 'A_DECIDER' })),
    devis: new LocalTable(() => ({ version: 1, visiteNecessaire: false, dateCreated: new Date() })),
    intervention: new LocalTable(() => ({ version: 1, isVisiteDevis: false })),
    referentiel: new LocalTable(),
    notification: new LocalTable(() => ({ read: false })),
    companyMailSettings: new LocalTable(() => ({ tls: true, port: 465 })),
    emailLog: new LocalTable(),
    companyInvitation: new LocalTable(),
    devisDocument: new LocalTable(),
    devisLienClient: new LocalTable(),
    rapportDocument: new LocalTable(),
    rapportLienClient: new LocalTable(),
    pointageTechnicien: new LocalTable(),
    pointageDerogation: new LocalTable(() => ({ active: true })),
    conversionRequest: new LocalTable(),
    technicienGpsPosition: new LocalTable(),
    async $transaction(fn: any) {
      return typeof fn === 'function' ? fn(db) : Promise.all(fn);
    },
  };
  for (const v of Object.values(db)) {
    if (v instanceof LocalTable) v.attachDb(db);
  }
  return db;
}

const db = createExtendedFakeDb();
(globalThis as any).__FAKE_PRISMA__ = db;

// ── Données initiales multi-tenant ────────────────────────────────────────────
const PW_HASH = bcrypt.hashSync('Solvant@2026!Ok', 4);
const CREATOR_HASH = bcrypt.hashSync('ZehCreator@2026!Ok', 4);

db.company.seed([
  { id: 1, name: 'ANELEC GROUPE', siret: '89012345600011', siren: '890123456', siegeAdresse: '10 Rue du Siège, Paris', siegeLat: 48.8566, siegeLng: 2.3522, active: true },
  { id: 2, name: 'BETA ELEC SAS', siret: '91234567800012', siren: '912345678', active: true },
]);

db.user.seed([
  // ID 99 volontairement != 1 pour vérifier la reconnaissance en dur par email/téléphone
  { id: 99, companyId: 1, email: 'louzza.zehair@gmail.com', phone: '+33628618628', name: 'Zehair Louzza', role: 'ADMIN', active: true, password: CREATOR_HASH },
  { id: 10, companyId: 1, email: 'admin@anelec.fr', name: 'Admin Anelec', role: 'ADMIN', active: true, password: PW_HASH },
  { id: 11, companyId: 1, email: 'charge@anelec.fr', name: 'Chargé Études', role: 'CHIFFRAGE_DEVIS', active: true, password: PW_HASH },
  { id: 12, companyId: 1, email: 'planif@anelec.fr', name: 'Planificateur', role: 'CONDUCTEUR_TRAVAUX', active: true, password: PW_HASH },
  { id: 13, companyId: 1, email: 'tech.karim@anelec.fr', name: 'Karim', technicienNom: 'Karim', role: 'TECHNICIEN', active: true, password: PW_HASH },
  { id: 14, companyId: 1, email: 'redac@anelec.fr', name: 'Rédacteur', role: 'REDACTEUR_RAPPORTS', active: true, password: PW_HASH },
  // Même e-mail dans 2 sociétés pour tester COMPANY_CHOICE_REQUIRED
  { id: 20, companyId: 1, email: 'shared@multi.fr', name: 'Shared S1', role: 'ADMIN', active: true, password: PW_HASH },
  { id: 21, companyId: 2, email: 'shared@multi.fr', name: 'Shared S2', role: 'ADMIN', active: true, password: PW_HASH },
  { id: 22, companyId: 2, email: 'admin@beta.fr', name: 'Admin Beta', role: 'ADMIN', active: true, password: PW_HASH },
]);

db.referentiel.seed([
  { id: 1, companyId: 1, categorie: 'clients', valeurs: JSON.stringify(['Syndic Rivoli']) },
  {
    id: 2,
    companyId: 1,
    categorie: 'clients_fiches',
    valeurs: JSON.stringify([
      {
        nom: 'Syndic Rivoli',
        email: 'client-devis@rivoli.fr',
        emails: ['client-devis@rivoli.fr', 'client-rapport@rivoli.fr'],
        adresse: '12 Rue de Rivoli, Paris',
      },
    ]),
  },
  { id: 3, companyId: 1, categorie: 'techniciens', valeurs: JSON.stringify(['Karim']) },
]);

// ── Imports serveur APRÈS injection de __FAKE_PRISMA__ et SMTP env ───────────
const { setSocketInstance } = await import('../server/socket/index.js');
setSocketInstance({ to: () => ({ emit() {} }), emit() {} } as any);

const { authRouter } = await import('../server/routes/auth.js');
const { authMiddleware } = await import('../server/middleware/auth.js');
const { demandesRouter } = await import('../server/routes/demandes.js');
const { devisRouter } = await import('../server/routes/devis.js');
const { interventionRouter } = await import('../server/routes/interventions.js');
const { adminRouter } = await import('../server/routes/admin.js');
const { devisClientPublicRouter } = await import('../server/routes/devisClientPublic.js');
const { rapportClientPublicRouter } = await import('../server/routes/rapportClientPublic.js');
const { errorHandler } = await import('../server/middleware/errorHandler.js');
const { config } = await import('../server/config.js');

function tokenFor(user: { id: number; email: string; role: string; companyId: number }) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role, companyId: user.companyId },
    config.jwtSecret,
    { expiresIn: '2h' }
  );
}

const tok = {
  creator: tokenFor({ id: 99, email: 'louzza.zehair@gmail.com', role: 'ADMIN', companyId: 1 }),
  admin1: tokenFor({ id: 10, email: 'admin@anelec.fr', role: 'ADMIN', companyId: 1 }),
  chiffrage1: tokenFor({ id: 11, email: 'charge@anelec.fr', role: 'CHIFFRAGE_DEVIS', companyId: 1 }),
  planif1: tokenFor({ id: 12, email: 'planif@anelec.fr', role: 'CONDUCTEUR_TRAVAUX', companyId: 1 }),
  tech1: tokenFor({ id: 13, email: 'tech.karim@anelec.fr', role: 'TECHNICIEN', companyId: 1 }),
  redac1: tokenFor({ id: 14, email: 'redac@anelec.fr', role: 'REDACTEUR_RAPPORTS', companyId: 1 }),
  admin2: tokenFor({ id: 22, email: 'admin@beta.fr', role: 'ADMIN', companyId: 2 }),
};

let server: http.Server;
let baseUrl = '';

async function api(method: string, path: string, token?: string | null, body?: any, headers: Record<string, string> = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/pdf') || contentType.includes('image/')) {
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, headers: res.headers, buffer: buf, json: null as any };
  }
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, headers: res.headers, buffer: null as any, json };
}

async function createMinimalValidPdfBase64(): Promise<{ rawBytes: number; base64: string }> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([400, 300]);
  page.drawText('Devis Test Chiffrage Auto TCE', { x: 40, y: 240 });
  const bytes = await pdf.save();
  return { rawBytes: bytes.length, base64: Buffer.from(bytes).toString('base64') };
}

async function createSamplePngDataUrl(): Promise<{ rawBytes: number; dataUrl: string }> {
  // Image pseudo-aléatoire 800x600 (> 100 Ko PNG) pour déclencher la compression MozJPEG (< 50 Ko vs lossless)
  const raw = Buffer.alloc(800 * 600 * 3);
  let seed = 0x12345678;
  for (let i = 0; i < raw.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    raw[i] = (seed >>> 24) & 0xff;
  }
  const png = await sharp(raw, { raw: { width: 800, height: 600, channels: 3 } }).png({ compressionLevel: 1 }).toBuffer();
  return { rawBytes: png.length, dataUrl: `data:image/png;base64,${png.toString('base64')}` };
}

before(async () => {
  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use('/api/auth', authRouter);
  app.use('/api/demandes', authMiddleware, demandesRouter);
  app.use('/api/devis', authMiddleware, devisRouter);
  app.use('/api/interventions', authMiddleware, interventionRouter);
  app.use('/api/admin', authMiddleware, adminRouter);
  app.use('/api/public/devis', devisClientPublicRouter);
  app.use('/api/public/rapport', rapportClientPublicRouter);
  app.use(errorHandler);

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as net.AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
  if (smtpServer) await smtpServer.close();
});

describe('20 Scénarios E2E — Comportement complet de Suivi TCE', () => {
  it('Scénario 01 — Inscription entreprise : rejet mdp faible, création 201, conflit SIRET 409, activation e-mail', async () => {
    const weak = await api('POST', '/api/auth/register', null, {
      name: 'Faible Test',
      email: 'weak@nouvelle.fr',
      password: '123',
      companyName: 'WEAK ELEC',
      siretOrSiren: '789456100',
    });
    assert.equal(weak.status, 400);

    const created = await api('POST', '/api/auth/register', null, {
      name: 'Directeur Nouvelle',
      email: 'dir@nouvelle.fr',
      password: 'Zeh!Tce94#Chiffrage',
      companyName: 'NOUVELLE ELEC',
      siretOrSiren: '789456123',
    });
    assert.equal(created.status, 201);
    assert.equal(created.json.requiresConfirmation, true);

    const conflict = await api('POST', '/api/auth/register', null, {
      name: 'Copieur',
      email: 'autre@nouvelle.fr',
      password: 'Zeh!Tce94#Chiffrage',
      companyName: 'ANELEC GROUPE',
      siretOrSiren: '890123456',
    });
    assert.equal(conflict.status, 409);

    const userRow = db.user.rows.find((u: any) => u.email === 'dir@nouvelle.fr');
    assert.ok(userRow);
    assert.equal(userRow.active, false);

    const activate = await api('POST', '/api/auth/verify-code', null, {
      email: 'dir@nouvelle.fr',
      code: userRow.confirmationCode,
    });
    assert.equal(activate.status, 200);
    const activatedRow = db.user.rows.find((u: any) => u.email === 'dir@nouvelle.fr');
    assert.equal(activatedRow.active, true);
  });

  it('Scénario 02 — Identité Créateur signée en dur (louzza.zehair@gmail.com / +33628618628) ADMIN même avec id=99 + protection suppression', async () => {
    const me = await api('GET', '/api/auth/me', tok.creator);
    assert.equal(me.status, 200);
    assert.equal(me.json.user.role, 'ADMIN');
    assert.equal(me.json.user.isCreator, true);
    assert.equal(me.json.user.phone, '+33628618628');

    const delCreator = await api('DELETE', '/api/admin/users/99', tok.admin1);
    assert.equal(delCreator.status, 400);
    assert.match(String(delCreator.json.error || delCreator.json.message), /créateur/i);
  });

  it('Scénario 03 — Même e-mail dans 2 sociétés : mauvais mdp (401), choix requis (409 COMPANY_CHOICE_REQUIRED), puis connexion ciblée', async () => {
    const badPw = await api('POST', '/api/auth/login', null, {
      email: 'shared@multi.fr',
      password: 'WrongPassword!123',
    });
    assert.equal(badPw.status, 401);

    const multiChoice = await api('POST', '/api/auth/login', null, {
      email: 'shared@multi.fr',
      password: 'Solvant@2026!Ok',
    });
    assert.equal(multiChoice.status, 409);
    assert.equal(multiChoice.json.code, 'COMPANY_CHOICE_REQUIRED');
    assert.equal(multiChoice.json.details.entreprises.length, 2);

    const picked = await api('POST', '/api/auth/login', null, {
      email: 'shared@multi.fr',
      password: 'Solvant@2026!Ok',
      companyId: 2,
    });
    assert.equal(picked.status, 200);
    assert.equal(picked.json.user.companyId, 2);
    assert.ok(picked.json.accessToken);
  });

  it('Scénario 04 — Mot de passe oublié via SMTP réel : capture lien, rejet jeton expiré (>2h), réinitialisation & reconnexion', async () => {
    const emailsBefore = sentEmails.length;
    const forgot = await api('POST', '/api/auth/forgot-password', null, { email: 'charge@anelec.fr' });
    assert.equal(forgot.status, 200);
    assert.ok(sentEmails.length > emailsBefore, 'Un e-mail a bien été capturé sur le serveur SMTP local');

    const lastMail = sentEmails[sentEmails.length - 1];
    const tokenMatch = lastMail.bodyText.match(/resetToken=([a-f0-9]{64})/i);
    assert.ok(tokenMatch, 'Le lien ?resetToken=<64 hex> est présent dans l’e-mail reçu');
    const realResetToken = tokenMatch[1];

    const targetUser = db.user.rows.find((u: any) => u.email === 'charge@anelec.fr');
    const expiredToken = 'a'.repeat(64);
    targetUser.confirmationToken = expiredToken;
    targetUser.confirmationSentAt = new Date(Date.now() - 3 * 3600_000);
    const expiredRes = await api('POST', '/api/auth/reset-password', null, {
      token: expiredToken,
      password: 'Zeh!Reset94#Nouveau',
    });
    assert.equal(expiredRes.status, 410);

    targetUser.confirmationToken = realResetToken;
    targetUser.confirmationSentAt = new Date();
    const okReset = await api('POST', '/api/auth/reset-password', null, {
      token: realResetToken,
      password: 'Zeh!Reset94#Nouveau',
    });
    assert.equal(okReset.status, 200);

    const loginNew = await api('POST', '/api/auth/login', null, {
      email: 'charge@anelec.fr',
      password: 'Zeh!Reset94#Nouveau',
    });
    assert.equal(loginNew.status, 200);
    assert.ok(loginNew.json.accessToken);
  });

  it('Scénario 05 — Sécurité Google Auth : refus strict des jetons simulés/non signés (401)', async () => {
    const sim = await api('POST', '/api/auth/google', null, {
      credential: 'simulated_google_louzza.zehair@gmail.com',
    });
    assert.equal(sim.status, 401);
  });

  it('Scénario 06 — Demande B2B (DONNEUR_ORDRE) : numeroDI requis (400), puis création & orientation vers DEVIS', async () => {
    const missingDI = await api('POST', '/api/demandes', tok.admin1, {
      typeDemandeur: 'DONNEUR_ORDRE',
      client: 'Syndic Rivoli',
      objet: 'Remise aux normes TGBT',
    });
    assert.equal(missingDI.status, 400);

    const created = await api('POST', '/api/demandes', tok.admin1, {
      typeDemandeur: 'DONNEUR_ORDRE',
      client: 'Syndic Rivoli',
      numeroDI: 'DI-2026-4410',
      site: '12 Rue de Rivoli, Paris',
      objet: 'Remise aux normes TGBT',
    });
    assert.equal(created.status, 201);
    const id = created.json.data.id;

    const orient = await api('POST', `/api/demandes/${id}/orienter`, tok.chiffrage1, {
      decision: 'DEVIS',
    });
    assert.equal(orient.status, 201);
    assert.equal(orient.json.data.statut, 'ORIENTEE');
    assert.ok(orient.json.created.devisId);
  });

  it('Scénario 07 — Demande Particulier : génération auto de referenceInterne & orientation vers INTERVENTION', async () => {
    const created = await api('POST', '/api/demandes', tok.planif1, {
      typeDemandeur: 'PARTICULIER',
      client: 'M. Martin Dupont',
      site: '45 Avenue Victor Hugo',
      objet: 'Coupure différentielle cave',
    });
    assert.equal(created.status, 201);
    assert.match(String(created.json.data.referenceInterne), /^REF-\d{4}-\d{4}$/);

    const orient = await api('POST', `/api/demandes/${created.json.data.id}/orienter`, tok.planif1, {
      decision: 'INTERVENTION',
    });
    assert.equal(orient.status, 201);
    assert.ok(orient.json.created.interventionId);
    assert.equal(orient.json.data.statut, 'ORIENTEE');
  });

  it('Scénario 08 — Automatismes Devis : saisie montant > 0 => À valider en interne, puis Envoyé au client => dateRelance J+3', async () => {
    const draft = await api('POST', '/api/devis', tok.chiffrage1, {
      client: 'Syndic Rivoli',
      objet: 'Éclairage parking LED',
      amount: 0,
    });
    assert.equal(draft.status, 201);
    assert.equal(draft.json.data.statutCommercial, 'À préparer');

    const priced = await api('PATCH', `/api/devis/${draft.json.data.id}`, tok.chiffrage1, {
      amount: 4250,
    });
    assert.equal(priced.status, 200);
    assert.equal(priced.json.data.statutCommercial, 'À valider en interne');

    const sent = await api('PATCH', `/api/devis/${draft.json.data.id}`, tok.chiffrage1, {
      statutCommercial: 'Envoyé au client',
      dateEnvoi: '2026-11-10',
    });
    assert.equal(sent.status, 200);
    assert.equal(sent.json.data.dateRelance, '2026-11-13');
  });

  it('Scénario 09 — Visite Technique Préalable (Usage Interne) + PDF interne + compression MozJPEG', async () => {
    const sample = await createSamplePngDataUrl();
    const d = await api('POST', '/api/devis', tok.chiffrage1, {
      client: 'Syndic Rivoli',
      objet: 'Remplacement colonne montante',
      visiteNecessaire: true,
      visiteTechnicien: 'Karim',
    });
    assert.equal(d.status, 201);
    const devisId = d.json.data.id;

    const patch = await api('PATCH', `/api/devis/${devisId}`, tok.tech1, {
      visiteStatut: 'Terminée',
      visiteRapport: {
        constat: 'Colonne vétuste 63A',
        travauxAChiffrer: 'Création colonne 160A + 4 coffrets',
        materiel: 'Câble U1000 R2V 4x50',
        contraintesAcces: 'Coupure ENEDIS 4h',
      },
      photos: [{ id: 'vp1', url: sample.dataUrl, caption: 'Gaine technique', category: 'CONSTAT' }],
    });
    assert.equal(patch.status, 200);

    const row = db.devis.rows.find((x: any) => x.id === devisId);
    const storedPhotos = JSON.parse(row.visitePhotosJson || '[]');
    assert.equal(storedPhotos.length, 1);
    assert.ok(storedPhotos[0].url.startsWith('data:image/jpeg;base64,'), 'Image convertie en JPEG optimisé');
    assert.ok(Buffer.from(storedPhotos[0].url.split(',')[1], 'base64').length < sample.rawBytes, 'Photo compressée par MozJPEG');

    const pdfRes = await api('POST', `/api/devis/${devisId}/visite-rapport/apercu`, tok.chiffrage1, {});
    assert.equal(pdfRes.status, 200);
    assert.match(String(pdfRes.headers.get('content-disposition')), /visite-technique-/i);
    assert.equal(pdfRes.buffer.subarray(0, 5).toString('utf8'), '%PDF-');
  });

  it('Scénario 10 — Dépôt PDF client : rejet faux PDF (400 INVALID_PDF), acceptation vrai PDF', async () => {
    const d = await api('POST', '/api/devis', tok.chiffrage1, {
      client: 'Syndic Rivoli',
      objet: 'Devis PDF externe',
    });
    const id = d.json.data.id;

    const fakePdf = await api('POST', `/api/devis/${id}/document`, tok.chiffrage1, {
      nomFichier: 'faux.pdf',
      contenuBase64: Buffer.from('pas un pdf du tout').toString('base64'),
    });
    assert.equal(fakePdf.status, 400);
    assert.equal(fakePdf.json.code, 'INVALID_PDF');

    const valid = await createMinimalValidPdfBase64();
    const okPdf = await api('POST', `/api/devis/${id}/document`, tok.chiffrage1, {
      nomFichier: 'devis-officiel.pdf',
      contenuBase64: valid.base64,
    });
    assert.equal(okPdf.status, 201);
    assert.ok(okPdf.json.data.taille > 0);
  });

  it('Scénario 11 — Conversion Devis -> Intervention idempotente : refus devis non accepté, 201 création, 200 rejeu sans doublon, 409 conflit', async () => {
    const devisPending = await db.devis.create({
      data: {
        userId: 10,
        companyId: 1,
        client: 'Syndic Rivoli',
        objet: 'Remplacement interrupteur général',
        statutCommercial: 'ENVOYE',
        amount: 950,
        dateCreated: new Date(),
      },
    });
    const idemKey = 'conv-key-scenario-11';
    const refuse = await api('POST', `/api/devis/${devisPending.id}/convert`, tok.admin1, {
      datePlanifiee: '2026-12-01',
      entreprise: 'Karim',
    }, { 'Idempotency-Key': idemKey });
    assert.equal(refuse.status, 409);

    await db.devis.update({ where: { id: devisPending.id }, data: { statutCommercial: 'ACCEPTE' } });
    const countBefore = db.intervention.rows.length;

    const first = await api('POST', `/api/devis/${devisPending.id}/convert`, tok.admin1, {
      datePlanifiee: '2026-12-01',
      entreprise: 'Karim',
    }, { 'Idempotency-Key': idemKey });
    assert.equal(first.status, 201);
    assert.equal(first.json.replayed, false);
    assert.equal(db.intervention.rows.length, countBefore + 1);

    const replay = await api('POST', `/api/devis/${devisPending.id}/convert`, tok.admin1, {
      datePlanifiee: '2026-12-01',
      entreprise: 'Karim',
    }, { 'Idempotency-Key': idemKey });
    assert.equal(replay.status, 200);
    assert.equal(replay.json.replayed, true);
    assert.equal(replay.json.data.id, first.json.data.id);
    assert.equal(db.intervention.rows.length, countBefore + 1);

    const conflict = await api('POST', `/api/devis/${devisPending.id}/convert`, tok.admin1, {
      datePlanifiee: '2026-12-05',
      entreprise: 'Karim',
    }, { 'Idempotency-Key': idemKey });
    assert.equal(conflict.status, 409);
  });

  it('Scénario 12 — Cycle Technicien Mobile : refus motivé libère la mission & notifie Planificateur ; réaffectation + acceptation passe à Affectée', async () => {
    const intv = await api('POST', '/api/interventions', tok.planif1, {
      client: 'Syndic Rivoli',
      chantier: '22 Bd Haussmann',
      entreprise: 'Karim',
      datePlanifiee: '2026-11-25',
      heureDebut: '09:00',
      heureFin: '11:00',
    });
    assert.equal(intv.status, 201);
    const id = intv.json.data.id;

    const notifsBefore = db.notification.rows.length;
    const refuse = await api('POST', `/api/interventions/${id}/reponse`, tok.tech1, {
      reponse: 'REFUSEE',
      motif: 'Déjà sur un dépannage urgent Hôpital',
    });
    assert.equal(refuse.status, 200);
    assert.equal(refuse.json.data.entreprise, null);
    assert.equal(refuse.json.data.statutOperationnel, 'À planifier');
    assert.ok(db.notification.rows.length > notifsBefore, 'Planificateur notifié du refus');

    const reassign = await api('PATCH', `/api/interventions/${id}`, tok.planif1, {
      entreprise: 'Karim',
      datePlanifiee: '2026-11-26',
    });
    assert.equal(reassign.status, 200);

    const accept = await api('POST', `/api/interventions/${id}/reponse`, tok.tech1, {
      reponse: 'ACCEPTEE',
    });
    assert.equal(accept.status, 200);
    assert.equal(accept.json.data.statutOperationnel, 'Affectée');
    assert.equal(accept.json.data.reponseTechnicien, 'ACCEPTEE');
  });

  it('Scénario 13 — Pointage matin GPS 30m : blocage hors périmètre, dérogation réservée aux personnes habilitées, & horodatage Paris', async () => {
    // 1) Sans coordonnées GPS -> 400 GPS_REQUIRED
    const noGps = await api('POST', '/api/admin/pointages/clock-in', tok.tech1, {
      technicien: 'Autre Tech',
      dateJour: '2020-01-01',
      heureArriveeBureau: '04:00',
    });
    assert.equal(noGps.status, 400);
    assert.equal(noGps.json.code, 'GPS_REQUIRED');

    // 2) Hors périmètre (> 30m du siège, ~120m) sans dérogation -> 403 OUTSIDE_PERIMETER
    const outside = await api('POST', '/api/admin/pointages/clock-in', tok.tech1, {
      latitude: 48.85768,
      longitude: 2.3522,
      accuracy: 10,
    });
    assert.equal(outside.status, 403);
    assert.equal(outside.json.code, 'OUTSIDE_PERIMETER');
    assert.ok(outside.json.details?.distanceMetres > 30);

    // 3) Seule la personne en charge habilitée peut activer la dérogation
    const techDenied = await api('PUT', '/api/admin/pointages/derogations', tok.tech1, {
      technicien: 'Karim',
      active: true,
      motif: 'Auto-autorisation interdite',
    });
    assert.equal(techDenied.status, 403);

    const planifDeniedBeforeGrant = await api('PUT', '/api/admin/pointages/derogations', tok.planif1, {
      technicien: 'Karim',
      active: true,
      motif: 'Avant habilitation',
    });
    assert.equal(planifDeniedBeforeGrant.status, 403);

    // Un technicien (id 13) ne peut JAMAIS recevoir canApproveRemoteClockIn (plafond de rôle)
    const techGrant = await api('PUT', '/api/admin/users/13', tok.admin1, {
      permissions: { canApproveRemoteClockIn: true },
    });
    assert.equal(techGrant.status, 200);
    assert.equal(techGrant.json.data.permissions?.canApproveRemoteClockIn, false);

    // L'Admin accorde le droit canApproveRemoteClockIn au Conducteur de travaux (id 12)
    const grantPerm = await api('PUT', '/api/admin/users/12', tok.admin1, {
      permissions: { canApproveRemoteClockIn: true },
    });
    assert.equal(grantPerm.status, 200);
    assert.equal(grantPerm.json.data.permissions?.canApproveRemoteClockIn, true);

    // Le Conducteur de travaux désormais habilité active l'exception pour Karim
    const enableException = await api('PUT', '/api/admin/pointages/derogations', tok.planif1, {
      technicien: 'Karim',
      active: true,
      motif: 'Départ direct chantier Client Rivoli',
    });
    assert.equal(enableException.status, 200);
    assert.equal(enableException.json.data.active, true);

    // 4) Pointage matin hors bureau désormais autorisé + horodatage Paris imposé
    const clockInRemote = await api('POST', '/api/admin/pointages/clock-in', tok.tech1, {
      technicien: 'Autre Tech',
      dateJour: '2020-01-01',
      heureArriveeBureau: '04:00',
      latitude: 48.85768,
      longitude: 2.3522,
      accuracy: 10,
    });
    assert.equal(clockInRemote.status, 200);
    assert.equal(clockInRemote.json.data.technicien, 'Karim');
    assert.notEqual(clockInRemote.json.data.dateJour, '2020-01-01');
    assert.notEqual(clockInRemote.json.data.heureArriveeBureau, '04:00');
    assert.equal(clockInRemote.json.data.derogationHorsBureau, true);
    assert.ok(clockInRemote.json.data.distanceBureauMetres > 30);

    // 5) Sans exception, un pointage réel dans le périmètre (<= 30m, ~16m) passe directement
    db.pointageTechnicien.rows = [];
    db.pointageDerogation.rows = [];
    const clockInHq = await api('POST', '/api/admin/pointages/clock-in', tok.tech1, {
      latitude: 48.85675,
      longitude: 2.3522,
      accuracy: 8,
    });
    assert.equal(clockInHq.status, 200);
    assert.equal(clockInHq.json.data.derogationHorsBureau, false);
    assert.ok(clockInHq.json.data.distanceBureauMetres <= 30);
  });

  it('Scénario 14 — Terrain Intervention : compression auto photos PNG -> MozJPEG + clôture GPS enregistrée', async () => {
    const sample = await createSamplePngDataUrl();
    const created = await api('POST', '/api/interventions', tok.planif1, {
      client: 'Syndic Rivoli',
      chantier: '8 Rue Lafayette',
      entreprise: 'Karim',
      datePlanifiee: '2026-11-22',
    });
    assert.equal(created.status, 201);
    const id = created.json.data.id;

    const close = await api('PATCH', `/api/interventions/${id}`, tok.tech1, {
      statutOperationnel: 'Terminée - à valider',
      compteRendu: 'Tableau réarmé et vérifié',
      photos: [
        { id: 'p-avant', url: sample.dataUrl, caption: 'Avant intervention', category: 'AVANT' },
        { id: 'p-apres', url: sample.dataUrl, caption: 'Après intervention', category: 'APRES' },
      ],
      gpsCloture: { lat: 48.8738, lng: 2.3321, accuracy: 8 },
    });
    assert.equal(close.status, 200);

    const row = db.intervention.rows.find((x: any) => x.id === id);
    const photos = JSON.parse(row.photosJson || '[]');
    assert.equal(photos.length, 2);
    assert.ok(photos.every((p: any) => String(p.url).startsWith('data:image/jpeg;base64,')));
    assert.ok(JSON.parse(row.historiqueJson || '[]').some((h: any) => h.action === 'CLOTURE_GPS_TERRAIN'));
  });

  it('Scénario 15 — Lien public Devis Client : consultation OK, modification montant révoque le lien, renvoi & acceptation client unique', async () => {
    const d = await api('POST', '/api/devis', tok.chiffrage1, {
      client: 'Syndic Rivoli',
      objet: 'Remise en service VMC',
      amount: 1500,
    });
    const id = d.json.data.id;

    const send1 = await api('POST', `/api/devis/${id}/envoyer-client`, tok.chiffrage1, {
      confirme: true,
      source: 'GENERE',
      emails: ['client-devis@rivoli.fr'],
    });
    assert.equal(send1.status, 200);

    const linkMail1 = sentEmails[sentEmails.length - 1].bodyText;
    const match1 = linkMail1.match(/\/devis-client\/([A-Za-z0-9_.-]+)/);
    assert.ok(match1, 'Jeton public devis présent dans l’e-mail');
    const jeton1 = match1[1];

    const pubGet1 = await api('GET', `/api/public/devis/${jeton1}`);
    assert.equal(pubGet1.status, 200);
    assert.equal(pubGet1.json.data.montantHt, 1500);

    const mod = await api('PATCH', `/api/devis/${id}`, tok.chiffrage1, { amount: 1850 });
    assert.equal(mod.status, 200);

    const revoked = await api('GET', `/api/public/devis/${jeton1}`);
    assert.equal(revoked.status, 404);

    const send2 = await api('POST', `/api/devis/${id}/envoyer-client`, tok.chiffrage1, {
      confirme: true,
      source: 'GENERE',
      emails: ['client-devis@rivoli.fr'],
    });
    assert.equal(send2.status, 200);
    const jeton2 = sentEmails[sentEmails.length - 1].bodyText.match(/\/devis-client\/([A-Za-z0-9_.-]+)/)![1];

    const accept = await api('POST', `/api/public/devis/${jeton2}/reponse`, null, {
      reponse: 'ACCEPTEE',
      nom: 'M. Bernard (Syndic)',
    });
    assert.equal(accept.status, 200);

    const secondTry = await api('POST', `/api/public/devis/${jeton2}/reponse`, null, {
      reponse: 'REFUSEE',
      motif: 'Trop tard',
      nom: 'M. Bernard',
    });
    assert.equal(secondTry.status, 404);
  });

  it('Scénario 16 — Lien public Rapport Client : refus avant Validé & Clôturé, sélection photos cochées, réserves obligatoirement motivées', async () => {
    const sample = await createSamplePngDataUrl();
    const created = await api('POST', '/api/interventions', tok.planif1, {
      client: 'Syndic Rivoli',
      chantier: '18 Place Vendôme',
      entreprise: 'Karim',
      datePlanifiee: '2026-11-24',
    });
    assert.equal(created.status, 201);
    const id = created.json.data.id;

    await api('PATCH', `/api/interventions/${id}`, tok.tech1, {
      statutOperationnel: 'Terminée - à valider',
      compteRendu: 'Intervention terminée',
      photos: [
        { id: 'ph-public', url: sample.dataUrl, caption: 'Tableau propre', category: 'APRES' },
        { id: 'ph-prive', url: sample.dataUrl, caption: 'Code porte local technique', category: 'CONSTAT' },
      ],
    });

    const blockedSend = await api('POST', `/api/interventions/${id}/rapport-envoyer-client`, tok.redac1, {
      confirme: true,
      toutesPhotos: true,
      emails: ['client-rapport@rivoli.fr'],
    });
    assert.equal(blockedSend.status, 409);

    const validate = await api('PATCH', `/api/interventions/${id}`, tok.redac1, {
      statutRapport: 'Validé & Clôturé',
      rapportFinal: 'Installation vérifiée conforme NF C 15-100',
    });
    assert.equal(validate.status, 200);

    const okSend = await api('POST', `/api/interventions/${id}/rapport-envoyer-client`, tok.redac1, {
      confirme: true,
      toutesPhotos: false,
      photoIds: ['ph-public'],
      emails: ['client-rapport@rivoli.fr'],
    });
    assert.equal(okSend.status, 200);

    const jeton = sentEmails[sentEmails.length - 1].bodyText.match(/\/rapport-client\/([A-Za-z0-9_.-]+)/)![1];
    const pub = await api('GET', `/api/public/rapport/${jeton}`);
    assert.equal(pub.status, 200);
    assert.equal(pub.json.data.contenu.photos.length, 1);
    assert.equal(pub.json.data.contenu.photos[0].id, 'ph-public');

    const unsharedPhoto = await api('GET', `/api/public/rapport/${jeton}/photos/ph-prive`);
    assert.equal(unsharedPhoto.status, 404);

    const badReserves = await api('POST', `/api/public/rapport/${jeton}/reponse`, null, {
      reponse: 'RESERVES',
      nom: 'Mme Moreau',
      motif: '',
    });
    assert.equal(badReserves.status, 400);

    const goodReserves = await api('POST', `/api/public/rapport/${jeton}/reponse`, null, {
      reponse: 'RESERVES',
      nom: 'Mme Moreau',
      motif: 'Joint d’étanchéité coffret à resserrer',
    });
    assert.equal(goodReserves.status, 200);
  });

  it('Scénario 17 — Cloisonnement RBAC complet : TECHNICIEN sans montants / interdit facturation ; REDACTEUR bloqué sur demandes & création', async () => {
    const devisTechDenied = await api('POST', '/api/devis', tok.tech1, { client: 'Syndic Rivoli', amount: 500 });
    assert.equal(devisTechDenied.status, 403);

    const intv = await api('POST', '/api/interventions', tok.planif1, {
      client: 'Syndic Rivoli',
      chantier: 'Test RBAC',
      entreprise: 'Karim',
      amount: 1200,
    });
    assert.equal(intv.status, 201);
    const listTech = await api('GET', '/api/interventions', tok.tech1);
    assert.equal(listTech.status, 200);
    const mine = listTech.json.data.find((i: any) => i.id === intv.json.data.id);
    assert.ok(mine);
    assert.equal(mine.amount, undefined);

    const billingDenied = await api('PATCH', `/api/interventions/${intv.json.data.id}`, tok.tech1, {
      statutFacture: 'Facturée',
      numeroFacture: 'FA-999',
    });
    assert.equal(billingDenied.status, 403);

    const redacDemandesDenied = await api('GET', '/api/demandes', tok.redac1);
    assert.equal(redacDemandesDenied.status, 403);

    const redacCreateIntvDenied = await api('POST', '/api/interventions', tok.redac1, { client: 'X', chantier: 'Y' });
    assert.equal(redacCreateIntvDenied.status, 403);
  });

  it('Scénario 18 — Isolation Multi-Tenant stricte : Société 2 bloquée (404) sur demandes, devis & interventions de Société 1', async () => {
    const dev1 = await api('POST', '/api/devis', tok.admin1, { client: 'Confidentiel S1', amount: 9000 });
    const intv1 = await api('POST', '/api/interventions', tok.admin1, { client: 'Confidentiel S1', chantier: 'Secret S1' });
    const dem1 = await api('POST', '/api/demandes', tok.admin1, { typeDemandeur: 'PARTICULIER', client: 'Client S1' });

    const r1 = await api('PATCH', `/api/devis/${dev1.json.data.id}`, tok.admin2, { amount: 1 });
    const r2 = await api('DELETE', `/api/interventions/${intv1.json.data.id}`, tok.admin2);
    const r3 = await api('POST', `/api/demandes/${dem1.json.data.id}/orienter`, tok.admin2, { decision: 'DEVIS' });
    assert.equal(r1.status, 404);
    assert.equal(r2.status, 404);
    assert.equal(r3.status, 404);

    const listS2 = await api('GET', '/api/devis', tok.admin2);
    assert.equal(listS2.status, 200);
    assert.equal(listS2.json.data.some((d: any) => d.id === dev1.json.data.id), false);
  });

  it('Scénario 19 — Sécurité SMTP Admin : blocage SSRF (127.0.0.1, .local), port non autorisé et refus non-admin (403)', async () => {
    const nonAdmin = await api('PUT', '/api/admin/smtp-config', tok.chiffrage1, {
      host: 'smtp.gmail.com', port: 465, user: 'a@b.fr', pass: 'secret123', fromEmail: 'a@b.fr',
    });
    assert.equal(nonAdmin.status, 403);

    const ssrfLoopback = await api('PUT', '/api/admin/smtp-config', tok.admin1, {
      host: '127.0.0.1', port: 587, user: 'a@b.fr', pass: 'secret123', fromEmail: 'a@b.fr',
    });
    assert.equal(ssrfLoopback.status, 400);
    assert.equal(ssrfLoopback.json.code, 'INVALID_SMTP_CONFIG');

    const ssrfLocal = await api('PUT', '/api/admin/smtp-config', tok.admin1, {
      host: 'mail.internal.local', port: 587, user: 'a@b.fr', pass: 'secret123', fromEmail: 'a@b.fr',
    });
    assert.equal(ssrfLocal.status, 400);

    const badPort = await api('PUT', '/api/admin/smtp-config', tok.admin1, {
      host: 'smtp.office365.com', port: 22, user: 'a@b.fr', pass: 'secret123', fromEmail: 'a@b.fr',
    });
    assert.equal(badPort.status, 400);
  });

  it('Scénario 20 — Charge simultanée (Promise.all) : 6 créations concurrentes multi-tenants sans collision d’IDs ni fuite', async () => {
    const calls = [
      api('POST', '/api/interventions', tok.admin1, { client: 'S1-A', chantier: 'C-S1-1' }),
      api('POST', '/api/interventions', tok.admin1, { client: 'S1-B', chantier: 'C-S1-2' }),
      api('POST', '/api/interventions', tok.admin1, { client: 'S1-C', chantier: 'C-S1-3' }),
      api('POST', '/api/interventions', tok.admin2, { client: 'S2-A', chantier: 'C-S2-1' }),
      api('POST', '/api/interventions', tok.admin2, { client: 'S2-B', chantier: 'C-S2-2' }),
      api('POST', '/api/interventions', tok.admin2, { client: 'S2-C', chantier: 'C-S2-3' }),
    ];
    const results = await Promise.all(calls);
    for (const r of results) assert.equal(r.status, 201);

    const ids = new Set(results.map((r) => r.json.data.id));
    assert.equal(ids.size, 6, 'Tous les IDs créés simultanément sont uniques');

    const s2List = await api('GET', '/api/interventions', tok.admin2);
    assert.equal(s2List.status, 200);
    const s2Clients = new Set(s2List.json.data.map((i: any) => i.client));
    assert.equal(s2Clients.has('S2-A'), true);
    assert.equal(s2Clients.has('S1-A'), false);
  });
});
