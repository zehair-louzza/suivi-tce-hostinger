import { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Intervention, Devis, GpsPositionPayload, referentielsApi } from '../lib/api';

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

export type MapDisplayMode = 'both' | 'positions' | 'trajet';

interface TechnicienLiveMarkerData {
  technicien: string;
  coords: GeoPoint;
  statusLabel: string;
  statusColor: string;
  sourceLabel: string;
  lastTimestamp?: string;
  accuracy?: number;
  lastCompletedMission?: {
    reference: string;
    client: string;
    address: string;
    heureFin?: string;
  };
  currentRunningMission?: {
    reference: string;
    client: string;
    address: string;
  };
  nextPendingMission?: {
    reference: string;
    client: string;
    address: string;
    heurePrevue?: string;
  };
  totalMissionsCount: number;
  completedMissionsCount: number;
  remainingMissionsCount: number;
  progressPercent: number;
}

function isMissionCompletedStatus(statut: string, isVisiteDevis: boolean): boolean {
  const s = (statut || '').trim();
  if (isVisiteDevis) {
    return ['Terminée', 'Effectuée', 'Clôturée'].includes(s);
  }
  return ['Clôturée', 'Terminée - à valider', 'Terminée', 'Facturée'].includes(s);
}

function formatTimeFromISO(iso?: string): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

