import { useState, useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import {
  Euro,
  Gauge,
  TrendingUp,
  Timer,
  Copy,
  Trophy,
  Users,
  Layers,
  CalendarDays,
  FolderKanban,
  Receipt,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { Page, SubNav, Kpi, Btn, Card, Avatar, Progress, Dropdown, DataTable, Pill } from './ui';
import type { Intervention, Devis } from '../lib/api';
import {
  buildLedgerContext,
  buildDossiers,
  amountOf,
  hoursOf,
  plannedHours,
  isRevenue,
  isDone,
  dayOf,
  inPeriod,
  type Dossier,
  type Period,
} from '../lib/dossiers';
import toast from 'react-hot-toast';

interface ComptabiliteStudioViewProps {
  interventionsList: Intervention[];
  devisList: Devis[];
  techniciens: string[];
  onOpenDevis?: (d: Devis) => void;
  onOpenIntervention?: (i: Intervention) => void;
}

function eur(v: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}
function num(n: number, d = 1): string {
  return Number(n).toFixed(d).replace('.', ',');
}

export function ComptabiliteStudioView({
  interventionsList,
  devisList,
  techniciens,
  onOpenDevis,
  onOpenIntervention,
}: ComptabiliteStudioViewProps) {
  const [tab, setTab] = useState<'tech' | 'corps' | 'dossiers'>('tech');
  const [cost, setCost] = useState(35);
  const [period, setPeriod] = useState<Period>('month');
  const [onlyAnomalies, setOnlyAnomalies] = useState(false);

  const ctx = useMemo(() => buildLedgerContext(devisList, interventionsList), [devisList, interventionsList]);

  // Travaux terminés de la période (hors visites de chiffrage et annulations) : la seule base du CA
  const revenue = useMemo(
    () => interventionsList.filter((i) => isRevenue(i) && inPeriod(dayOf(i), period)),
    [interventionsList, period]
  );

  const rows = useMemo(() => {
    const names = new Set<string>(techniciens);
    revenue.forEach((i) => i.entreprise && names.add(i.entreprise));
    return Array.from(names)
      .map((tech) => {
        const own = revenue.filter((i) => i.entreprise === tech);
        const ca = own.reduce((s, i) => s + amountOf(i, ctx), 0);
        const reel = own.reduce((s, i) => s + hoursOf(i).hours, 0);
        const prev = own.reduce((s, i) => s + plannedHours(i), 0);
        const sansHoraires = own.filter((i) => hoursOf(i).source === 'aucun').length;
        const marge = ca - reel * cost;
        return {
          tech,
          missions: own.length,
          prev,
          reel,
          ca,
          perH: reel > 0 ? ca / reel : 0,
          marge,
          taux: ca > 0 ? (marge / ca) * 100 : 0,
          eff: reel > 0 && prev > 0 ? (prev / reel) * 100 : null,
          sansHoraires,
        };
      })
      .sort((a, b) => b.perH - a.perH || b.ca - a.ca);
  }, [revenue, techniciens, ctx, cost]);

  const corpsStats = useMemo(() => {
    const map = new Map<string, { corps: string; clotures: number; ca: number; heures: number }>();
    revenue.forEach((i) => {
      const k = i.corpsEtat || 'Non renseigné';
      const g = map.get(k) || { corps: k, clotures: 0, ca: 0, heures: 0 };
      g.clotures += 1;
      g.ca += amountOf(i, ctx);
      g.heures += hoursOf(i).hours;
      map.set(k, g);
    });
    return Array.from(map.values()).sort((a, b) => b.ca - a.ca);
  }, [revenue, ctx]);

  const dossiers = useMemo(() => buildDossiers(devisList, interventionsList, ctx), [devisList, interventionsList, ctx]);
  const dossiersShown = onlyAnomalies ? dossiers.filter((d) => d.anomalies.length > 0) : dossiers;
  const dossierTotals = useMemo(
    () => ({
      devis: dossiers.reduce((s, d) => s + (d.devis && /accept/i.test(d.devis.statutCommercial || '') ? d.devisMontant : 0), 0),
      realise: dossiers.reduce((s, d) => s + d.caRealise, 0),
      facture: dossiers.reduce((s, d) => s + d.facture, 0),
      reste: dossiers.reduce((s, d) => s + d.resteAFacturer, 0),
      anomalies: dossiers.filter((d) => d.anomalies.length > 0).length,
    }),
    [dossiers]
  );

  const totalCa = rows.reduce((s, r) => s + r.ca, 0);
  const totalHrs = rows.reduce((s, r) => s + r.reel, 0);
  const totalPrev = rows.reduce((s, r) => s + r.prev, 0);
  const totalMissions = rows.reduce((s, r) => s + r.missions, 0);
  const totalSansHoraires = rows.reduce((s, r) => s + r.sansHoraires, 0);
  const totalMarge = totalCa - totalHrs * cost;
  const maxPerH = Math.max(...rows.map((r) => r.perH), 1);
  const topTech = rows.find((r) => r.perH > 0) || null;
  const periodLabel = period === 'week' ? '7 derniers jours' : period === 'month' ? 'ce mois' : 'historique complet';

  const handleCopySynthese = () => {
    const text = `SYNTHÈSE DE GESTION (${new Date().toLocaleDateString('fr-FR')} — ${periodLabel})
• CA produit HT : ${eur(totalCa)} sur ${totalMissions} intervention${totalMissions > 1 ? 's' : ''} terminée${totalMissions > 1 ? 's' : ''}
• Rentabilité horaire moyenne : ${totalHrs > 0 ? `${eur(totalCa / totalHrs)}/h` : 'non calculable (horaires manquants)'}
• Marge brute : ${eur(totalMarge)}${totalCa > 0 ? ` (${Math.round((totalMarge / totalCa) * 100)} %)` : ''}
• Meilleure rentabilité : ${topTech ? `${topTech.tech} (${eur(topTech.perH)}/h)` : '—'}
• Heures retenues : ${num(totalHrs, 1)} h
• Dossiers : ${eur(dossierTotals.realise)} réalisés, ${eur(dossierTotals.facture)} facturés, ${eur(dossierTotals.reste)} restant à facturer`;
    navigator.clipboard?.writeText(text).then(
      () => toast.success('Synthèse de gestion copiée dans le presse-papier !'),
      () => toast.error('Copie impossible : autorisez l’accès au presse-papier')
    );
  };

  const techColumns = [
    {
      key: 'rank',
      label: '#',
      width: 48,
      render: (r: any) => <span className="m-rank m-mono" style={{ fontWeight: 700, color: 'var(--muted)' }}>{rows.indexOf(r) + 1}</span>,
    },
    {
      key: 'tech',
      label: 'Technicien',
      render: (r: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Avatar name={r.tech} size={26} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <strong style={{ fontSize: '13px', color: 'var(--text-strong)' }}>{r.tech}</strong>
            {r.sansHoraires > 0 && (
              <span style={{ fontSize: '11.5px', color: 'var(--warn)' }}>{r.sansHoraires} mission{r.sansHoraires > 1 ? 's' : ''} sans horaires</span>
            )}
          </div>
        </div>
      ),
    },
    { key: 'missions', label: 'Missions', align: 'right' as const, width: 90, render: (r: any) => <span className="m-mono" style={{ fontWeight: 600 }}>{r.missions}</span> },
    {
      key: 'h',
      label: 'Heures prévues / retenues',
      width: 200,
      render: (r: any) => (
        <span className="m-mono m-small">
          {num(r.prev, 1)} h / {num(r.reel, 1)} h{' '}
          {r.eff !== null && (
            <em style={{ fontStyle: 'normal', fontWeight: 700, color: r.eff >= 100 ? 'var(--ok)' : 'var(--warn)' }}>({Math.round(r.eff)} %)</em>
          )}
        </span>
      ),
    },
    { key: 'ca', label: 'CA produit HT', align: 'right' as const, width: 140, render: (r: any) => <span className="m-mono m-strong" style={{ fontSize: '13.5px' }}>{eur(r.ca)}</span> },
    {
      key: 'perH',
      label: 'Rentabilité horaire',
      width: 210,
      render: (r: any) =>
        r.perH > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ flex: 1 }}><Progress value={(r.perH / maxPerH) * 100} /></div>
            <span className="m-mono m-small" style={{ fontWeight: 700, minWidth: '60px' }}>{eur(r.perH)}/h</span>
          </div>
        ) : (
          <span className="m-small m-muted">—</span>
        ),
    },
    {
      key: 'marge',
      label: 'Marge brute',
      align: 'right' as const,
      width: 140,
      render: (r: any) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <strong className="m-mono" style={{ color: r.marge >= 0 ? 'var(--ok)' : 'var(--danger)' }}>{eur(r.marge)}</strong>
          <span className="m-mono m-small" style={{ color: 'var(--muted)' }}>{r.ca > 0 ? `${Math.round(r.taux)} %` : '—'}</span>
        </div>
      ),
    },
  ];

  const corpsColumns = [
    { key: 'corps', label: 'Corps d’état', render: (s: any) => <strong>{s.corps}</strong> },
    { key: 'clotures', label: 'Chantiers terminés', align: 'right' as const, render: (s: any) => <span className="m-mono">{s.clotures}</span> },
    { key: 'ca', label: 'CA HT', align: 'right' as const, render: (s: any) => <span className="m-mono m-strong">{eur(s.ca)}</span> },
    { key: 'h', label: 'Heures retenues', align: 'right' as const, render: (s: any) => <span className="m-mono">{s.heures > 0 ? `${num(s.heures, 1)} h` : '—'}</span> },
    { key: 'marge', label: 'Marge brute', align: 'right' as const, render: (s: any) => <span className="m-mono">{eur(s.ca - s.heures * cost)}</span> },
    {
      key: 'pct',
      label: 'Taux de marge',
      render: (s: any) => {
        const t = s.ca > 0 ? ((s.ca - s.heures * cost) / s.ca) * 100 : 0;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ flex: 1 }}><Progress value={Math.max(0, t)} /></div>
            <span className="m-mono m-small">{s.ca > 0 ? `${Math.round(t)} %` : '—'}</span>
          </div>
        );
      },
    },
  ];

  const dossierColumns = [
    {
      key: 'di',
      label: 'N° de DI',
      width: 150,
      render: (d: Dossier) =>
        d.di ? <span className="m-mono m-strong">{d.di}</span> : <span className="m-small m-muted">— sans DI —</span>,
    },
    {
      key: 'devis',
      label: 'Client & devis',
      render: (d: Dossier) => (
        <div className="m-cell-2">
          <strong>{d.client}</strong>
          <span className="m-ellipsis m-small m-muted">
            {d.devis ? `${d.devis.reference || `DEV-${d.devis.id}`} · ${d.devis.statutCommercial}` : 'Intervention directe (sans devis)'}
          </span>
        </div>
      ),
    },
    { key: 'montant', label: 'Devis HT', align: 'right' as const, width: 110, render: (d: Dossier) => <span className="m-mono">{d.devis ? eur(d.devisMontant) : '—'}</span> },
    {
      key: 'intv',
      label: 'Interventions',
      width: 130,
      render: (d: Dossier) => (
        <span className="m-small">
          {d.travaux.length} travaux{d.visites.length > 0 ? ` · ${d.visites.length} visite${d.visites.length > 1 ? 's' : ''}` : ''}
          {d.travaux.length > 0 && ` (${d.travaux.filter(isDone).length} term.)`}
        </span>
      ),
    },
    { key: 'ca', label: 'CA réalisé', align: 'right' as const, width: 110, render: (d: Dossier) => <span className="m-mono m-strong">{eur(d.caRealise)}</span> },
    { key: 'fact', label: 'Facturé', align: 'right' as const, width: 100, render: (d: Dossier) => <span className="m-mono">{eur(d.facture)}</span> },
    {
      key: 'reste',
      label: 'Reste à facturer',
      align: 'right' as const,
      width: 130,
      render: (d: Dossier) => <span className="m-mono" style={{ color: d.resteAFacturer > 0 ? 'var(--warn)' : undefined, fontWeight: 600 }}>{eur(d.resteAFacturer)}</span>,
    },
    {
      key: 'controle',
      label: 'Contrôle',
      width: 230,
      render: (d: Dossier) =>
        d.anomalies.length === 0 ? (
          <Pill tone="green">Cohérent</Pill>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {d.anomalies.map((a) => (
              <Pill key={a} tone="amber">{a}</Pill>
            ))}
          </div>
        ),
    },
  ];

  const openDossier = (d: Dossier) => {
    if (d.devis && onOpenDevis) onOpenDevis(d.devis);
    else if (d.travaux[0] && onOpenIntervention) onOpenIntervention(d.travaux[0]);
    else if (d.visites[0] && onOpenIntervention) onOpenIntervention(d.visites[0]);
  };

  return (
    <Page
      testid="screen-comptabilite"
      title="Comptabilité & équipe"
      subtitle="Rentabilité horaire, marges brutes et suivi financier des dossiers (DI), calculés sur les interventions réellement terminées."
      actions={
        <>
          <Dropdown
            testid="compta-period"
            icon={CalendarDays}
            value={period}
            onChange={(v) => setPeriod(v as Period)}
            options={[
              { id: 'week', label: '7 derniers jours' },
              { id: 'month', label: 'Ce mois' },
              { id: 'all', label: 'Historique complet' },
            ]}
          />
          <Btn variant="primary" icon={Copy} onClick={handleCopySynthese}>
            Copier la synthèse direction
          </Btn>
        </>
      }
      subnav={
        <SubNav
          testid="compta-tabs"
          value={tab}
          onChange={(v) => setTab(v as any)}
          items={[
            { id: 'tech', label: 'Par technicien', count: rows.length, icon: Users },
            { id: 'corps', label: 'Par corps d’état', count: corpsStats.length, icon: Layers },
            { id: 'dossiers', label: 'Dossiers (DI)', count: dossiers.length, icon: FolderKanban },
          ]}
        />
      }
    >
      {tab !== 'dossiers' ? (
        <div className="m-kpis m-kpis--4">
          <Kpi testid="compta-kpi-ca" label="CA produit HT" value={eur(totalCa)} hint={`${totalMissions} intervention${totalMissions > 1 ? 's' : ''} terminée${totalMissions > 1 ? 's' : ''} · ${periodLabel}`} icon={Euro} tone="blue" />
          <Kpi testid="compta-kpi-hour" label="Rentabilité horaire" value={totalHrs > 0 ? `${eur(totalCa / totalHrs)}/h` : '—'} hint={totalHrs > 0 ? `${num(totalHrs, 1)} h retenues` : 'Aucun horaire renseigné'} icon={Gauge} tone="indigo" />
          <Kpi testid="compta-kpi-marge" label="Marge brute" value={eur(totalMarge)} delta={totalCa > 0 ? `${Math.round((totalMarge / totalCa) * 100)} %` : undefined} up={totalMarge >= 0} hint={`Coût chargé : ${cost} €/h`} icon={TrendingUp} tone="green" />
          <Kpi testid="compta-kpi-eff" label="Efficience des délais" value={totalPrev > 0 && totalHrs > 0 ? `${Math.round((totalPrev / totalHrs) * 100)} %` : '—'} hint={totalSansHoraires > 0 ? `${totalSansHoraires} mission${totalSansHoraires > 1 ? 's' : ''} sans horaires` : `${num(totalPrev, 1)} h prévues / ${num(totalHrs, 1)} h`} icon={Timer} tone="amber" />
        </div>
      ) : (
        <div className="m-kpis m-kpis--4">
          <Kpi testid="compta-kpi-devis" label="Devis acceptés HT" value={eur(dossierTotals.devis)} hint="Montants signés" icon={FileText} tone="blue" />
          <Kpi testid="compta-kpi-realise" label="CA réalisé" value={eur(dossierTotals.realise)} hint="Interventions terminées" icon={Euro} tone="indigo" />
          <Kpi testid="compta-kpi-facture" label="Facturé" value={eur(dossierTotals.facture)} hint={`${eur(dossierTotals.reste)} restant à facturer`} icon={Receipt} tone="green" />
          <Kpi
            testid="compta-kpi-anomalies"
            label="Dossiers à contrôler"
            value={String(dossierTotals.anomalies)}
            hint={onlyAnomalies ? 'Cliquer pour tout afficher' : 'Cliquer pour filtrer'}
            icon={AlertTriangle}
            tone="amber"
            onClick={() => setOnlyAnomalies((v) => !v)}
          />
        </div>
      )}

      {tab !== 'dossiers' && (
        <div className="m-compta-top" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', margin: '14px 0' }}>
          <Card title="Coût horaire chargé" subtitle="Simulez l’impact sur les marges" icon={Gauge} testid="compta-cost-card">
            <div className="m-slider" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input type="range" min="25" max="60" step="1" value={cost} onChange={(e) => setCost(Number(e.target.value))} style={{ width: '100%', cursor: 'pointer' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong className="m-mono" style={{ fontSize: '18px', color: 'var(--primary)' }}>{cost} €/h</strong>
                <span className="m-muted m-small">salaire + charges + véhicule</span>
              </div>
              <div className="m-slider-scale m-mono m-small" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}>
                <span>25 €</span><span>40 €</span><span>60 €</span>
              </div>
            </div>
          </Card>

          <Card title="Meilleure rentabilité" icon={Trophy} testid="compta-top">
            {topTech ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '6px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Avatar name={topTech.tech} size={42} />
                  <div>
                    <strong style={{ fontSize: '14px', color: 'var(--text-strong)' }}>{topTech.tech}</strong>
                    <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>Leader rentabilité</span>
                  </div>
                </div>
                <Pill tone="green">{eur(topTech.perH)}/h</Pill>
              </div>
            ) : (
              <p className="m-small m-muted" style={{ margin: 0, padding: '8px 0' }}>
                Disponible dès qu’une intervention terminée a ses horaires (début / fin) et un montant.
              </p>
            )}
          </Card>

          <Card title="Rentabilité par technicien" subtitle="€ HT par heure retenue" testid="compta-chart">
            <div style={{ height: 130, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows.filter((r) => r.perH > 0).map((r) => ({ name: r.tech, v: Math.round(r.perH) }))} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                  <Tooltip cursor={{ fill: 'var(--surface-2)' }} formatter={(v: any) => [`${v} €/h`, 'Rentabilité']} />
                  <Bar dataKey="v" radius={[6, 6, 0, 0]} barSize={22}>
                    {rows.filter((r) => r.perH > 0).map((r, i) => (
                      <Cell key={r.tech} fill={i === 0 ? '#1D4ED8' : '#60A5FA'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      <div className="m-card m-card--table" style={tab === 'dossiers' ? { marginTop: 14 } : undefined}>
        <header className="m-card-head">
          <div className="m-card-titles">
            <h2>{tab === 'tech' ? 'Classement des techniciens' : tab === 'corps' ? 'Marges par corps d’état' : 'Suivi financier par dossier (N° de DI)'}</h2>
            <p>
              {tab === 'dossiers'
                ? 'Un DI relie un devis à ses interventions. Les visites de chiffrage ne comptent pas dans le CA. Cliquez une ligne pour ouvrir le dossier.'
                : `Interventions terminées (hors visites de chiffrage) · ${periodLabel} · coût horaire ${cost} €/h`}
            </p>
          </div>
        </header>
        {tab === 'tech' && (
          <DataTable
            testid="compta-table"
            columns={techColumns}
            rows={rows}
            rowKey={(r) => r.tech}
            empty="Aucun technicien enregistré. Ajoutez votre équipe dans Paramètres métier."
            mobileCard={(r) => (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Avatar name={r.tech} size={24} /><strong>{r.tech}</strong></span>
                  <Pill tone="green">{r.perH > 0 ? `${eur(r.perH)}/h` : '—'}</Pill>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                  <span className="m-small m-muted">CA {eur(r.ca)}</span>
                  <span className="m-mono m-strong">Marge {eur(r.marge)}</span>
                </div>
              </>
            )}
          />
        )}
        {tab === 'corps' && (
          <DataTable
            testid="compta-corps-table"
            columns={corpsColumns}
            rows={corpsStats}
            rowKey={(s) => s.corps}
            empty="Aucune intervention terminée sur la période."
            mobileCard={(s) => (
              <>
                <strong>{s.corps}</strong>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                  <span className="m-small m-muted">{s.clotures} chantiers terminés</span>
                  <span className="m-mono m-strong">{eur(s.ca)}</span>
                </div>
              </>
            )}
          />
        )}
        {tab === 'dossiers' && (
          <DataTable
            testid="compta-dossiers-table"
            columns={dossierColumns}
            rows={dossiersShown}
            rowKey={(d) => d.key}
            onRowClick={openDossier}
            empty={onlyAnomalies ? 'Aucune anomalie : tous les dossiers sont cohérents.' : 'Aucun dossier. Créez un devis ou une intervention avec un numéro de DI.'}
            mobileCard={(d) => (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong className="m-mono">{d.di || 'Sans DI'}</strong>
                  {d.anomalies.length === 0 ? <Pill tone="green">Cohérent</Pill> : <Pill tone="amber">{d.anomalies.length} point{d.anomalies.length > 1 ? 's' : ''}</Pill>}
                </div>
                <span className="m-small">{d.client}</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span className="m-small m-muted">Devis {d.devis ? eur(d.devisMontant) : '—'}</span>
                  <span className="m-mono m-strong">Réalisé {eur(d.caRealise)}</span>
                </div>
              </>
            )}
          />
        )}
      </div>
    </Page>
  );
}
