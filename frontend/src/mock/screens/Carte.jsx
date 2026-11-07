import React, { useMemo, useState, useEffect } from 'react';
import { Maximize2, Minimize2, Route, Crosshair, Layers, Sparkles, Navigation, Clock, MapPin, CheckCircle2, X, Building } from 'lucide-react';
import { useMock, useToast, Page, SubNav, Kpi, Btn, Segmented, Avatar, Progress, Card, Pill, IconBtn } from '../ui';
import { MapView } from '../MapView';
import { TECHS, TECH_BY_ID, INTERVENTIONS, CLIENT_BY_ID, HQ, hhmm } from '../../data/sample';

export function buildRoutes(techFilter) {
  const techs = techFilter === 'all' ? TECHS : TECHS.filter((t) => t.id === techFilter);
  const stops = [];
  const routes = [];
  techs.forEach((t) => {
    const own = INTERVENTIONS.filter((i) => i.tech === t.id && ['Planifiée', 'En cours'].includes(i.status) && i.date === '06/11/2026').sort((a, b) => a.start - b.start);
    own.forEach((i, idx) => stops.push({ type: 'stop', pos: i.pos, color: t.color, label: String(idx + 1), popup: `${t.name} · étape ${idx + 1} · ${hhmm(i.start)} — ${CLIENT_BY_ID[i.client].name}` }));
    if (own.length) routes.push({ color: t.color, points: [t.pos, ...own.map((i) => i.pos), HQ.pos], dashed: true });
  });
  const positions = techs.map((t) => ({ type: 'tech', pos: t.pos, color: t.color, label: t.initials, popup: `${t.name} — ${t.status}` }));
  return { stops, routes, positions };
}

function ProgressPanel({ tech, onPick }) {
  return (
    <div className="m-route-panel" data-testid="mock-route-panel">
      <div className="m-route-panel-head"><strong>Avancement par technicien</strong><span className="m-muted m-small">Mis à jour il y a 1 min</span></div>
      {TECHS.map((t) => {
        const next = INTERVENTIONS.filter((i) => i.tech === t.id && ['Planifiée', 'En cours'].includes(i.status) && i.date === '06/11/2026').sort((a, b) => a.start - b.start)[0];
        return (
          <button key={t.id} type="button" className={`m-route-tech ${tech === t.id ? 'is-active' : ''}`} onClick={() => onPick(tech === t.id ? 'all' : t.id)} data-testid={`mock-route-tech-${t.id}`}>
            <Avatar name={t.name} initials={t.initials} color={t.color} size={30} />
            <div className="m-route-tech-text">
              <div className="m-route-tech-top"><strong>{t.name}</strong><span className="m-mono m-small">{t.done}/{t.total} · {Math.round((t.done / t.total) * 100)} %</span></div>
              <Progress value={(t.done / t.total) * 100} />
              <span className="m-small m-muted">{next ? <><Navigation size={12} /> {CLIENT_BY_ID[next.client].name} · {hhmm(next.start)}</> : <><CheckCircle2 size={12} /> Tournée terminée</>}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function Carte() {
  const { dir, isMobile } = useMock();
  const toast = useToast();
  const [mode, setMode] = useState('both');
  const [tech, setTech] = useState('all');
  const [full, setFull] = useState(false);
  const { stops, routes, positions } = useMemo(() => buildRoutes(tech), [tech]);
  const markers = [...(mode !== 'positions' ? stops : []), ...(mode !== 'route' ? positions : [])];
  const shownRoutes = mode !== 'positions' ? routes : [];
  useEffect(() => {
    if (!full) return undefined;
    const k = (e) => { if (e.key === 'Escape') setFull(false); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [full]);

  const modeCtl = (
    <Segmented testid="mock-map-mode" value={mode} onChange={setMode} options={[
      { id: 'positions', label: isMobile ? 'Positions' : 'Positions actuelles', icon: Crosshair },
      { id: 'route', label: isMobile ? 'Trajet' : 'Trajet restant', icon: Route },
      { id: 'both', label: 'Les deux', icon: Layers },
    ]} />
  );

  return (
    <Page
      testid="mock-screen-carte"
      title="Carte & tournées"
      subtitle={`Positions des techniciens et tournées du jour au départ du siège — ${HQ.addr}.`}
      actions={(
        <>
          {!isMobile && <Btn icon={Maximize2} onClick={() => setFull(true)} data-testid="mock-map-fullscreen">Plein écran</Btn>}
          <Btn variant="primary" icon={Sparkles} onClick={() => toast('Tournées recalculées : 6 km et 14 min économisés')} data-testid="mock-map-optimize">Optimiser les tournées</Btn>
        </>
      )}
      subnav={(
        <SubNav testid="mock-map-tech" value={tech} onChange={setTech} items={[{ id: 'all', label: 'Toute l’équipe', count: TECHS.length }, ...TECHS.map((t) => ({ id: t.id, label: t.name, count: t.total - t.done }))]} />
      )}
    >
      <div className="m-kpis m-kpis--4 m-kpis--compact">
        <Kpi label="Distance restante" value="38 km" hint="Tous techniciens" icon={Route} tone="blue" />
        <Kpi label="Temps de trajet estimé" value="1 h 25" hint="Trafic actuel inclus" icon={Clock} tone="indigo" />
        <Kpi label="Étapes restantes" value={String(stops.length)} hint="Interventions et visites" icon={MapPin} tone="amber" />
        <Kpi label="Missions terminées" value="2 / 11" hint="Retirées de la carte" icon={CheckCircle2} tone="green" />
      </div>
      <div className="m-toolbar">{modeCtl}<span className="m-muted m-small m-toolbar-note"><Building size={14} /> Départ et retour : siège ANELEC (sans GPS)</span></div>
      <div className="m-mapwrap">
        <div className="m-mapbox">
          {!full && <MapView testid="mock-map" tiles={dir.tiles} markers={markers} routes={shownRoutes} hq={mode !== 'positions' ? HQ : null} height={isMobile ? '420px' : '560px'} fitKey={`${mode}-${tech}`} />}
        </div>
        {!isMobile && <ProgressPanel tech={tech} onPick={setTech} />}
      </div>
      {isMobile && <Card title="Avancement" pad={false}><ProgressPanel tech={tech} onPick={setTech} /></Card>}

      {full && (
        <div className="m-cockpit" data-testid="mock-map-cockpit">
          <header className="m-cockpit-head">
            <strong>Cockpit tournées · en direct</strong>
            {modeCtl}
            <Pill tone="green">6 techniciens connectés</Pill>
            <IconBtn icon={Minimize2} label="Quitter le plein écran" onClick={() => setFull(false)} data-testid="mock-map-exit-fullscreen" />
          </header>
          <div className="m-cockpit-body">
            <MapView tiles={dir.tiles} markers={markers} routes={shownRoutes} hq={mode !== 'positions' ? HQ : null} height="100%" fitKey={`full-${mode}-${tech}`} />
            <ProgressPanel tech={tech} onPick={setTech} />
          </div>
          <button type="button" className="m-cockpit-close" onClick={() => setFull(false)} aria-label="Fermer"><X size={16} /> Échap pour quitter</button>
        </div>
      )}
    </Page>
  );
}
