import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Sheet, MoreHorizontal, Mail, Eye, CheckCircle2, CalendarPlus, Image as ImageIcon, Camera, LayoutList, Columns3, Wrench, Clock, MapPin, Navigation, History, FileCheck2, Users, AlertTriangle, Receipt, Phone } from 'lucide-react';
import { useMock, useToast, Page, SubNav, Kpi, Btn, IconBtn, StatusPill, Pill, Segmented, Dropdown, SearchInput, DataTable, Menu, Drawer, Avatar, Tabs, Modal, Field, Input } from '../ui';
import { EmailReportModal } from '../Overlays';
import { INTERVENTIONS, CLIENTS, CLIENT_BY_ID, TECHS, TECH_BY_ID, CORPS, eur, hhmm } from '../../data/sample';

const STATUSES = ['À planifier', 'Planifiée', 'En cours', 'Non terminée', 'Terminée — à valider', 'Clôturée'];
const SHORT = { 'Terminée — à valider': 'À valider' };

function PhotoGrid({ n }) {
  const labels = ['Avant — vue générale', 'Avant — détail', 'Pendant — dépose', 'Après — vue générale', 'Après — finitions', 'Après — nettoyage'];
  if (!n) return <div className="m-empty m-empty--rich"><span className="m-empty-icon"><Camera size={22} /></span><strong>Aucune photo pour l’instant</strong><p>Le technicien ajoute les photos avant/après depuis l’app terrain.</p></div>;
  return (
    <div className="m-photos">
      {labels.slice(0, n).map((l, i) => (
        <figure key={l} className={`m-photo m-photo--${i % 3}`}>
          <ImageIcon size={22} />
          <figcaption>{l}</figcaption>
        </figure>
      ))}
    </div>
  );
}

function FicheDrawer({ it, onClose, onReport, onValidate }) {
  const [tab, setTab] = useState('resume');
  if (!it) return null;
  const c = CLIENT_BY_ID[it.client];
  const t = TECH_BY_ID[it.tech];
  return (
    <Drawer
      open
      onClose={onClose}
      testid="mock-intervention-drawer"
      head={<div className="m-drawer-tags"><span className="m-mono">{it.ref}</span><StatusPill status={it.status} /></div>}
      title={c.name}
      subtitle={`${it.corps} · ${it.objet}`}
      footer={(
        <>
          <Btn icon={Mail} onClick={onReport} data-testid="mock-intervention-send-report">Envoyer le rapport</Btn>
          {it.status === 'Terminée — à valider' && <Btn variant="primary" icon={CheckCircle2} onClick={() => onValidate(it)} data-testid="mock-intervention-validate">Valider le rapport</Btn>}
        </>
      )}
    >
      <Tabs testid="mock-intervention-tabs" value={tab} onChange={setTab} items={[{ id: 'resume', label: 'Résumé' }, { id: 'photos', label: 'Photos', count: it.photos }, { id: 'historique', label: 'Historique' }]} />
      {tab === 'resume' && (
        <>
          <div className="m-amounts">
            <div><span>Montant HT</span><strong className="m-mono">{eur(it.ht)}</strong></div>
            <div><span>Créneau</span><strong className="m-mono">{it.start != null ? `${hhmm(it.start)}–${hhmm(it.end)}` : '—'}</strong></div>
            <div><span>Rapport</span><strong>{it.rapport}</strong></div>
          </div>
          <dl className="m-dl">
            <div><dt>Adresse</dt><dd><MapPin size={14} /> {it.addr} <Btn size="sm" variant="ghost" icon={Navigation} data-testid="mock-intervention-itinerary">Itinéraire</Btn></dd></div>
            <div><dt>Technicien</dt><dd>{t ? <><Avatar name={t.name} initials={t.initials} color={t.color} size={22} /> {t.name}</> : <Pill tone="amber">À affecter</Pill>}</dd></div>
            <div><dt>Date</dt><dd>{it.date}</dd></div>
            <div><dt>Contact</dt><dd><Phone size={14} /> {c.phone}</dd></div>
            <div><dt>Facturation</dt><dd>{it.facture} · {c.tva}</dd></div>
          </dl>
          <div className="m-callout m-callout--note"><strong>Consignes du donneur d’ordre</strong><p>{c.consignes}</p></div>
        </>
      )}
      {tab === 'photos' && <PhotoGrid n={it.photos} />}
      {tab === 'historique' && (
        <ol className="m-timeline">
          <li><time>02/11 · 14:12</time><span>Intervention créée par Sarah K.</span></li>
          {t && <li><time>03/11 · 09:30</time><span>Affectée à {t.name}, créneau confirmé</span></li>}
          {['En cours', 'Terminée — à valider', 'Clôturée', 'Non terminée'].includes(it.status) && <li><time>{it.date.slice(0, 5)} · {hhmm(it.start)}</time><span>Démarrée sur site (position GPS transmise)</span></li>}
          {it.status === 'Non terminée' && <li className="is-ko"><time>{it.date.slice(0, 5)} · 11:40</time><span>Non terminée : pièce manquante, à replanifier</span></li>}
          {['Terminée — à valider', 'Clôturée'].includes(it.status) && <li className="is-ok"><time>{it.date.slice(0, 5)} · {hhmm(it.end)}</time><span>Clôturée avec GPS · rapport et {it.photos} photos envoyés</span></li>}
          {it.status === 'Clôturée' && <li className="is-ok"><time>05/11 · 17:02</time><span>Rapport validé et facturé (F-2026-0187)</span></li>}
        </ol>
      )}
    </Drawer>
  );
}

