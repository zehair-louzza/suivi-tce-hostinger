import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { Euro, Gauge, TrendingUp, Timer, Copy, Trophy, Users, Layers, CalendarDays } from 'lucide-react';
import { useMock, useToast, Page, SubNav, Kpi, Btn, Card, Avatar, Progress, Dropdown, DataTable, Pill } from '../ui';
import { RENTA, TECH_BY_ID, CORPS_STATS, eur, num } from '../../data/sample';

export default function Comptabilite() {
  const { dir } = useMock();
  const toast = useToast();
  const [tab, setTab] = useState('tech');
  const [cost, setCost] = useState(35);
  const [period, setPeriod] = useState('month');
  const rows = useMemo(() => RENTA.map((r) => {
    const perH = r.ca / r.reel;
    const marge = r.ca - r.reel * cost;
    return { ...r, perH, marge, taux: (marge / r.ca) * 100, eff: (r.prev / r.reel) * 100 };
  }).sort((a, b) => b.perH - a.perH), [cost]);
  const ca = rows.reduce((s, r) => s + r.ca, 0);
  const hrs = rows.reduce((s, r) => s + r.reel, 0);
  const prev = rows.reduce((s, r) => s + r.prev, 0);
  const marge = ca - hrs * cost;
  const maxH = Math.max(...rows.map((r) => r.perH));
  const top = rows[0];
  const c = dir.chart;

  const techCols = [
    { key: 'rank', label: '#', width: 48, render: (r) => <span className="m-rank m-mono">{rows.indexOf(r) + 1}</span> },
    { key: 'tech', label: 'Technicien', render: (r) => { const t = TECH_BY_ID[r.tech]; return <span className="m-cell-user"><Avatar name={t.name} initials={t.initials} color={t.color} size={26} /><span className="m-cell-2"><strong>{t.name}</strong><span>{t.skills.slice(0, 2).join(' · ')}</span></span></span>; } },
    { key: 'missions', label: 'Missions', align: 'right', width: 90, render: (r) => <span className="m-mono">{r.missions}</span> },
    { key: 'h', label: 'Heures prévues / réelles', width: 170, render: (r) => <span className="m-mono m-small">{num(r.prev, 1)} h / {num(r.reel, 1)} h <em className={r.eff >= 100 ? 'm-ok-text' : 'm-warn-text'}>({Math.round(r.eff)} %)</em></span> },
    { key: 'ca', label: 'CA produit HT', align: 'right', width: 130, render: (r) => <span className="m-mono m-strong">{eur(r.ca)}</span> },
    { key: 'perH', label: 'Rentabilité horaire', width: 200, render: (r) => <div className="m-inline-prog"><Progress value={(r.perH / maxH) * 100} /><span className="m-mono m-small">{eur(r.perH)}/h</span></div> },
    { key: 'marge', label: 'Marge brute', align: 'right', width: 140, render: (r) => <div className="m-cell-2 m-right"><strong className="m-mono">{eur(r.marge)}</strong><span className="m-mono">{Math.round(r.taux)} %</span></div> },
  ];
  const corpsCols = [
    { key: 'corps', label: 'Corps d’état', render: (s) => <strong>{s.corps}</strong> },
    { key: 'clotures', label: 'Chantiers clôturés', align: 'right', render: (s) => <span className="m-mono">{s.clotures}</span> },
    { key: 'ca', label: 'CA HT', align: 'right', render: (s) => <span className="m-mono m-strong">{eur(s.ca)}</span> },
    { key: 'h', label: 'Heures estimées', align: 'right', render: (s) => <span className="m-mono">{num(s.ca / 380, 1)} h</span> },
    { key: 'marge', label: 'Marge estimée', align: 'right', render: (s) => <span className="m-mono">{eur(s.ca - (s.ca / 380) * cost)}</span> },
    { key: 'pct', label: 'Taux de marge', render: (s) => { const t = ((s.ca - (s.ca / 380) * cost) / s.ca) * 100; return <div className="m-inline-prog"><Progress value={t} /><span className="m-mono m-small">{Math.round(t)} %</span></div>; } },
  ];

  return (
    <Page
      testid="mock-screen-comptabilite"
      title="Comptabilité & équipe"
      subtitle="Rentabilité horaire, marges brutes et productivité des équipes terrain."
      actions={(
        <>
          <Dropdown testid="mock-compta-period" icon={CalendarDays} value={period} onChange={setPeriod} options={[{ id: 'week', label: '7 derniers jours' }, { id: 'month', label: 'Novembre 2026' }, { id: 'all', label: 'Historique complet' }]} />
          <Btn variant="primary" icon={Copy} onClick={() => toast('Synthèse direction copiée — prête à coller dans un e-mail')} data-testid="mock-compta-copy">Copier la synthèse direction</Btn>
        </>
      )}
      subnav={<SubNav testid="mock-compta-tabs" value={tab} onChange={setTab} items={[{ id: 'tech', label: 'Par technicien', count: rows.length, icon: Users }, { id: 'corps', label: 'Par corps d’état', count: CORPS_STATS.length, icon: Layers }]} />}
    >
      <div className="m-kpis m-kpis--4">
        <Kpi testid="mock-compta-kpi-ca" label="CA produit HT" value={eur(ca)} delta="+9 %" hint={`${rows.reduce((s, r) => s + r.missions, 0)} missions clôturées`} icon={Euro} tone="blue" />
        <Kpi testid="mock-compta-kpi-hour" label="Rentabilité horaire" value={`${eur(ca / hrs)}/h`} hint={`${num(hrs, 1)} h réelles pointées`} icon={Gauge} tone="indigo" />
        <Kpi testid="mock-compta-kpi-marge" label="Marge brute globale" value={eur(marge)} delta={`${Math.round((marge / ca) * 100)} %`} hint={`Coût chargé : ${cost} €/h`} icon={TrendingUp} tone="green" />
        <Kpi testid="mock-compta-kpi-eff" label="Efficience des délais" value={`${Math.round((prev / hrs) * 100)} %`} hint={`${num(prev, 1)} h prévues / ${num(hrs, 1)} h réelles`} icon={Timer} tone="amber" />
      </div>
      <div className="m-compta-top">
        <Card title="Coût horaire chargé" subtitle="Simulez l’impact sur les marges" icon={Gauge} testid="mock-compta-cost-card">
          <div className="m-slider">
            <input type="range" min="25" max="60" step="1" value={cost} onChange={(e) => setCost(Number(e.target.value))} data-testid="mock-compta-cost-slider" style={{ '--v': `${((cost - 25) / 35) * 100}%` }} />
            <div className="m-slider-val"><strong className="m-mono" data-testid="mock-compta-cost-value">{cost} €/h</strong><span className="m-muted m-small">salaire + charges + véhicule</span></div>
          </div>
          <div className="m-slider-scale m-mono m-small"><span>25 €</span><span>40 €</span><span>60 €</span></div>
        </Card>
        <Card title="Meilleure rentabilité" icon={Trophy} testid="mock-compta-top">
          <div className="m-top-tech">
            <Avatar name={TECH_BY_ID[top.tech].name} initials={TECH_BY_ID[top.tech].initials} color={TECH_BY_ID[top.tech].color} size={44} />
            <div><strong>{TECH_BY_ID[top.tech].name}</strong><span className="m-muted m-small">{TECH_BY_ID[top.tech].skills.join(' · ')}</span></div>
            <Pill tone="green">{eur(top.perH)}/h</Pill>
          </div>
        </Card>
        <Card title="Rentabilité par technicien" subtitle="€ HT par heure pointée" testid="mock-compta-chart">
          <div className="m-chart" style={{ height: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows.map((r) => ({ name: TECH_BY_ID[r.tech].name, v: Math.round(r.perH) }))} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                <Tooltip cursor={{ fill: 'var(--surface-2)' }} formatter={(v) => [`${v} €/h`, 'Rentabilité']} />
                <Bar dataKey="v" radius={[6, 6, 0, 0]} barSize={22}>{rows.map((r, i) => <Cell key={r.tech} fill={i === 0 ? c[1] : c[0]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <div className="m-card m-card--table">
        <header className="m-card-head"><div className="m-card-titles"><h2>{tab === 'tech' ? 'Classement des techniciens' : 'Marges par corps d’état'}</h2><p>Recalculé en direct avec un coût de {cost} €/h</p></div></header>
        {tab === 'tech' ? (
          <DataTable testid="mock-compta-table" columns={techCols} rows={rows} rowKey={(r) => r.tech} mobileCard={(r) => { const t = TECH_BY_ID[r.tech]; return (<><div className="m-mcard-top"><span className="m-cell-user"><Avatar name={t.name} initials={t.initials} color={t.color} size={24} /> <strong>{t.name}</strong></span><Pill tone="green">{eur(r.perH)}/h</Pill></div><div className="m-mcard-foot"><span className="m-small m-muted">CA {eur(r.ca)}</span><span className="m-mono m-strong">Marge {eur(r.marge)}</span></div></>); }} />
        ) : (
          <DataTable testid="mock-compta-corps-table" columns={corpsCols} rows={CORPS_STATS} rowKey={(s) => s.corps} mobileCard={(s) => (<><strong>{s.corps}</strong><div className="m-mcard-foot"><span className="m-small m-muted">{s.clotures} clôturés</span><span className="m-mono m-strong">{eur(s.ca)}</span></div></>)} />
        )}
      </div>
    </Page>
  );
}
