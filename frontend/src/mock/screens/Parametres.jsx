import React, { useState } from 'react';
import { SlidersHorizontal, Users, Building2, Wrench, BanknoteArrowUp, FileText, Plus, Edit3, ChevronRight, Check } from 'lucide-react';
import { useMock, useToast, Page, Tabs, Card, Btn, Pill, Avatar, SearchInput, Input, Field, StatusPill, DataTable, Dropdown, Switch } from '../ui';
import { CORPS, TECHS, TECH_BY_ID, CLIENTS, eur } from '../../data/sample';

const BAREMES = [
  { corps: 'Électricité', ht: 55, min: 1, deplacement: 35 },
  { corps: 'Plomberie', ht: 58, min: 1, deplacement: 35 },
  { corps: 'CVC / Climatisation', ht: 62, min: 1.5, deplacement: 40 },
  { corps: 'Chauffage', ht: 60, min: 1.5, deplacement: 40 },
  { corps: 'Serrurerie', ht: 65, min: 0.5, deplacement: 30 },
  { corps: 'Menuiserie', ht: 54, min: 1, deplacement: 35 },
  { corps: 'Peinture', ht: 42, min: 2, deplacement: 30 },
  { corps: 'Plâtrerie', ht: 44, min: 2, deplacement: 30 },
  { corps: 'Faux plafond', ht: 46, min: 1.5, deplacement: 30 },
  { corps: 'Revêtement de sol', ht: 48, min: 2, deplacement: 30 },
  { corps: 'Maçonnerie', ht: 52, min: 2, deplacement: 35 },
  { corps: 'Tous corps d’état', ht: 60, min: 1, deplacement: 40 },
];

const TVA = [
  { label: 'Autoliquidation B2B', rate: '—', usage: 'Chantiers sous-traitance' },
  { label: 'TVA 10 % réduite', rate: '10 %', usage: 'Rénovation locatif / copro' },
  { label: 'TVA 20 % standard', rate: '20 %', usage: 'Neuf, pro, hors-service' },
  { label: 'TVA 5,5 %', rate: '5,5 %', usage: 'Rénovation énergétique' },
];

const NUMBERS = [
  { kind: 'Devis', mask: 'DEV-AAAA-###', last: 'DEV-2026-008' },
  { kind: 'Intervention', mask: 'INT-AAAA-###', last: 'INT-2026-014' },
  { kind: 'Facture', mask: 'F-AAAA-####', last: 'F-2026-0187' },
];

