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
import {
  DEFAULT_DEPOT_ADDRESS,
  DEFAULT_DEPOT_COORDS,
  geocodeAddress,
  solveTSP,
  estimateRoadDistanceAndDuration,
  type CircuitStop,
  type GeoPoint,
} from '../lib/geocoding';
import type { Intervention, Devis } from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../stores/authStore';

interface CarteStudioViewProps {
  interventions: Intervention[];
  devis: Devis[];
  techniciensList: string[];
  currentTechnicien?: string;
  onSelectTechnicien?: (tech: string) => void;
  onOpenIntervention?: (intv: Partial<Intervention>) => void;
  onOpenDevis?: (dev: Partial<Devis>) => void;
}

/** Fallback quand l'entreprise n'a pas encore renseigné son adresse. */
const FALLBACK_HQ = {
  name: 'Siège (adresse non configurée)',
  addr: DEFAULT_DEPOT_ADDRESS,
  pos: [DEFAULT_DEPOT_COORDS.lat, DEFAULT_DEPOT_COORDS.lng] as [number, number],
};

const TECH_COLORS = ['#1D4ED8', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0EA5A4'];

/** Adresse à géocoder : l'adresse du site si la fiche en a une, sinon le chantier. */
const adresseDe = (i: Intervention): string =>
  String(((i as any).siteAdresse as string | undefined) || i.chantier || '').trim();

/** Cache de géocodage partagé pour la session : une adresse n'est résolue qu'une fois. */
const geoCache = new Map<string, GeoPoint | null>();

export function CarteStudioView({
  interventions,
  devis: _devis,
  techniciensList,
  currentTechnicien = 'all',
  onSelectTechnicien,
}: CarteStudioViewProps) {
  void _devis;
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [mode, setMode] = useState<'positions' | 'route' | 'both'>('both');
  const [tech, setTech] = useState<string>(currentTechnicien || 'all');
  const [full, setFull] = useState(false);
  /** Ordre recalculé par l'optimiseur (par technicien) ; vide tant qu'on n'a pas optimisé */
  const [ordreOptimise, setOrdreOptimise] = useState<Record<string, number[]>>({});

  // Adresse du siège : priorité à l'adresse configurée par l'entreprise
  const HQ = useMemo(() => {
    const company = (user as any)?.company;
    if (company?.siegeAdresse && company?.siegeLat && company?.siegeLng) {
      return {
        name: `Siège ${company.name || ''}`.trim(),
        addr: company.siegeAdresse as string,
        pos: [company.siegeLat as number, company.siegeLng as number] as [number, number],
      };
    }
    return FALLBACK_HQ;
  }, [user]);

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

  // Géocodage réel des chantiers affichés (Base Adresse Nationale, via lib/geocoding).
  // Une adresse introuvable n'invente pas de point : la fiche est comptée « non localisée ».
  const [geoVersion, setGeoVersion] = useState(0);
  useEffect(() => {
    let vivant = true;
    (async () => {
      for (const i of pendingInterventions) {
        const adresse = adresseDe(i);
        if (!adresse || geoCache.has(adresse)) continue;
        try {
          const point = await geocodeAddress(adresse);
          geoCache.set(adresse, point);
        } catch {
          geoCache.set(adresse, null);
        }
        if (vivant) setGeoVersion((v) => v + 1);
      }
    })();
    return () => {
      vivant = false;
    };
  }, [pendingInterventions]);

  const positionDe = (i: Intervention): GeoPoint | null => {
    const adresse = adresseDe(i);
    return adresse ? geoCache.get(adresse) ?? null : null;
  };

  const completedInterventions = useMemo(() => {
    return interventions.filter(
      (i) =>
        (i.statutOperationnel === 'Clôturée' || i.statutOperationnel === 'Terminée - à valider') &&
        (tech === 'all' || i.entreprise === tech)
    );
  }, [interventions, tech]);

  // KPIs dynamiques : distance et temps calculés à partir des positions réelles
  const { totalDistKm, totalDurMin } = useMemo(() => {
    if (pendingInterventions.length === 0) return { totalDistKm: 0, totalDurMin: 0 };
    const depotGeo: GeoPoint = { lat: HQ.pos[0], lng: HQ.pos[1] };
    let distKm = 0;
    let durMin = 0;
    let prev = depotGeo;
    for (const intv of pendingInterventions) {
      const geo = positionDe(intv);
      if (!geo) continue;
      const leg = estimateRoadDistanceAndDuration(prev, geo);
      distKm += leg.distanceKm;
      durMin += leg.durationMin;
      prev = geo;
    }
    // Retour au siège
    if (prev !== depotGeo) {
      const ret = estimateRoadDistanceAndDuration(prev, depotGeo);
      distKm += ret.distanceKm;
      durMin += ret.durationMin;
    }
    return { totalDistKm: Math.round(distKm * 10) / 10, totalDurMin: Math.round(durMin) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInterventions, geoVersion, HQ]);

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

    // En plein écran la référence pointe un AUTRE conteneur : la carte doit suivre,
    // sinon l'écran agrandi reste vide.
    if (
      mapInstanceRef.current &&
      (mapInstanceRef.current as any)._container !== mapContainerRef.current
    ) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    }

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [48.86, 2.34],
        zoom: 12,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Tiles OpenStreetMap gratuites (pas de clé API requise)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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
      html: `<div style="background:#0F172A;color:#fff;border-radius:8px;padding:4px 8px;font-size:11px;font-weight:700;display:flex;align-items:center;gap:4px;box-shadow:0 2px 8px rgba(0,0,0,.2);white-space:nowrap;">🏢 ${HQ.name}</div>`,
      iconSize: [140, 26],
      iconAnchor: [70, 13],
    });
    L.marker(HQ.pos, { icon: hqIcon })
      .bindPopup(`<strong>${HQ.name}</strong><br/>${HQ.addr}`)
      .addTo(layer);

    const bounds: [number, number][] = [HQ.pos];

    // Les tournées sont dessinées sur les POSITIONS RÉELLES des chantiers (géocodage BAN).
    // Avant : étapes posées à des coordonnées dérivées de l'identifiant de la fiche, et
    // techniciens affichés à des « positions GPS en direct » écrites en dur.
    displayedTechs.forEach((tName, idx) => {
      const color = TECH_COLORS[idx % TECH_COLORS.length];
      let techMissions = pendingInterventions.filter((i) => i.entreprise === tName);
      const ordre = ordreOptimise[tName];
      if (ordre?.length) {
        techMissions = [...techMissions].sort(
          (a, b) =>
            (ordre.indexOf(a.id) + 1 || techMissions.length + 1) -
            (ordre.indexOf(b.id) + 1 || techMissions.length + 1)
        );
      }
      const points: [number, number][] = [HQ.pos];
      let premier: [number, number] | null = null;

      if (mode === 'route' || mode === 'both') {
        techMissions.forEach((m, mIdx) => {
          const geo = positionDe(m);
          if (!geo) return; // adresse non localisée : rien n'est inventé
          const pos: [number, number] = [geo.lat, geo.lng];
          if (!premier) premier = pos;
          points.push(pos);
          bounds.push(pos);

          const stopIcon = L.divIcon({
            className: 'm-map-stop-marker',
            html: `<div style="background:#ffffff;color:${color};border:2px solid ${color};border-radius:999px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;box-shadow:0 2px 6px rgba(0,0,0,.15);">${mIdx + 1}</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });

          L.marker(pos, { icon: stopIcon })
            .bindPopup(
              `<strong>${m.client || 'Client'}</strong><br/>${m.objet || 'Intervention'}<br/>${m.chantier || ''}`
            )
            .addTo(layer);
        });

        if (points.length > 1) {
          L.polyline(points, { color, weight: 3, dashArray: '6, 8', opacity: 0.8 }).addTo(layer);
        }
      }

      // Le badge du technicien se pose sur sa première mission localisée — pas sur un
      // faux GPS : personne n'est suivi en direct ici.
      if ((mode === 'positions' || mode === 'both') && premier) {
        const techIcon = L.divIcon({
          className: 'm-map-tech-marker',
          html: `<div style="background:${color};color:#fff;border-radius:999px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.25);">${tName.slice(0, 2).toUpperCase()}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 40],
        });
        L.marker(premier, { icon: techIcon })
          .bindPopup(`<strong>${tName}</strong><br/>Première mission planifiée`)
          .addTo(layer);
      }
    });

    if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 14 });
    }

    // Le conteneur vient parfois d'être (re)dimensionné : Leaflet doit se re-mesurer,
    // sinon la carte reste grise ou tronquée.
    setTimeout(() => map.invalidateSize(), 60);
  }, [displayedTechs, mode, pendingInterventions, geoVersion, full, ordreOptimise]);

  // Optimisation RÉELLE : plus proche voisin + 2-opt du module d'itinéraires, sur les
  // chantiers effectivement localisés. L'ancien bouton annonçait « 8,4 km économisés »
  // sans rien calculer.
  const handleOptimizeTournees = () => {
    const ordres: Record<string, number[]> = {};
    let kmAvant = 0;
    let kmApres = 0;
    const depotGeo: GeoPoint = { lat: HQ.pos[0], lng: HQ.pos[1] };
    displayedTechs.forEach((tName) => {
      const missions = pendingInterventions.filter((i) => i.entreprise === tName);
      const stops: CircuitStop[] = missions
        .map((m) => ({
          id: m.id,
          reference: m.reference || `INT-${m.id}`,
          client: m.client || '',
          chantierOrSite: m.chantier || '',
          address: adresseDe(m),
          coordinates: positionDe(m) || undefined,
        }))
        .filter((st) => st.coordinates);
      if (stops.length < 2) return;
      const res = solveTSP(depotGeo, stops);
      ordres[tName] = res.orderedStops.map((st) => Number(st.id));
      kmAvant += res.originalDistanceKm;
      kmApres += res.totalDistanceKm;
    });
    if (Object.keys(ordres).length === 0) {
      toast('Pas assez de chantiers localisés pour recalculer une tournée.');
      return;
    }
    setOrdreOptimise(ordres);
    const gain = Math.max(0, kmAvant - kmApres);
    toast.success(
      `Ordre des tournées recalculé — ${kmApres.toFixed(1)} km estimés${
        gain > 0.1 ? `, ${gain.toFixed(1)} km gagnés sur l'ordre initial` : ''
      }.`
    );
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
          value={totalDistKm > 0 ? `${totalDistKm} km` : '— km'}
          hint={tech === 'all' ? 'Tous techniciens' : tech}
          icon={Route}
          tone="blue"
        />
        <Kpi
          label="Temps de trajet estimé"
          value={totalDurMin > 0 ? `${Math.floor(totalDurMin / 60)} h ${String(totalDurMin % 60).padStart(2, '0')}` : '— h —'}
          hint="Estimation routière"
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
              <Pill tone="green">{techniciensList.length} techniciens affichés</Pill>
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
