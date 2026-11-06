import { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  CircuitStop,
  GeoPoint,
  DEFAULT_DEPOT_ADDRESS,
  DEFAULT_DEPOT_COORDS,
  geocodeAddress,
  solveTSP,
  fetchOsrmPolyline,
  estimateRoadDistanceAndDuration,
  getNavigationUrl,
  getFullTourGoogleMapsUrl,
  cleanAddressString,
} from '../lib/geocoding';
import { Intervention, Devis } from '../lib/api';

interface TourneeMapOptimizerProps {
  interventions: Intervention[];
  devis: Devis[];
  selectedDate?: string;
  currentTechnicien?: string;
  techniciensList: string[];
  onSelectTechnicien?: (tech: string) => void;
  onOpenIntervention?: (intv: Intervention) => void;
  onOpenDevis?: (devis: Devis) => void;
}

export function TourneeMapOptimizer({
  interventions,
  devis,
  selectedDate: initialSelectedDate,
  currentTechnicien: initialTechnicien,
  techniciensList,
  onSelectTechnicien,
  onOpenIntervention,
  onOpenDevis,
}: TourneeMapOptimizerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);

  // RÈGLE FORMELLE ANELEC : Le point de départ est TOUJOURS et STRICTEMENT l'adresse officielle du bureau.
  // Aucun GPS utilisateur / technicien n'est utilisé pour le calcul de l'itinéraire.
  const officeAddress = DEFAULT_DEPOT_ADDRESS; // '9 Rue des Colonnes, 75002 Paris'
  const officeCoords = DEFAULT_DEPOT_COORDS;   // { lat: 48.869742, lng: 2.339379 }

  // Filtre Technicien local (par défaut 'TOUS' si aucun spécifié, ou le technicien courant)
  const [techFilter, setTechFilter] = useState<string>(() => {
    return initialTechnicien || 'TOUS';
  });

  // Filtre Date : mode 'today' | 'all' | 'custom'
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [dateFilterMode, setDateFilterMode] = useState<'today' | 'all' | 'custom'>('all');
  const [customDate, setCustomDate] = useState<string>(() => initialSelectedDate || todayStr);

  useEffect(() => {
    if (initialTechnicien && initialTechnicien !== techFilter) {
      setTechFilter(initialTechnicien);
    }
  }, [initialTechnicien]);

  useEffect(() => {
    // Purge toute ancienne valeur polluée dans le localStorage
    try {
      localStorage.removeItem('anelec_depot_address');
    } catch {
      // ignore
    }
  }, []);

  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  // État de la tournée calculée
  const [optimizedStops, setOptimizedStops] = useState<
    (CircuitStop & { sequenceNumber: number; distanceToNext?: number; durationToNext?: number })[]
  >([]);
  const [stats, setStats] = useState({
    totalKm: 0,
    totalDurationMin: 0,
    savedKm: 0,
    savedMin: 0,
  });
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);

  // 1. Filtrer les interventions et devis selon les filtres actifs
  const dailyMissions = useMemo(() => {
    const activeDate =
      dateFilterMode === 'today' ? todayStr : dateFilterMode === 'custom' ? customDate : null;

    // A. Interventions
    const intvs = interventions
      .filter((i) => {
        const t = (i.entreprise || (i as any).technicien || '').trim();
        const matchTech =
          !techFilter ||
          techFilter === 'TOUS' ||
          t.toLowerCase().includes(techFilter.toLowerCase());
        const d = (i.datePlanifiee || i.dateDebut || '').trim();
        const matchDate = !activeDate || d === activeDate;
        return matchTech && matchDate;
      })
      .map((i) => {
        const rawAddr = i.chantier || (i as any).siteAdresse || (i as any).adresse || '';
        return {
          id: i.id,
          reference: i.reference || `INT-${i.id}`,
          client: i.client || 'Client non précisé',
          chantierOrSite: i.chantier || (i as any).siteAdresse || '',
          address: rawAddr,
          corpsEtat: i.corpsEtat || i.typeIntervention || 'Tous corps d’état',
          heurePrevue: i.heureDebut || '08:30',
          statut: i.statutOperationnel || 'Planifiée',
          isVisiteDevis: false,
          rawMission: i,
        };
      });

    // B. Visites Devis
    const devisVisits = devis
      .filter((d) => {
        const t = (d.visiteTechnicien || d.responsable || '').trim();
        const matchTech =
          !techFilter ||
          techFilter === 'TOUS' ||
          t.toLowerCase().includes(techFilter.toLowerCase());
        const vDate = (d.visiteDate || '').trim();
        const matchDate = !activeDate || vDate === activeDate;
        return matchTech && matchDate && Boolean(d.visiteDate || d.visiteTechnicien || d.site);
      })
      .map((d) => {
        const rawAddr = d.site || (d as any).siteAdresse || (d as any).adresse || '';
        return {
          id: -d.id,
          reference: d.reference || `DEV-${d.id}`,
          client: d.client || 'Client devis',
          chantierOrSite: d.site || d.client || '',
          address: rawAddr,
          corpsEtat: d.corpsEtat || 'Visite technique devis',
          heurePrevue: d.visiteHeureDebut || '09:00',
          statut: d.visiteStatut || 'À réaliser',
          isVisiteDevis: true,
          rawMission: d,
        };
      });

    // Combiner et ne conserver que les missions ayant un texte d'adresse exploitable (au moins 2 caractères)
    return [...intvs, ...devisVisits].filter(
      (m) => Boolean(m.address) && cleanAddressString(m.address).length >= 2
    );
  }, [interventions, devis, techFilter, dateFilterMode, customDate, todayStr]);

  // 2. CALCUL AUTOMATIQUE DU TRAJET OPTIMAL (Strictement depuis et vers le Bureau)
  useEffect(() => {
    let isCancelled = false;

    async function runAutoTourCalculation() {
      setIsCalculating(true);

      const depotPoint = officeCoords;

      if (dailyMissions.length === 0) {
        if (!isCancelled) {
          setOptimizedStops([]);
          setRoutePolyline([]);
          setStats({ totalKm: 0, totalDurationMin: 0, savedKm: 0, savedMin: 0 });
          setIsCalculating(false);
        }
        return;
      }

      // Géocoder toutes les adresses des interventions et visites devis
      const stopsWithCoords: CircuitStop[] = [];
      for (const m of dailyMissions) {
        if (isCancelled) return;
        const coords = await geocodeAddress(m.address || m.chantierOrSite || m.client);
        stopsWithCoords.push({
          ...m,
          coordinates: coords || undefined,
          geocodingStatus: coords ? 'ok' : 'approx',
        });
      }

      if (isCancelled) return;

      // Résolution TSP (Voyageur de commerce) avec départ et arrivée au Bureau ANELEC
      const tspResult = solveTSP(depotPoint, stopsWithCoords);

      // Calcul des étapes consécutives
      const sequenced = tspResult.orderedStops.map((stop, index) => {
        const prevPoint =
          index === 0 ? depotPoint : tspResult.orderedStops[index - 1].coordinates || depotPoint;
        const leg = stop.coordinates
          ? estimateRoadDistanceAndDuration(prevPoint, stop.coordinates)
          : undefined;
        return {
          ...stop,
          sequenceNumber: index + 1,
          distanceToNext: leg?.distanceKm,
          durationToNext: leg?.durationMin,
        };
      });

      // Récupérer le tracé routier réel OSRM
      const pointsToTrace: GeoPoint[] = [depotPoint];
      sequenced.forEach((s) => {
        if (s.coordinates) pointsToTrace.push(s.coordinates);
      });
      // Retour final au Bureau
      pointsToTrace.push(depotPoint);

      const poly = await fetchOsrmPolyline(pointsToTrace);

      if (!isCancelled) {
        setOptimizedStops(sequenced);
        setRoutePolyline(poly);
        const savedK = Math.max(
          0,
          Math.round((tspResult.originalDistanceKm - tspResult.totalDistanceKm) * 10) / 10
        );
        const savedM = Math.max(
          0,
          Math.round(tspResult.originalDurationMin - tspResult.totalDurationMin)
        );
        setStats({
          totalKm: tspResult.totalDistanceKm,
          totalDurationMin: tspResult.totalDurationMin,
          savedKm: savedK,
          savedMin: savedM,
        });
        setIsCalculating(false);
      }
    }

    runAutoTourCalculation();

    return () => {
      isCancelled = true;
    };
  }, [dailyMissions]);

  // 3. INITIALISATION ET GESTION ROBUSTE DE LA CARTE LEAFLET
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [officeCoords.lat, officeCoords.lng],
        zoom: 12,
        zoomControl: true,
      });

      // Moteur cartographique mondial ESRI & OSM France : aucun blocage 403, aucun filigrane, gratuit et ultra net
      const esriLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: '© Esri & OSM • ANELEC GROUPE',
      }).addTo(map);

      const osmFrLayer = L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap France • ANELEC GROUPE',
      });

      L.control.layers({
        '🗺️ Plan Rues (ESRI)': esriLayer,
        '🇫🇷 OSM France': osmFrLayer,
      }, undefined, { position: 'topright' }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    if (!map) return;

    // Recalibrer la taille automatiquement pour éviter les tuiles grises ou mal cadrées
    const t1 = setTimeout(() => map.invalidateSize(), 80);
    const t2 = setTimeout(() => map.invalidateSize(), 300);
    const t3 = setTimeout(() => map.invalidateSize(), 700);

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      observer.observe(mapContainerRef.current);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      observer.disconnect();
    };
  }, []);

  // 4. MISE À JOUR DES MARQUEURS ET DU TRACÉ LORSQUE LE TRAJET CHANGE
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    const bounds = L.latLngBounds([officeCoords.lat, officeCoords.lng], [officeCoords.lat, officeCoords.lng]);

    // A. Marqueur Fixe : Siège & Bureau ANELEC GROUPE
    const depotIcon = L.divIcon({
      className: 'anelec-map-depot-pin',
      html: `
        <div style="
          width: 36px; height: 36px; border-radius: 50%;
          background: #0a0f1d; border: 3px solid #ffcc00;
          color: #ffcc00; display: flex; align-items: center; justify-content: center;
          font-size: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        ">🏢</div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const depotMarker = L.marker([officeCoords.lat, officeCoords.lng], { icon: depotIcon }).addTo(markersLayer);
    depotMarker.bindPopup(`
      <div style="font-family: inherit; font-size: 12px; line-height: 1.4; min-width: 200px;">
        <div style="font-weight: 800; font-size: 13px; color: #0a0f1d; margin-bottom: 2px;">
          🏢 Bureau ANELEC GROUPE
        </div>
        <div style="color: #64748b; font-size: 11.5px; margin-bottom: 6px;">
          ${officeAddress}
        </div>
        <div style="background: #f1f5f9; padding: 4px 8px; border-radius: 6px; font-weight: 700; color: #0f172a; font-size: 11px;">
          🔒 Point officiel de départ et retour de tournée
        </div>
      </div>
    `);

    // B. Marqueurs numérotés des interventions & visites devis
    optimizedStops.forEach((stop) => {
      if (!stop.coordinates) return;

      bounds.extend([stop.coordinates.lat, stop.coordinates.lng]);

      const isDevis = stop.isVisiteDevis;
      const bgColor = isDevis ? '#f59e0b' : '#00bf63';
      const stopIcon = L.divIcon({
        className: 'anelec-map-step-pin',
        html: `
          <div style="
            width: 32px; height: 32px; border-radius: 50%;
            background: ${bgColor}; border: 2.5px solid #ffffff;
            color: #ffffff; display: flex; align-items: center; justify-content: center;
            font-size: 13px; font-weight: 900; box-shadow: 0 3px 10px rgba(0,0,0,0.35);
          ">${stop.sequenceNumber}</div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const navUrls = getNavigationUrl(stop);
      const marker = L.marker([stop.coordinates.lat, stop.coordinates.lng], { icon: stopIcon }).addTo(markersLayer);

      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; line-height: 1.4; min-width: 230px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="background: ${bgColor}; color: #fff; padding: 2px 7px; border-radius: 6px; font-weight: 800; font-size: 11px;">
              Étape ${stop.sequenceNumber} • ${isDevis ? '🟡 Visite Devis' : '🟢 Travaux TCE'}
            </span>
            <span style="font-weight: 700; color: #64748b; font-size: 11px;">
              ${stop.heurePrevue}
            </span>
          </div>
          <div style="font-weight: 800; font-size: 13.5px; color: #0f172a;">
            ${stop.client}
          </div>
          <div style="color: #475569; font-size: 11.5px; margin: 3px 0;">
            📍 ${cleanAddressString(stop.address || stop.chantierOrSite)}
          </div>
          <div style="color: #059669; font-size: 11px; font-weight: 600; margin-bottom: 8px;">
            🏷️ ${stop.corpsEtat || 'Tous corps d’état'}
          </div>
          <div style="display: flex; gap: 6px; border-top: 1px solid #e2e8f0; padding-top: 6px;">
            <a href="${navUrls.googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="flex: 1; text-align: center; background: #00bf63; color: #fff; text-decoration: none; padding: 5px 8px; border-radius: 6px; font-weight: 700; font-size: 11px;">
              🧭 Google Maps
            </a>
            <a href="${navUrls.wazeUrl}" target="_blank" rel="noopener noreferrer" style="flex: 1; text-align: center; background: #0284c7; color: #fff; text-decoration: none; padding: 5px 8px; border-radius: 6px; font-weight: 700; font-size: 11px;">
              🚗 Waze
            </a>
          </div>
        </div>
      `);
    });

    // C. Tracé du circuit routier en Vert ANELEC (#00bf63)
    if (routePolyline.length > 1) {
      const polyline = L.polyline(routePolyline, {
        color: '#00bf63',
        weight: 5,
        opacity: 0.88,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      routeLayerRef.current = polyline;
    }

    // Centrage automatique de la carte sur l'ensemble des points
    if (optimizedStops.length > 0) {
      map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
    } else {
      map.setView([officeCoords.lat, officeCoords.lng], 13);
    }

    map.invalidateSize();
  }, [optimizedStops, routePolyline]);

  // URL Google Maps globale de l'itinéraire complet de la journée
  const fullTourUrl = useMemo(() => {
    return getFullTourGoogleMapsUrl(officeCoords, optimizedStops);
  }, [optimizedStops]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
      {/* =====================================================================
          EN-TÊTE DU MODULE DE CALCUL ROUTIER
         ===================================================================== */}
      <div className="panel" style={{ padding: '12px 14px', background: 'var(--bg-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '18px' }}>🗺️</span>
              <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Calcul Automatique des Trajets & Tournées
              </h2>
              <span className="badge badge-success" style={{ fontSize: '10.5px' }}>
                Algorithme TSP 2-Opt
              </span>
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Circuit routier automatique optimisé depuis le bureau ANELEC vers l'ensemble des chantiers et devis.
            </p>
          </div>

          {/* SÉLECTEURS DE FILTRAGE : TECHNICIEN & DATE */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <select
              className="select"
              style={{ minWidth: '150px', fontWeight: 700, fontSize: '12.5px', height: '34px' }}
              value={techFilter}
              onChange={(e) => {
                setTechFilter(e.target.value);
                onSelectTechnicien?.(e.target.value);
              }}
            >
              <option value="TOUS">👥 Tous techniciens</option>
              {techniciensList.map((t) => (
                <option key={t} value={t}>
                  👷 {t}
                </option>
              ))}
            </select>

            <select
              className="select"
              style={{ fontWeight: 700, fontSize: '12px', height: '34px' }}
              value={dateFilterMode}
              onChange={(e) => setDateFilterMode(e.target.value as any)}
            >
              <option value="all">📅 Toutes les dates</option>
              <option value="today">📅 Aujourd'hui ({todayStr})</option>
              <option value="custom">📅 Date personnalisée</option>
            </select>

            {dateFilterMode === 'custom' && (
              <input
                type="date"
                className="input"
                style={{ width: '135px', fontWeight: 600, fontSize: '12px', height: '34px' }}
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
              />
            )}
          </div>
        </div>

        {/* POINT DE DÉPART STRICT DU BUREAU (AUCUN GPS UTILISATEUR) */}
        <div
          style={{
            marginTop: '10px',
            padding: '8px 12px',
            borderRadius: '8px',
            background: 'var(--bg-app)',
            border: '1px solid var(--border-default)',
            borderLeft: '4px solid #00bf63',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: '1 1 auto' }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>🏢</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Point de Départ & Arrivée Fixe :
              </div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Siège / Bureau ANELEC GROUPE — {officeAddress}
              </div>
            </div>
          </div>
          <span className="badge badge-neutral" style={{ fontSize: '10.5px', flexShrink: 0 }}>
            🔒 Bureau Fixe (Sans GPS)
          </span>
        </div>
      </div>

      {/* =====================================================================
          BANDEAU RÉSULTATS & GAINS AUTOMATIQUES (RESPONSIVE PC & MOBILE)
         ===================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '8px',
          width: '100%',
        }}
      >
        <div className="panel" style={{ padding: '10px', background: 'var(--bg-surface)', borderLeft: '4px solid #00bf63' }}>
          <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: 700 }}>DISTANCE ROUTE</div>
          <div className="font-mono" style={{ fontSize: '17px', fontWeight: 900, color: '#00bf63', marginTop: '2px' }}>
            {stats.totalKm} km
          </div>
          <div style={{ fontSize: '10px', color: '#047857', fontWeight: 600 }}>
            {stats.savedKm > 0 ? `✓ -${stats.savedKm} km économisés` : 'Trajet optimisé'}
          </div>
        </div>

        <div className="panel" style={{ padding: '10px', background: 'var(--bg-surface)', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: 700 }}>TEMPS ESTIMÉ</div>
          <div className="font-mono" style={{ fontSize: '17px', fontWeight: 900, color: '#3b82f6', marginTop: '2px' }}>
            {Math.floor(stats.totalDurationMin / 60)}h {stats.totalDurationMin % 60}min
          </div>
          <div style={{ fontSize: '10px', color: '#1d4ed8', fontWeight: 600 }}>
            {stats.savedMin > 0 ? `✓ ~${stats.savedMin} min gagnées` : 'Flux direct'}
          </div>
        </div>

        <div className="panel" style={{ padding: '10px', background: 'var(--bg-surface)', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: 700 }}>CHANTIERS & VISITES</div>
          <div className="font-mono" style={{ fontSize: '17px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '2px' }}>
            {optimizedStops.length} étape(s)
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
            Départ & retour au bureau
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <a
            href={fullTourUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{
              width: '100%',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontWeight: 800,
              fontSize: '12px',
              textDecoration: 'none',
              background: '#00bf63',
              boxShadow: '0 3px 10px rgba(0, 191, 99, 0.25)',
              padding: '6px 12px',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            <span>🧭</span>
            <span>Lancer Tournée GPS</span>
          </a>
        </div>
      </div>

      {/* =====================================================================
          ZONE CARTE INTERACTIVE LEAFLET (CADRAGE HAUTEUR PARFAIT)
         ===================================================================== */}
      <div
        className="panel"
        style={{
          width: '100%',
          height: '420px',
          minHeight: '340px',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '12px',
          border: '1px solid var(--border-default)',
          background: '#e2e8f0',
        }}
      >
        {isCalculating && (
          <div
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              zIndex: 1000,
              background: 'rgba(10, 15, 29, 0.88)',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '11.5px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backdropFilter: 'blur(4px)',
            }}
          >
            <span className="spinner" style={{ width: '13px', height: '13px' }} />
            Calcul de l'itinéraire optimal...
          </div>
        )}

        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* =====================================================================
          ÉTAPES DÉTAILLÉES DE LA TOURNÉE DANS L'ORDRE OPTIMAL DU CIRCUIT
         ===================================================================== */}
      <div className="panel" style={{ padding: '12px 14px', background: 'var(--bg-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            📋 Circuit d'Interventions dans l'Ordre Optimal
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Guidage GPS Waze & Google Maps en 1 clic
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Étape 0 : Départ du bureau */}
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'var(--bg-app)',
              border: '1px solid var(--border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: '#0a0f1d',
                  color: '#ffcc00',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  flexShrink: 0,
                }}
              >
                🏢
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Départ : Siège / Bureau ANELEC GROUPE
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {officeAddress} • Sortie outillage & matériel
                </div>
              </div>
            </div>
            <span className="badge badge-neutral" style={{ fontSize: '10px', flexShrink: 0 }}>
              Départ
            </span>
          </div>

          {/* Étapes intermédiaires numérotées */}
          {optimizedStops.map((stop) => {
            const nav = getNavigationUrl(stop);
            return (
              <div
                key={stop.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-default)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: stop.isVisiteDevis ? '#f59e0b' : '#00bf63',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 900,
                        flexShrink: 0,
                      }}
                    >
                      {stop.sequenceNumber}
                    </span>
                    <strong style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>
                      {stop.reference}
                    </strong>
                    <span
                      className={`badge ${stop.isVisiteDevis ? 'badge-warning' : 'badge-success'}`}
                      style={{ fontSize: '10px', padding: '1px 6px' }}
                    >
                      {stop.isVisiteDevis ? 'Visite Devis' : 'Travaux'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {stop.distanceToNext !== undefined && (
                      <span style={{ fontSize: '11px', color: '#00bf63', fontWeight: 700 }}>
                        🚗 {stop.distanceToNext} km (~{stop.durationToNext} min)
                      </span>
                    )}
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {stop.heurePrevue}
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ fontWeight: 800, fontSize: '12.5px', color: 'var(--text-primary)' }}>
                    {stop.client}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '1px' }}>
                    📍 {cleanAddressString(stop.address || stop.chantierOrSite)}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#00bf63', fontWeight: 600, marginTop: '1px' }}>
                    🏷️ {stop.corpsEtat || 'Tous corps d’état'}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '6px',
                    paddingTop: '6px',
                    borderTop: '1px solid var(--border-subtle)',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <a
                    href={nav.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{
                      flex: '1 1 110px',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      fontWeight: 700,
                      fontSize: '11px',
                      color: '#00bf63',
                      borderColor: '#00bf63',
                      height: '30px',
                    }}
                  >
                    🧭 Google Maps
                  </a>

                  <a
                    href={nav.wazeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{
                      flex: '1 1 85px',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      fontWeight: 700,
                      fontSize: '11px',
                      color: '#0284c7',
                      borderColor: '#38bdf8',
                      height: '30px',
                    }}
                  >
                    🚗 Waze
                  </a>

                  {stop.rawMission && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '2px 8px', fontSize: '11px', height: '30px' }}
                      onClick={() => {
                        if (stop.isVisiteDevis) {
                          onOpenDevis?.(stop.rawMission);
                        } else {
                          onOpenIntervention?.(stop.rawMission);
                        }
                      }}
                    >
                      📝 Fiche
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Étape Finale : Retour au Bureau */}
          {optimizedStops.length > 0 && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'var(--bg-app)',
                border: '1px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <span
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#0a0f1d',
                    color: '#ffcc00',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    flexShrink: 0,
                  }}
                >
                  🏁
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Retour : Siège / Bureau ANELEC GROUPE
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {officeAddress} • Clôture de tournée & rangement
                  </div>
                </div>
              </div>
              <span className="badge badge-neutral" style={{ fontSize: '10px', flexShrink: 0 }}>
                Arrivée
              </span>
            </div>
          )}

          {optimizedStops.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
              Aucune intervention ou visite planifiée avec une adresse exploitable pour ces critères.
              <div style={{ marginTop: '6px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Sélectionnez <strong>« Toutes les dates »</strong> ou <strong>« Tous techniciens »</strong> dans les filtres en haut pour voir le circuit complet.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
