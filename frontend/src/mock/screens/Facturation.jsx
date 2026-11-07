import React, { useMemo, useState } from 'react';
import { Receipt, CheckCircle2, Clock, Ban, AlertTriangle, FileCheck2, Stethoscope, Copy, Send, Eye, Scale, Building2, Home } from 'lucide-react';
import { useMock, useToast, Page, SubNav, Btn, Segmented, DataTable, Drawer, Pill, Card } from '../ui';
import { FACTU, BUCKETS, CLIENT_BY_ID, eur } from '../../data/sample';

const ICONS = { 'a-facturer': CheckCircle2, 'a-verifier': Clock, 'non-eligibles': Ban, retards: AlertTriangle, facturees: FileCheck2 };
const tvaLabel = (r) => (r.tva === 0 ? 'Autoliquidation' : `TVA ${String(r.tva).replace('.', ',')} %`);

export default function Facturation() {
  const { isMobile } = useMock();
  const toast = useToast();
  const [bucket, setBucket] = useState('a-facturer');
  const [type, setType] = useState('all');
  const [mode, setMode] = useState('ht');
  const [rows, setRows] = useState(FACTU);
  const [diag, setDiag] = useState(null);

  const list = useMemo(() => rows.filter((r) => r.bucket === bucket && (type === 'all' || r.type === type)), [rows, bucket, type]);
  const sum = (b) => rows.filter((r) => r.bucket === b).reduce((s, r) => s + r.ht, 0);
  const sumTtc = (b) => rows.filter((r) => r.bucket === b).reduce((s, r) => s + r.ht * (1 + r.tva / 100), 0);
  const ready = rows.filter((r) => r.bucket === 'a-facturer');
  const bill = (refs) => {
    setRows((l) => l.map((r) => (refs.includes(r.ref) ? { ...r, bucket: 'facturees', note: `Facture F-2026-0${190 + refs.indexOf(r.ref)} émise` } : r)));
    toast(`${refs.length} facture${refs.length > 1 ? 's' : ''} émise${refs.length > 1 ? 's' : ''} et envoyée${refs.length > 1 ? 's' : ''}`);
  };

  const act = (r) => {
    if (r.bucket === 'a-facturer') return <Btn size="sm" variant="primary" icon={Receipt} onClick={() => bill([r.ref])} data-testid={`mock-factu-bill-${r.ref}`}>Facturer</Btn>;
    if (r.bucket === 'a-verifier') return <Btn size="sm" icon={CheckCircle2} onClick={() => { setRows((l) => l.map((x) => (x.ref === r.ref ? { ...x, bucket: 'a-facturer', note: 'Rapport validé' } : x))); toast(`${r.ref} vérifiée — passée dans « À facturer »`); }} data-testid={`mock-factu-verify-${r.ref}`}>Valider</Btn>;
    if (r.bucket === 'retards') return <Btn size="sm" icon={Stethoscope} onClick={() => setDiag(r)} data-testid={`mock-factu-diag-${r.ref}`}>Diagnostic</Btn>;
    if (r.bucket === 'facturees') return <Btn size="sm" variant="ghost" icon={Eye} data-testid={`mock-factu-view-${r.ref}`}>Facture</Btn>;
    return <span className="m-muted m-small">Non facturable</span>;
  };

  const columns = [
    { key: 'ref', label: 'Référence', width: 130, render: (r) => <span className="m-mono">{r.ref}</span> },
    { key: 'client', label: 'Client', render: (r) => <div className="m-cell-2"><strong>{CLIENT_BY_ID[r.client].name}</strong><span>{r.objet}</span></div> },
    { key: 'type', label: 'Type', width: 90, render: (r) => <Pill tone={r.type === 'B2B' ? 'blue' : 'amber'} dot={false}>{r.type}</Pill> },
    { key: 'tva', label: 'Régime TVA', width: 140, render: (r) => <span className="m-small">{tvaLabel(r)}</span> },
    { key: 'ht', label: mode === 'ht' ? 'Montant HT' : 'Montant TTC', align: 'right', width: 130, render: (r) => <span className="m-mono m-strong">{eur(mode === 'ht' ? r.ht : r.ht * (1 + r.tva / 100))}</span> },
    { key: 'note', label: 'Situation', render: (r) => <span className="m-small m-muted">{r.note}</span> },
    { key: 'act', label: '', align: 'right', width: 130, render: act },
  ];

  return (
    <Page
      testid="mock-screen-facturation"
      title="Facturation"
      subtitle="Tri des interventions, calcul HT/TTC, relances et réponses clients."
      actions={(
        <>
          <Segmented testid="mock-factu-mode" value={mode} onChange={setMode} options={[{ id: 'ht', label: 'HT' }, { id: 'ttc', label: 'TTC' }]} />
          <Btn variant="primary" icon={Receipt} disabled={!ready.length} onClick={() => bill(ready.map((r) => r.ref))} data-testid="mock-factu-bill-all">Émettre les factures ({ready.length})</Btn>
        </>
      )}
      subnav={(
        <SubNav testid="mock-factu-type" value={type} onChange={setType} items={[
          { id: 'all', label: 'Tous les clients', count: rows.length },
          { id: 'B2B', label: 'Professionnels (B2B)', count: rows.filter((r) => r.type === 'B2B').length, icon: Building2 },
          { id: 'B2C', label: 'Particuliers (B2C)', count: rows.filter((r) => r.type === 'B2C').length, icon: Home },
        ]} />
      )}
    >
      <div className="m-buckets" data-testid="mock-factu-buckets">
        {BUCKETS.map((b) => {
          const Icon = ICONS[b.id];
          const n = rows.filter((r) => r.bucket === b.id).length;
          return (
            <button key={b.id} type="button" className={`m-bucket m-bucket-tone-${b.tone} ${bucket === b.id ? 'is-active' : ''}`} onClick={() => setBucket(b.id)} data-testid={`mock-factu-bucket-${b.id}`}>
              <span className="m-bucket-top"><span className={`m-bucket-ic m-tone-${b.tone}`}><Icon size={16} /></span>{b.label}</span>
              <strong className="m-bucket-n">{n}</strong>
              <span className="m-bucket-amount m-mono">{eur(sum(b.id))} HT</span>
              <span className="m-bucket-sub m-mono">{eur(sumTtc(b.id))} TTC</span>
              <span className="m-bucket-hint">{b.hint}</span>
            </button>
          );
        })}
      </div>
      <div className="m-factu-layout">
        <div className="m-card m-card--table">
          <header className="m-card-head"><div className="m-card-titles"><h2>{BUCKETS.find((b) => b.id === bucket).label}</h2><p>{list.length} élément{list.length > 1 ? 's' : ''} · {type === 'all' ? 'tous clients' : type}</p></div></header>
          <DataTable
            testid="mock-factu-table"
            columns={columns}
            rows={list}
            rowKey={(r) => r.ref}
            empty="Rien dans ce bac pour l’instant."
            mobileCard={(r) => (
              <>
                <div className="m-mcard-top"><span className="m-mono">{r.ref}</span><Pill tone={r.type === 'B2B' ? 'blue' : 'amber'} dot={false}>{r.type}</Pill></div>
                <strong>{CLIENT_BY_ID[r.client].name}</strong>
                <span className="m-small m-muted">{r.objet} · {tvaLabel(r)}</span>
                <div className="m-mcard-foot"><span className="m-mono m-strong">{eur(mode === 'ht' ? r.ht : r.ht * (1 + r.tva / 100))}</span>{act(r)}</div>
              </>
            )}
          />
        </div>
        {!isMobile && (
          <Card className="m-factu-rules" title="Arbitrage fiscal automatique" icon={Scale} testid="mock-factu-rules">
            <ul className="m-rules">
              <li><Pill tone="blue" dot={false}>B2B</Pill><span>Autoliquidation (sous-traitance BTP)</span><b className="m-mono">0 %</b></li>
              <li><Pill tone="blue" dot={false}>B2B</Pill><span>Taux normal</span><b className="m-mono">20 %</b></li>
              <li><Pill tone="amber" dot={false}>B2C</Pill><span>Travaux d’amélioration (logement &gt; 2 ans)</span><b className="m-mono">10 %</b></li>
              <li><Pill tone="amber" dot={false}>B2C</Pill><span>Rénovation énergétique</span><b className="m-mono">5,5 %</b></li>
            </ul>
            <p className="m-small m-muted">Le régime est déduit de la fiche du donneur d’ordre ; il reste modifiable avant émission.</p>
          </Card>
        )}
      </div>
      <Drawer
        open={!!diag}
        onClose={() => setDiag(null)}
        testid="mock-factu-diag-drawer"
        head={diag && <div className="m-drawer-tags"><span className="m-mono">{diag.ref}</span><Pill tone="red">Retard {diag.delay}</Pill></div>}
        title="Diagnostic du retard"
        subtitle={diag ? `${CLIENT_BY_ID[diag.client].name} · ${diag.objet}` : ''}
        footer={(
          <>
            <Btn icon={Copy} onClick={() => toast('Courrier copié dans le presse-papiers', 'info')} data-testid="mock-factu-diag-copy">Copier</Btn>
            <Btn variant="primary" icon={Send} onClick={() => { setDiag(null); toast('Réponse envoyée au donneur d’ordre'); }} data-testid="mock-factu-diag-send">Envoyer au client</Btn>
          </>
        )}
      >
        {diag && (
          <>
            <div className="m-diag">
              <div className="m-diag-cause"><span>Cause identifiée</span><strong>{diag.cause}</strong><p>{diag.note}</p></div>
              <ol className="m-timeline">
                <li><time>04/11 · 09:00</time><span>Démarrage sur site par Haitam</span></li>
                <li className="is-ko"><time>04/11 · 11:40</time><span>Déclarée « non terminée » : pièce manquante</span></li>
                <li><time>05/11 · 10:15</time><span>Commande fournisseur passée — livraison prévue le 08/11</span></li>
                <li><time>09/11 · 08:30</time><span>Nouveau créneau proposé</span></li>
              </ol>
            </div>
            <h4 className="m-h4">Courrier de réponse généré</h4>
            <textarea className="m-textarea" rows={9} data-testid="mock-factu-diag-letter" defaultValue={`Bonjour,\n\nNous revenons vers vous concernant l’intervention ${diag.ref} (${diag.objet}).\n\nLors du passage de notre technicien le 04/11, la pose n’a pu être finalisée en raison d’une pièce manquante (disjoncteur différentiel 63 A). La pièce est commandée et sera livrée le 08/11.\n\nNous vous proposons de terminer l’intervention le lundi 09/11 à 08:30. La facture sera émise après réception de votre validation.\n\nCordialement,\nL’équipe ANELEC GROUPE`} />
          </>
        )}
      </Drawer>
    </Page>
  );
}