function MatriceCompetences() {
  const [q, setQ] = useState('');
  const filtered = TECHS.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Card title="Matrice des compétences" subtitle="Qui peut intervenir sur quel corps d’état (utilisé pour les suggestions de dispatch)." icon={Users} actions={<Btn size="sm" icon={Plus} data-testid="mock-param-competence-add">Ajouter un technicien</Btn>} testid="mock-param-competences">
      <div className="m-toolbar" style={{ marginBottom: 10 }}>
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un technicien…" data-testid="mock-param-competence-search" />
      </div>
      <div className="m-table-wrap">
        <table className="m-table m-table--compact" data-testid="mock-param-competences-table">
          <thead>
            <tr>
              <th style={{ width: 160 }}>Technicien</th>
              {CORPS.slice(0, 11).map((c) => <th key={c} style={{ textAlign: 'center' }}>{c.split(' / ')[0]}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id}>
                <td><span className="m-cell-user"><Avatar name={t.name} initials={t.initials} color={t.color} size={22} /> {t.name}</span></td>
                {CORPS.slice(0, 11).map((c) => (
                  <td key={c} style={{ textAlign: 'center' }}>
                    {t.skills.includes(c)
                      ? <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: 6, background: 'color-mix(in srgb, var(--ok) 14%, white)', color: 'var(--ok)', alignItems: 'center', justifyContent: 'center' }}><Check size={13} /></span>
                      : <span className="m-muted m-mono" style={{ fontSize: 11 }}>—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function BaremesHoraires() {
  const toast = useToast();
  return (
    <Card title="Barèmes horaires & déplacements" subtitle="Appliqués par défaut lors de la création d’un devis ou d’une intervention." icon={BanknoteArrowUp} testid="mock-param-baremes">
      <DataTable
        testid="mock-param-baremes-table"
        columns={[
          { key: 'corps', label: 'Corps d’état', render: (b) => <strong>{b.corps}</strong> },
          { key: 'ht', label: 'Taux horaire HT', align: 'right', render: (b) => <span className="m-mono">{eur(b.ht)} / h</span> },
          { key: 'min', label: 'Durée minimum', align: 'right', render: (b) => <span className="m-mono">{b.min} h</span> },
          { key: 'deplacement', label: 'Forfait déplacement', align: 'right', render: (b) => <span className="m-mono">{eur(b.deplacement)}</span> },
          {
            key: 'actions',
            label: '',
            width: 140,
            align: 'right',
            render: (b) => <Btn size="sm" variant="ghost" icon={Edit3} onClick={() => toast(`Édition du barème ${b.corps}`, 'info')} data-testid={`mock-param-bareme-edit-${b.corps}`}>Modifier</Btn>,
          },
        ]}
        rows={BAREMES}
        rowKey={(b) => b.corps}
      />
    </Card>
  );
}

function CorpsEtats() {
  return (
    <Card title="Corps d’état" subtitle="Utilisés pour le filtrage, les suggestions et les statistiques." icon={Wrench} actions={<Btn size="sm" icon={Plus} data-testid="mock-param-corps-add">Ajouter</Btn>} testid="mock-param-corps">
      <div className="m-chips">
        {CORPS.map((c) => <span key={c} className="m-chip is-on" data-testid={`mock-param-corps-${c}`}>{c}</span>)}
      </div>
      <p className="m-muted m-small" style={{ marginTop: 10 }}>Les corps d’état sont partagés par les modules Devis, Interventions et Facturation.</p>
    </Card>
  );
}

function Numerotation() {
  return (
    <Card title="Numérotation automatique" subtitle="Format des références générées pour chaque pièce." icon={FileText} testid="mock-param-numbers">
      <DataTable
        testid="mock-param-numbers-table"
        columns={[
          { key: 'kind', label: 'Document', render: (r) => <strong>{r.kind}</strong> },
          { key: 'mask', label: 'Format', render: (r) => <span className="m-mono">{r.mask}</span> },
          { key: 'last', label: 'Dernier émis', render: (r) => <span className="m-mono">{r.last}</span> },
          { key: 'actions', label: '', align: 'right', width: 120, render: (r) => <Btn size="sm" variant="ghost" icon={Edit3} data-testid={`mock-param-numbers-edit-${r.kind}`}>Modifier</Btn> },
        ]}
        rows={NUMBERS}
        rowKey={(r) => r.kind}
      />
    </Card>
  );
}

function FacturationParams() {
  const [autoliq, setAutoliq] = useState(true);
  const [defaultTva, setDefaultTva] = useState('tva20');
  return (
    <Card title="Régles de facturation" subtitle="Appliquées par défaut sur les factures générées." icon={BanknoteArrowUp} testid="mock-param-facturation">
      <div className="m-grid-2">
        <Field label="Régime TVA par défaut (B2B)">
          <Dropdown testid="mock-param-tva" value={defaultTva} onChange={setDefaultTva} options={[{ id: 'auto', label: 'Autoliquidation' }, { id: 'tva20', label: 'TVA 20 % standard' }, { id: 'tva10', label: 'TVA 10 % réduite' }]} />
        </Field>
        <Field label="Délai de règlement par défaut"><Input defaultValue="30 jours fin de mois" data-testid="mock-param-payment-delay" /></Field>
      </div>
      <div className="m-form-sec-row">
        <div>
          <strong style={{ fontSize: 13.5 }}>Appliquer l’autoliquidation sur les chantiers sous-traitance</strong>
          <p className="m-muted m-small" style={{ margin: 0 }}>Détectée automatiquement si le donneur d’ordre est en régime « Autoliquidation ».</p>
        </div>
        <Switch testid="mock-param-autoliq" checked={autoliq} onChange={setAutoliq} />
      </div>
      <div style={{ marginTop: 10 }}>
        <strong style={{ fontSize: 13 }}>Taux de TVA disponibles</strong>
        <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {TVA.map((t) => (
            <li key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
              <strong style={{ flex: 1, fontSize: 13 }}>{t.label}</strong>
              <Pill tone="slate">{t.rate}</Pill>
              <span className="m-muted m-small" style={{ flex: 1, textAlign: 'right' }}>{t.usage}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function DonneursTab() {
  const { go } = useMock();
  return (
    <Card title="Donneurs d’ordre & clients" subtitle="Fiches, consignes et e-mails d’envoi des rapports." icon={Building2} actions={<Btn size="sm" iconRight={ChevronRight} onClick={() => go('donneurs-ordre')} data-testid="mock-param-open-clients">Ouvrir le module</Btn>} testid="mock-param-donneurs">
      <DataTable
        testid="mock-param-donneurs-table"
        columns={[
          { key: 'name', label: 'Nom', render: (c) => <strong>{c.name}</strong> },
          { key: 'type', label: 'Type', render: (c) => <Pill tone={c.type === 'B2B' ? 'blue' : 'green'}>{c.type}</Pill> },
          { key: 'tva', label: 'Régime TVA' },
          { key: 'delay', label: 'Délai contractuel' },
          { key: 'ca', label: 'CA 2026', align: 'right', render: (c) => <span className="m-mono">{eur(c.ca)}</span> },
        ]}
        rows={CLIENTS}
        rowKey={(c) => c.id}
        onRowClick={() => go('donneurs-ordre')}
      />
    </Card>
  );
}

export default function Parametres() {
  const [tab, setTab] = useState('metier');
  return (
    <Page
      testid="mock-screen-parametres"
      title="Paramètres métier"
      subtitle="Référentiels, barèmes et règles automatiques utilisés par toute la plateforme."
    >
      <Tabs
        testid="mock-parametres-tabs"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'metier', label: 'Référentiels métier' },
          { id: 'bareme', label: 'Barèmes & TVA' },
          { id: 'numero', label: 'Numérotation' },
          { id: 'clients', label: 'Donneurs d’ordre' },
        ]}
      />
      {tab === 'metier' && (<><CorpsEtats /><MatriceCompetences /></>)}
      {tab === 'bareme' && (<><BaremesHoraires /><FacturationParams /></>)}
      {tab === 'numero' && <Numerotation />}
      {tab === 'clients' && <DonneursTab />}
    </Page>
  );
}