function NewInterventionModal({ open, onClose, onCreate }) {
  const [client, setClient] = useState('cmulti');
  const [corps, setCorps] = useState('Plomberie');
  const [tech, setTech] = useState('mohamed');
  return (
    <Modal open={open} onClose={onClose} icon={Wrench} title="Nouvelle intervention" subtitle="Elle apparaît immédiatement dans le planning et l’app du technicien." width={620} testid="mock-new-intervention-modal"
      footer={<><Btn variant="ghost" onClick={onClose} data-testid="mock-new-intervention-cancel">Annuler</Btn><Btn variant="primary" onClick={() => onCreate({ client, corps, tech })} data-testid="mock-new-intervention-create">Créer l’intervention</Btn></>}>
      <div className="m-grid-2">
        <Field label="Donneur d’ordre / client" required><Dropdown testid="mock-new-intervention-client" value={client} onChange={setClient} options={CLIENTS.map((c) => ({ id: c.id, label: c.name }))} /></Field>
        <Field label="Corps d’état" required><Dropdown testid="mock-new-intervention-corps" value={corps} onChange={setCorps} options={CORPS.map((c) => ({ id: c, label: c }))} /></Field>
      </div>
      <Field label="Adresse du chantier"><Input icon={MapPin} defaultValue={CLIENT_BY_ID[client].address} key={client} data-testid="mock-new-intervention-address" /></Field>
      <Field label="Objet" required><Input defaultValue="Remplacement groupe de sécurité" data-testid="mock-new-intervention-objet" /></Field>
      <div className="m-grid-2">
        <Field label="Technicien" hint="Suggéré selon les compétences"><Dropdown testid="mock-new-intervention-tech" value={tech} onChange={setTech} options={TECHS.map((t) => ({ id: t.id, label: `${t.name} — ${t.skills[0]}` }))} /></Field>
        <Field label="Créneau"><Input defaultValue="09/11/2026 · 08:30 – 10:30" data-testid="mock-new-intervention-slot" /></Field>
      </div>
    </Modal>
  );
}

