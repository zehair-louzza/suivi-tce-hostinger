// Base de données simulée en mémoire, juste assez fidèle à Prisma pour faire tourner les VRAIES routes :
// filtres where (égalité, contains, in, not, gte/lte, OR, AND), tri, pagination, create/update/delete.
type Row = Record<string, any>;

function matchValue(actual: any, cond: any): boolean {
  if (cond === null) return actual == null; // SQL NULL : colonne absente ou nulle
  if (typeof cond !== 'object' || cond instanceof Date) return actual === cond;
  const ci = cond.mode === 'insensitive';
  const norm = (v: any) => (ci && typeof v === 'string' ? v.toLowerCase() : v);
  for (const [op, v] of Object.entries(cond)) {
    if (op === 'mode') continue;
    const a = norm(actual);
    const e = norm(v);
    switch (op) {
      case 'equals': if (a !== e) return false; break;
      case 'contains': if (typeof a !== 'string' || !a.includes(String(e))) return false; break;
      case 'startsWith': if (typeof a !== 'string' || !a.startsWith(String(e))) return false; break;
      case 'is': if (!matches((actual as Row) || {}, v as Row)) return false; break;
      case 'in': if (!(v as any[]).includes(actual)) return false; break;
      case 'notIn': if ((v as any[]).includes(actual)) return false; break;
      case 'not': if (v === null ? actual == null : matchValue(actual, v)) return false; break;
      case 'gte': if (!(a >= (e as any))) return false; break;
      case 'lte': if (!(a <= (e as any))) return false; break;
      case 'gt': if (!(a > (e as any))) return false; break;
      case 'lt': if (!(a < (e as any))) return false; break;
      default: throw new Error(`Filtre Prisma non simulé : ${op}`);
    }
  }
  return true;
}

function matches(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  for (const [k, cond] of Object.entries(where)) {
    if (k === 'OR') { if (!(cond as Row[]).some((w) => matches(row, w))) return false; continue; }
    if (k === 'AND') { if (!(Array.isArray(cond) ? cond : [cond]).every((w: Row) => matches(row, w))) return false; continue; }
    if (k === 'NOT') { if ((Array.isArray(cond) ? cond : [cond]).some((w: Row) => matches(row, w))) return false; continue; }
    if (!matchValue(row[k], cond)) return false;
  }
  return true;
}

function applyData(row: Row, data: Row) {
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && !(v instanceof Date) && 'increment' in v) row[k] = (row[k] || 0) + (v as any).increment;
    else row[k] = v;
  }
  row.updatedAt = new Date();
}

class Table {
  rows: Row[] = [];
  private seq = 1000;
  constructor(public name: string) {}
  seed(rows: Row[]) { this.rows = rows.map((r) => ({ createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'), ...r })); }
  async findMany(a: Row = {}) {
    let out = this.rows.filter((r) => matches(r, a.where));
    if (a.skip) out = out.slice(a.skip);
    if (a.take) out = out.slice(0, a.take);
    return out.map((r) => ({ ...r }));
  }
  async findFirst(a: Row = {}) { const r = this.rows.find((x) => matches(x, a.where)); return r ? { ...r } : null; }
  async findUnique(a: Row) { return this.findFirst(a); }
  async count(a: Row = {}) { return this.rows.filter((r) => matches(r, a.where)).length; }
  async create(a: Row) {
    const row = { id: ++this.seq, createdAt: new Date(), updatedAt: new Date(), version: 1, ...a.data };
    this.rows.push(row);
    return { ...row };
  }
  async update(a: Row) {
    const row = this.rows.find((x) => matches(x, a.where));
    if (!row) throw new Error(`${this.name}: enregistrement introuvable`);
    applyData(row, a.data);
    return { ...row };
  }
  async updateMany(a: Row) {
    const hit = this.rows.filter((x) => matches(x, a.where));
    hit.forEach((r) => applyData(r, a.data));
    return { count: hit.length };
  }
  async delete(a: Row) {
    const i = this.rows.findIndex((x) => matches(x, a.where));
    if (i < 0) throw new Error(`${this.name}: enregistrement introuvable`);
    return this.rows.splice(i, 1)[0];
  }
}

export function createFakeDb() {
  const db: Record<string, any> = {
    user: new Table('user'),
    devis: new Table('devis'),
    intervention: new Table('intervention'),
    referentiel: new Table('referentiel'),
    company: new Table('company'),
    notification: new Table('notification'),
    companyMailSettings: new Table('companyMailSettings'),
    emailLog: new Table('emailLog'),
    companyInvitation: new Table('companyInvitation'),
    devisDocument: new Table('devisDocument'),
    devisLienClient: new Table('devisLienClient'),
    $transaction: async (x: any) => (typeof x === 'function' ? x(db) : Promise.all(x)),
  };
  return db;
}
