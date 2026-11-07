import React, { useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell } from 'recharts';
import { Euro, Receipt, FileText, Camera, AlertTriangle, ArrowRight, Siren, Send, CalendarDays, ChevronRight, Clock, Wrench, CalendarRange, LayoutGrid, Activity, PieChart } from 'lucide-react';
import { useMock, useToast, Page, SubNav, Kpi, Card, Btn, Avatar, Pill, StatusPill, KindTag, Progress, Dropdown } from '../ui';
import { NewMenu } from '../Overlays';
import { BLOCKS, TECHS, TECH_BY_ID, CA_MONTHS, CA_BY_CLIENT, CORPS_STATS, FUNNEL, DEVIS, BOURSE, FACTU, CLIENT_BY_ID, eur, hhmm, num } from '../../data/sample';

const PRIORITIES = [
  { icon: Camera, tone: 'teal', title: 'Valider le rapport terrain', meta: 'INT-2026-004 · EMALEC · 6 photos reçues de Jamal', amount: 2100, cta: 'Valider', to: 'interventions' },
  { icon: Siren, tone: 'red', title: 'Affecter l’urgence', meta: 'INT-2026-010 · Fuite sur colonne EU · Presta maintenance', amount: 420, cta: 'Affecter', to: 'planning' },
  { icon: Receipt, tone: 'green', title: 'Facturer 2 interventions terminées', meta: 'GMS et M. et Mme Martin · rapports validés', amount: 2390, cta: 'Facturer', to: 'facturation' },
  { icon: Send, tone: 'blue', title: 'Relancer le devis envoyé', meta: 'DEV-2026-002 · C-Multi-Serv · envoyé il y a 9 jours', amount: 4200, cta: 'Relancer', to: 'devis' },
  { icon: AlertTriangle, tone: 'amber', title: 'Chantier bloqué : pièce manquante', meta: 'INT-2026-012 · EMALEC · disjoncteur différentiel 63 A', amount: 1600, cta: 'Diagnostic', to: 'facturation' },
];

function ChartTip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="m-chart-tip">
      <strong>{label}</strong>
      <span>{eur(payload[0].value)} HT</span>
    </div>
  );
}

