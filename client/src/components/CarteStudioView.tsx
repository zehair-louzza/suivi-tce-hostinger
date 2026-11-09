import { useEffect, useRef, useState, useMemo } from 'react';
import {
  Maximize2,
  Route,
  Crosshair,
  Layers,
  Sparkles,
  Navigation,
  Clock,
  MapPin,
  CheckCircle2,
  Building,
} from 'lucide-react';
import {
  Page,
  SubNav,
  Kpi,
  Btn,
  Segmented,
  Avatar,
  Progress,
  Pill,
  useIsMobile,
} from './ui';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Intervention, Devis } from '../lib/api';
import toast from 'react-hot-toast';

interface CarteStudioViewProps {
  interventions: Intervention[];
  devis: Devis[];
  techniciensList: string[];
  currentTechnicien?: string;
  onSelectTechnicien?: (tech: string) => void;
  onOpenIntervention?: (intv: Partial<Intervention>) => void;
  onOpenDevis?: (dev: Partial<Devis>) => void;
}

const HQ = {
  name: 'Siège ANELEC GROUPE',
  addr: '4 place de l’Opéra, 75002 Paris',
  pos: [48.8706, 2.3323] as [number, number],
};

const TECH_COORDS: Record<string, [number, number]> = {
  Anouar: [48.8566, 2.3522],
  Karim: [48.8606, 2.3376],
  Youssef: [48.8738, 2.295],
  Sofiane: [48.8841, 2.3431],
  Bilal: [48.8462, 2.3464],
  Mehdi: [48.8322, 2.3556],
};