const TECH_COLORS = ['#0284c7', '#7c3aed', '#059669', '#ea580c', '#db2777', '#2563eb', '#0d9488'];

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

  const officeAddress = DEFAULT_DEPOT_ADDRESS; // '9 Rue des Colonnes, 75002 Paris'
  const officeCoords = DEFAULT_DEPOT_COORDS;   // { lat: 48.869742, lng: 2.339379 }

  // Récupération temps réel des positions GPS transmises par les techniciens
  const referentielsQuery = useQuery({
    queryKey: ['referentiels'],
    queryFn: async () => {
      const res = await referentielsApi.getAll();
      return res.data.data;
    },
    refetchInterval: 15000,
  });

  const positionsGpsMap: Record<string, GpsPositionPayload> = useMemo(
    () => referentielsQuery.data?.positions_gps_techniciens || {},
    [referentielsQuery.data]
  );

  // Filtre Technicien local
  const [techFilter, setTechFilter] = useState<string>(() => {
    return initialTechnicien || 'TOUS';
  });

  // Filtre Date : mode 'today' | 'all' | 'custom'
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [dateFilterMode, setDateFilterMode] = useState<'today' | 'all' | 'custom'>('all');
  const [customDate, setCustomDate] = useState<string>(() => initialSelectedDate || todayStr);

  // Mode d'affichage de la carte : 'both' (Positions + Trajet) | 'positions' (Positions actuelles seules) | 'trajet' (Trajet restant seul)
  const [displayMode, setDisplayMode] = useState<MapDisplayMode>('both');

  // Option pour afficher ou masquer en filigrane les interventions déjà terminées (par défaut masquées = supprimées de la carte)
  const [showCompletedPinsOnMap, setShowCompletedPinsOnMap] = useState<boolean>(false);

  // Mode Plein Écran sur PC
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showFullscreenSidebar, setShowFullscreenSidebar] = useState<boolean>(true);

  useEffect(() => {
    if (initialTechnicien && initialTechnicien !== techFilter) {
      setTechFilter(initialTechnicien);
    }
  }, [initialTechnicien]);

  // Touche Échap pour quitter le plein écran sur PC
  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  // Recalibrer Leaflet lors du passage en Plein Écran ou sortie du Plein Écran
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const t1 = setTimeout(() => map.invalidateSize(), 60);
    const t2 = setTimeout(() => map.invalidateSize(), 250);
    const t3 = setTimeout(() => map.invalidateSize(), 550);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isFullscreen, showFullscreenSidebar, displayMode]);

  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  // État de la tournée calculée (uniquement sur les interventions/visites NON terminées)
  const [optimizedStops, setOptimizedStops] = useState<
    (CircuitStop & { sequenceNumber: number; distanceToNext?: number; durationToNext?: number })[]
  >([]);
  // État des interventions terminées (retirées du trajet mais disponibles pour le suivi d'avancement)
  const [completedStopsWithCoords, setCompletedStopsWithCoords] = useState<CircuitStop[]>([]);
  // Positions actuelles calculées des techniciens sur la carte
  const [technicienMarkers, setTechnicienMarkers] = useState<TechnicienLiveMarkerData[]>([]);

  const [stats, setStats] = useState({
    totalKm: 0,
    totalDurationMin: 0,
    savedKm: 0,
    savedMin: 0,
  });
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);

  // 1. Filtrer toutes les missions et séparer :
  //    - remainingMissions : celles qui ne sont PAS terminées (conservées sur la carte du trajet)
  //    - completedMissions : celles qui sont clôturées / finies (supprimées du trajet pour prévoir la suite)
  const { allFilteredMissions, remainingMissions, completedMissions } = useMemo(() => {
    const activeDate =
      dateFilterMode === 'today' ? todayStr : dateFilterMode === 'custom' ? customDate : null;

    // A. Interventions
    const intvs = interventions
      .filter((i) => {
        if (i.statutOperationnel === 'Annulée') return false;
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
        const statut = i.statutOperationnel || 'Planifiée';
        const isCompleted = isMissionCompletedStatus(statut, false);
        return {
          id: i.id,
          reference: i.reference || `INT-${i.id}`,
          client: i.client || 'Client non précisé',
          chantierOrSite: i.chantier || (i as any).siteAdresse || '',
          address: rawAddr,
          corpsEtat: i.corpsEtat || i.typeIntervention || 'Tous corps d’état',
          heurePrevue: i.heureDebut || '08:30',
          heureFinReelle: i.heureFinReelle || undefined,
          technicien: (i.entreprise || (i as any).technicien || '').trim(),
          statut,
          isVisiteDevis: false,
          isCompleted,
          gpsCloture: i.gpsCloture || null,
          rawMission: i,
        };
      });

    // B. Visites Devis
    const devisVisits = devis
      .filter((d) => {
        if (d.statutCommercial === 'Perdu' || d.statutCommercial === 'Sans suite') return false;
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
        const statut = d.visiteStatut || 'À réaliser';
        const isCompleted = isMissionCompletedStatus(statut, true);
        return {
          id: -d.id,
          reference: d.reference || `DEV-${d.id}`,
          client: d.client || 'Client devis',
          chantierOrSite: d.site || d.client || '',
          address: rawAddr,
          corpsEtat: d.corpsEtat || 'Visite technique devis',
          heurePrevue: d.visiteHeureDebut || '09:00',
          heureFinReelle: undefined,
          technicien: (d.visiteTechnicien || d.responsable || '').trim(),
          statut,
          isVisiteDevis: true,
          isCompleted,
          gpsCloture: d.gpsCloture || null,
          rawMission: d,
        };
      });

    const validAll = [...intvs, ...devisVisits].filter(
      (m) => Boolean(m.address) && cleanAddressString(m.address).length >= 2
    );

    return {
      allFilteredMissions: validAll,
      remainingMissions: validAll.filter((m) => !m.isCompleted),
      completedMissions: validAll.filter((m) => m.isCompleted),
    };
  }, [interventions, devis, techFilter, dateFilterMode, customDate, todayStr]);

  // 2. CALCUL AUTOMATIQUE DU TRAJET RESTANT + POSITIONS ACTUELLES DES TECHNICIENS
  useEffect(() => {
    let isCancelled = false;

    async function runAutoTourAndPositionsCalculation() {
      setIsCalculating(true);
      const depotPoint = officeCoords;

      // 2A. Géocoder les missions RESTANTES (non terminées) pour le calcul d'itinéraire
      const remainingWithCoords: CircuitStop[] = [];
      for (const m of remainingMissions) {
        if (isCancelled) return;
        const coords = await geocodeAddress(m.address || m.chantierOrSite || m.client);
        remainingWithCoords.push({
          ...m,
          coordinates: coords || undefined,
          geocodingStatus: coords ? 'ok' : 'approx',
        });
      }

      // 2B. Géocoder ou récupérer le GPS de clôture des missions TERMINÉES
      const completedWithCoords: CircuitStop[] = [];
      for (const m of completedMissions) {
        if (isCancelled) return;
        let coords: GeoPoint | null = null;
        if (m.gpsCloture && typeof m.gpsCloture.lat === 'number' && typeof m.gpsCloture.lng === 'number') {
          coords = { lat: m.gpsCloture.lat, lng: m.gpsCloture.lng };
        } else {
          coords = await geocodeAddress(m.address || m.chantierOrSite || m.client);
        }
        completedWithCoords.push({
          ...m,
          coordinates: coords || undefined,
          geocodingStatus: coords ? 'ok' : 'approx',
        });
      }

      if (isCancelled) return;

      // 2C. Calculer les positions actuelles et l'avancement de chaque technicien
      const targetTechs =
        techFilter && techFilter !== 'TOUS'
          ? [techFilter]
          : techniciensList.length > 0
          ? techniciensList
          : ['Anouar', 'Mohamed', 'Haitam'];

      const liveTechData: TechnicienLiveMarkerData[] = [];

      for (let idx = 0; idx < targetTechs.length; idx++) {
        const techName = targetTechs[idx];
        const techLower = techName.toLowerCase();

        // Missions rattachées à ce technicien
        const techAll = allFilteredMissions.filter((m) =>
          (m.technicien || '').toLowerCase().includes(techLower)
        );
        const techCompleted = completedWithCoords.filter((m: any) =>
          (m.technicien || '').toLowerCase().includes(techLower)
        );
        const techRemaining = remainingWithCoords.filter((m: any) =>
          (m.technicien || '').toLowerCase().includes(techLower)
        );

        const totalCount = techAll.length;
        const doneCount = techCompleted.length;
        const remCount = techRemaining.length;
        const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

        // Trouver la mission en cours, la dernière terminée, et la prochaine à faire
        const runningMission = techRemaining.find(
          (m) => m.statut === 'En cours' || m.statut === 'Sur site'
        );
        const lastDone = techCompleted[techCompleted.length - 1] as any;
        const nextPending = techRemaining[0];

        // Déterminer la position actuelle transmise du technicien :
        // Priorité 1 : Position GPS directe transmise dans positionsGpsMap[techName]
        // Priorité 2 : gpsCloture de la dernière intervention clôturée
        // Priorité 3 : Coordonnées du chantier actuellement "En cours"
        // Priorité 4 : Coordonnées du dernier chantier clôturé
        // Priorité 5 : Siège / Bureau ANELEC
        const liveGps = positionsGpsMap[techName];
        let coords: GeoPoint = {
          lat: depotPoint.lat + idx * 0.0008,
          lng: depotPoint.lng + idx * 0.0008,
        };
        let statusLabel = '🏢 Au bureau / Prêt au départ';
        let statusColor = '#475569';
        let sourceLabel = 'Siège ANELEC';
        let lastTimestamp: string | undefined;
        let accuracy: number | undefined;

        if (liveGps && typeof liveGps.lat === 'number' && typeof liveGps.lng === 'number') {
          coords = { lat: liveGps.lat, lng: liveGps.lng };
          lastTimestamp = liveGps.timestamp;
          accuracy = liveGps.accuracy;
          sourceLabel = liveGps.source === 'GPS_MOBILE' ? '📡 GPS Téléphone' : '📍 Position Certifiée';
          if (liveGps.statut === 'CLOTUREE') {
            statusLabel = `✅ Dernière position transmise (Clôture ${liveGps.missionRef || ''})`;
            statusColor = '#059669';
          } else if (liveGps.statut === 'EN_COURS') {
            statusLabel = `🔧 En intervention (${liveGps.missionRef || ''})`;
            statusColor = '#0284c7';
          } else {
            statusLabel = '📡 Position actuelle en direct';
            statusColor = '#0284c7';
          }
        } else if (runningMission?.coordinates) {
          coords = runningMission.coordinates;
          statusLabel = `🔧 En intervention sur site (${runningMission.reference})`;
          statusColor = '#0284c7';
          sourceLabel = '📍 Chantier en cours';
        } else if (lastDone?.gpsCloture && typeof lastDone.gpsCloture.lat === 'number') {
          coords = { lat: lastDone.gpsCloture.lat, lng: lastDone.gpsCloture.lng };
          lastTimestamp = lastDone.gpsCloture.timestamp;
          accuracy = lastDone.gpsCloture.accuracy;
          statusLabel = `✅ Clôturée à ${lastDone.heureFinReelle || formatTimeFromISO(lastDone.gpsCloture.timestamp)} (${lastDone.reference})`;
          statusColor = '#059669';
          sourceLabel = '📡 GPS de Clôture';
        } else if (lastDone?.coordinates) {
          coords = lastDone.coordinates;
          statusLabel = `✅ Dernier chantier terminé (${lastDone.reference})`;
          statusColor = '#059669';
          sourceLabel = '📍 Dernier chantier fini';
        } else if (nextPending?.coordinates) {
          statusLabel = `⏳ Prochain départ : ${nextPending.reference} (${nextPending.heurePrevue})`;
          statusColor = '#d97706';
        }

        liveTechData.push({
          technicien: techName,
          coords,
          statusLabel,
          statusColor,
          sourceLabel,
          lastTimestamp,
          accuracy,
          lastCompletedMission: lastDone
            ? {
                reference: lastDone.reference,
                client: lastDone.client,
                address: lastDone.address || lastDone.chantierOrSite,
                heureFin: lastDone.heureFinReelle || formatTimeFromISO(lastDone.gpsCloture?.timestamp),
              }
            : undefined,
          currentRunningMission: runningMission
            ? {
                reference: runningMission.reference,
                client: runningMission.client,
                address: runningMission.address || runningMission.chantierOrSite,
              }
            : undefined,
          nextPendingMission: nextPending
            ? {
                reference: nextPending.reference,
                client: nextPending.client,
                address: nextPending.address || nextPending.chantierOrSite,
                heurePrevue: nextPending.heurePrevue,
              }
            : undefined,
          totalMissionsCount: totalCount,
          completedMissionsCount: doneCount,
          remainingMissionsCount: remCount,
          progressPercent,
        });
      }

      if (!isCancelled) {
        setCompletedStopsWithCoords(completedWithCoords);
        setTechnicienMarkers(liveTechData);
      }

      // 2D. Calcul de l'itinéraire optimal UNIQUEMENT sur les missions restantes à faire
      if (remainingWithCoords.length === 0) {
        if (!isCancelled) {
          setOptimizedStops([]);
          setRoutePolyline([]);
          setStats({ totalKm: 0, totalDurationMin: 0, savedKm: 0, savedMin: 0 });
          setIsCalculating(false);
        }
        return;
      }

      const tspResult = solveTSP(depotPoint, remainingWithCoords);

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

      const pointsToTrace: GeoPoint[] = [depotPoint];
      sequenced.forEach((s) => {
        if (s.coordinates) pointsToTrace.push(s.coordinates);
      });
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

    runAutoTourAndPositionsCalculation();

    return () => {
      isCancelled = true;
    };
  }, [allFilteredMissions, remainingMissions, completedMissions, positionsGpsMap, techFilter, techniciensList]);

  // 3. INITIALISATION ET GESTION ROBUSTE DE LA CARTE LEAFLET
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [officeCoords.lat, officeCoords.lng],
        zoom: 12,
        zoomControl: true,
      });

      const esriLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: '© Esri & OSM • ANELEC GROUPE',
        }
      ).addTo(map);

      const osmFrLayer = L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap France • ANELEC GROUPE',
      });

      L.control
        .layers(
          {
            '🗺️ Plan Rues (ESRI)': esriLayer,
            '🇫🇷 OSM France': osmFrLayer,
          },
          undefined,
          { position: 'topright' }
        )
        .addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    if (!map) return;

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

  // 4. MISE À JOUR DES MARQUEURS ET DU TRACÉ SELON LE MODE D'AFFICHAGE (POSITIONS ACTUELLES / TRAJET RESTANT / LES DEUX)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    const bounds = L.latLngBounds(
      [officeCoords.lat, officeCoords.lng],
      [officeCoords.lat, officeCoords.lng]
    );
    let hasExtendedBounds = false;

    const showTrajet = displayMode === 'trajet' || displayMode === 'both';
    const showPositions = displayMode === 'positions' || displayMode === 'both';

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

    const depotMarker = L.marker([officeCoords.lat, officeCoords.lng], { icon: depotIcon }).addTo(
      markersLayer
    );
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

    // B. Affichage des POSITIONS ACTUELLES DES TECHNICIENS (Mode 'positions' ou 'both')
    if (showPositions) {
      technicienMarkers.forEach((tm, idx) => {
        const color = TECH_COLORS[idx % TECH_COLORS.length];
        bounds.extend([tm.coords.lat, tm.coords.lng]);
        hasExtendedBounds = true;

        const initials = tm.technicien.slice(0, 2).toUpperCase();
        const timeStr = tm.lastTimestamp ? formatTimeFromISO(tm.lastTimestamp) : '';

        const techIcon = L.divIcon({
          className: 'anelec-map-tech-live-pin',
          html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
              <div style="
                background: #0f172a; color: #ffffff; padding: 2px 8px; border-radius: 999px;
                font-size: 11px; font-weight: 800; white-space: nowrap;
                box-shadow: 0 3px 8px rgba(0,0,0,0.35); border: 1.5px solid ${color};
                margin-bottom: 3px; display: flex; align-items: center; gap: 4px;
              ">
                <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#10b981;"></span>
                <span>👷 ${tm.technicien} (${tm.completedMissionsCount}/${tm.totalMissionsCount})</span>
              </div>
              <div style="
                width: 38px; height: 38px; border-radius: 50%;
                background: ${color}; border: 3px solid #ffffff;
                color: #ffffff; display: flex; align-items: center; justify-content: center;
                font-size: 13px; font-weight: 900; box-shadow: 0 0 0 5px ${color}33, 0 4px 12px rgba(0,0,0,0.4);
              ">${initials}</div>
            </div>
          `,
          iconSize: [120, 62],
          iconAnchor: [60, 52],
        });

        const marker = L.marker([tm.coords.lat, tm.coords.lng], {
          icon: techIcon,
          zIndexOffset: 900,
        }).addTo(markersLayer);

        marker.bindPopup(`
          <div style="font-family: inherit; font-size: 12px; line-height: 1.45; min-width: 250px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span style="background: ${color}; color: #fff; padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 11.5px;">
                👷 ${tm.technicien}
              </span>
              <span style="font-weight: 700; color: #059669; font-size: 11px;">
                ${tm.sourceLabel}${timeStr ? ` • ${timeStr}` : ''}
              </span>
            </div>
            <div style="font-weight: 700; font-size: 12px; color: ${tm.statusColor}; margin-bottom: 6px;">
              ${tm.statusLabel}
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 8px; margin-bottom: 6px;">
              <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; margin-bottom: 4px;">
                <span>Avancement travaux :</span>
                <span>${tm.completedMissionsCount} / ${tm.totalMissionsCount} terminées (${tm.progressPercent}%)</span>
              </div>
              <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
                <div style="width: ${tm.progressPercent}%; height: 100%; background: #10b981;"></div>
              </div>
            </div>
            ${
              tm.lastCompletedMission
                ? `<div style="font-size: 11px; color: #047857; margin-bottom: 4px;">
                    ✅ <strong>Dernière finie :</strong> ${tm.lastCompletedMission.reference} — ${tm.lastCompletedMission.client}
                   </div>`
                : ''
            }
            ${
              tm.nextPendingMission
                ? `<div style="font-size: 11px; color: #0284c7; margin-bottom: 4px;">
                    ➡️ <strong>Prochaine étape :</strong> ${tm.nextPendingMission.reference} (${tm.nextPendingMission.client})
                   </div>`
                : `<div style="font-size: 11px; color: #059669; font-weight: 700;">🎉 Toutes les missions affectées sont terminées !</div>`
            }
            <div style="font-size: 10.5px; color: #64748b; margin-top: 4px;">
              Coordonnées GPS : ${tm.coords.lat.toFixed(5)}, ${tm.coords.lng.toFixed(5)}
              ${tm.accuracy ? ` (±${tm.accuracy}m)` : ''}
            </div>
          </div>
        `);
      });
    }

    // C. Affichage des ÉTAPES RESTANTES À FAIRE & DU TRAJET (Mode 'trajet' ou 'both')
    if (showTrajet) {
      optimizedStops.forEach((stop) => {
        if (!stop.coordinates) return;

        bounds.extend([stop.coordinates.lat, stop.coordinates.lng]);
        hasExtendedBounds = true;

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
        const marker = L.marker([stop.coordinates.lat, stop.coordinates.lng], {
          icon: stopIcon,
        }).addTo(markersLayer);

        marker.bindPopup(`
          <div style="font-family: inherit; font-size: 12px; line-height: 1.4; min-width: 230px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="background: ${bgColor}; color: #fff; padding: 2px 7px; border-radius: 6px; font-weight: 800; font-size: 11px;">
                Étape ${stop.sequenceNumber} • ${isDevis ? '🟡 Visite Devis' : '🟢 Restant à faire'}
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

      // Tracé du circuit routier restant en Vert ANELEC (#00bf63)
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
    }

    // D. Optionnel : Afficher en filigrane les interventions déjà terminées si la case est cochée
    if (showCompletedPinsOnMap) {
      completedStopsWithCoords.forEach((doneStop: any) => {
        if (!doneStop.coordinates) return;
        bounds.extend([doneStop.coordinates.lat, doneStop.coordinates.lng]);
        hasExtendedBounds = true;

        const doneIcon = L.divIcon({
          className: 'anelec-map-done-pin',
          html: `
            <div style="
              width: 26px; height: 26px; border-radius: 50%;
              background: #64748b; border: 2px solid #ffffff; opacity: 0.78;
              color: #ffffff; display: flex; align-items: center; justify-content: center;
              font-size: 12px; font-weight: 900; box-shadow: 0 2px 6px rgba(0,0,0,0.25);
            ">✓</div>
          `,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });

        const marker = L.marker([doneStop.coordinates.lat, doneStop.coordinates.lng], {
          icon: doneIcon,
        }).addTo(markersLayer);

        marker.bindPopup(`
          <div style="font-family: inherit; font-size: 12px; line-height: 1.4; min-width: 210px;">
            <div style="background: #10b981; color: #fff; padding: 2px 7px; border-radius: 6px; font-weight: 800; font-size: 11px; display: inline-block; margin-bottom: 4px;">
              ✅ Intervention Terminée & Clôturée
            </div>
            <div style="font-weight: 800; font-size: 13px; color: #0f172a;">
              ${doneStop.reference} — ${doneStop.client}
            </div>
            <div style="color: #475569; font-size: 11.5px; margin: 3px 0;">
              📍 ${cleanAddressString(doneStop.address || doneStop.chantierOrSite)}
            </div>
            <div style="color: #059669; font-size: 11px; font-weight: 700;">
              👷 ${doneStop.technicien || 'Technicien'} • Retirée du trajet restant
            </div>
          </div>
        `);
      });
    }

    if (hasExtendedBounds) {
      map.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 });
    } else {
      map.setView([officeCoords.lat, officeCoords.lng], 13);
    }

    map.invalidateSize();
  }, [
    optimizedStops,
    routePolyline,
    technicienMarkers,
    completedStopsWithCoords,
    displayMode,
    showCompletedPinsOnMap,
  ]);

  // Centrer la carte sur un technicien spécifique au clic
  const focusOnTechnicien = (tm: TechnicienLiveMarkerData) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.setView([tm.coords.lat, tm.coords.lng], 15, { animate: true });
  };

  // Centrer la carte sur l'ensemble des points
  const fitAllMapPoints = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const bounds = L.latLngBounds(
      [officeCoords.lat, officeCoords.lng],
      [officeCoords.lat, officeCoords.lng]
    );
    technicienMarkers.forEach((tm) => bounds.extend([tm.coords.lat, tm.coords.lng]));
    optimizedStops.forEach((s) => {
      if (s.coordinates) bounds.extend([s.coordinates.lat, s.coordinates.lng]);
    });
    map.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 });
  };

  // URL Google Maps globale de l'itinéraire restant de la journée
  const fullTourUrl = useMemo(() => {
    return getFullTourGoogleMapsUrl(officeCoords, optimizedStops);
  }, [optimizedStops]);

  const totalMissionsCount = allFilteredMissions.length;
  const completedCount = completedMissions.length;
  const remainingCount = remainingMissions.length;
  const globalProgressPercent =
    totalMissionsCount > 0 ? Math.round((completedCount / totalMissionsCount) * 100) : 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden',
      }}
    >
      {/* =====================================================================
          EN-TÊTE DU MODULE : CHOIX POSITIONS ACTUELLES / TRAJET & PLEIN ÉCRAN PC
         ===================================================================== */}
      <div className="panel" style={{ padding: '14px', background: 'var(--bg-surface)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '18px' }}>🗺️</span>
              <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Supervision GPS Techniciens & Trajet des Interventions Restantes
              </h2>
              <span className="badge badge-success" style={{ fontSize: '10.5px' }}>
                Temps Réel • Retrait auto des missions finies
              </span>
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Les interventions clôturées avec GPS sont automatiquement retirées du circuit pour ne laisser que le reste à faire et afficher la dernière position des techniciens.
            </p>
          </div>

          {/* BOUTON PLEIN ÉCRAN PC + FILTRES TECHNICIEN & DATE */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="btn btn-primary"
              style={{
                height: '36px',
                padding: '0 14px',
                fontWeight: 800,
                fontSize: '12px',
                background: '#0f172a',
                borderColor: '#0f172a',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 3px 10px rgba(15, 23, 42, 0.25)',
              }}
              title="Agrandir la carte pour couvrir tout l'écran PC"
            >
              <span>⛶</span>
              <span>Plein Écran PC</span>
            </button>

            <select
              className="select"
              style={{ minWidth: '150px', fontWeight: 700, fontSize: '12.5px', height: '36px' }}
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
              style={{ fontWeight: 700, fontSize: '12px', height: '36px' }}
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
                style={{ width: '135px', fontWeight: 600, fontSize: '12px', height: '36px' }}
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
              />
            )}
          </div>
        </div>

        {/* BARRE DE BASCULE : POSITIONS ACTUELLES vs TRAJET RESTANT vs LES DEUX */}
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
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-secondary)', marginRight: '4px' }}>
              Mode d'affichage carte :
            </span>

            <button
              type="button"
              onClick={() => setDisplayMode('positions')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                border: displayMode === 'positions' ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                background: displayMode === 'positions' ? '#0284c7' : '#ffffff',
                color: displayMode === 'positions' ? '#ffffff' : '#334155',
              }}
            >
              📍 Positions Actuelles Techniciens
            </button>

            <button
              type="button"
              onClick={() => setDisplayMode('trajet')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                border: displayMode === 'trajet' ? '1.5px solid #00bf63' : '1px solid #cbd5e1',
                background: displayMode === 'trajet' ? '#00bf63' : '#ffffff',
                color: displayMode === 'trajet' ? '#ffffff' : '#334155',
              }}
            >
              🧭 Afficher le Trajet Restant ({remainingCount})
            </button>

            <button
              type="button"
              onClick={() => setDisplayMode('both')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                border: displayMode === 'both' ? '1.5px solid #0f172a' : '1px solid #cbd5e1',
                background: displayMode === 'both' ? '#0f172a' : '#ffffff',
                color: displayMode === 'both' ? '#ffffff' : '#334155',
              }}
            >
              🌐 Les Deux (Positions + Trajet)
            </button>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11.5px',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={showCompletedPinsOnMap}
              onChange={(e) => setShowCompletedPinsOnMap(e.target.checked)}
            />
            <span>
              Afficher aussi les {completedCount} terminée(s) (masquées par défaut)
            </span>
          </label>
        </div>
      </div>

      {/* =====================================================================
          CARTES D'AVANCEMENT ET DE DERNIÈRE POSITION PAR TECHNICIEN
         ===================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '8px',
          width: '100%',
        }}
      >
        {technicienMarkers.map((tm, idx) => {
          const color = TECH_COLORS[idx % TECH_COLORS.length];
          return (
            <div
              key={tm.technicien}
              onClick={() => focusOnTechnicien(tm)}
              className="panel"
              style={{
                padding: '10px 12px',
                background: 'var(--bg-surface)',
                borderLeft: `4px solid ${color}`,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
              title="Cliquer pour centrer la carte sur la position actuelle de ce technicien"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: color,
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 900,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {tm.technicien.slice(0, 2).toUpperCase()}
                  </span>
                  <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                    {tm.technicien}
                  </strong>
                </div>
                <span
                  className="badge"
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    background: '#ecfdf5',
                    color: '#047857',
                    border: '1px solid #a7f3d0',
                  }}
                >
                  {tm.completedMissionsCount}/{tm.totalMissionsCount} finies ({tm.progressPercent}%)
                </span>
              </div>

              <div
                style={{
                  width: '100%',
                  height: '6px',
                  background: '#e2e8f0',
                  borderRadius: '999px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${tm.progressPercent}%`,
                    height: '100%',
                    background: '#10b981',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              <div style={{ fontSize: '11px', fontWeight: 700, color: tm.statusColor }}>
                {tm.statusLabel}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                <span>
                  📍 {tm.coords.lat.toFixed(4)}, {tm.coords.lng.toFixed(4)}
                </span>
                <span style={{ fontWeight: 700, color: '#0284c7' }}>🎯 Voir sur carte →</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* =====================================================================
          BANDEAU RÉSULTATS & AVANCEMENT DU TRAJET RESTANT
         ===================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
          gap: '8px',
          width: '100%',
        }}
      >
        <div className="panel" style={{ padding: '10px', background: 'var(--bg-surface)', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: 700 }}>
            AVANCEMENT TRAVAUX
          </div>
          <div className="font-mono" style={{ fontSize: '17px', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
            {completedCount} finie(s) / {totalMissionsCount}
          </div>
          <div style={{ fontSize: '10px', color: '#047857', fontWeight: 600 }}>
            ✓ {completedCount} retirée(s) de la carte ({globalProgressPercent}%)
          </div>
        </div>

        <div className="panel" style={{ padding: '10px', background: 'var(--bg-surface)', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: 700 }}>
            RESTE À FAIRE SUR CARTE
          </div>
          <div className="font-mono" style={{ fontSize: '17px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '2px' }}>
            {optimizedStops.length} étape(s)
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
            Interventions & devis restants
          </div>
        </div>

        <div className="panel" style={{ padding: '10px', background: 'var(--bg-surface)', borderLeft: '4px solid #00bf63' }}>
          <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: 700 }}>
            DISTANCE RESTANTE
          </div>
          <div className="font-mono" style={{ fontSize: '17px', fontWeight: 900, color: '#00bf63', marginTop: '2px' }}>
            {stats.totalKm} km
          </div>
          <div style={{ fontSize: '10px', color: '#047857', fontWeight: 600 }}>
            {stats.savedKm > 0 ? `✓ -${stats.savedKm} km économisés` : 'Itinéraire recalculé'}
          </div>
        </div>

        <div className="panel" style={{ padding: '10px', background: 'var(--bg-surface)', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: 700 }}>
            TEMPS RESTANT ESTIMÉ
          </div>
          <div className="font-mono" style={{ fontSize: '17px', fontWeight: 900, color: '#3b82f6', marginTop: '2px' }}>
            {Math.floor(stats.totalDurationMin / 60)}h {stats.totalDurationMin % 60}min
          </div>
          <div style={{ fontSize: '10px', color: '#1d4ed8', fontWeight: 600 }}>
            {stats.savedMin > 0 ? `✓ ~${stats.savedMin} min gagnées` : 'Flux direct'}
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
            <span>Lancer GPS Restant</span>
          </a>
        </div>
      </div>

      {/* =====================================================================
          ZONE CARTE INTERACTIVE LEAFLET (STANDARD OU PLEIN ÉCRAN PC 100vw x 100vh)
         ===================================================================== */}
      <div
        className="panel"
        style={
          isFullscreen
            ? {
                position: 'fixed',
                inset: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 9999,
                borderRadius: 0,
                border: 'none',
                background: '#0f172a',
                overflow: 'hidden',
              }
            : {
                width: '100%',
                height: '460px',
                minHeight: '360px',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '12px',
                border: '1px solid var(--border-default)',
                background: '#e2e8f0',
              }
        }
      >
        {/* BARRE SUPÉRIEURE FLOTTANTE EN MODE PLEIN ÉCRAN PC */}
        {isFullscreen && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '56px',
              right: '60px',
              zIndex: 1001,
              background: 'rgba(15, 23, 42, 0.92)',
              backdropFilter: 'blur(8px)',
              color: '#ffffff',
              padding: '10px 16px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '18px' }}>📡</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: '13.5px', color: '#ffffff' }}>
                  Cockpit Grand Écran — Positions Techniciens & Avancement
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {completedCount} terminée(s) et retirée(s) • {remainingCount} restante(s) sur la carte
                </div>
              </div>
            </div>

            {/* Commutateur de mode en plein écran */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <select
                value={techFilter}
                onChange={(e) => {
                  setTechFilter(e.target.value);
                  onSelectTechnicien?.(e.target.value);
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.25)',
                  background: 'rgba(30, 41, 59, 0.95)',
                  color: '#ffffff',
                }}
              >
                <option value="TOUS">👥 Tous les techniciens</option>
                {techniciensList.map((t) => (
                  <option key={t} value={t}>
                    👷 {t}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setDisplayMode('positions')}
                style={{
                  padding: '6px 11px',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  border: 'none',
                  background: displayMode === 'positions' ? '#0284c7' : 'rgba(255,255,255,0.12)',
                  color: '#ffffff',
                }}
              >
                📍 Positions Actuelles
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('trajet')}
                style={{
                  padding: '6px 11px',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  border: 'none',
                  background: displayMode === 'trajet' ? '#00bf63' : 'rgba(255,255,255,0.12)',
                  color: '#ffffff',
                }}
              >
                🧭 Trajet Restant ({remainingCount})
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('both')}
                style={{
                  padding: '6px 11px',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  border: 'none',
                  background: displayMode === 'both' ? '#10b981' : 'rgba(255,255,255,0.12)',
                  color: '#ffffff',
                }}
              >
                🌐 Positions + Trajet
              </button>

              <button
                type="button"
                onClick={fitAllMapPoints}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.25)',
                  background: 'transparent',
                  color: '#ffffff',
                }}
              >
                🎯 Recadrer
              </button>

              <button
                type="button"
                onClick={() => setShowFullscreenSidebar((v) => !v)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.25)',
                  background: 'transparent',
                  color: '#ffffff',
                }}
              >
                {showFullscreenSidebar ? '◀ Masquer panneau' : '▶ Panneau'}
              </button>

              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  border: 'none',
                  background: '#dc2626',
                  color: '#ffffff',
                }}
              >
                ✕ Quitter (Échap)
              </button>
            </div>
          </div>
        )}

        {/* PANNEAU LATÉRAL DE SUIVI DES TECHNICIENS EN MODE PLEIN ÉCRAN */}
        {isFullscreen && showFullscreenSidebar && (
          <div
            style={{
              position: 'absolute',
              top: '112px',
              left: '12px',
              bottom: '20px',
              width: '320px',
              maxWidth: '90vw',
              zIndex: 1001,
              background: 'rgba(15, 23, 42, 0.92)',
              backdropFilter: 'blur(8px)',
              color: '#ffffff',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.15)',
              padding: '14px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.12)', paddingBottom: '8px' }}>
              👷 Positions & Avancement par Technicien
            </div>

            {technicienMarkers.map((tm, idx) => {
              const color = TECH_COLORS[idx % TECH_COLORS.length];
              return (
                <div
                  key={tm.technicien}
                  onClick={() => focusOnTechnicien(tm)}
                  style={{
                    padding: '10px',
                    borderRadius: '10px',
                    background: 'rgba(30, 41, 59, 0.9)',
                    border: `1px solid ${color}`,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '13px', color: '#ffffff' }}>👷 {tm.technicien}</strong>
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 800,
                        background: '#059669',
                        color: '#fff',
                        padding: '2px 7px',
                        borderRadius: '999px',
                      }}
                    >
                      {tm.completedMissionsCount}/{tm.totalMissionsCount} finies
                    </span>
                  </div>

                  <div style={{ width: '100%', height: '6px', background: '#334155', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${tm.progressPercent}%`, height: '100%', background: '#10b981' }} />
                  </div>

                  <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700 }}>
                    {tm.statusLabel}
                  </div>

                  {tm.lastCompletedMission && (
                    <div style={{ fontSize: '10.5px', color: '#a7f3d0' }}>
                      ✅ Finie : {tm.lastCompletedMission.reference} ({tm.lastCompletedMission.client})
                    </div>
                  )}

                  {tm.nextPendingMission && (
                    <div style={{ fontSize: '10.5px', color: '#fde68a' }}>
                      ➡️ Suivante : {tm.nextPendingMission.reference} ({tm.nextPendingMission.client})
                    </div>
                  )}

                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                    📍 {tm.coords.lat.toFixed(5)}, {tm.coords.lng.toFixed(5)} • Cliquer pour zoomer
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* BOUTON FLOTTANT PLEIN ÉCRAN (EN VUE NORMALE) */}
        {!isFullscreen && (
          <button
            type="button"
            onClick={() => setIsFullscreen(true)}
            style={{
              position: 'absolute',
              bottom: '14px',
              right: '14px',
              zIndex: 1000,
              background: 'rgba(15, 23, 42, 0.9)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            <span>⛶</span>
            <span>Agrandir la carte (Tout l'écran)</span>
          </button>
        )}

        {isCalculating && (
          <div
            style={{
              position: 'absolute',
              top: isFullscreen ? '82px' : '10px',
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
            Mise à jour des positions & du trajet restant...
          </div>
        )}

        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* =====================================================================
          ÉTAPES DÉTAILLÉES : INTERVENTIONS RESTANTES À FAIRE (ORDRE OPTIMAL)
         ===================================================================== */}
      <div className="panel" style={{ padding: '12px 14px', background: 'var(--bg-surface)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
            flexWrap: 'wrap',
            gap: '6px',
          }}
        >
          <h3 style={{ fontSize: '13px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            📋 Circuit Restant à Faire ({optimizedStops.length} étape(s) non terminée(s))
          </h3>
          <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>
            ✓ {completedCount} intervention(s) finie(s) retirée(s) de l'itinéraire
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
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  Départ : Siège / Bureau ANELEC GROUPE
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {officeAddress} • Point de départ officiel
                </div>
              </div>
            </div>
            <span className="badge badge-neutral" style={{ fontSize: '10px', flexShrink: 0 }}>
              Départ
            </span>
          </div>

          {/* Étapes intermédiaires numérotées (uniquement les restantes à faire) */}
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
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '4px',
                  }}
                >
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
                      {stop.isVisiteDevis ? 'Visite Devis à faire' : 'Travaux à faire'}
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

          {optimizedStops.length === 0 && (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: '#059669',
                background: '#ecfdf5',
                borderRadius: '10px',
                border: '1px solid #a7f3d0',
                fontSize: '12.5px',
                fontWeight: 700,
              }}
            >
              🎉 Toutes les interventions et visites planifiées sur ce filtre sont terminées !
              {completedCount > 0 && (
                <div style={{ marginTop: '4px', fontSize: '11.5px', color: '#047857', fontWeight: 500 }}>
                  {completedCount} mission(s) clôturée(s) et retirée(s) de la carte d'itinéraire.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