function Synthese() {
  const { go, dir } = useMock();
  const toast = useToast();
  const today = [...BLOCKS].sort((a, b) => a.start - b.start).slice(0, 7);
  const c = dir.chart;
  return (
    <div className="m-dash m-dash--synthese" data-testid="mock-dashboard-synthese">
      <div className="m-kpis m-kpis--4">
        <Kpi testid="mock-kpi-ca" label="CA travaux réalisés" value={eur(47200)} delta="+12 %" hint="vs octobre · 3 clôturées" icon={Euro} tone="blue" spark={[31, 28, 36, 34, 41, 39, 30, 22, 44, 48, 47]} />
        <Kpi testid="mock-kpi-facturer" label="Prêt à facturer" value={eur(4200)} delta="+2" hint="2 chantiers validés" icon={Receipt} tone="green" onClick={() => go('facturation')} action="Ouvrir la facturation" />
        <Kpi testid="mock-kpi-devis" label="Devis à suivre" value="6" delta="50 % signés" hint={`${eur(40350)} en portefeuille`} icon={FileText} tone="amber" onClick={() => go('devis')} action="Voir les devis" />
        <Kpi testid="mock-kpi-rapports" label="Rapports à valider" value="1" hint="INT-2026-004 · 6 photos" icon={Camera} tone="teal" onClick={() => go('interventions')} action="Valider" />
      </div>

      <Card className="m-dash-priority" title="À traiter en priorité" subtitle="Classé par impact financier et urgence" icon={AlertTriangle} testid="mock-priority-card">
        <ul className="m-prio">
          {PRIORITIES.map((p, i) => (
            <li key={p.title} className="m-prio-item">
              <span className={`m-prio-ic m-tone-${p.tone}`}><p.icon size={16} /></span>
              <div className="m-prio-text">
                <strong>{p.title}</strong>
                <span>{p.meta}</span>
              </div>
              <span className="m-prio-amount m-mono">{eur(p.amount)}</span>
              <Btn size="sm" variant={i === 0 ? 'primary' : 'secondary'} onClick={() => go(p.to)} data-testid={`mock-priority-action-${i}`}>{p.cta}</Btn>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="m-dash-today" title="Planning du jour" subtitle="11 missions · 6 techniciens · 3 à affecter" icon={CalendarRange} actions={<Btn size="sm" variant="ghost" iconRight={ArrowRight} onClick={() => go('planning')} data-testid="mock-today-open-planning">Planning</Btn>} testid="mock-today-card">
        <ul className="m-agenda">
          {today.map((b) => {
            const t = TECH_BY_ID[b.tech];
            return (
              <li key={b.id} className={`m-agenda-item m-agenda--${b.kind}`}>
                <span className="m-agenda-time m-mono">{hhmm(b.start)}<small>{hhmm(b.end)}</small></span>
                <i className="m-agenda-bar" />
                <div className="m-agenda-text">
                  <strong>{b.client} · <span className="m-mono">{b.ref}</span></strong>
                  <span>{b.label}</span>
                </div>
                <Avatar name={t.name} initials={t.initials} color={t.color} size={26} />
                <KindTag kind={b.kind} />
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="m-dash-chart" title="Chiffre d’affaires 2026" subtitle="Montants HT par mois · novembre en cours" icon={Activity} actions={<Pill tone="green">+14 % sur 12 mois</Pill>} testid="mock-ca-chart">
        <div className="m-chart" style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={CA_MONTHS} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id={`ca-${dir.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c[0]} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={c[0]} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="m" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip content={<ChartTip />} cursor={{ stroke: 'var(--border-strong)' }} />
              <Area type="monotone" dataKey="ca" stroke={c[0]} strokeWidth={2.5} fill={`url(#ca-${dir.id})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="m-dash-team" title="Équipe aujourd’hui" subtitle="5 pointés sur 6" icon={Clock} testid="mock-team-card">
        <ul className="m-team">
          {TECHS.map((t) => (
            <li key={t.id}>
              <Avatar name={t.name} initials={t.initials} color={t.color} size={30} />
              <div className="m-team-text">
                <strong>{t.name}</strong>
                <span>{t.since ? `Pointé à ${t.since}` : 'Pas encore pointé'}</span>
              </div>
              <div className="m-team-prog">
                <span className="m-mono m-small">{t.done}/{t.total}</span>
                <Progress value={(t.done / t.total) * 100} tone={t.since ? 'primary' : 'danger'} />
              </div>
              {!t.since && <Btn size="sm" variant="ghost" onClick={() => toast(`Rappel envoyé à ${t.name}`, 'info')} data-testid={`mock-team-remind-${t.id}`}>Relancer</Btn>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Operations() {
  const { go } = useMock();
  const toast = useToast();
  const hours = (tid, kind) => BLOCKS.filter((b) => b.tech === tid && (!kind || b.kind === kind)).reduce((s, b) => s + (b.end - b.start), 0);
  const toConvert = DEVIS.filter((d) => d.status === 'Accepté' && !d.linked);
  const toRelance = DEVIS.filter((d) => d.status === 'Envoyé' || d.status === 'En négociation');
  const toBill = FACTU.filter((f) => f.bucket === 'a-facturer');
  return (
    <div className="m-dash m-dash--ops" data-testid="mock-dashboard-operations">
      <div className="m-banner m-tone-teal" data-testid="mock-ops-banner">
        <Camera size={18} />
        <div><strong>1 rapport terrain avec photos attend votre vérification</strong><span>Dernière déclaration : INT-2026-004 (Jamal) à 10:34</span></div>
        <Btn size="sm" variant="primary" onClick={() => go('interventions')} data-testid="mock-ops-banner-action">Vérifier</Btn>
      </div>
      <Card title="Capacité des équipes" subtitle="Heures planifiées sur une journée de 8 h" icon={LayoutGrid} actions={<Btn size="sm" variant="ghost" iconRight={ArrowRight} onClick={() => go('planning')} data-testid="mock-ops-open-planning">Ouvrir le planning</Btn>} testid="mock-capacity-card">
        <div className="m-capa">
          {TECHS.map((t) => {
            const tr = hours(t.id, 'travaux'); const vi = hours(t.id, 'visite'); const ur = hours(t.id, 'urgence');
            const tot = tr + vi + ur;
            return (
              <div key={t.id} className="m-capa-row">
                <span className="m-capa-name"><Avatar name={t.name} initials={t.initials} color={t.color} size={24} /> {t.name}</span>
                <div className="m-capa-bar">
                  <i className="m-capa-seg m-capa--travaux" style={{ width: `${(tr / 8) * 100}%` }} />
                  <i className="m-capa-seg m-capa--visite" style={{ width: `${(vi / 8) * 100}%` }} />
                  <i className="m-capa-seg m-capa--urgence" style={{ width: `${(ur / 8) * 100}%` }} />
                </div>
                <span className={`m-capa-val m-mono ${tot > 7.5 ? 'is-full' : ''}`}>{num(tot, 1)} h</span>
              </div>
            );
          })}
          <div className="m-legend"><span><i className="m-capa--travaux" />Travaux</span><span><i className="m-capa--visite" />Visites devis</span><span><i className="m-capa--urgence" />Urgences</span></div>
        </div>
      </Card>
      <div className="m-ops-grid">
        <Card title="Devis acceptés à convertir" subtitle={`${toConvert.length} signé sans intervention`} icon={FileText} testid="mock-ops-convert">
          {toConvert.map((d) => (
            <div key={d.ref} className="m-ops-item">
              <div><strong className="m-mono">{d.ref}</strong><span>{CLIENT_BY_ID[d.client].name} · {d.objet}</span></div>
              <Btn size="sm" variant="primary" onClick={() => toast(`Intervention créée depuis ${d.ref}`)} data-testid={`mock-ops-convert-${d.ref}`}>Convertir</Btn>
            </div>
          ))}
        </Card>
        <Card title="Missions à planifier" subtitle={`${BOURSE.length} en attente de créneau`} icon={CalendarDays} testid="mock-ops-dispatch">
          {BOURSE.map((b) => (
            <div key={b.id} className="m-ops-item">
              <div><strong><span className="m-mono">{b.ref}</span> <KindTag kind={b.kind} /></strong><span>{b.client} · {b.city}</span></div>
              <Btn size="sm" onClick={() => go('planning')} data-testid={`mock-ops-dispatch-${b.ref}`}>Planifier</Btn>
            </div>
          ))}
        </Card>
        <Card title="Devis à relancer" subtitle={`${toRelance.length} sans réponse`} icon={Send} testid="mock-ops-relance">
          {toRelance.map((d) => (
            <div key={d.ref} className="m-ops-item">
              <div><strong className="m-mono">{d.ref}</strong><span>{CLIENT_BY_ID[d.client].name} · {eur(d.ht)}</span></div>
              <Btn size="sm" onClick={() => toast(`Relance envoyée pour ${d.ref}`)} data-testid={`mock-ops-relance-${d.ref}`}>Relancer</Btn>
            </div>
          ))}
        </Card>
        <Card title="Interventions à facturer" subtitle={`${toBill.length} prêtes · ${eur(toBill.reduce((s, f) => s + f.ht, 0))} HT`} icon={Receipt} testid="mock-ops-bill">
          {toBill.map((f) => (
            <div key={f.ref} className="m-ops-item">
              <div><strong className="m-mono">{f.ref}</strong><span>{CLIENT_BY_ID[f.client].name} · {eur(f.ht)} HT</span></div>
              <Btn size="sm" onClick={() => go('facturation')} data-testid={`mock-ops-bill-${f.ref}`}>Facturer</Btn>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function Analyse() {
  const { dir, go } = useMock();
  const c = dir.chart;
  const data = [...CA_BY_CLIENT].sort((a, b) => b.ca - a.ca);
  return (
    <div className="m-dash m-dash--analyse" data-testid="mock-dashboard-analyse">
      <Card title="Entonnoir d’avancement" subtitle="Du chiffrage à la facturation, en temps réel" icon={PieChart} actions={<Pill tone="green">Synchronisé</Pill>} testid="mock-funnel">
        <ol className="m-funnel">
          {FUNNEL.map((f, i) => (
            <li key={f.step}>
              <span className="m-funnel-step">Étape {i + 1}</span>
              <strong>{f.step}</strong>
              <b className="m-funnel-val">{f.value}</b>
              <small>{f.hint}</small>
              {i < FUNNEL.length - 1 && <ChevronRight className="m-funnel-arrow" size={18} />}
            </li>
          ))}
        </ol>
      </Card>
      <div className="m-kpis m-kpis--4">
        <Kpi label="Pipeline devis en cours" value={eur(40350)} hint="6 chiffrages émis" icon={FileText} tone="blue" />
        <Kpi label="Devis signés" value={eur(24750)} delta="+3" hint="3 devis validés" icon={Euro} tone="green" />
        <Kpi label="Taux de transformation" value="50 %" delta="+8 pts" hint="Signatures / devis émis" icon={Activity} tone="teal" />
        <Kpi label="Panier moyen" value={eur(6725)} delta="-4 %" up={false} hint="Par dossier chiffré" icon={Wrench} tone="amber" />
      </div>
      <div className="m-grid-2 m-grid-2--wide">
        <Card title="CA par donneur d’ordre" subtitle="Année 2026, HT" testid="mock-ca-client-chart">
          <div className="m-chart" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickFormatter={(v) => `${v / 1000}k`} />
                <YAxis type="category" dataKey="name" width={130} tickLine={false} axisLine={false} tick={{ fill: 'var(--text)', fontSize: 12 }} />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar dataKey="ca" radius={[0, 6, 6, 0]} barSize={16}>
                  {data.map((d, i) => <Cell key={d.name} fill={c[i % c.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Performance par corps d’état" subtitle="Chantiers, devis et complétion" pad={false} actions={<Btn size="sm" variant="ghost" iconRight={ArrowRight} onClick={() => go('comptabilite')} data-testid="mock-analyse-open-compta">Rentabilité</Btn>} testid="mock-corps-table">
          <table className="m-table m-table--compact">
            <thead><tr><th>Corps d’état</th><th style={{ textAlign: 'right' }}>Actifs</th><th style={{ textAlign: 'right' }}>Clôturés</th><th style={{ textAlign: 'right' }}>CA HT</th><th>Complétion</th></tr></thead>
            <tbody>
              {CORPS_STATS.map((s) => (
                <tr key={s.corps}>
                  <td><strong>{s.corps}</strong></td>
                  <td style={{ textAlign: 'right' }} className="m-mono">{s.actifs}</td>
                  <td style={{ textAlign: 'right' }} className="m-mono">{s.clotures}</td>
                  <td style={{ textAlign: 'right' }} className="m-mono">{eur(s.ca)}</td>
                  <td><div className="m-inline-prog"><Progress value={s.pct} /><span className="m-mono m-small">{s.pct} %</span></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [tab, setTab] = useState('synthese');
  const [period, setPeriod] = useState('month');
  return (
    <Page
      testid="mock-screen-dashboard"
      eyebrow="Vendredi 6 novembre 2026"
      title="Tableau de bord"
      subtitle="Vue d’ensemble de l’activité, des interventions et du chiffre d’affaires."
      actions={(
        <>
          <Dropdown testid="mock-dashboard-period" icon={CalendarDays} value={period} onChange={setPeriod} options={[{ id: 'today', label: 'Aujourd’hui' }, { id: 'week', label: 'Cette semaine' }, { id: 'month', label: 'Novembre 2026' }, { id: 'year', label: 'Année 2026' }]} />
          <NewMenu />
        </>
      )}
      subnav={(
        <SubNav
          testid="mock-dashboard-tabs"
          value={tab}
          onChange={setTab}
          items={[
            { id: 'synthese', label: 'Synthèse', icon: LayoutGrid },
            { id: 'operations', label: 'Opérations', count: 3, alert: true, icon: Wrench },
            { id: 'analyse', label: 'Analyse', icon: PieChart },
          ]}
        />
      )}
    >
      {tab === 'synthese' && <Synthese />}
      {tab === 'operations' && <Operations />}
      {tab === 'analyse' && <Analyse />}
    </Page>
  );
}

export { StatusPill };
