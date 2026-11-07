import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Sheet, MoreHorizontal, Send, ArrowRightLeft, CalendarCheck, Copy, Archive, Eye, LayoutList, Columns3, FileText, Euro, CheckCircle2, MapPin, Search, Link2, History, User } from 'lucide-react';
import { useMock, useToast, Page, SubNav, Kpi, Btn, IconBtn, StatusPill, Pill, Segmented, Dropdown, SearchInput, DataTable, Menu, Drawer, Modal, Field, Input, Checkbox, Avatar } from '../ui';
import { DEVIS, CLIENTS, CLIENT_BY_ID, CORPS, TECHS, eur } from '../../data/sample';

const STATUSES = ['À préparer', 'Envoyé', 'En négociation', 'Accepté', 'Refusé'];

function primaryAction(d) {
  if (d.status === 'Accepté' && !d.linked) return { label: 'Convertir', icon: ArrowRightLeft, variant: 'primary', kind: 'convert' };
  if (d.status === 'Accepté') return { label: d.linked, icon: Link2, variant: 'ghost', kind: 'linked' };
  if (d.status === 'Envoyé' || d.status === 'En négociation') return { label: 'Relancer', icon: Send, variant: 'secondary', kind: 'relance' };
  if (d.status === 'À préparer') return { label: 'Compléter', icon: FileText, variant: 'secondary', kind: 'open' };
  return null;
}

export function NewDevisModal({ open, onClose, onCreate }) {
  const [client, setClient] = useState('presta');
  const [corps, setCorps] = useState('Électricité');
  const [visite, setVisite] = useState(true);
  const [tech, setTech] = useState('anouar');
  const [objet, setObjet] = useState('Remplacement tableau divisionnaire');
  const [ht, setHt] = useState('3200');
  return (
    <Modal open={open} onClose={onClose} icon={FileText} title="Nouveau devis" subtitle="Le devis pourra être envoyé puis converti en intervention sans ressaisie." width={620} testid="mock-new-devis-modal"
      footer={<><Btn variant="ghost" onClick={onClose} data-testid="mock-new-devis-cancel">Annuler</Btn><Btn variant="primary" onClick={() => onCreate({ client, corps, objet, ht: Number(ht) || 0, visite })} data-testid="mock-new-devis-create">Créer le devis</Btn></>}>
      <div className="m-grid-2">
        <Field label="Donneur d’ordre / client" required><Dropdown testid="mock-new-devis-client" value={client} onChange={setClient} options={CLIENTS.map((c) => ({ id: c.id, label: c.name }))} /></Field>
        <Field label="Corps d’état" required><Dropdown testid="mock-new-devis-corps" value={corps} onChange={setCorps} options={CORPS.map((c) => ({ id: c, label: c }))} /></Field>
      </div>
      <Field label="Site d’intervention"><Input icon={MapPin} defaultValue={CLIENT_BY_ID[client].address} key={client} data-testid="mock-new-devis-site" /></Field>
      <Field label="Objet" required><Input value={objet} onChange={(e) => setObjet(e.target.value)} data-testid="mock-new-devis-objet" /></Field>
      <div className="m-grid-2">
        <Field label="Montant estimé HT"><Input icon={Euro} value={ht} onChange={(e) => setHt(e.target.value)} data-testid="mock-new-devis-ht" /></Field>
        <Field label="Échéance"><Input defaultValue="20/11/2026" data-testid="mock-new-devis-due" /></Field>
      </div>
      <div className="m-callout">
        <Checkbox checked={visite} onChange={setVisite} label="Visite technique nécessaire avant chiffrage" sub="Une mission « Visite devis » est créée dans le planning et l’app du technicien" testid="mock-new-devis-visite" />
        {visite && (
          <div className="m-grid-2">
            <Field label="Technicien"><Dropdown testid="mock-new-devis-tech" value={tech} onChange={setTech} options={TECHS.map((t) => ({ id: t.id, label: `${t.name} — ${t.skills[0]}` }))} /></Field>
            <Field label="Date souhaitée"><Input defaultValue="09/11/2026 · 09:00" data-testid="mock-new-devis-visite-date" /></Field>
          </div>
        )}
      </div>
    </Modal>
  );
}

