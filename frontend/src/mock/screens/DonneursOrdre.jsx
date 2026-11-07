import React, { useMemo, useState } from 'react';
import { Plus, Mail, Phone, MapPin, FileText, Wrench, Building2, Home, Pencil, Hash, Clock, Euro, Users, ShieldCheck } from 'lucide-react';
import { useMock, useToast, Page, SubNav, Kpi, Btn, Pill, SearchInput, Drawer, Tabs, Card, Field, Input, Modal, Segmented } from '../ui';
import { CLIENTS, CORPS, INTERVENTIONS, DEVIS, eur } from '../../data/sample';

const RATES = { 'Électricité': 62, Plomberie: 58, 'CVC / Climatisation': 68, Chauffage: 60, Serrurerie: 55, Menuiserie: 52, Peinture: 45, Plâtrerie: 48 };

function Fiche({ c, onClose }) {
  const { go } = useMock();
  const [tab, setTab] = useState('infos');
  if (!c) return null;
  const hist = [...INTERVENTIONS.filter((i) => i.client === c.id).map((i) => ({ ref: i.ref, label: i.objet, date: i.date, ht: i.ht, s: i.status })), ...DEVIS.filter((d) => d.client === c.id).map((d) => ({ ref: d.ref, label: d.objet, date: d.created, ht: d.ht, s: d.status }))];
  return (
    <Drawer open onClose={onClose} testid="mock-client-drawer"
      head={<div className="m-drawer-tags"><Pill tone={c.type === 'B2B' ? 'blue' : 'amber'} dot={false}>{c.kind} · {c.type}</Pill></div>}
      title={c.name} subtitle={`${c.contact} — ${c.role}`}
      footer={<><Btn icon={FileText} onClick={() => go('devis', '?new=1')} data-testid="mock-client-new-devis">Nouveau devis</Btn><Btn variant="primary" icon={Wrench} onClick={() => go('interventions', '?new=1')} data-testid="mock-client-new-intervention">Nouvelle intervention</Btn></>}>
      <Tabs testid="mock-client-tabs" value={tab} onChange={setTab} items={[{ id: 'infos', label: 'Fiche technique' }, { id: 'contacts', label: 'E-mails d’envoi', count: c.emails.length }, { id: 'tarifs', label: 'Grille tarifaire' }, { id: 'histo', label: 'Historique', count: hist.length }]} />
      {tab === 'infos' && (
        <>
          <div className="m-amounts">
            <div><span>CA 2026 HT</span><strong className="m-mono">{eur(c.ca)}</strong></div>
            <div><span>Interventions</span><strong className="m-mono">{c.jobs}</strong></div>
            <div><span>Régime TVA</span><strong>{c.tva}</strong></div>
          </div>
          <dl className="m-dl">
            <div><dt>Adresse</dt><dd><MapPin size={14} /> {c.address}</dd></div>
            <div><dt>Téléphone</dt><dd><Phone size={14} /> {c.phone}</dd></div>
            <div><dt>SIRET</dt><dd className="m-mono">{c.siret || '— (particulier)'}</dd></div>
            <div><dt>Délai contractuel</dt><dd><Clock size={14} /> {c.delay}</dd></div>
          </dl>
          <div className="m-callout m-callout--note"><strong>Consignes particulières d’intervention</strong><p>{c.consignes}</p></div>
        </>
      )}
      {tab === 'contacts' && (
        <div className="m-emails">
          {c.emails.map((e) => (
            <div key={e.email} className="m-email-row"><Mail size={16} /><span><strong>{e.email}</strong><small>Service : {e.label}</small></span><Pill tone="green">Envoi des rapports</Pill></div>
          ))}
          <Btn icon={Plus} variant="ghost" data-testid="mock-client-add-email">Ajouter un service / e-mail</Btn>
          <p className="m-small m-muted">Les rapports d’intervention sont envoyés automatiquement au bon service selon le type de document.</p>
        </div>
      )}
      {tab === 'tarifs' && (
        <table className="m-table m-table--compact">
          <thead><tr><th>Corps d’état</th><th style={{ textAlign: 'right' }}>Taux horaire HT</th><th style={{ textAlign: 'right' }}>Déplacement</th></tr></thead>
          <tbody>{Object.entries(RATES).map(([k, v]) => <tr key={k}><td>{k}</td><td style={{ textAlign: 'right' }} className="m-mono">{v} €</td><td style={{ textAlign: 'right' }} className="m-mono">35 €</td></tr>)}</tbody>
        </table>
      )}
      {tab === 'histo' && (
        <ul className="m-hist">
          {hist.map((h) => <li key={h.ref}><span className="m-mono">{h.ref}</span><span className="m-hist-label">{h.label}</span><span className="m-mono m-small">{eur(h.ht)}</span><Pill tone="slate">{h.s}</Pill></li>)}
          {!hist.length && <li className="m-muted">Aucun dossier pour l’instant</li>}
        </ul>
      )}
    </Drawer>
  );
}

