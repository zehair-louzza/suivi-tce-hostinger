import { useState, useMemo } from 'react';
import {
  Receipt,
  CheckCircle2,
  Clock,
  Ban,
  AlertTriangle,
  FileCheck2,
  Stethoscope,
  Eye,
  Scale,
  Building2,
  Home,
} from 'lucide-react';
import {
  Page,
  SubNav,
  Btn,
  Segmented,
  DataTable,
  Drawer,
  Pill,
  Card,
  useIsMobile,
} from './ui';
import type { Devis, Intervention } from '../lib/api';
import { buildLedgerContext, amountOf, isVisite, isCancelled, isBilled, isDone } from '../lib/dossiers';
import toast from 'react-hot-toast';

interface FacturationStudioViewProps {
  devisList: Devis[];
  interventionsList: Intervention[];
  onUpdateIntervention?: (id: number, data: Partial<Intervention>) => Promise<any>;
  onUpdateDevis?: (id: number, data: Partial<Devis>) => Promise<any>;
}

type BucketId = 'a-facturer' | 'a-verifier' | 'non-eligibles' | 'retards' | 'facturees';

interface FactuRow {
  id: number;
  sourceType: 'INTERVENTION' | 'DEVIS';
  ref: string;
  di?: string;
  client: string;
  type: 'B2B' | 'B2C';
  objet: string;
  tva: number;
  ht: number;
  bucket: BucketId;
  note: string;
  date: string;
}

const BUCKET_DEFS: {
  id: BucketId;
  label: string;
  tone: 'green' | 'blue' | 'red' | 'amber' | 'slate';
  hint: string;
  icon: any;
}[] = [
  { id: 'a-facturer', label: 'À facturer', tone: 'green', hint: 'Clôturé avec signature', icon: CheckCircle2 },
  { id: 'a-verifier', label: 'À vérifier', tone: 'blue', hint: 'Rapport en cours de revue', icon: Clock },
  { id: 'non-eligibles', label: 'Non éligibles', tone: 'red', hint: 'Sous garantie ou SAV', icon: Ban },
  { id: 'retards', label: 'Retards', tone: 'amber', hint: 'Relance requise (+30 j)', icon: AlertTriangle },
  { id: 'facturees', label: 'Facturées', tone: 'slate', hint: 'Payées ou en recouvrement', icon: FileCheck2 },
];

function eur(v: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(v);
}

function tvaLabel(r: FactuRow): string {
  return r.tva === 0 ? 'Autoliquidation (0 %)' : `TVA ${String(r.tva).replace('.', ',')} %`;
}