function DevisDrawer({ d, onClose, onConvert }) {
  const toast = useToast();
  if (!d) return null;
  const c = CLIENT_BY_ID[d.client];
  const tva = c.tva === 'Autoliquidation' ? 0 : c.tva === 'TVA 10 %' ? 0.1 : 0.2;
  const pa = primaryAction(d);
  return (
    <Drawer
      open
      onClose={onClose}
      testid="mock-devis-drawer"
      head={<div className="m-drawer-tags"><span className="m-mono">{d.ref}</span><StatusPill status={d.status} /></div>}
      title={c.name}
      subtitle={`${d.corps} · ${d.objet}`}
      footer={(
        <>
          <Btn icon={Send} onClick={() => toast(`Devis ${d.ref} envoyé à ${c.emails[0].email}`)} data-testid="mock-devis-drawer-send">Envoyer au client</Btn>
          {pa && pa.kind === 'convert' && <Btn variant="primary" icon={ArrowRightLeft} onClick={() => { onConvert(d); onClose(); }} data-testid="mock-devis-drawer-convert">Convertir en intervention</Btn>}
        </>
      )}
    >
      <div className="m-amounts">
        <div><span>Montant HT</span><strong className="m-mono">{eur(d.ht)}</strong></div>
        <div><span>{c.tva}</span><strong className="m-mono">{eur(d.ht * tva)}</strong></div>
        <div><span>Total TTC</span><strong className="m-mono">{eur(d.ht * (1 + tva))}</strong></div>
      </div>
      <dl className="m-dl">
        <div><dt>Site</dt><dd>{d.city} · {c.address}</dd></div>
        <div><dt>Contact</dt><dd>{c.contact} · {c.phone}</dd></div>
        <div><dt>Envoi des devis</dt><dd>{c.emails[0].email}</dd></div>
        <div><dt>Responsable</dt><dd><User size={14} /> {d.resp}</dd></div>
        <div><dt>Visite technique</dt><dd>{d.visite}</dd></div>
        <div><dt>Échéance</dt><dd>{d.due}</dd></div>
        {d.linked && <div><dt>Intervention liée</dt><dd><Pill tone="green">{d.linked}</Pill></dd></div>}
      </dl>
      <h4 className="m-h4"><History size={15} /> Historique</h4>
      <ol className="m-timeline">
        <li><time>{d.created}</time><span>Devis créé par {d.resp}</span></li>
        {d.visite.startsWith('Réalisée') && <li><time>27/10/2026</time><span>Visite technique réalisée, métrés relevés</span></li>}
        {d.status !== 'À préparer' && <li><time>28/10/2026</time><span>Envoyé par e-mail à {c.emails[0].email}</span></li>}
        {d.status === 'Accepté' && <li className="is-ok"><time>02/11/2026</time><span>Accepté par le client</span></li>}
        {d.status === 'Refusé' && <li className="is-ko"><time>30/10/2026</time><span>Refusé : budget reporté</span></li>}
      </ol>
    </Drawer>
  );
}