export default function DonneursOrdre() {
  const { go } = useMock();
  const toast = useToast();
  const [type, setType] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newType, setNewType] = useState('B2B');
  const list = useMemo(() => CLIENTS.filter((c) => (type === 'all' || c.type === type) && `${c.name} ${c.contact} ${c.address} ${c.emails.map((e) => e.email).join(' ')}`.toLowerCase().includes(q.toLowerCase())), [type, q]);
  const ca = CLIENTS.reduce((s, c) => s + c.ca, 0);
  return (
    <Page
      testid="mock-screen-donneurs"
      title="Donneurs d’ordre"
      subtitle="Fiches entreprises et particuliers, contacts et e-mails d’envoi des rapports."
      actions={<Btn variant="primary" icon={Plus} onClick={() => setCreating(true)} data-testid="mock-clients-new">Nouvelle fiche</Btn>}
      subnav={<SubNav testid="mock-clients-type" value={type} onChange={setType} items={[{ id: 'all', label: 'Toutes les fiches', count: CLIENTS.length }, { id: 'B2B', label: 'Professionnels (B2B)', count: CLIENTS.filter((c) => c.type === 'B2B').length, icon: Building2 }, { id: 'B2C', label: 'Particuliers (B2C)', count: CLIENTS.filter((c) => c.type === 'B2C').length, icon: Home }]} />}
    >
      <div className="m-kpis m-kpis--4 m-kpis--compact">
        <Kpi label="Donneurs d’ordre B2B" value="6" hint="Grands comptes et gestionnaires" icon={Building2} tone="blue" />
        <Kpi label="Particuliers B2C" value="1" hint="Copropriétés et particuliers" icon={Home} tone="amber" />
        <Kpi label="E-mails d’envoi configurés" value="7 / 7" hint="Envoi des rapports en 1 clic" icon={Mail} tone="green" />
        <Kpi label="CA 2026 HT" value={eur(ca)} hint="Tous donneurs d’ordre" icon={Euro} tone="indigo" />
      </div>
      <div className="m-toolbar"><SearchInput placeholder="Rechercher un nom, un contact, un e-mail, une ville…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="mock-clients-search" /></div>
      <div className="m-client-grid" data-testid="mock-clients-grid">
        {list.map((c) => (
          <article key={c.id} className="m-client" data-testid={`mock-client-card-${c.id}`}>
            <header>
              <span className="m-client-mark">{c.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>
              <div><strong>{c.name}</strong><span>{c.contact}</span></div>
              <Pill tone={c.type === 'B2B' ? 'blue' : 'amber'} dot={false}>{c.type}</Pill>
            </header>
            <ul className="m-client-info">
              <li><Mail size={14} /><span className="m-ellipsis">{c.emails[0].email}</span>{c.emails.length > 1 && <em>+{c.emails.length - 1}</em>}</li>
              <li><Phone size={14} /><span>{c.phone}</span></li>
              <li><MapPin size={14} /><span className="m-ellipsis">{c.address}</span></li>
              {c.siret && <li><Hash size={14} /><span className="m-mono">{c.siret}</span></li>}
            </ul>
            <div className="m-client-stats"><div><span>CA 2026</span><strong className="m-mono">{eur(c.ca)}</strong></div><div><span>Dossiers</span><strong className="m-mono">{c.jobs}</strong></div><div><span>Délai</span><strong>{c.delay}</strong></div></div>
            <footer>
              <Btn size="sm" variant="ghost" icon={FileText} onClick={() => go('devis', '?new=1')} data-testid={`mock-client-devis-${c.id}`}>Devis</Btn>
              <Btn size="sm" variant="ghost" icon={Wrench} onClick={() => go('interventions', '?new=1')} data-testid={`mock-client-intervention-${c.id}`}>Intervention</Btn>
              <Btn size="sm" onClick={() => setOpen(c.id)} data-testid={`mock-client-open-${c.id}`}>Fiche</Btn>
            </footer>
          </article>
        ))}
        {!list.length && <Card><div className="m-empty">Aucune fiche ne correspond à « {q} ».</div></Card>}
      </div>
      <Fiche c={CLIENTS.find((c) => c.id === open)} onClose={() => setOpen(null)} />
      <Modal open={creating} onClose={() => setCreating(false)} icon={Users} title="Nouvelle fiche donneur d’ordre" width={600} testid="mock-client-new-modal"
        footer={<><Btn variant="ghost" onClick={() => setCreating(false)}>Annuler</Btn><Btn variant="primary" onClick={() => { setCreating(false); toast('Fiche créée — disponible dans les devis et interventions'); }} data-testid="mock-client-new-save">Enregistrer la fiche</Btn></>}>
        <Segmented testid="mock-client-new-type" value={newType} onChange={setNewType} options={[{ id: 'B2B', label: 'Professionnel (B2B)', icon: Building2 }, { id: 'B2C', label: 'Particulier (B2C)', icon: Home }]} />
        <div className="m-grid-2">
          <Field label={newType === 'B2B' ? 'Raison sociale' : 'Nom et prénom'} required><Input placeholder={newType === 'B2B' ? 'Ex. Nexity Gestion' : 'Ex. Mme Dupont'} data-testid="mock-client-new-name" /></Field>
          {newType === 'B2B' && <Field label="SIRET"><Input icon={Hash} placeholder="14 chiffres" data-testid="mock-client-new-siret" /></Field>}
        </div>
        <Field label="E-mail d’envoi des rapports" required><Input icon={Mail} placeholder="rapports@entreprise.fr" data-testid="mock-client-new-email" /></Field>
        <Field label="Consignes d’intervention"><textarea className="m-textarea" rows={3} placeholder="Accès, badges, photos obligatoires…" /></Field>
        <p className="m-small m-muted"><ShieldCheck size={13} /> Corps d’état disponibles : {CORPS.slice(0, 6).join(', ')}…</p>
      </Modal>
    </Page>
  );
}

export { Pencil };