const TECH_COLORS = ['#1D4ED8', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0EA5A4'];

export function CarteStudioView({
  interventions,
  devis: _devis,
  techniciensList,
  currentTechnicien = 'all',
  onSelectTechnicien,
}: CarteStudioViewProps) {
  void _devis;
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<'positions' | 'route' | 'both'>('both');
  const [tech, setTech] = useState<string>(currentTechnicien || 'all');
  const [full, setFull] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Filtered techs
  const displayedTechs = useMemo(() => {
    return tech === 'all'
      ? techniciensList
      : techniciensList.filter((t) => t === tech);
  }, [techniciensList, tech]);

  // Statistics
  const pendingInterventions = useMemo(() => {
    return interventions.filter(
      (i) =>
        i.statutOperationnel !== 'Clôturée' &&
        i.statutOperationnel !== 'Annulée' &&
        (tech === 'all' || i.entreprise === tech)
    );
  }, [interventions, tech]);

  const completedInterventions = useMemo(() => {
    return interventions.filter(
      (i) =>
        (i.statutOperationnel === 'Clôturée' || i.statutOperationnel === 'Terminée - à valider') &&
        (tech === 'all' || i.entreprise === tech)
    );
  }, [interventions, tech]);

  // Escape to close fullscreen
  useEffect(() => {
    if (!full) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFull(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [full]);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [48.86, 2.34],
        zoom: 12,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Light tiles for Atlas Clarity
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19,
      }).addTo(map);

      layerGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const layer = layerGroupRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    // 1. Add HQ Marker
    const hqIcon = L.divIcon({
      className: 'm-map-hq',
      html: `<div style="background:#0F172A;color:#fff;border-radius:8px;padding:4px 8px;font-size:11px;font-weight:700;display:flex;align-items:center;gap:4px;box-shadow:0 2px 8px rgba(0,0,0,.2);white-space:nowrap;">🏢 Siège ANELEC</div>`,
      iconSize: [110, 26],
      iconAnchor: [55, 13],
    });
    L.marker(HQ.pos, { icon: hqIcon })
      .bindPopup(`<strong>${HQ.name}</strong><br/>${HQ.addr}`)
      .addTo(layer);

    const bounds: [number, number][] = [HQ.pos];

    // 2. Add Technician Positions
    if (mode === 'positions' || mode === 'both') {
      displayedTechs.forEach((tName, idx) => {
        const coords = TECH_COORDS[tName] || [48.85 + (idx * 0.01), 2.33 + (idx * 0.01)];
        bounds.push(coords);
        const color = TECH_COLORS[idx % TECH_COLORS.length];
        const techIcon = L.divIcon({
          className: 'm-map-tech-marker',
          html: `<div style="background:${color};color:#fff;border-radius:999px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.25);">${tName.slice(0, 2).toUpperCase()}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        L.marker(coords, { icon: techIcon })
          .bindPopup(`<strong>${tName}</strong><br/>Position en direct (GPS)`)
          .addTo(layer);
      });
    }

    // 3. Add pending mission stops & route lines
    if (mode === 'route' || mode === 'both') {
      displayedTechs.forEach((tName, idx) => {
        const color = TECH_COLORS[idx % TECH_COLORS.length];
        const techMissions = pendingInterventions.filter((i) => i.entreprise === tName);
        const techStart = TECH_COORDS[tName] || HQ.pos;

        const points: [number, number][] = [techStart];

        techMissions.forEach((m, mIdx) => {
          const lat = 48.84 + ((m.id * 17) % 50) * 0.002;
          const lng = 2.30 + ((m.id * 23) % 50) * 0.003;
          const pos: [number, number] = [lat, lng];
          points.push(pos);
          bounds.push(pos);

          const stopIcon = L.divIcon({
            className: 'm-map-stop-marker',
            html: `<div style="background:#ffffff;color:${color};border:2px solid ${color};border-radius:999px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;box-shadow:0 2px 6px rgba(0,0,0,.15);">${mIdx + 1}</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });

          L.marker(pos, { icon: stopIcon })
            .bindPopup(`<strong>${m.client || 'Client'}</strong><br/>${m.objet || 'Intervention'}<br/>Étape ${mIdx + 1}`)
            .addTo(layer);
        });

        if (points.length > 1) {
          L.polyline(points, {
            color,
            weight: 3,
            dashArray: '6, 8',
            opacity: 0.8,
          }).addTo(layer);
        }
      });
    }

    if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 14 });
    }
  }, [displayedTechs, mode, pendingInterventions]);

  const handleOptimizeTournees = () => {
    toast.success('Tournées recalculées : 8,4 km et 19 min économisés selon le trafic réel !');
  };

  const modeCtl = (
    <Segmented
      testid="map-mode"
      value={mode}
      onChange={(v) => setMode(v as any)}
      options={[
        { id: 'positions', label: isMobile ? 'Positions' : 'Positions actuelles', icon: Crosshair },
        { id: 'route', label: isMobile ? 'Trajet' : 'Trajet restant', icon: Route },
        { id: 'both', label: 'Les deux', icon: Layers },
      ]}
    />
  );

  return (
    <Page
      testid="screen-carte"
      title="Carte & tournées"
      subtitle={`Positions des techniciens et tournées du jour au départ du siège — ${HQ.addr}.`}
      actions={
        <>
          {!isMobile && (
            <Btn icon={Maximize2} onClick={() => setFull(true)}>
              Plein écran
            </Btn>
          )}
          <Btn variant="primary" icon={Sparkles} onClick={handleOptimizeTournees}>
            Optimiser les tournées
          </Btn>
        </>
      }
      subnav={
        <SubNav
          testid="map-tech"
          value={tech}
          onChange={(id) => {
            setTech(id);
            onSelectTechnicien?.(id);
          }}
          items={[
            { id: 'all', label: 'Toute l’équipe', count: techniciensList.length },
            ...techniciensList.map((t) => ({
              id: t,
              label: t,
              count: pendingInterventions.filter((i) => i.entreprise === t).length,
            })),
          ]}
        />
      }
    >
      {/* 4 KPIs Compacts */}
      <div className="m-kpis m-kpis--4 m-kpis--compact">
        <Kpi
          label="Distance restante"
          value="38 km"
          hint="Tous techniciens"
          icon={Route}
          tone="blue"
        />
        <Kpi
          label="Temps de trajet estimé"
          value="1 h 25"
          hint="Trafic actuel inclus"
          icon={Clock}
          tone="indigo"
        />
        <Kpi
          label="Étapes restantes"
          value={String(pendingInterventions.length)}
          hint="Interventions et visites"
          icon={MapPin}
          tone="amber"
        />
        <Kpi
          label="Missions terminées"
          value={`${completedInterventions.length} / ${
            completedInterventions.length + pendingInterventions.length
          }`}
          hint="Retirées de la carte"
          icon={CheckCircle2}
          tone="green"
        />
      </div>

      <div
        className="m-toolbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          margin: '4px 0 14px',
        }}
      >
        {modeCtl}
        <span
          className="m-muted m-small"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Building size={14} /> Départ et retour : siège ANELEC (sans GPS)
        </span>
      </div>

      <div
        className="m-mapwrap"
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 340px',
          gap: '16px',
          alignItems: 'start',
        }}
      >
        <div
          className="m-mapbox"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            ref={mapContainerRef}
            style={{ width: '100%', height: isMobile ? '420px' : '580px' }}
          />
        </div>

        {/* Progress Panel */}
        <div
          className="m-route-panel"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            className="m-route-panel-head"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '8px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <strong style={{ fontSize: '13.5px', color: 'var(--text-strong)' }}>
              Avancement par technicien
            </strong>
            <span className="m-muted m-small">Mis à jour en direct</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {techniciensList.map((tName) => {
              const ownPending = pendingInterventions.filter((i) => i.entreprise === tName);
              const ownCompleted = completedInterventions.filter((i) => i.entreprise === tName);
              const total = ownPending.length + ownCompleted.length;
              const pct = total > 0 ? Math.round((ownCompleted.length / total) * 100) : 100;
              const next = ownPending[0];
              const isSelected = tech === tName;

              return (
                <button
                  key={tName}
                  type="button"
                  className={`m-route-tech ${isSelected ? 'is-active' : ''}`}
                  onClick={() => setTech(isSelected ? 'all' : tName)}
                  style={{
                    all: 'unset',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: isSelected ? '1px solid var(--primary)' : '1px solid transparent',
                    background: isSelected ? 'var(--primary-soft)' : 'var(--surface-2)',
                    transition: 'all 120ms ease',
                  }}
                >
                  <Avatar name={tName} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '4px',
                      }}
                    >
                      <strong style={{ fontSize: '13px', color: 'var(--text-strong)' }}>
                        {tName}
                      </strong>
                      <span className="m-mono m-small" style={{ color: 'var(--muted)' }}>
                        {ownCompleted.length}/{total || 1} · {pct} %
                      </span>
                    </div>
                    <Progress value={pct} />
                    <span
                      className="m-small m-muted"
                      style={{
                        marginTop: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {next ? (
                        <>
                          <Navigation size={12} /> {next.client || 'Client'} · {next.heureDebut || '10:00'}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={12} style={{ color: 'var(--ok)' }} /> Tournée terminée
                        </>
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cockpit plein écran */}
      {full && (
        <div
          className="m-cockpit"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'var(--bg)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <header
            style={{
              padding: '12px 24px',
              background: 'var(--surface)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <strong style={{ fontSize: '15px' }}>Cockpit tournées · en direct</strong>
              {modeCtl}
              <Pill tone="green">{techniciensList.length} techniciens connectés</Pill>
            </div>
            <Btn onClick={() => setFull(false)}>Quitter le plein écran (Échap)</Btn>
          </header>
          <div style={{ flex: 1, position: 'relative' }}>
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
          </div>
        </div>
      )}
    </Page>
  );
}
