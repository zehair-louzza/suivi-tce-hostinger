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
import toast from 'react-hot-toast';

interface TourneeMapOptimizerProps {
  interventions: Intervention[];
  devis: Devis[];
  selectedDate: string;
  currentTechnicien: string;
  techniciensList: string[];
  onSelectTechnicien?: (tech: string) => void;
  onOpenIntervention?: (intv: Intervention) => void;
  onOpenDevis?: (devis: Devis) => void;
}

export function TourneeMapOptimizer({
  interventions,
  devis,
  selectedDate,
  currentTechnicien,
  techniciensList,
  onSelectTechnicien,
  onOpenIntervention,
  onOpenDevis,
}: TourneeMapOptimizerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);

  // Adresse de départ (Bureau / Dépôt / Domicile)
  const [startAddress, setStartAddress] = useState<string>(() => {
    return localStorage.getItem('anelec_depot_address') || DEFAULT_DEPOT_ADDRESS;
  });
  const [startCoords, setStartCoords] = useState<GeoPoint>(DEFAULT_DEPOT_COORDS);
  const [isLocating, setIsLocating] = useState<boolean>(false);
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

  // 1. Filtrer les missions du technicien et de la date sélectionnée
  const dailyMissions = useMemo(() => {
    const intvs = interventions
      .filter((i) => {
        const matchTech =
          !currentTechnicien ||
          currentTechnicien === 'TOUS' ||
          (i.entreprise && i.entreprise.toLowerCase().includes(currentTechnicien.toLowerCase()));
        const matchDate = !selectedDate || i.datePlanifiee === selectedDate;
        return matchTech && matchDate;
      })
      .map((i) => ({
        id: i.id,
        reference: i.reference || `INT-${i.id}`,
        client: i.client || 'Client non précisé',
        chantierOrSite: i.chantier || '',
        address: i.chantier || 'Paris',
        corpsEtat: i.corpsEtat || i.typeIntervention || 'Tous corps d’état',
        heurePrevue: i.heureDebut || '08:30',
        statut: i.statutOperationnel || 'Planifiée',
        isVisiteDevis: false,
        rawMission: i,
      }));

    const devisVisits = devis
      .filter((d) => {
        const matchTech =
          !currentTechnicien ||
          currentTechnicien === 'TOUS' ||
          (d.visiteTechnicien && d.visiteTechnicien.toLowerCase().includes(currentTechnicien.toLowerCase())) ||
          (d.responsable && d.responsable.toLowerCase().includes(currentTechnicien.toLowerCase()));
        const matchDate = !selectedDate || d.visiteDate === selectedDate;
        return matchTech && matchDate && Boolean(d.visiteDate || d.visiteTechnicien);
      })
      .map((d) => ({
        id: -d.id,
        reference: d.reference || `DEV-${d.id}`,
        client: d.client || 'Client devis',
        chantierOrSite: d.site || d.client || '',
        address: d.site || 'Paris',
        corpsEtat: d.corpsEtat || 'Visite technique',
        heurePrevue: d.visiteHeureDebut || '09:00',
        statut: d.visiteStatut || 'À réaliser',
        isVisiteDevis: true,
        rawMission: d,
      }));

    return [...intvs, ...devisVisits];
  }, [interventions, devis, currentTechnicien, selectedDate]);

  // Géolocalisation automatique du point de départ
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('La géolocalisation n\'est pas supportée par votre navigateur');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords: GeoPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: 'Position GPS Actuelle (Smartphone / Ordinateur)',
        };
        setStartCoords(coords);
        setStartAddress('Position GPS Actuelle');
        localStorage.setItem('anelec_depot_address', 'Position GPS Actuelle');
        setIsLocating(false);
        toast.success('📍 Position GPS prise comme point de départ !');
      },
      (err) => {
        setIsLocating(false);
        toast.error(`Erreur GPS : ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // 2. CALCUL AUTOMATIQUE DU TRAJET OPTIMAL
  useEffect(() => {
    let isCancelled = false;

    async function runAutoTourCalculation() {
      setIsCalculating(true);

      // A. Géocoder l'adresse de départ si ce n'est pas "Position GPS"
      let depotPoint = startCoords;
      if (startAddress && startAddress !== 'Position GPS Actuelle') {
        const found = await geocodeAddress(startAddress);
        if (found) {
          depotPoint = found;
          setStartCoords(found);
        }
      }

      // B. Géocoder toutes les missions du jour
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

      // C. Lancer l'algorithme TSP d'optimisation de tournée
      const tspResult = solveTSP(depotPoint, stopsWithCoords);

      // D. Numéroter et calculer les étapes consécutives
      const sequenced = tspResult.orderedStops.map((stop, index) => {
        const prevPoint = index === 0 ? depotPoint : tspResult.orderedStops[index - 1].coordinates || depotPoint;
        const leg = stop.coordinates ? estimateRoadDistanceAndDuration(prevPoint, stop.coordinates) : undefined;
        return {
          ...stop,
          sequenceNumber: index + 1,
          distanceToNext: leg?.distanceKm,
          durationToNext: leg?.durationMin,
        };
      });

      // E. Récupérer le tracé routier réel OSRM
      const pointsToTrace: GeoPoint[] = [depotPoint];
      sequenced.forEach((s) => {
        if (s.coordinates) pointsToTrace.push(s.coordinates);
      });
      // Retour au dépôt pour boucler le circuit
      pointsToTrace.push(depotPoint);

      const poly = await fetchOsrmPolyline(pointsToTrace);

      if (!isCancelled) {
        setOptimizedStops(sequenced);
        setRoutePolyline(poly);
        const savedK = Math.max(0, Math.round((tspResult.originalDistanceKm - tspResult.totalDistanceKm) * 10) / 10);
        const savedM = Math.max(0, Math.round(tspResult.originalDurationMin - tspResult.totalDurationMin));
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
  }, [dailyMissions, startAddress]);

  // 3. INITIALISATION ET MISE À JOUR DE LA CARTE LEAFLET
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [startCoords.lat, startCoords.lng],
        zoom: 12,
        zoomControl: true,
      });

      // Tuiles cartographiques OpenStreetMap standard rapides et claires
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap • ANELEC Tournées',
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    // Nettoyer les anciens marqueurs et polylignes
    markersLayer.clearLayers();
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    const bounds = L.latLngBounds([startCoords.lat, startCoords.lng], [startCoords.lat, startCoords.lng]);

    // A. Marqueur Dépôt / Point de Départ
    const depotIcon = L.divIcon({
      className: 'anelec-map-depot-pin',
      html: `
        <div style="
          width: 38px; height: 38px; border-radius: 50%;
          background: #0a0f1d; border: 3px solid #ffcc00;
          color: #ffcc00; display: flex; align-items: center; justify-content: center;
          font-size: 18px; box-shadow: 0 4px 14px rgba(0,0,0,0.45);
        ">🏢</div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });

    const depotMarker = L.marker([startCoords.lat, startCoords.lng], { icon: depotIcon })
      .bindPopup(`
        <div style="font-family: inherit; font-size: 13px; line-height: 1.4;">
          <div style="font-weight: 800; color: #0a0f1d; margin-bottom: 4px;">🏢 POINT DE DÉPART / DÉPÔT</div>
          <div style="color: #475569; font-size: 12px;">${startAddress}</div>
          <div style="margin-top: 6px; font-size: 11px; color: #00bf63; font-weight: 700;">
            ✓ Début et fin du circuit optimisé
          </div>
        </div>
      `);
    markersLayer.addLayer(depotMarker);

    // B. Marqueurs des étapes numérotées dans l'ordre du circuit ①, ②, ③...
    optimizedStops.forEach((stop) => {
      if (!stop.coordinates) return;
      bounds.extend([stop.coordinates.lat, stop.coordinates.lng]);

      const pinColor = stop.isVisiteDevis ? '#d97706' : '#00bf63';
      const navLinks = getNavigationUrl(stop, startCoords);

      const stepIcon = L.divIcon({
        className: 'anelec-map-step-pin',
        html: `
          <div style="
            width: 34px; height: 34px; border-radius: 50%;
            background: ${pinColor}; border: 2.5px solid #ffffff;
            color: #ffffff; display: flex; align-items: center; justify-content: center;
            font-size: 14px; font-weight: 900; box-shadow: 0 3px 10px rgba(0,0,0,0.35);
          ">
            ${stop.sequenceNumber}
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const popupHtml = `
        <div style="font-family: inherit; min-width: 220px; font-size: 12.5px; line-height: 1.4;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-weight: 800; font-size: 12px; background: ${pinColor}; color: #fff; padding: 2px 7px; border-radius: 6px;">
              Étape ${stop.sequenceNumber} • ${stop.reference}
            </span>
            <span style="font-size: 11px; font-weight: 700; color: #475569;">
              ${stop.heurePrevue}
            </span>
          </div>

          <div style="font-weight: 800; font-size: 13.5px; color: #0f172a; margin-bottom: 2px;">
            ${stop.client}
          </div>
          <div style="font-size: 11.5px; color: #64748b; margin-bottom: 4px;">
            📍 ${cleanAddressString(stop.address || stop.chantierOrSite)}
          </div>
          <div style="font-size: 11px; color: #00bf63; font-weight: 700; margin-bottom: 8px;">
            🏷️ ${stop.corpsEtat || 'Tous corps d’état'}
          </div>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 8px; display: flex; gap: 6px;">
            <a href="${navLinks.googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="
              flex: 1; text-align: center; background: #00bf63; color: #ffffff; font-weight: 700;
              font-size: 11.5px; padding: 6px 8px; border-radius: 6px; text-decoration: none;
            ">
              🧭 Google Maps
            </a>
            <a href="${navLinks.wazeUrl}" target="_blank" rel="noopener noreferrer" style="
              flex: 1; text-align: center; background: #33ccff; color: #0a0f1d; font-weight: 700;
              font-size: 11.5px; padding: 6px 8px; border-radius: 6px; text-decoration: none;
            ">
              🚗 Waze
            </a>
          </div>
        </div>
      `;

      const marker = L.marker([stop.coordinates.lat, stop.coordinates.lng], { icon: stepIcon })
        .bindPopup(popupHtml);
      markersLayer.addLayer(marker);
    });

    // C. Tracé du circuit routier en Vert ANELEC
    if (routePolyline.length > 1) {
      const polyline = L.polyline(routePolyline, {
        color: '#00bf63',
        weight: 5,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: undefined,
      }).addTo(map);

      routeLayerRef.current = polyline;
    }

    // Centrage automatique de la carte pour englober tous les points
    if (optimizedStops.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [startCoords, optimizedStops, routePolyline]);

  // URL Google Maps globale de l'itinéraire complet de la journée
  const fullTourUrl = useMemo(() => {
    return getFullTourGoogleMapsUrl(startCoords, optimizedStops);
  }, [startCoords, optimizedStops]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
      {/* =====================================================================
          EN-TÊTE : SÉLECTEUR TECHNICIEN, DATE & POINT DE DÉPART AUTOMATIQUE
         ===================================================================== */}
      <div className="panel" style={{ padding: '14px 16px', background: 'var(--bg-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>🗺️</span>
              <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Calcul Automatique des Trajets & Optimisation de Tournée
              </h2>
              <span className="badge badge-success" style={{ fontSize: '10.5px' }}>
                Algorithme TSP 2-Opt
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
              Trace automatiquement le circuit routier le plus court pour minimiser les kilomètres et temps de conduite.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {onSelectTechnicien && techniciensList.length > 0 && (
              <select
                className="select"
                style={{ width: '150px', fontWeight: 700 }}
                value={currentTechnicien}
                onChange={(e) => onSelectTechnicien(e.target.value)}
              >
                <option value="TOUS">👥 Tous techniciens</option>
                {techniciensList.map((t) => (
                  <option key={t} value={t}>
                    👷 {t}
                  </option>
                ))}
              </select>
            )}

            <input
              type="date"
              className="input"
              style={{ width: '145px', fontWeight: 600 }}
              value={selectedDate}
              onChange={() => {
                // date sélectionnée gérée au niveau parent si besoin
              }}
            />
          </div>
        </div>

        {/* POINT DE DÉPART / BUREAU CONFIGURABLE */}
        <div
          style={{
            marginTop: '12px',
            padding: '10px 12px',
            borderRadius: '10px',
            background: 'var(--bg-app)',
            border: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 280px', minWidth: '220px' }}>
            <span style={{ fontSize: '16px' }}>🏢</span>
            <div style={{ width: '100%' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block' }}>
                Adresse de Départ Prédéfinie (Bureau / Dépôt / Domicile) :
              </label>
              <input
                type="text"
                className="input"
                style={{ width: '100%', fontSize: '12.5px', padding: '6px 10px', height: '34px' }}
                value={startAddress}
                onChange={(e) => {
                  setStartAddress(e.target.value);
                  localStorage.setItem('anelec_depot_address', e.target.value);
                }}
                placeholder="Ex: 93 rue de Paris, 75000 Paris ou adresse du domicile"
              />
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '34px' }}
          >
            {isLocating ? '⏳ Géolocalisation...' : '📍 Ma position GPS actuelle'}
          </button>
        </div>
      </div>

      {/* =====================================================================
          BANDEAU RÉSULTATS & GAINS AUTOMATIQUES
         ===================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '10px',
        }}
      >
        <div className="panel" style={{ padding: '12px', background: 'var(--bg-surface)', borderLeft: '4px solid #00bf63' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>DISTANCE DU CIRCUIT</div>
          <div className="font-mono" style={{ fontSize: '18px', fontWeight: 900, color: '#00bf63', marginTop: '2px' }}>
            {stats.totalKm} km
          </div>
          <div style={{ fontSize: '10.5px', color: '#047857', fontWeight: 600 }}>
            {stats.savedKm > 0 ? `✓ -${stats.savedKm} km économisés` : 'Trajet optimal'}
          </div>
        </div>

        <div className="panel" style={{ padding: '12px', background: 'var(--bg-surface)', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>TEMPS DE CONDUITE ESTIMÉ</div>
          <div className="font-mono" style={{ fontSize: '18px', fontWeight: 900, color: '#3b82f6', marginTop: '2px' }}>
            {Math.floor(stats.totalDurationMin / 60)}h {stats.totalDurationMin % 60}min
          </div>
          <div style={{ fontSize: '10.5px', color: '#1d4ed8', fontWeight: 600 }}>
            {stats.savedMin > 0 ? `✓ ~${stats.savedMin} min de route évitées` : 'Flux direct'}
          </div>
        </div>

        <div className="panel" style={{ padding: '12px', background: 'var(--bg-surface)', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>INTERVENTIONS DU JOUR</div>
          <div className="font-mono" style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '2px' }}>
            {optimizedStops.length} étape(s)
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
            Départ & retour au dépôt
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
              height: '100%',
              minHeight: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontWeight: 800,
              fontSize: '13px',
              textDecoration: 'none',
              background: '#00bf63',
              boxShadow: '0 4px 14px rgba(0, 191, 99, 0.28)',
            }}
          >
            <span>🧭</span>
            <span>Lancer la Tournée Complète (GPS)</span>
          </a>
        </div>
      </div>

      {/* =====================================================================
          ZONE CENTRALE : CARTE INTERACTIVE LEAFLET + LISTE D'ÉTAPES CADRÉES
         ===================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: '14px',
        }}
      >
        {/* LEAFLET MAP CONTAINER */}
        <div
          className="panel"
          style={{
            height: '420px',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '14px',
            border: '1px solid var(--border-default)',
            background: '#e2e8f0',
          }}
        >
          {isCalculating && (
            <div
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                zIndex: 1000,
                background: 'rgba(10, 15, 29, 0.88)',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backdropFilter: 'blur(4px)',
              }}
            >
              <span className="spinner" style={{ width: '14px', height: '14px' }} />
              Calcul automatique de la meilleure tournée...
            </div>
          )}

          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
        </div>

        {/* ÉTAPES DÉTAILLÉES DE LA TOURNÉE */}
        <div className="panel" style={{ padding: '14px 16px', background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '13.5px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              📋 Circuit d'Interventions dans l'Ordre Optimal
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              1 clic pour lancer le guidage GPS vers chaque chantier
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Point de départ initial */}
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '10px',
                background: 'var(--bg-app)',
                border: '1px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: '#0a0f1d',
                    color: '#ffcc00',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  🏢
                </span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '12.5px', color: 'var(--text-primary)' }}>
                    Départ : {startAddress}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Début de la journée • Sortie des outils et pièces
                  </div>
                </div>
              </div>
              <span className="badge badge-neutral" style={{ fontSize: '10.5px' }}>
                Point 0
              </span>
            </div>

            {/* Étapes optimisées */}
            {optimizedStops.map((stop) => {
              const nav = getNavigationUrl(stop, startCoords);
              return (
                <div
                  key={stop.id}
                  className="mobile-record-card"
                  style={{
                    borderLeft: `4px solid ${stop.isVisiteDevis ? '#f59e0b' : '#00bf63'}`,
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
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
                      <span className="font-mono" style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>
                        {stop.reference}
                      </span>
                      {stop.isVisiteDevis && (
                        <span className="badge badge-warning" style={{ fontSize: '10px' }}>
                          Visite Devis
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {stop.distanceToNext !== undefined && (
                        <span
                          className="font-mono"
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#047857',
                            background: '#ecfdf5',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: '1px solid #a7f3d0',
                          }}
                        >
                          🚗 {stop.distanceToNext} km (~{stop.durationToNext} min)
                        </span>
                      )}
                      <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        {stop.heurePrevue}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>
                      {stop.client}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '1px' }}>
                      📍 {cleanAddressString(stop.address || stop.chantierOrSite)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#00bf63', fontWeight: 600, marginTop: '2px' }}>
                      🏷️ {stop.corpsEtat || 'Tous corps d’état'}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      paddingTop: '8px',
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
                        flex: '1 1 120px',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontWeight: 700,
                        fontSize: '11.5px',
                        color: '#00bf63',
                        borderColor: '#00bf63',
                      }}
                    >
                      🧭 Lancer Google Maps
                    </a>

                    <a
                      href={nav.wazeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{
                        flex: '1 1 90px',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontWeight: 700,
                        fontSize: '11.5px',
                        color: '#0284c7',
                        borderColor: '#38bdf8',
                      }}
                    >
                      🚗 Waze
                    </a>

                    {stop.rawMission && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: '11.5px' }}
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

            {optimizedStops.length === 0 && (
              <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                Aucune mission planifiée pour cette date et ce technicien.
                <div style={{ marginTop: '6px', fontSize: '12px' }}>
                  Sélectionnez une autre date ou ajoutez une intervention dans le Planning pour calculer le trajet automatique.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