export function FacturationStudioView({
  devisList,
  interventionsList,
  onUpdateIntervention,
}: FacturationStudioViewProps) {
  const isMobile = useIsMobile();
  const [bucket, setBucket] = useState<BucketId>('a-facturer');
  const [clientType, setClientType] = useState<string>('all');
  const [amountMode, setAmountMode] = useState<'ht' | 'ttc'>('ht');
  const [diagRow, setDiagRow] = useState<FactuRow | null>(null);

  // Lignes de facturation : uniquement les vraies interventions (montants réels, visites exclues)
  const ctx = useMemo(() => buildLedgerContext(devisList, interventionsList), [devisList, interventionsList]);
  const rows: FactuRow[] = useMemo(() => {
    const todayMs = Date.now();
    const out: FactuRow[] = [];
    for (const i of interventionsList) {
      if (isCancelled(i)) continue;
      const lowClient = (i.client || '').toLowerCase();
      const isB2B = !lowClient.includes('particulier') && !lowClient.includes('copro');
      const day = String(i.dateReelle || i.datePlanifiee || '').slice(0, 10);
      const ageDays = day ? (todayMs - new Date(day + 'T00:00:00').getTime()) / 86400000 : 0;

      let bId: BucketId;
      let note: string;
      if (isVisite(i)) {
        bId = 'non-eligibles';
        note = 'Visite de chiffrage : non facturable (comprise dans le devis)';
      } else if (isBilled(i)) {
        bId = 'facturees';
        note = i.numeroFacture ? `Facture ${i.numeroFacture}` : 'Facturée (n° de facture non renseigné)';
      } else if (i.typeIntervention === 'SAV' || (i.objet || '').includes('[SAV]')) {
        bId = 'non-eligibles';
        note = 'Prise en charge SAV / garantie contractuelle';
      } else if (!isDone(i)) {
        continue; // pas encore terminée : rien à facturer
      } else if ((i.statutOperationnel || '').toLowerCase().startsWith('terminée')) {
        bId = 'a-verifier';
        note = 'Rapport terminé : à valider avant facturation';
      } else if (ageDays > 15) {
        bId = 'retards';
        note = `Clôturée depuis ${Math.floor(ageDays)} jours sans facturation`;
      } else {
        bId = 'a-facturer';
        note = 'Rapport validé : prête à facturer';
      }

      const ht = amountOf(i, ctx);
      if (ht <= 0 && (bId === 'a-facturer' || bId === 'a-verifier' || bId === 'retards')) {
        note += ' · montant HT à renseigner';
      }
      out.push({
        id: i.id as number,
        sourceType: 'INTERVENTION',
        ref: i.reference || `INT-${i.id}`,
        di: i.numeroDI || undefined,
        client: i.client || 'Client',
        type: isB2B ? 'B2B' : 'B2C',
        objet: i.objet || i.corpsEtat || 'Travaux TCE',
        tva: isB2B ? 0 : 10,
        ht,
        bucket: bId,
        note,
        date: day || '—',
      });
    }
    return out;
  }, [interventionsList, ctx]);

  // Filtered rows
  const filteredList = useMemo(() => {
    return rows.filter((r) => {
      if (r.bucket !== bucket) return false;
      if (clientType !== 'all' && r.type !== clientType) return false;
      return true;
    });
  }, [rows, bucket, clientType]);

  const sumHt = (b: BucketId) => rows.filter((r) => r.bucket === b).reduce((s, r) => s + r.ht, 0);
  const sumTtc = (b: BucketId) => rows.filter((r) => r.bucket === b).reduce((s, r) => s + r.ht * (1 + r.tva / 100), 0);
  const readyList = useMemo(() => rows.filter((r) => r.bucket === 'a-facturer'), [rows]);

  const handleBillSingle = async (row: FactuRow) => {
    if (row.ht <= 0) {
      toast.error(`${row.ref} : renseignez d’abord le montant HT de l’intervention`);
      return;
    }
    if (onUpdateIntervention) {
      await onUpdateIntervention(row.id, { statutFacture: 'Facturée' });
      toast.success(`Facture pour ${row.ref} générée et transmise au client`);
    }
  };

  const handleBillAllReady = async () => {
    const billable = readyList.filter((r) => r.ht > 0);
    const skipped = readyList.length - billable.length;
    if (billable.length === 0) {
      if (skipped > 0) toast.error('Aucune intervention facturable : renseignez les montants HT manquants');
      return;
    }
    const toastId = toast.loading(`Facturation de ${billable.length} intervention${billable.length > 1 ? 's' : ''}...`);
    for (const r of billable) {
      if (onUpdateIntervention) {
        await onUpdateIntervention(r.id, { statutFacture: 'Facturée' });
      }
    }
    toast.success(
      `${billable.length} intervention${billable.length > 1 ? 's' : ''} marquée${billable.length > 1 ? 's' : ''} facturée${billable.length > 1 ? 's' : ''}${skipped ? ` · ${skipped} ignorée${skipped > 1 ? 's' : ''} (montant manquant)` : ''}`,
      { id: toastId }
    );
  };

  const renderActionBtn = (r: FactuRow) => {
    if (r.bucket === 'a-facturer') {
      return (
        <Btn size="sm" variant="primary" icon={Receipt} onClick={() => handleBillSingle(r)}>
          Facturer
        </Btn>
      );
    }
    if (r.bucket === 'a-verifier') {
      return (
        <Btn
          size="sm"
          icon={CheckCircle2}
          onClick={async () => {
            if (onUpdateIntervention) {
              await onUpdateIntervention(r.id, { statutOperationnel: 'Clôturée' });
              toast.success(`${r.ref} vérifiée — basculée dans « À facturer »`);
            }
          }}
        >
          Valider
        </Btn>
      );
    }
    if (r.bucket === 'retards') {
      return (
        <Btn size="sm" icon={Stethoscope} onClick={() => setDiagRow(r)}>
          Diagnostic
        </Btn>
      );
    }
    if (r.bucket === 'facturees') {
      return (
        <Btn
          size="sm"
          variant="ghost"
          icon={Eye}
          onClick={() => toast(r.note)}
        >
          Facture
        </Btn>
      );
    }
    return <span className="m-muted m-small">Non facturable</span>;
  };

  const columns = [
    {
      key: 'ref',
      label: 'Référence',
      width: 130,
      render: (r: FactuRow) => (
        <div className="m-cell-ref">
          <span className="m-mono" style={{ fontWeight: 600 }}>{r.ref}</span>
          {r.di && <span className="m-linked">DI {r.di}</span>}
        </div>
      ),
    },
    {
      key: 'client',
      label: 'Client / Chantier',
      render: (r: FactuRow) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <strong style={{ color: 'var(--text-strong)' }}>{r.client}</strong>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{r.objet}</span>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      width: 90,
      render: (r: FactuRow) => (
        <Pill tone={r.type === 'B2B' ? 'blue' : 'amber'} dot={false}>
          {r.type}
        </Pill>
      ),
    },
    {
      key: 'tva',
      label: 'Régime TVA',
      width: 150,
      render: (r: FactuRow) => <span className="m-small">{tvaLabel(r)}</span>,
    },
    {
      key: 'ht',
      label: amountMode === 'ht' ? 'Montant HT' : 'Montant TTC',
      align: 'right' as const,
      width: 140,
      render: (r: FactuRow) => (
        <span className="m-mono" style={{ fontWeight: 700, fontSize: '13.5px' }}>
          {eur(amountMode === 'ht' ? r.ht : r.ht * (1 + r.tva / 100))}
        </span>
      ),
    },
    {
      key: 'note',
      label: 'Situation',
      render: (r: FactuRow) => (
        <span className="m-small m-muted">{r.note}</span>
      ),
    },
    {
      key: 'act',
      label: '',
      align: 'right' as const,
      width: 130,
      render: renderActionBtn,
    },
  ];

  return (
    <Page
      testid="screen-facturation"
      title="Facturation"
      subtitle="Tri des interventions, calcul HT/TTC, relances et bordereaux de facturation clients."
      actions={
        <>
          <Segmented
            testid="factu-mode"
            value={amountMode}
            onChange={(v) => setAmountMode(v as any)}
            options={[
              { id: 'ht', label: 'HT' },
              { id: 'ttc', label: 'TTC' },
            ]}
          />
          <Btn
            variant="primary"
            icon={Receipt}
            disabled={readyList.length === 0}
            onClick={handleBillAllReady}
          >
            Émettre les factures ({readyList.length})
          </Btn>
        </>
      }
      subnav={
        <SubNav
          testid="factu-type"
          value={clientType}
          onChange={setClientType}
          items={[
            { id: 'all', label: 'Tous les clients', count: rows.length },
            {
              id: 'B2B',
              label: 'Professionnels (B2B)',
              count: rows.filter((r) => r.type === 'B2B').length,
              icon: Building2,
            },
            {
              id: 'B2C',
              label: 'Particuliers (B2C)',
              count: rows.filter((r) => r.type === 'B2C').length,
              icon: Home,
            },
          ]}
        />
      }
    >
      {/* 5 BACS DE FACTURATION ATLAS */}
      <div
        className="m-buckets"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '12px',
          marginBottom: '18px',
        }}
      >
        {BUCKET_DEFS.map((b) => {
          const Icon = b.icon;
          const n = rows.filter((r) => r.bucket === b.id).length;
          const isActive = bucket === b.id;

          return (
            <button
              key={b.id}
              type="button"
              className={`m-bucket m-bucket-tone-${b.tone} ${isActive ? 'is-active' : ''}`}
              onClick={() => setBucket(b.id)}
              style={{
                all: 'unset',
                cursor: 'pointer',
                background: 'var(--surface)',
                border: isActive ? '2px solid var(--primary)' : '1px solid var(--border)',
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                boxShadow: isActive ? 'var(--shadow)' : 'var(--shadow-sm)',
                transition: 'all 120ms ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--muted)',
                }}
              >
                <span
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background:
                      b.tone === 'green'
                        ? 'rgba(22, 163, 74, .1)'
                        : b.tone === 'blue'
                        ? 'rgba(37, 99, 235, .1)'
                        : b.tone === 'red'
                        ? 'rgba(220, 38, 38, .1)'
                        : b.tone === 'amber'
                        ? 'rgba(245, 158, 11, .14)'
                        : 'rgba(100, 116, 139, .1)',
                    color:
                      b.tone === 'green'
                        ? '#16A34A'
                        : b.tone === 'blue'
                        ? '#2563EB'
                        : b.tone === 'red'
                        ? '#DC2626'
                        : b.tone === 'amber'
                        ? '#D97706'
                        : '#64748B',
                  }}
                >
                  <Icon size={15} />
                </span>
                {b.label}
              </div>
              <strong
                className="m-mono"
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  color: 'var(--text-strong)',
                  lineHeight: 1.15,
                  marginTop: '4px',
                }}
              >
                {n}
              </strong>
              <span className="m-mono" style={{ fontSize: '13px', fontWeight: 600 }}>
                {eur(sumHt(b.id))} HT
              </span>
              <span className="m-mono m-small" style={{ color: 'var(--muted)' }}>
                {eur(sumTtc(b.id))} TTC
              </span>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--muted)',
                  marginTop: '4px',
                  borderTop: '1px dashed var(--border)',
                  paddingTop: '4px',
                }}
              >
                {b.hint}
              </span>
            </button>
          );
        })}
      </div>

      <div
        className="m-factu-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 320px',
          gap: '18px',
          alignItems: 'start',
        }}
      >
        <div className="m-card m-card--table">
          <header className="m-card-head">
            <div className="m-card-titles">
              <h2>{BUCKET_DEFS.find((b) => b.id === bucket)?.label}</h2>
              <p>
                {filteredList.length} élément{filteredList.length > 1 ? 's' : ''} ·{' '}
                {clientType === 'all' ? 'tous clients' : clientType}
              </p>
            </div>
          </header>
          <DataTable
            testid="factu-table"
            columns={columns}
            rows={filteredList}
            rowKey={(r) => r.ref}
            empty="Rien dans ce bac pour l’instant."
            mobileCard={(r) => (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span className="m-mono" style={{ fontWeight: 700 }}>
                    {r.ref}
                  </span>
                  <Pill tone={r.type === 'B2B' ? 'blue' : 'amber'} dot={false}>
                    {r.type}
                  </Pill>
                </div>
                <strong>{r.client}</strong>
                <span className="m-small m-muted">
                  {r.objet} · {tvaLabel(r)}
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '6px',
                  }}
                >
                  <span className="m-mono m-strong">
                    {eur(amountMode === 'ht' ? r.ht : r.ht * (1 + r.tva / 100))}
                  </span>
                  {renderActionBtn(r)}
                </div>
              </>
            )}
          />
        </div>

        {!isMobile && (
          <Card
            className="m-factu-rules"
            title="Arbitrage fiscal automatique"
            icon={Scale}
            testid="factu-rules"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <strong style={{ fontSize: '13px', color: 'var(--text-strong)' }}>
                  Autoliquidation de TVA (B2B)
                </strong>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                  Art. 283-2 nonies du CGI pour les travaux de sous-traitance du BTP. TVA à 0 % avec mention obligatoire.
                </p>
              </div>
              <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '10px' }}>
                <strong style={{ fontSize: '13px', color: 'var(--text-strong)' }}>
                  Taux réduit TVA 10 % (B2C)
                </strong>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                  Locaux d'habitation achevés depuis plus de 2 ans. Attestation simplifiée conservée en archive.
                </p>
              </div>
              <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '10px' }}>
                <strong style={{ fontSize: '13px', color: 'var(--text-strong)' }}>
                  Taux standard TVA 20 %
                </strong>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                  Bureaux neufs, prestations hors sous-traitance et fournitures non rattachées.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Diagnostic Drawer for Retards */}
      <Drawer
        open={Boolean(diagRow)}
        onClose={() => setDiagRow(null)}
        testid="factu-diag-drawer"
        head={
          diagRow && (
            <div className="m-drawer-tags">
              <Pill tone="amber">Dossier en retard</Pill>
              <span className="m-mono">{diagRow.ref}</span>
            </div>
          )
        }
        title={diagRow ? diagRow.client : ''}
        subtitle={diagRow ? diagRow.objet : ''}
        footer={
          diagRow && (
            <>
              <Btn
                onClick={() => {
                  toast.success(`Relance e-mail envoyée à ${diagRow.client}`);
                  setDiagRow(null);
                }}
              >
                Relancer le client
              </Btn>
              <Btn
                variant="primary"
                onClick={async () => {
                  if (onUpdateIntervention) {
                    await onUpdateIntervention(diagRow.id, { statutFacture: 'Facturée' });
                    toast.success(`Dossier ${diagRow.ref} débloqué et facturé !`);
                  }
                  setDiagRow(null);
                }}
              >
                Débloquer et facturer
              </Btn>
            </>
          )
        }
      >
        {diagRow && (
          <dl className="m-dl">
            <div>
              <dt>Client</dt>
              <dd>{diagRow.client}</dd>
            </div>
            <div>
              <dt>Montant HT</dt>
              <dd className="m-mono">{eur(diagRow.ht)}</dd>
            </div>
            <div>
              <dt>Régime TVA</dt>
              <dd>{tvaLabel(diagRow)}</dd>
            </div>
            <div>
              <dt>Cause du blocage</dt>
              <dd>En attente du bon de commande régularisé du donneur d'ordre.</dd>
            </div>
          </dl>
        )}
      </Drawer>
    </Page>
  );
}