export default function Devis() {
  const { isMobile, openExcel } = useMock();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const [rows, setRows] = useState(DEVIS);
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [resp, setResp] = useState('all');
  const [view, setView] = useState('table');
  const [open, setOpen] = useState(null);
  const [creating, setCreating] = useState(sp.get('new') === '1');
  useEffect(() => { if (sp.get('new') === '1') { setCreating(true); setSp({}, { replace: true }); } }, [sp, setSp]);

  const filtered = useMemo(() => rows.filter((d) => (status === 'all' || d.status === status)
    && (resp === 'all' || d.resp === resp)
    && `${d.ref} ${CLIENT_BY_ID[d.client].name} ${d.objet} ${d.city}`.toLowerCase().includes(q.toLowerCase())), [rows, status, q, resp]);
  const count = (s) => rows.filter((d) => d.status === s).length;
  const total = rows.reduce((s, d) => s + d.ht, 0);
  const signed = rows.filter((d) => d.status === 'Accepté');

  const convert = (d) => {
    const nref = `INT-2026-0${16 + rows.filter((r) => r.linked).length}`;
    setRows((l) => l.map((x) => (x.ref === d.ref ? { ...x, linked: nref } : x)));
    toast(`${nref} créée depuis ${d.ref} — le devis d’origine est conservé`);
  };
  const create = (v) => {
    const ref = `DEV-2026-0${String(rows.length + 1).padStart(2, '0')}`;
    setRows((l) => [{ ref, client: v.client, city: CLIENT_BY_ID[v.client].address.split(', ')[1] || 'Paris', corps: v.corps, objet: v.objet, resp: 'Zehair L.', ht: v.ht, status: 'À préparer', visite: v.visite ? 'Planifiée 09/11' : 'Non requise', due: '20/11/2026', linked: null, created: '06/11/2026' }, ...l]);
    setCreating(false);
    toast(`${ref} créé${v.visite ? ' — visite ajoutée au planning' : ''}`);
  };
  const onAction = (d, pa) => {
    if (pa.kind === 'convert') convert(d);
    else if (pa.kind === 'relance') toast(`Relance envoyée à ${CLIENT_BY_ID[d.client].name}`);
    else setOpen(d.ref);
  };

  const menuItems = (d) => [
    { label: 'Ouvrir la fiche', icon: Eye, onClick: () => setOpen(d.ref) },
    { label: 'Planifier une visite', icon: CalendarCheck, onClick: () => toast('Visite ajoutée à la bourse de dispatch') },
    { label: 'Envoyer par e-mail', icon: Send, onClick: () => toast(`Devis ${d.ref} envoyé`) },
    { label: 'Créer une suite (SAV, avenant…)', icon: ArrowRightLeft, onClick: () => toast('Suite créée, liée au devis d’origine') },
    { label: 'Dupliquer', icon: Copy, onClick: () => toast('Devis dupliqué') },
    { sep: true },
    { label: 'Archiver', icon: Archive, danger: true, onClick: () => toast('Devis archivé', 'info') },
  ];

  const columns = [
    { key: 'ref', label: 'Référence', width: 150, render: (d) => <div className="m-cell-ref"><span className="m-mono">{d.ref}</span>{d.linked && <span className="m-linked"><Link2 size={11} /> lié</span>}</div> },
    { key: 'client', label: 'Client & site', render: (d) => <div className="m-cell-2"><strong>{CLIENT_BY_ID[d.client].name}</strong><span>{d.city}</span></div> },
    { key: 'objet', label: 'Corps d’état & objet', render: (d) => <div className="m-cell-2"><strong>{d.corps}</strong><span className="m-ellipsis">{d.objet}</span></div> },
    { key: 'resp', label: 'Responsable', width: 130, render: (d) => <span className="m-cell-user"><Avatar name={d.resp} size={22} /> {d.resp}</span> },
    { key: 'ht', label: 'Montant HT', align: 'right', width: 120, render: (d) => <span className="m-mono m-strong">{eur(d.ht)}</span> },
    { key: 'status', label: 'Statut', width: 150, render: (d) => <StatusPill status={d.status} /> },
    { key: 'visite', label: 'Visite', width: 130, render: (d) => <span className={`m-small ${d.visite === 'À affecter' ? 'm-warn-text' : 'm-muted'}`}>{d.visite}</span> },
    { key: 'due', label: 'Échéance', width: 104, render: (d) => <span className="m-mono m-small">{d.due}</span> },
    {
      key: 'actions', label: '', width: 150, align: 'right', render: (d) => {
        const pa = primaryAction(d);
        return (
          <div className="m-row-actions" onClick={(e) => e.stopPropagation()}>
            {pa && <Btn size="sm" variant={pa.variant} icon={pa.icon} onClick={() => onAction(d, pa)} data-testid={`mock-devis-action-${d.ref}`}>{pa.label}</Btn>}
            <Menu testid={`mock-devis-menu-${d.ref}`} trigger={<IconBtn icon={MoreHorizontal} label="Plus d’actions" />} items={menuItems(d)} />
          </div>
        );
      },
    },
  ];

  return (
    <Page
      testid="mock-screen-devis"
      title="Devis"
      subtitle="Chiffrages, visites techniques et conversion en interventions."
      actions={(
        <>
          <Btn icon={Sheet} onClick={openExcel} data-testid="mock-devis-export">Exporter</Btn>
          <Btn variant="primary" icon={Plus} onClick={() => setCreating(true)} data-testid="mock-devis-new">Nouveau devis</Btn>
        </>
      )}
      subnav={(
        <SubNav
          testid="mock-devis-status"
          value={status}
          onChange={setStatus}
          items={[{ id: 'all', label: 'Tous les devis', count: rows.length }, ...STATUSES.map((s) => ({ id: s, label: s, count: count(s) }))]}
        />
      )}
    >
      <div className="m-kpis m-kpis--4 m-kpis--compact">
        <Kpi label="Portefeuille" value={`${rows.length} devis`} hint={`${count('À préparer')} à préparer`} icon={FileText} tone="blue" />
        <Kpi label="Volume chiffré HT" value={eur(total)} hint="Potentiel commercial brut" icon={Euro} tone="indigo" />
        <Kpi label="Devis signés" value={eur(signed.reduce((s, d) => s + d.ht, 0))} delta={`${signed.length} acceptés`} hint="Taux de transformation 50 %" icon={CheckCircle2} tone="green" />
        <Kpi label="Visites à planifier" value="2" hint="Dont 1 à affecter" icon={CalendarCheck} tone="amber" />
      </div>
      <div className="m-toolbar">
        <SearchInput placeholder="Rechercher une référence, un client, un site…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="mock-devis-search" />
        <Dropdown testid="mock-devis-resp" value={resp} onChange={setResp} options={[{ id: 'all', label: 'Tous les responsables' }, { id: 'Zehair L.', label: 'Zehair L.' }, { id: 'Sarah K.', label: 'Sarah K.' }, { id: 'Najoua B.', label: 'Najoua B.' }, { id: 'Anouar', label: 'Anouar' }]} />
        {!isMobile && <Segmented testid="mock-devis-view" value={view} onChange={setView} options={[{ id: 'table', label: 'Tableau', icon: LayoutList }, { id: 'kanban', label: 'Kanban', icon: Columns3 }]} />}
      </div>
      {view === 'table' || isMobile ? (
        <div className="m-card m-card--table">
          <DataTable
            testid="mock-devis-table"
            columns={columns}
            rows={filtered}
            rowKey={(d) => d.ref}
            onRowClick={(d) => setOpen(d.ref)}
            empty={<span><Search size={16} /> Aucun devis ne correspond à ces filtres.</span>}
            mobileCard={(d) => (
              <>
                <div className="m-mcard-top"><span className="m-mono">{d.ref}</span><StatusPill status={d.status} /></div>
                <strong>{CLIENT_BY_ID[d.client].name}</strong>
                <span className="m-muted m-small">{d.corps} · {d.objet}</span>
                <div className="m-mcard-foot"><span className="m-mono m-strong">{eur(d.ht)}</span><span className="m-small m-muted">Éch. {d.due}</span></div>
              </>
            )}
          />
        </div>
      ) : (
        <div className="m-kanban" data-testid="mock-devis-kanban">
          {STATUSES.map((s) => {
            const list = filtered.filter((d) => d.status === s);
            return (
              <div key={s} className="m-kcol">
                <header><StatusPill status={s} /><em>{list.length}</em><span className="m-mono m-small m-muted">{eur(list.reduce((x, d) => x + d.ht, 0))}</span></header>
                {list.map((d) => (
                  <button key={d.ref} type="button" className={`m-kcard m-kcard-tone-${s === 'Accepté' ? 'green' : s === 'Refusé' ? 'red' : s === 'Envoyé' ? 'blue' : s === 'En négociation' ? 'amber' : 'slate'}`} onClick={() => setOpen(d.ref)} data-testid={`mock-devis-kcard-${d.ref}`}>
                    <span className="m-mono m-small">{d.ref}</span>
                    <strong>{CLIENT_BY_ID[d.client].name}</strong>
                    <span className="m-small m-muted">{d.objet}</span>
                    <div className="m-kcard-foot"><span className="m-mono m-strong">{eur(d.ht)}</span><Avatar name={d.resp} size={22} /></div>
                  </button>
                ))}
                {!list.length && <div className="m-kempty">Aucun devis</div>}
              </div>
            );
          })}
        </div>
      )}
      <DevisDrawer d={rows.find((r) => r.ref === open)} onClose={() => setOpen(null)} onConvert={convert} />
      <NewDevisModal open={creating} onClose={() => setCreating(false)} onCreate={create} />
    </Page>
  );
}