export default function Interventions() {
  const { isMobile, openExcel, modal } = useMock();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const [rows, setRows] = useState(INTERVENTIONS);
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [tech, setTech] = useState('all');
  const [view, setView] = useState('table');
  const [open, setOpen] = useState(modal === 'rapport' ? 'INT-2026-004' : null);
  const [report, setReport] = useState(modal === 'rapport');
  const [creating, setCreating] = useState(sp.get('new') === '1');
  useEffect(() => { if (sp.get('new') === '1') { setCreating(true); setSp({}, { replace: true }); } }, [sp, setSp]);

  const filtered = useMemo(() => rows.filter((i) => (status === 'all' || i.status === status)
    && (tech === 'all' || i.tech === tech)
    && `${i.ref} ${CLIENT_BY_ID[i.client].name} ${i.objet} ${i.addr}`.toLowerCase().includes(q.toLowerCase())), [rows, status, q, tech]);
  const count = (s) => rows.filter((i) => i.status === s).length;
  const current = rows.find((r) => r.ref === open);

  const validate = (it) => {
    setRows((l) => l.map((x) => (x.ref === it.ref ? { ...x, status: 'Clôturée', rapport: 'Validé' } : x)));
    toast(`Rapport ${it.ref} validé — prêt à facturer`);
  };
  const create = (v) => {
    const ref = `INT-2026-0${rows.length + 8}`;
    setRows((l) => [{ ref, client: v.client, addr: CLIENT_BY_ID[v.client].address, corps: v.corps, objet: 'Remplacement groupe de sécurité', tech: v.tech, date: '09/11/2026', start: 8.5, end: 10.5, status: 'Planifiée', photos: 0, rapport: '—', facture: 'Non facturée', ht: 690, kind: 'travaux' }, ...l]);
    setCreating(false);
    toast(`${ref} créée et envoyée sur l’app de ${TECH_BY_ID[v.tech].name}`);
  };

  const action = (i) => {
    if (i.status === 'Terminée — à valider') return { label: 'Valider', icon: CheckCircle2, variant: 'primary', run: () => setOpen(i.ref) };
    if (i.status === 'À planifier') return { label: 'Planifier', icon: CalendarPlus, variant: 'secondary', run: () => toast(`${i.ref} ajoutée à la bourse de dispatch`) };
    if (i.status === 'Non terminée') return { label: 'Replanifier', icon: CalendarPlus, variant: 'secondary', run: () => toast(`${i.ref} replanifiée au 09/11`) };
    return { label: 'Fiche', icon: Eye, variant: 'ghost', run: () => setOpen(i.ref) };
  };

  const columns = [
    { key: 'ref', label: 'Référence', width: 132, render: (i) => <div className="m-cell-ref"><span className="m-mono">{i.ref}</span>{i.kind === 'urgence' && <span className="m-urgent"><AlertTriangle size={11} /> urgent</span>}</div> },
    { key: 'client', label: 'Client & chantier', render: (i) => <div className="m-cell-2"><strong>{CLIENT_BY_ID[i.client].name}</strong><span className="m-ellipsis">{i.addr}</span></div> },
    { key: 'objet', label: 'Corps d’état & objet', render: (i) => <div className="m-cell-2"><strong>{i.corps}</strong><span className="m-ellipsis">{i.objet}</span></div> },
    { key: 'tech', label: 'Technicien', width: 130, render: (i) => (i.tech ? <span className="m-cell-user"><Avatar name={TECH_BY_ID[i.tech].name} initials={TECH_BY_ID[i.tech].initials} color={TECH_BY_ID[i.tech].color} size={22} /> {TECH_BY_ID[i.tech].name}</span> : <span className="m-warn-text m-small">À affecter</span>) },
    { key: 'slot', label: 'Créneau', width: 120, render: (i) => <div className="m-cell-2"><strong className="m-mono m-small">{i.date}</strong><span className="m-mono">{i.start != null ? `${hhmm(i.start)}–${hhmm(i.end)}` : '—'}</span></div> },
    { key: 'status', label: 'Statut', width: 150, render: (i) => <StatusPill status={i.status}>{SHORT[i.status] || i.status}</StatusPill> },
    { key: 'rapport', label: 'Rapport', width: 120, render: (i) => <span className="m-cell-photos"><Camera size={14} /> {i.photos} <em>{i.rapport}</em></span> },
    {
      key: 'actions', label: '', width: 140, align: 'right', render: (i) => {
        const a = action(i);
        return (
          <div className="m-row-actions" onClick={(e) => e.stopPropagation()}>
            <Btn size="sm" variant={a.variant} icon={a.icon} onClick={a.run} data-testid={`mock-intervention-action-${i.ref}`}>{a.label}</Btn>
            <Menu testid={`mock-intervention-menu-${i.ref}`} trigger={<IconBtn icon={MoreHorizontal} label="Plus d’actions" />} items={[
              { label: 'Ouvrir la fiche', icon: Eye, onClick: () => setOpen(i.ref) },
              { label: 'Envoyer le rapport', icon: Mail, onClick: () => { setOpen(i.ref); setReport(true); } },
              { label: 'Voir les photos', icon: ImageIcon, onClick: () => setOpen(i.ref) },
              { label: 'Préparer la facture', icon: Receipt, onClick: () => toast('Ajoutée au bac « À vérifier »') },
            ]} />
          </div>
        );
      },
    },
  ];

  return (
    <Page
      testid="mock-screen-interventions"
      title="Interventions"
      subtitle="Suivi des chantiers, comptes-rendus terrain et rapports officiels."
      actions={(
        <>
          <Btn icon={Sheet} onClick={openExcel} data-testid="mock-interventions-export">Exporter</Btn>
          <Btn variant="primary" icon={Plus} onClick={() => setCreating(true)} data-testid="mock-interventions-new">Nouvelle intervention</Btn>
        </>
      )}
      subnav={(
        <SubNav
          testid="mock-interventions-status"
          value={status}
          onChange={setStatus}
          items={[{ id: 'all', label: 'Toutes', count: rows.length }, ...STATUSES.map((s) => ({ id: s, label: SHORT[s] || s, count: count(s), alert: s === 'Terminée — à valider' }))]}
        />
      )}
    >
      <div className="m-kpis m-kpis--4 m-kpis--compact">
        <Kpi label="Sur site maintenant" value={String(count('En cours'))} hint="Dont 1 urgence" icon={Wrench} tone="indigo" />
        <Kpi label="Planifiées" value={String(count('Planifiée'))} hint="Aujourd’hui et demain" icon={Clock} tone="blue" />
        <Kpi label="Rapports à valider" value={String(count('Terminée — à valider'))} hint="Avec photos terrain" icon={FileCheck2} tone="teal" />
        <Kpi label="À planifier" value={String(count('À planifier') + count('Non terminée'))} hint="Dont 1 pièce manquante" icon={CalendarPlus} tone="amber" />
      </div>
      <div className="m-toolbar">
        <SearchInput placeholder="Rechercher une référence, un client, une adresse…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="mock-interventions-search" />
        <Dropdown testid="mock-interventions-tech" icon={Users} value={tech} onChange={setTech} options={[{ id: 'all', label: 'Tous les techniciens' }, ...TECHS.map((t) => ({ id: t.id, label: t.name }))]} />
        {!isMobile && <Segmented testid="mock-interventions-view" value={view} onChange={setView} options={[{ id: 'table', label: 'Tableau', icon: LayoutList }, { id: 'kanban', label: 'Kanban', icon: Columns3 }]} />}
      </div>
      {view === 'table' || isMobile ? (
        <div className="m-card m-card--table">
          <DataTable
            testid="mock-interventions-table"
            columns={columns}
            rows={filtered}
            rowKey={(i) => i.ref}
            onRowClick={(i) => setOpen(i.ref)}
            rowClass={(i) => (i.kind === 'urgence' ? 'is-urgent' : '')}
            empty="Aucune intervention ne correspond à ces filtres."
            mobileCard={(i) => (
              <>
                <div className="m-mcard-top"><span className="m-mono">{i.ref}</span><StatusPill status={i.status}>{SHORT[i.status] || i.status}</StatusPill></div>
                <strong>{CLIENT_BY_ID[i.client].name}</strong>
                <span className="m-muted m-small">{i.corps} · {i.objet}</span>
                <div className="m-mcard-foot">
                  {i.tech ? <span className="m-cell-user"><Avatar name={TECH_BY_ID[i.tech].name} initials={TECH_BY_ID[i.tech].initials} color={TECH_BY_ID[i.tech].color} size={20} /> {TECH_BY_ID[i.tech].name}</span> : <span className="m-warn-text m-small">À affecter</span>}
                  <span className="m-mono m-small">{i.start != null ? `${hhmm(i.start)}–${hhmm(i.end)}` : '—'}</span>
                </div>
              </>
            )}
          />
        </div>
      ) : (
        <div className="m-kanban m-kanban--6" data-testid="mock-interventions-kanban">
          {STATUSES.map((s) => {
            const list = filtered.filter((i) => i.status === s);
            return (
              <div key={s} className="m-kcol">
                <header><StatusPill status={s}>{SHORT[s] || s}</StatusPill><em>{list.length}</em></header>
                {list.map((i) => (
                  <button key={i.ref} type="button" className="m-kcard" onClick={() => setOpen(i.ref)} data-testid={`mock-intervention-kcard-${i.ref}`}>
                    <span className="m-mono m-small">{i.ref}</span>
                    <strong>{CLIENT_BY_ID[i.client].name}</strong>
                    <span className="m-small m-muted">{i.objet}</span>
                    <div className="m-kcard-foot">
                      <span className="m-mono m-small">{i.start != null ? hhmm(i.start) : '—'}</span>
                      {i.tech ? <Avatar name={TECH_BY_ID[i.tech].name} initials={TECH_BY_ID[i.tech].initials} color={TECH_BY_ID[i.tech].color} size={22} /> : <Pill tone="amber">À affecter</Pill>}
                    </div>
                  </button>
                ))}
                {!list.length && <div className="m-kempty">Aucune</div>}
              </div>
            );
          })}
        </div>
      )}
      <FicheDrawer it={current} onClose={() => { setOpen(null); setReport(false); }} onReport={() => setReport(true)} onValidate={(it) => { validate(it); setOpen(null); }} />
      <EmailReportModal open={report && !!current} onClose={() => setReport(false)} intervention={current} />
      <NewInterventionModal open={creating} onClose={() => setCreating(false)} onCreate={create} />
    </Page>
  );
}
