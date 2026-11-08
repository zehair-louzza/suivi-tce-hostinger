import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  adminApi,
  devisApi,
  interventionApi,
  Intervention,
  Devis,
  formatDateFR,
} from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../stores/authStore';
import { useTheme } from '../stores/themeStore';
import type { ThemeId } from '../stores/themeStore';
import { compressAndOptimizeImage } from '../lib/imageOptimizer';
import { TourneeMapOptimizer } from './TourneeMapOptimizer';
import {
  DEFAULT_DEPOT_ADDRESS,
  DEFAULT_DEPOT_COORDS,
  geocodeAddress,
} from '../lib/geocoding';

interface TechnicianMobileViewProps {
  techniciens: string[];
  currentTechnicien: string;
  canSwitchTechnicien: boolean;
  onSelectTechnicien: (tech: string) => void;
  interventionsList: Intervention[];
  devisList: Devis[];
}

/* ============================================================================
   UTILITAIRES
   ============================================================================ */
function getNowHHMM(): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
  } catch {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}

/** Date du jour (AAAA-MM-JJ) au fuseau de Paris, pas en UTC. */
function getParisTodayISO(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function shiftISODate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days, 12, 0, 0);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function toMinutes(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Durée prévue lisible ("2 h 30", "45 min") à partir du créneau, ou null si inconnue. */
function formatDuration(start?: string | null, end?: string | null): string | null {
  const a = toMinutes(start);
  const b = toMinutes(end);
  if (a === null || b === null || b <= a) return null;
  const diff = b - a;
  const h = Math.floor(diff / 60);
  const min = diff % 60;
  if (h === 0) return `${min} min`;
  return min === 0 ? `${h} h` : `${h} h ${String(min).padStart(2, '0')}`;
}

const DONE_STATUSES = ['Clôturée', 'Terminée', 'Terminée - à valider', 'Effectuée'];
const isDoneStatus = (s?: string | null) => DONE_STATUSES.includes((s || '').trim());

/** Numéro de téléphone français trouvé dans les notes de la mission (consignes d'accès). */
function findPhone(text?: string | null): string | null {
  if (!text) return null;
  const m = /(?:\+33\s?|0)[1-9](?:[\s.]?\d{2}){4}/.exec(text);
  return m ? m[0].replace(/[\s.]/g, '') : null;
}

/* ============================================================================
   HOOKS D'INTERFACE : TABLETTE & APPARENCE
   ============================================================================ */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** Chronologie ajoute la frise de la journée ; les autres directions gardent la liste de cartes. */
function skinFor(themeId: ThemeId): 'clarte' | 'chrono' {
  return themeId === 'craft' ? 'chrono' : 'clarte';
}

/* ============================================================================
   ICÔNES (jeu unique, trait net, rendu identique sur tous les téléphones)
   ============================================================================ */
type IconName =
  | 'pin' | 'nav' | 'phone' | 'camera' | 'clock' | 'check' | 'checkCircle' | 'play'
  | 'stop' | 'pause' | 'calendar' | 'left' | 'right' | 'alert' | 'file' | 'user'
  | 'history' | 'missions' | 'target' | 'plus' | 'logout' | 'close';

const ICONS: Record<IconName, React.ReactNode> = {
  pin: (<><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>),
  nav: (<polygon points="3 11 22 2 13 21 11 13 3 11" />),
  phone: (<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />),
  camera: (<><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></>),
  clock: (<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>),
  check: (<path d="m5 12 5 5L20 7" />),
  checkCircle: (<><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>),
  play: (<polygon points="6 4 20 12 6 20 6 4" />),
  stop: (<rect x="6" y="6" width="12" height="12" rx="2" />),
  pause: (<><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>),
  calendar: (<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>),
  left: (<path d="m15 18-6-6 6-6" />),
  right: (<path d="m9 18 6-6-6-6" />),
  alert: (<><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" /><path d="M12 9v4M12 17h.01" /></>),
  file: (<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8" /></>),
  user: (<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
  history: (<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l4 2" />),
  missions: (<><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01" /></>),
  target: (<><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="8" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>),
  plus: (<path d="M12 5v14M5 12h14" />),
  logout: (<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />),
  close: (<path d="M18 6 6 18M6 6l12 12" />),
};

function Ic({ n, size = 20 }: { n: IconName; size?: number }) {
  return (
    <svg
      className="t-ic"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[n]}
    </svg>
  );
}

/* ============================================================================
   EN-TÊTE MOBILE
   ============================================================================ */
function Header({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}) {
  return (
    <header className="t-head">
      {onBack ? (
        <button type="button" onClick={onBack} className="t-back" aria-label="Retour à la liste">
          <Ic n="left" size={24} />
          <span>Retour</span>
        </button>
      ) : (
        <img src="/brand/anelec-mark.png" alt="ANELEC" className="t-head-logo" />
      )}
      <div className="t-head-text">
        <h1>{title}</h1>
        {subtitle && <span>{subtitle}</span>}
      </div>
    </header>
  );
}

/* ============================================================================
   PASTILLE DE STATUT (icône + texte : jamais la couleur seule)
   ============================================================================ */
function StatusPill({ status }: { status: string }) {
  const norm = (status || '').toLowerCase();
  let tone = 'slate';
  let label = status || 'Planifiée';
  let icon: IconName = 'calendar';

  if (norm.includes('cours')) {
    tone = 'blue';
    label = 'En cours';
    icon = 'clock';
  } else if (norm.includes('clôtur') || norm.includes('termin') || norm.includes('effectu')) {
    tone = 'green';
    label = 'Clôturée';
    icon = 'check';
  } else if (norm.includes('planifi')) {
    tone = 'slate';
    label = 'Planifiée';
    icon = 'calendar';
  } else if (norm.includes('urg') || norm.includes('bloqu')) {
    tone = 'red';
    label = 'Urgence';
    icon = 'alert';
  } else if (norm.includes('suiv')) {
    tone = 'slate';
    label = 'Suivant';
    icon = 'right';
  }

  return (
    <span className={`t-pill t-pill--${tone}`}>
      <Ic n={icon} size={14} />
      <span>{label}</span>
    </span>
  );
}

/* ============================================================================
   AVATAR ROND
   ============================================================================ */
function UserAvatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = (name || 'TE')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div
      className="t-avatar"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

/* ============================================================================
   CARTE INTERACTIVE LEAFLET DÉDIÉE À LA TOURNÉE DU TECHNICIEN
   ============================================================================ */
function MobileRouteMap({
  technicien,
  missions,
  onOpenMission,
}: {
  technicien: string;
  missions: Intervention[];
  selectedDate: string;
  onOpenMission: (id: number) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  const [stopsCoords, setStopsCoords] = useState<{ id: number; coords: [number, number] }[]>([]);
  const [resolved, setResolved] = useState(false);

  // Résolution géocodée des adresses
  useEffect(() => {
    let cancelled = false;
    async function resolveCoords() {
      const results: { id: number; coords: [number, number] }[] = [];
      for (let i = 0; i < missions.length; i++) {
        const m = missions[i];
        let lat = 0;
        let lng = 0;
        if (m.gpsCloture) {
          try {
            const parsed = typeof m.gpsCloture === 'string' ? JSON.parse(m.gpsCloture) : m.gpsCloture;
            if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
              lat = parsed.lat;
              lng = parsed.lng;
            }
          } catch {
            // ignore
          }
        }
        if (!lat || !lng) {
          const geo = await geocodeAddress(m.chantier || m.client || 'Paris');
          if (geo?.lat && geo?.lng) {
            lat = geo.lat;
            lng = geo.lng;
          }
        }
        // Adresse introuvable : on n'invente jamais de position, l'étape est simplement omise.
        if (lat && lng) results.push({ id: m.id, coords: [lat, lng] });
      }
      if (!cancelled) {
        setStopsCoords(results);
        setResolved(true);
      }
    }
    resolveCoords();
    return () => {
      cancelled = true;
    };
  }, [missions]);

  // Initialisation Map Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [DEFAULT_DEPOT_COORDS.lat, DEFAULT_DEPOT_COORDS.lng],
        zoom: 13,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
        }
      ).addTo(map);

      const lg = L.layerGroup().addTo(map);
      layerGroupRef.current = lg;
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const t1 = setTimeout(() => map?.invalidateSize(), 100);
    const t2 = setTimeout(() => map?.invalidateSize(), 300);
    const t3 = setTimeout(() => map?.invalidateSize(), 600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // Rendu des marqueurs et de l'itinéraire polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    const lg = layerGroupRef.current;
    if (!map || !lg) return;

    lg.clearLayers();
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    // Exposer l'ouverture de mission dans la fenêtre globale pour les popups Leaflet
    (window as any).__openMobileMission = (id: number) => {
      onOpenMission(id);
    };

    const bounds = L.latLngBounds(
      [DEFAULT_DEPOT_COORDS.lat, DEFAULT_DEPOT_COORDS.lng],
      [DEFAULT_DEPOT_COORDS.lat, DEFAULT_DEPOT_COORDS.lng]
    );

    // 1. Marqueur Siège / Technicien
    const initials = (technicien || 'TE').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
    const techPinIcon = L.divIcon({
      className: 't-leaflet-tech-pin',
      html: `
        <div style="
          width: 34px; height: 34px; border-radius: 50%;
          background: #1D4ED8; color: #ffffff;
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 13px;
          border: 3px solid #ffffff; box-shadow: 0 0 0 4px rgba(29, 78, 216, 0.25), 0 3px 8px rgba(0,0,0,0.3);
        ">
          ${initials}
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    L.marker([DEFAULT_DEPOT_COORDS.lat, DEFAULT_DEPOT_COORDS.lng], { icon: techPinIcon })
      .bindPopup(`
        <div style="font-family: inherit; font-size: 14px; line-height: 1.4;">
          <strong style="color: #1D4ED8; font-size: 15px;">Point de départ tournée</strong>
          <div style="color: #475569; font-size: 13px; margin-top: 2px;">${DEFAULT_DEPOT_ADDRESS}</div>
        </div>
      `)
      .addTo(lg);

    const routePoints: [number, number][] = [[DEFAULT_DEPOT_COORDS.lat, DEFAULT_DEPOT_COORDS.lng]];

    // 2. Marqueurs numérotés 1, 2, 3...
    missions.forEach((m, idx) => {
      const stopCoord = stopsCoords.find((s) => s.id === m.id);
      if (!stopCoord) return; // adresse non localisée : pas de repère inventé
      const latLng: [number, number] = stopCoord.coords;
      routePoints.push(latLng);
      bounds.extend(latLng);

      const stopNum = idx + 1;
      const isDone = ['Clôturée', 'Terminée', 'Effectuée'].includes(m.statutOperationnel || '');
      const bgColor = isDone ? '#059669' : '#0f172a';
      const textColor = isDone ? '#ffffff' : '#ffc107';

      const stopPinIcon = L.divIcon({
        className: 't-leaflet-stop-pin',
        html: `
          <div style="
            width: 32px; height: 32px; border-radius: 50%;
            background: ${bgColor}; color: ${textColor};
            display: flex; align-items: center; justify-content: center;
            font-weight: 800; font-size: 14px; font-family: ui-monospace, monospace;
            border: 2.5px solid #ffffff; box-shadow: 0 3px 8px rgba(0,0,0,0.35);
          ">
            ${stopNum}
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker(latLng, { icon: stopPinIcon }).addTo(lg);
      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 14px; line-height: 1.45; min-width: 230px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="background: ${bgColor}; color: ${textColor}; font-weight: 800; font-size: 13px; padding: 3px 9px; border-radius: 999px;">
              Étape ${stopNum}
            </span>
            <span style="font-weight: 700; color: #1D4ED8; font-size: 13px;">
              ${m.heureDebut || '09:00'}
            </span>
          </div>
          <strong style="font-size: 15px; color: #0f172a; display: block; margin-top: 2px;">
            ${m.client || 'Client TCE'}
          </strong>
          <div style="color: #475569; font-size: 13px; margin: 2px 0 10px 0;">
            ${(m.chantier || 'Paris').split(',')[0]}
          </div>
          <div style="display: flex; gap: 6px;">
            <button
              type="button"
              onclick="window.__openMobileMission(${m.id})"
              style="flex: 1; padding: 12px 12px; min-height: 44px; background: #1D4ED8; color: #fff; border: none; border-radius: 10px; font-weight: 700; font-size: 14px; cursor: pointer;"
            >
              Ouvrir la mission
            </button>
            <button
              type="button"
              onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(m.chantier || 'Paris')}', '_blank')"
              style="padding: 12px 14px; min-height: 44px; background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 10px; font-weight: 700; font-size: 14px; cursor: pointer;"
            >
              GPS
            </button>
          </div>
        </div>
      `);
    });

    // 3. Tracé d'itinéraire
    if (routePoints.length > 1) {
      polylineRef.current = L.polyline(routePoints, {
        color: '#1D4ED8',
        weight: 4,
        opacity: 0.85,
        dashArray: '6, 8',
      }).addTo(map);
    }

    if (missions.length > 0) {
      map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
    }
  }, [missions, stopsCoords, technicien, onOpenMission]);

  const unlocated = resolved ? missions.length - stopsCoords.length : 0;

  return (
    <div className="t-leaflet-map-container" data-testid="mobile-route-leaflet-map">
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
      {unlocated > 0 && (
        <p className="t-map-note" role="status">
          {unlocated} étape{unlocated > 1 ? 's' : ''} sans position : adresse introuvable ou incomplète.
        </p>
      )}
    </div>
  );
}

/* ============================================================================
   COMPOSANT PRINCIPAL : TECHNICIAN MOBILE VIEW
   ============================================================================ */
export function TechnicianMobileView({
  techniciens,
  currentTechnicien,
  canSwitchTechnicien,
  onSelectTechnicien,
  interventionsList,
  devisList,
}: TechnicianMobileViewProps) {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const { current: currentTheme, themes, userPref, allowUserOverride, setUserPref, isPending: themePending } = useTheme();
  const skin = skinFor(currentTheme);
  const isTablet = useMediaQuery('(min-width: 768px)');

  const [tab, setTab] = useState<'home' | 'map' | 'hist' | 'prof'>('home');
  const [openMissionId, setOpenMissionId] = useState<number | null>(null);
  const [gpsModalOpen, setGpsModalOpen] = useState(false);
  const [isInteractiveMapOpen, setIsInteractiveMapOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Brouillons locaux ; la référence reste le serveur (photos et compte-rendu de la mission).
  const [missionPhotos, setMissionPhotos] = useState<Record<number, { url: string; label: string }[]>>({});
  const [missionReports, setMissionReports] = useState<Record<number, string>>({});
  const [syncState, setSyncState] = useState<Record<number, 'saving' | 'saved' | 'error'>>({});
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [runningMissions, setRunningMissions] = useState<Record<number, boolean>>({});

  const todayISO = useMemo(() => getParisTodayISO(), []);
  const [selectedDate, setSelectedDate] = useState<string>(() => getParisTodayISO());

  // Pointages Query pour la date sélectionnée
  const pointagesQuery = useQuery({
    queryKey: ['admin-pointages', selectedDate, currentTechnicien],
    queryFn: async () => {
      const res = await adminApi.listPointages({
        dateJour: selectedDate,
        technicien: currentTechnicien,
      });
      return res.data.data;
    },
    enabled: Boolean(currentTechnicien && selectedDate),
  });

  const currentPointage = (pointagesQuery.data || [])[0] || null;
  const isPointed = Boolean(currentPointage?.heureArriveeBureau);
  const isTerminee = currentPointage?.statutJournee === 'TERMINEE' || Boolean(currentPointage?.heureFinJournee);

  // Pointage Mut : Prise de poste matin ("Commencer la journée")
  const clockInMut = useMutation({
    mutationFn: adminApi.clockIn,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-pointages'] });
      toast.success(res.data.message || `Journée commencée à ${getNowHHMM()}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Erreur lors du commencement de journée');
    },
  });

  // Pointage Mut : Fin de poste soir ("Finir la journée")
  const clockOutMut = useMutation({
    mutationFn: adminApi.clockOut,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-pointages'] });
      toast.success(res.data.message || `Journée terminée à ${getNowHHMM()}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Erreur lors de la fin de journée');
    },
  });

  const updateMissionMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => interventionApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      queryClient.invalidateQueries({ queryKey: ['devis'] });
    },
    // Les erreurs sont traitées par chaque action (photo, compte-rendu, clôture) : message précis + nouvelle tentative.
  });

  // Missions pour ce technicien
  const allTechMissionsCombined: Intervention[] = useMemo(() => {
    const targetLower = (currentTechnicien || '').trim().toLowerCase();
    const devisById = new Map<number, Devis>();
    const devisByRef = new Map<string, Devis>();
    devisList.forEach((d) => {
      devisById.set(d.id, d);
      if (d.reference) devisByRef.set(d.reference.trim().toLowerCase(), d);
    });

    const allForTech: Intervention[] = interventionsList
      .filter((i) => {
        const ent = (i.entreprise || '').trim();
        if (!ent) return false;
        if (ent.toLowerCase() === targetLower) return true;
        if (ent.includes('+')) {
          return ent
            .split('+')
            .map((p) => p.trim().toLowerCase())
            .includes(targetLower);
        }
        return false;
      })
      .map((i) => {
        const isVisite = Boolean(i.isVisiteDevis || i.typeIntervention === 'Visite technique devis');
        const parentDevis =
          (i.devisId ? devisById.get(i.devisId) : undefined) ||
          (i.origineDevisId ? devisById.get(i.origineDevisId) : undefined) ||
          (i.refDevisTexte ? devisByRef.get(i.refDevisTexte.trim().toLowerCase()) : undefined);
        const parentDevisDone = parentDevis
          ? ['Terminée', 'Effectuée', 'Clôturée', 'Réalisée', 'Validée'].includes(
              (parentDevis.visiteStatut || '').trim()
            ) || Boolean(parentDevis.gpsCloture)
          : false;
        const alreadyDone =
          ['Clôturée', 'Terminée - à valider', 'Terminée', 'Effectuée', 'Facturée'].includes(
            (i.statutOperationnel || '').trim()
          ) ||
          Boolean(i.gpsCloture) ||
          (isVisite && parentDevisDone);

        if (alreadyDone && i.statutOperationnel !== 'Clôturée' && i.statutOperationnel !== 'Terminée - à valider') {
          return {
            ...i,
            statutOperationnel: 'Clôturée',
            gpsCloture: i.gpsCloture || parentDevis?.gpsCloture || null,
          };
        }
        return i;
      });

    const existingDevisIds = new Set<number>();
    const existingDevisRefs = new Set<string>();
    allForTech.forEach((i) => {
      const dId = i.devisId || i.origineDevisId;
      if (dId) existingDevisIds.add(dId);
      if (i.refDevisTexte) existingDevisRefs.add(i.refDevisTexte.trim().toLowerCase());
    });

    const devisVisitsForTech: Intervention[] = devisList
      .filter((d) => {
        if (['Perdu', 'Sans suite', 'Refusé', 'Annulé'].includes(d.statutCommercial || '')) return false;
        if (existingDevisIds.has(d.id)) return false;
        if (d.reference && existingDevisRefs.has(d.reference.trim().toLowerCase())) return false;
        const tech = (d.visiteTechnicien || d.responsable || '').trim().toLowerCase();
        if (!tech) return false;
        const matchTech = tech === targetLower || tech.includes(targetLower);
        return matchTech && Boolean(d.visiteNecessaire || d.visiteDate || d.visiteTechnicien || d.site);
      })
      .map((d) => {
        const isDevisDone =
          ['Terminée', 'Effectuée', 'Clôturée', 'Réalisée', 'Validée', 'Fait', 'Traitée'].includes(
            (d.visiteStatut || '').trim()
          ) ||
          Boolean(d.gpsCloture) ||
          ['Traité', 'Clôturé'].includes((d.traitement || '').trim()) ||
          d.status === 'traite' ||
          ['Accepté', 'Signé', 'Facturé', 'Gagné', 'Terminé', 'Clôturé'].includes(
            (d.statutCommercial || '').trim()
          );
        return {
          id: -d.id,
          reference: d.reference || `DEV-${d.id}`,
          client: d.client,
          chantier: d.site || 'Site client',
          datePlanifiee: d.visiteDate || todayISO,
          heureDebut: '09:00',
          heureFin: '11:00',
          statutOperationnel: isDevisDone ? 'Clôturée' : 'Planifiée',
          typeIntervention: 'Visite technique devis',
          corpsEtat: d.corpsEtat || 'Électricité / Serrurerie',
          objet: d.objet || 'Relevé de côtes et visite préparatoire',
          devisId: d.id,
          gpsCloture: d.gpsCloture || null,
          photos: (d as any).photos || [],
        } as unknown as Intervention;
      });

    return [...allForTech, ...devisVisitsForTech].sort((a, b) => {
      const da = a.datePlanifiee || '9999-99-99';
      const db = b.datePlanifiee || '9999-99-99';
      if (da !== db) return da.localeCompare(db);
      return (a.heureDebut || '08:00').localeCompare(b.heureDebut || '08:00');
    });
  }, [currentTechnicien, devisList, interventionsList, todayISO]);

  // Décompte des missions par date ISO
  const countByDate = useMemo(() => {
    const map: Record<string, number> = {};
    allTechMissionsCombined.forEach((m) => {
      const d = m.datePlanifiee || todayISO;
      map[d] = (map[d] || 0) + 1;
    });
    return map;
  }, [allTechMissionsCombined, todayISO]);

  // Jours de la semaine entourant la date sélectionnée (Lundi à Dimanche)
  const weekDays = useMemo(() => {
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const ref = new Date(y, m - 1, d, 12, 0, 0);
      const dayOfWeek = ref.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(ref);
      monday.setDate(ref.getDate() + diffToMonday);

      const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
      const res = [];
      for (let i = 0; i < 7; i++) {
        const cur = new Date(monday);
        cur.setDate(monday.getDate() + i);
        const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
        res.push({
          iso,
          dayLabel: dayNames[i],
          dayNum: String(cur.getDate()).padStart(2, '0'),
          isToday: iso === todayISO,
        });
      }
      return res;
    } catch {
      return [];
    }
  }, [selectedDate, todayISO]);

  // Titre du mois en français
  const monthTitle = useMemo(() => {
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const date = new Date(y, m - 1, d, 12, 0, 0);
      const str = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date);
      return str.charAt(0).toUpperCase() + str.slice(1);
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Format complet de la date sélectionnée (ex: "Vendredi 6 novembre")
  const formattedSelectedDate = useMemo(() => {
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const date = new Date(y, m - 1, d, 12, 0, 0);
      const s = new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(date);
      return s.charAt(0).toUpperCase() + s.slice(1);
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const handlePrevWeek = () => setSelectedDate((d) => shiftISODate(d, -7));
  const handleNextWeek = () => setSelectedDate((d) => shiftISODate(d, 7));

  const handleTodayShortcut = () => {
    setSelectedDate(todayISO);
  };

  // Missions pour le jour sélectionné
  const selectedDateMissions = useMemo(() => {
    return allTechMissionsCombined.filter((m: Intervention) => {
      const d = m.datePlanifiee || todayISO;
      return d === selectedDate;
    });
  }, [allTechMissionsCombined, selectedDate, todayISO]);

  const doneCount = useMemo(() => {
    return selectedDateMissions.filter((m: Intervention) =>
      ['Clôturée', 'Terminée', 'Terminée - à valider', 'Effectuée'].includes(m.statutOperationnel || '')
    ).length;
  }, [selectedDateMissions]);

  // Interventions passées pour l'historique
  const pastMissions = useMemo(() => {
    return allTechMissionsCombined.filter((m: Intervention) =>
      ['Clôturée', 'Terminée', 'Terminée - à valider', 'Effectuée'].includes(m.statutOperationnel || '')
    );
  }, [allTechMissionsCombined]);

  // Mission actuellement ouverte en plein écran
  const activeMission = useMemo(() => {
    if (!openMissionId) return null;
    return allTechMissionsCombined.find((m: Intervention) => m.id === openMissionId) || null;
  }, [allTechMissionsCombined, openMissionId]);

  // Handlers Pointage
  const handleStartDay = () => {
    clockInMut.mutate({
      technicien: currentTechnicien,
      dateJour: selectedDate,
      heureArriveeBureau: getNowHHMM(),
    });
  };

  const handleEndDay = () => {
    const unfinished = selectedDateMissions.filter(
      (m) => !['Clôturée', 'Terminée', 'Terminée - à valider', 'Effectuée'].includes(m.statutOperationnel || '')
    );
    if (unfinished.length > 0) {
      const confirmEnd = window.confirm(
        `Attention : il reste ${unfinished.length} mission(s) non clôturée(s) pour aujourd'hui. Voulez-vous vraiment finir votre journée ?`
      );
      if (!confirmEnd) return;
    }
    clockOutMut.mutate({
      technicien: currentTechnicien,
      dateJour: selectedDate,
      heureFinJournee: getNowHHMM(),
    });
  };

  /** Une « mission » d'id négatif est une visite devis (id réel = -id). */
  const isDevisVisit = (m: Intervention) => m.id < 0;

  const photosOf = (m: Intervention): { url: string; label: string }[] => {
    if (missionPhotos[m.id]) return missionPhotos[m.id];
    const fromServer = ((m as any).photos || []) as { url?: string; caption?: string; category?: string }[];
    return fromServer
      .filter((p) => Boolean(p.url))
      .map((p, i) => ({ url: p.url as string, label: p.caption || `Photo ${i + 1}` }));
  };
  const reportOf = (m: Intervention): string => missionReports[m.id] ?? m.compteRendu ?? '';

  const toServerPhotos = (photos: { url: string; label: string }[]) =>
    photos.map((p, i) => ({
      id: `ph-${Date.now()}-${i}`,
      url: p.url,
      category: 'Terrain',
      caption: p.label,
      takenAt: new Date().toISOString(),
      auteur: currentTechnicien,
    }));

  const markSync = (id: number, state: 'saving' | 'saved' | 'error') =>
    setSyncState((prev) => ({ ...prev, [id]: state }));

  const handleStartMission = (m: Intervention) => {
    setRunningMissions((prev) => ({ ...prev, [m.id]: true }));
    const onFail = () => {
      setRunningMissions((prev) => ({ ...prev, [m.id]: false }));
      toast.error('Démarrage non enregistré : vérifiez votre connexion et réessayez.');
    };
    if (isDevisVisit(m)) {
      devisApi
        .update(-m.id, { visiteStatut: 'En cours' })
        .then(() => queryClient.invalidateQueries({ queryKey: ['devis'] }))
        .catch(onFail);
    } else {
      updateMissionMut
        .mutateAsync({ id: m.id, data: { statutOperationnel: 'En cours', heureDebutReelle: getNowHHMM() } })
        .catch(onFail);
    }
    toast.success(`Intervention ${m.reference} démarrée sur site`);
  };

  /** Envoie la liste complète des photos de la mission ; l'ajout n'est validé qu'une fois reçu par le serveur. */
  const handleAddPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file || !activeMission) return;
    const m = activeMission;
    const current = photosOf(m);
    if (current.length >= 10) {
      toast.error('10 photos maximum par mission.');
      input.value = '';
      return;
    }
    try {
      const optimized = await compressAndOptimizeImage(file);
      const label = `Photo ${current.length + 1} · ${getNowHHMM()}`;
      const next = [...current, { url: optimized.dataUrl, label }];
      markSync(m.id, 'saving');
      if (isDevisVisit(m)) {
        await devisApi.update(-m.id, { photos: toServerPhotos(next) });
        queryClient.invalidateQueries({ queryKey: ['devis'] });
      } else {
        await updateMissionMut.mutateAsync({
          id: m.id,
          data: { photos: toServerPhotos(next), statutRapport: 'Déclaré par technicien' },
        });
      }
      setMissionPhotos((prev) => ({ ...prev, [m.id]: next }));
      markSync(m.id, 'saved');
      toast.success(`Photo envoyée au bureau : ${label}`);
    } catch {
      markSync(m.id, 'error');
      toast.error('Photo non envoyée : elle n’a pas été enregistrée. Réessayez avec du réseau.');
    } finally {
      input.value = '';
    }
  };

  /** Enregistre le compte-rendu (à la sortie du champ et à la clôture). */
  const saveReport = async (m: Intervention) => {
    const text = reportOf(m).trim();
    if (text === (m.compteRendu || '').trim()) return;
    markSync(m.id, 'saving');
    try {
      if (isDevisVisit(m)) {
        await devisApi.update(-m.id, { compteRendu: text });
      } else {
        await updateMissionMut.mutateAsync({
          id: m.id,
          data: { compteRendu: text, statutRapport: text ? 'Déclaré par technicien' : null },
        });
      }
      markSync(m.id, 'saved');
    } catch {
      markSync(m.id, 'error');
    }
  };

  type GpsFix = { lat: number; lng: number; accuracy: number };

  /** Clôture la mission ; ne ferme la fenêtre et n'annonce « envoyé » qu'une fois le serveur d'accord. */
  const closeMission = async (fix: GpsFix | null) => {
    if (!activeMission) return;
    const m = activeMission;
    setClosing(true);
    setGpsError(null);
    const gps = fix
      ? { ...fix, timestamp: new Date().toISOString(), source: 'GPS_MOBILE', technicien: currentTechnicien }
      : undefined;
    const report = reportOf(m).trim();
    try {
      if (isDevisVisit(m)) {
        const visitPhotos = photosOf(m);
        await devisApi.update(-m.id, {
          visiteStatut: 'Terminée',
          ...(gps ? { gpsCloture: gps } : {}),
          ...(report ? { compteRendu: report } : {}),
          ...(visitPhotos.length > 0 ? { photos: toServerPhotos(visitPhotos) } : {}),
        });
        queryClient.invalidateQueries({ queryKey: ['devis'] });
      } else {
        const photos = photosOf(m);
        await updateMissionMut.mutateAsync({
          id: m.id,
          data: {
            statutOperationnel: 'Clôturée',
            heureFinReelle: getNowHHMM(),
            ...(gps ? { gpsCloture: gps } : {}),
            ...(report ? { compteRendu: report } : {}),
            ...(photos.length > 0 ? { photos: toServerPhotos(photos) } : {}),
            ...(report || photos.length > 0 ? { statutRapport: 'Déclaré par technicien' } : {}),
          },
        });
      }
      setGpsModalOpen(false);
      setOpenMissionId(null);
      toast.success(
        gps ? 'Intervention clôturée · envoyée au bureau' : 'Intervention clôturée sans position GPS · envoyée au bureau'
      );
    } catch {
      setGpsError('La clôture n’a pas pu être envoyée. Rien n’est perdu : vérifiez le réseau puis réessayez.');
    } finally {
      setClosing(false);
    }
  };

  /** Relève la position réelle. En cas d'échec : aucune position inventée, le technicien choisit. */
  const handleGpsConfirm = () => {
    if (!activeMission || closing) return;
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError('La position GPS n’est pas disponible sur cet appareil.');
      return;
    }
    setClosing(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void closeMission({
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
          accuracy: Math.round(pos.coords.accuracy),
        });
      },
      (err) => {
        setClosing(false);
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? 'La position est refusée pour ce site : autorisez la localisation dans le navigateur.'
            : 'Position introuvable pour le moment (signal GPS faible ou délai dépassé).'
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // ==========================================================================
  // DÉRIVÉS D'AFFICHAGE (calculs simples, sans hooks)
  // ==========================================================================
  const statusOf = (m: Intervention) =>
    runningMissions[m.id] ? 'En cours' : m.statutOperationnel || 'Planifiée';
  const isLiveMission = (m: Intervention) =>
    Boolean(runningMissions[m.id]) || /cours/i.test(m.statutOperationnel || '');
  const slotOf = (m: Intervention) =>
    m.heureDebut ? `${m.heureDebut}${m.heureFin ? ` – ${m.heureFin}` : ''}` : 'Horaire à confirmer';
  const firstName = (currentTechnicien || 'Technicien').split(' ')[0];

  const defaultMission: Intervention | null =
    selectedDateMissions.find((m) => isLiveMission(m)) ||
    selectedDateMissions.find((m) => !isDoneStatus(m.statutOperationnel)) ||
    selectedDateMissions[0] ||
    null;

  // Sur tablette, la mission choisie s'affiche à côté de la liste (jamais en plein écran).
  const shownMission: Intervention | null =
    activeMission || (isTablet && tab === 'home' ? defaultMission : null);
  const showFullDetail = Boolean(activeMission) && !isTablet;

  const openMission = (id: number) => {
    setOpenMissionId(id);
    if (isTablet) setTab('home');
  };

  const monthKey = selectedDate.slice(0, 7);
  const monthMissions = allTechMissionsCombined.filter((m) => (m.datePlanifiee || '').startsWith(monthKey));
  const monthDone = monthMissions.filter((m) => isDoneStatus(m.statutOperationnel));
  const gpsRate = monthDone.length
    ? Math.round((monthDone.filter((m) => m.gpsCloture).length / monthDone.length) * 100)
    : null;
  const specialities = Array.from(
    new Set(allTechMissionsCombined.map((m) => (m.corpsEtat || '').trim()).filter(Boolean))
  ).slice(0, 4);

  const formatEUR = (v: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

  // Fermeture de la modale GPS avec la touche Échap
  useEffect(() => {
    if (!gpsModalOpen) return;
    setGpsError(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGpsModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gpsModalOpen]);

  // ==========================================================================
  // BLOCS D'INTERFACE
  // ==========================================================================
  const renderPointage = () => (
    <section className="t-pointage" data-testid="terrain-pointage">
      {!isPointed ? (
        <>
          <div className="t-pointage-info">
            <span className="t-pointage-ic t-pointage-ic--warn">
              <Ic n="clock" size={24} />
            </span>
            <div>
              <strong>Prêt à démarrer ?</strong>
              <span>Pointez votre arrivée pour commencer la journée.</span>
            </div>
          </div>
          <button
            type="button"
            className="t-btn t-btn--primary t-btn--xl t-btn--block"
            disabled={clockInMut.isPending}
            onClick={handleStartDay}
          >
            <Ic n="play" size={22} />
            <span>{clockInMut.isPending ? 'Enregistrement…' : 'Commencer ma journée'}</span>
          </button>
        </>
      ) : (
        <div className="t-pointage-row">
          <span className="t-pointage-ic t-pointage-ic--ok">
            <Ic n="checkCircle" size={24} />
          </span>
          <div className="t-pointage-text">
            <strong>{isTerminee ? 'Journée terminée' : 'Journée commencée'}</strong>
            <span>
              Arrivée pointée à {currentPointage?.heureArriveeBureau}
              {isTerminee && currentPointage?.heureFinJournee ? ` · fin ${currentPointage.heureFinJournee}` : ''}
            </span>
          </div>
          {!isTerminee && (
            <button
              type="button"
              className="t-btn t-btn--danger-outline"
              disabled={clockOutMut.isPending}
              onClick={handleEndDay}
            >
              <Ic n="stop" size={16} />
              <span>{clockOutMut.isPending ? '…' : 'Finir'}</span>
            </button>
          )}
        </div>
      )}
    </section>
  );

  const renderDatePicker = () => (
    <section className="t-date-picker" data-testid="terrain-date-picker">
      <div className="t-month-row">
        <h2 className="t-month-label">{monthTitle}</h2>
        <div className="t-month-nav-btns">
          <button type="button" className="t-icon-btn" onClick={handlePrevWeek} aria-label="Semaine précédente">
            <Ic n="left" />
          </button>
          <button type="button" className="t-today-btn" onClick={handleTodayShortcut}>
            Aujourd’hui
          </button>
          <button type="button" className="t-icon-btn" onClick={handleNextWeek} aria-label="Semaine suivante">
            <Ic n="right" />
          </button>
        </div>
      </div>

      <div className="t-week-strip">
        {weekDays.map((day) => {
          const isSelected = day.iso === selectedDate;
          const missionCount = countByDate[day.iso] || 0;
          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => setSelectedDate(day.iso)}
              className={`t-day-pill ${isSelected ? 'is-selected' : ''} ${day.isToday ? 'is-today' : ''}`}
              aria-pressed={isSelected}
              aria-label={`${day.dayLabel} ${day.dayNum}, ${missionCount} mission${missionCount > 1 ? 's' : ''}`}
            >
              <span className="t-day-name">{day.dayLabel}</span>
              <span className="t-day-num">{day.dayNum}</span>
              <span className="t-day-count">{missionCount > 0 ? missionCount : '–'}</span>
            </button>
          );
        })}
      </div>
    </section>
  );

  const renderProgress = () => (
    <section className="t-progress" aria-label="Avancement de la journée">
      <div className="t-progress-head">
        <strong>
          {doneCount} sur {selectedDateMissions.length} terminée{doneCount > 1 ? 's' : ''}
        </strong>
        {selectedDateMissions.length > 0 && doneCount < selectedDateMissions.length && (
          <span>
            Reste {selectedDateMissions.length - doneCount} mission
            {selectedDateMissions.length - doneCount > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="t-segments" aria-hidden="true">
        {selectedDateMissions.map((m) => (
          <span
            key={m.id}
            className={`t-seg ${isDoneStatus(m.statutOperationnel) ? 'is-done' : isLiveMission(m) ? 'is-live' : ''}`}
          />
        ))}
      </div>
    </section>
  );

  const renderMissionList = () => {
    const rows: React.ReactNode[] = [];
    selectedDateMissions.forEach((m, idx) => {
      const done = isDoneStatus(m.statutOperationnel);
      const live = isLiveMission(m);
      const selected = isTablet && shownMission?.id === m.id;
      const prev = selectedDateMissions[idx - 1];
      const prevEnd = toMinutes(prev?.heureFin);
      const curStart = toMinutes(m.heureDebut);
      if (prev && prevEnd !== null && curStart !== null && curStart - prevEnd >= 45) {
        rows.push(
          <li key={`gap-${m.id}`} className="t-gap" aria-hidden="true">
            <span className="t-item-time">{prev.heureFin}</span>
            <span className="t-gap-box">Pause · jusqu’à {m.heureDebut}</span>
          </li>
        );
      }
      rows.push(
        <li
          key={m.id}
          className={`t-item ${done ? 'is-done' : ''} ${live ? 'is-live' : ''} ${selected ? 'is-selected' : ''}`}
        >
          <span className="t-item-time" aria-hidden="true">
            {m.heureDebut || '–'}
          </span>
          <span className="t-item-dot" aria-hidden="true" />
          <div className="t-item-body">
            <button type="button" className="t-card" onClick={() => openMission(m.id)}>
              <span className="t-card-top">
                <span className="t-card-time">{slotOf(m)}</span>
                <StatusPill status={statusOf(m)} />
              </span>
              <strong className="t-card-client">{m.client || 'Client'}</strong>
              <span className="t-card-objet">
                {m.corpsEtat || 'Tous corps d’état'} · {m.objet || 'Prestation sur site'}
              </span>
              <span className="t-card-foot">
                <Ic n="pin" size={18} />
                <span className="t-card-addr">{(m.chantier || 'Adresse non renseignée').split(',')[0]}</span>
                <Ic n="right" size={18} />
              </span>
            </button>

            {!done && !live && (
              <button
                type="button"
                className="t-btn t-btn--primary t-btn--lg t-btn--block"
                onClick={() => {
                  handleStartMission(m);
                  openMission(m.id);
                }}
              >
                <Ic n="play" size={20} />
                <span>Commencer l’intervention</span>
              </button>
            )}
          </div>
        </li>
      );
    });

    return (
      <ul className="t-list" data-testid="terrain-missions-list">
        {rows}
        {selectedDateMissions.length === 0 && (
          <li className="t-empty">Aucune mission planifiée pour le {formattedSelectedDate}.</li>
        )}
      </ul>
    );
  };

  const renderHomeColumn = () => (
    <>
      {canSwitchTechnicien && (
        <div className="t-supervisor">
          <label htmlFor="t-supervisor-select">Superviseur : technicien affiché</label>
          <select
            id="t-supervisor-select"
            className="t-select"
            value={currentTechnicien}
            onChange={(e) => onSelectTechnicien(e.target.value)}
          >
            {techniciens.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      )}

      <section className="t-hello">
        <h2>Bonjour {firstName}</h2>
        <p>
          {formattedSelectedDate} · {selectedDateMissions.length} mission
          {selectedDateMissions.length > 1 ? 's' : ''}
        </p>
      </section>

      {renderPointage()}
      {renderDatePicker()}
      {renderProgress()}
      {renderMissionList()}
    </>
  );

  const renderMissionDetail = (m: Intervention, embedded: boolean) => {
    const live = isLiveMission(m);
    const done = isDoneStatus(m.statutOperationnel);
    const photos = photosOf(m);
    const sync = syncState[m.id];
    const duration = formatDuration(m.heureDebut, m.heureFin);
    const phone = findPhone(m.notes);
    const addr = m.chantier || '';
    const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr || 'Paris')}`;

    return (
      <section className="t-detail" data-testid="terrain-mission-detail">
        {!embedded && <Header title="Mission" subtitle={m.reference || undefined} onBack={() => setOpenMissionId(null)} />}

        <div className="t-detail-body">
          <div className="t-mission-top">
            <span className="t-ref">{m.reference}</span>
            <StatusPill status={statusOf(m)} />
          </div>

          <div>
            <h2 className="t-mission-title">{m.client || 'Client'}</h2>
            <p className="t-mission-sub">
              {m.corpsEtat || 'Tous corps d’état'} · {m.objet || 'Prestation sur site'}
            </p>
          </div>

          <div className="t-facts">
            <div>
              <span>Créneau</span>
              <strong>{m.heureDebut ? `${m.heureDebut}–${m.heureFin || '?'}` : 'À confirmer'}</strong>
            </div>
            {typeof m.amount === 'number' && (
              <div>
                <span>Montant HT</span>
                <strong>{formatEUR(m.amount)}</strong>
              </div>
            )}
            {duration && (
              <div>
                <span>Durée</span>
                <strong>{duration}</strong>
              </div>
            )}
          </div>

          <div className="t-block">
            <h3 className="t-block-title">
              <Ic n="pin" size={18} />
              Adresse
            </h3>
            <p className="t-addr">{addr || 'Adresse non renseignée'}</p>
            <div className="t-row-actions">
              <a className="t-btn t-btn--outline t-btn--lg" href={mapsHref} target="_blank" rel="noopener noreferrer">
                <Ic n="nav" />
                <span>Itinéraire</span>
              </a>
              {phone && (
                <a className="t-btn t-btn--outline t-btn--lg" href={`tel:${phone}`}>
                  <Ic n="phone" />
                  <span>Appeler</span>
                </a>
              )}
            </div>
          </div>

          {m.notes && (
            <div className="t-callout" role="note">
              <Ic n="alert" size={22} />
              <div>
                <strong>Consignes d’accès</strong>
                <p>{m.notes}</p>
              </div>
            </div>
          )}

          <div className="t-block">
            <h3 className="t-block-title">
              <Ic n="camera" size={18} />
              Photos avant / après
              <span className="t-block-count">
                {photos.length} prise{photos.length > 1 ? 's' : ''}
              </span>
            </h3>
            <div className="t-photos">
              {photos.map((p, i) => (
                <figure key={i} className="t-photo">
                  <img src={p.url} alt={p.label} />
                  <figcaption>{p.label}</figcaption>
                </figure>
              ))}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="t-file-input"
                aria-label="Ajouter une photo"
                onChange={handleAddPhoto}
              />
              <button
                type="button"
                className="t-photo t-photo--add"
                disabled={sync === 'saving'}
                onClick={() => fileInputRef.current?.click()}
              >
                <Ic n="plus" size={26} />
                <span>{sync === 'saving' ? 'Envoi…' : 'Ajouter'}</span>
              </button>
            </div>
          </div>

          <div className="t-block">
            <label className="t-block-title" htmlFor={`t-report-${m.id}`}>
              <Ic n="file" size={18} />
              Compte-rendu
            </label>
            <textarea
              id={`t-report-${m.id}`}
              className="t-textarea"
              rows={3}
              placeholder="Travaux réalisés, matériel posé, mesures prises…"
              value={reportOf(m)}
              maxLength={4000}
              onChange={(e) =>
                setMissionReports((prev) => ({
                  ...prev,
                  [m.id]: e.target.value,
                }))
              }
              onBlur={() => {
                void saveReport(m);
              }}
            />
            <p
              className={`t-sync ${sync === 'error' ? 't-sync--error' : ''}`}
              role="status"
              aria-live="polite"
            >
              {sync === 'saving' && 'Envoi au bureau…'}
              {sync === 'saved' && 'Enregistré et envoyé au bureau.'}
              {sync === 'error' && (
                <>
                  Non envoyé.{' '}
                  <button type="button" className="t-sync-retry" onClick={() => void saveReport(m)}>
                    Réessayer
                  </button>
                </>
              )}
              {!sync && 'Enregistré automatiquement quand vous quittez le champ.'}
            </p>
          </div>
        </div>

        <div className="t-actions">
          {done && (
            <p className="t-done-note">
              <Ic n="checkCircle" size={22} />
              Mission clôturée
            </p>
          )}
          {!done && !live && (
            <button type="button" className="t-btn t-btn--primary t-btn--xl t-btn--block" onClick={() => handleStartMission(m)}>
              <Ic n="play" size={22} />
              <span>Démarrer sur site</span>
            </button>
          )}
          {!done && live && (
            <>
              <button type="button" className="t-btn t-btn--outline t-btn--xl" onClick={() => toast('Pause enregistrée')}>
                <Ic n="pause" size={20} />
                <span>Pause</span>
              </button>
              <button type="button" className="t-btn t-btn--primary t-btn--xl t-btn--grow" onClick={() => setGpsModalOpen(true)}>
                <Ic n="target" size={22} />
                <span>Clôturer avec GPS</span>
              </button>
            </>
          )}
        </div>
      </section>
    );
  };

  const navItems: { id: 'home' | 'map' | 'hist' | 'prof'; label: string; icon: IconName; testId: string }[] = [
    { id: 'home', label: 'Missions', icon: 'missions', testId: 'terrain-tab-missions' },
    { id: 'map', label: 'Tournée', icon: 'nav', testId: 'terrain-tab-map' },
    { id: 'hist', label: 'Historique', icon: 'history', testId: 'terrain-tab-hist' },
    { id: 'prof', label: 'Profil', icon: 'user', testId: 'terrain-tab-prof' },
  ];

  // ==========================================================================
  // RENDU
  // ==========================================================================
  return (
    <div className="t-app" data-skin={skin} data-layout={isTablet ? 'tablet' : 'phone'} data-testid="real-terrain-mobile-app">
      {/* =====================================================================
          1. MISSION OUVERTE EN PLEIN ÉCRAN (TÉLÉPHONE UNIQUEMENT)
         ===================================================================== */}
      {showFullDetail && activeMission ? (
        <main className="t-main t-main--mission">{renderMissionDetail(activeMission, false)}</main>
      ) : (
        <>
          {/* ===================================================================
              2. ÉCRAN MISSIONS
             =================================================================== */}
          {tab === 'home' && (
            <main className={`t-main ${isTablet ? 't-main--split' : ''}`} data-testid="terrain-home">
              {isTablet ? (
                <>
                  <div className="t-col t-col--list">
                    <Header title="ANELEC Terrain" />
                    <div className="t-col-body">{renderHomeColumn()}</div>
                  </div>
                  <div className="t-col t-col--detail">
                    {shownMission ? (
                      renderMissionDetail(shownMission, true)
                    ) : (
                      <p className="t-empty">Sélectionnez une mission pour voir son détail.</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Header title="ANELEC Terrain" />
                  <div className="t-col-body">{renderHomeColumn()}</div>
                </>
              )}
            </main>
          )}

          {/* ===================================================================
              3. ÉCRAN TOURNÉE
             =================================================================== */}
          {tab === 'map' && (
            <main className="t-main t-main--page" data-testid="terrain-mapview">
              <Header title="Ma tournée" subtitle={formattedSelectedDate} />
              <div className="t-col-body">
                <MobileRouteMap
                  technicien={currentTechnicien}
                  missions={selectedDateMissions}
                  selectedDate={selectedDate}
                  onOpenMission={openMission}
                />

                <div className="t-route-head">
                  <h2 className="t-h2">
                    {selectedDateMissions.length} étape{selectedDateMissions.length > 1 ? 's' : ''}
                  </h2>
                  <button type="button" className="t-btn t-btn--outline" onClick={() => setIsInteractiveMapOpen((o) => !o)}>
                    {isInteractiveMapOpen ? 'Masquer l’optimisation' : 'Optimiser la tournée'}
                  </button>
                </div>

                {isInteractiveMapOpen && (
                  <div className="t-optimizer">
                    <TourneeMapOptimizer
                      interventions={interventionsList}
                      devis={devisList}
                      selectedDate={selectedDate}
                      currentTechnicien={currentTechnicien}
                      techniciensList={techniciens}
                      onSelectTechnicien={onSelectTechnicien}
                      onOpenIntervention={(i) => openMission(i.id)}
                      onOpenDevis={(d) => openMission(-d.id)}
                    />
                  </div>
                )}

                <ul className="t-list t-list--route" data-testid="terrain-route-list">
                  {selectedDateMissions.map((m, index) => (
                    <li key={m.id}>
                      <button type="button" className="t-route-row" onClick={() => openMission(m.id)}>
                        <span className="t-stop-num">{index + 1}</span>
                        <span className="t-route-text">
                          <strong>{m.client || 'Client'}</strong>
                          <span>
                            {(m.chantier || 'Adresse non renseignée').split(',')[0]} · {m.heureDebut || 'horaire à confirmer'}
                          </span>
                        </span>
                        <StatusPill status={statusOf(m)} />
                      </button>
                    </li>
                  ))}
                  {selectedDateMissions.length === 0 && (
                    <li className="t-empty">Aucun itinéraire à afficher pour cette date.</li>
                  )}
                </ul>
              </div>
            </main>
          )}

          {/* ===================================================================
              4. ÉCRAN HISTORIQUE
             =================================================================== */}
          {tab === 'hist' && (
            <main className="t-main t-main--page" data-testid="terrain-history">
              <Header title="Historique" subtitle="Mes interventions clôturées" />
              <div className="t-col-body">
                <ul className="t-list">
                  {pastMissions.map((m) => (
                    <li key={m.id}>
                      <button type="button" className="t-card" onClick={() => openMission(m.id)}>
                        <span className="t-card-top">
                          <span className="t-ref">{m.reference}</span>
                          <StatusPill status="Clôturée" />
                        </span>
                        <strong className="t-card-client">{m.client || 'Client'}</strong>
                        <span className="t-card-objet">{m.objet || 'Prestation terminée'}</span>
                        <span className="t-card-foot t-card-foot--plain">
                          <span>{m.datePlanifiee ? formatDateFR(m.datePlanifiee) : 'Date non renseignée'}</span>
                          {photosOf(m).length > 0 && (
                            <span>
                              {photosOf(m).length} photo{photosOf(m).length > 1 ? 's' : ''}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                  {pastMissions.length === 0 && (
                    <li className="t-empty">Pas encore d’interventions terminées enregistrées.</li>
                  )}
                </ul>
              </div>
            </main>
          )}

          {/* ===================================================================
              5. ÉCRAN PROFIL & APPARENCE
             =================================================================== */}
          {tab === 'prof' && (
            <main className="t-main t-main--page" data-testid="terrain-profile">
              <Header title="Profil" />
              <div className="t-col-body">
                <section className="t-profile">
                  <UserAvatar name={currentTechnicien} size={64} />
                  <strong>{currentTechnicien}</strong>
                  {specialities.length > 0 && <span>{specialities.join(' · ')}</span>}
                </section>

                <ul className="t-prof-list">
                  <li>
                    <Ic n="missions" />
                    <span>
                      Missions ce mois : <strong>{monthMissions.length}</strong>
                    </span>
                  </li>
                  <li>
                    <Ic n="checkCircle" />
                    <span>
                      Clôturées ce mois : <strong>{monthDone.length}</strong>
                    </span>
                  </li>
                  <li>
                    <Ic n="target" />
                    <span>
                      Clôtures avec position GPS : <strong>{gpsRate === null ? '—' : `${gpsRate} %`}</strong>
                    </span>
                  </li>
                </ul>

                {allowUserOverride && (
                  <section className="t-skin" aria-labelledby="t-skin-title">
                    <h3 id="t-skin-title">Apparence</h3>
                    <div className="t-skin-opts" role="radiogroup" aria-labelledby="t-skin-title">
                      {themes.map((t) => {
                        const selected = (userPref ?? currentTheme) === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            disabled={themePending}
                            className={`t-skin-opt ${selected ? 'is-selected' : ''}`}
                            onClick={() => {
                              setUserPref(t.id).catch(() => toast.error('Impossible de changer l’apparence pour le moment.'));
                            }}
                          >
                            <strong>{t.name}</strong>
                            <span>{t.tagline}</span>
                            {selected && <Ic n="check" size={20} />}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                <button
                  type="button"
                  className="t-btn t-btn--danger-outline t-btn--lg t-btn--block"
                  onClick={async () => {
                    await logout();
                    toast.success('Déconnexion réussie');
                  }}
                >
                  <Ic n="logout" />
                  <span>Se déconnecter</span>
                </button>
              </div>
            </main>
          )}

          {/* ===================================================================
              6. NAVIGATION PRINCIPALE (barre basse sur téléphone, rail sur tablette)
             =================================================================== */}
          <nav className="t-nav" aria-label="Navigation principale">
            {isTablet && <img src="/brand/anelec-mark.png" alt="" className="t-nav-logo" />}
            {navItems.map((it) => (
              <button
                key={it.id}
                type="button"
                className={tab === it.id ? 'is-active' : ''}
                aria-current={tab === it.id ? 'page' : undefined}
                onClick={() => {
                  setTab(it.id);
                  setOpenMissionId(null);
                }}
                data-testid={it.testId}
              >
                <Ic n={it.icon} size={24} />
                <span>{it.label}</span>
              </button>
            ))}
          </nav>
        </>
      )}

      {/* =====================================================================
          7. MODALE DE CLÔTURE GPS
         ===================================================================== */}
      {gpsModalOpen && activeMission && (
        <div className="t-modal-backdrop" onClick={() => setGpsModalOpen(false)}>
          <div
            className="t-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="t-gps-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="t-modal-head">
              <span className="t-modal-ic">
                <Ic n="target" size={24} />
              </span>
              <div>
                <h3 id="t-gps-title">Clôturer avec la position GPS</h3>
                <p>Votre position est relevée au moment de la clôture, comme preuve d’exécution.</p>
              </div>
              <button type="button" className="t-icon-btn" onClick={() => setGpsModalOpen(false)} aria-label="Fermer">
                <Ic n="close" />
              </button>
            </div>

            <div className="t-modal-site">
              <Ic n="pin" size={20} />
              <span>{activeMission.chantier || 'Adresse non renseignée'}</span>
            </div>

            <p className="t-modal-note">
              Le navigateur peut vous demander l’autorisation d’accéder à votre position. Le rapport part ensuite à
              l’équipe bureau pour validation.
            </p>

            {gpsError && (
              <div className="t-callout" role="alert">
                <Ic n="alert" size={22} />
                <div>
                  <strong>{gpsError}</strong>
                  <p>Vous pouvez réessayer, ou clôturer sans position : le bureau verra « sans position GPS ».</p>
                </div>
              </div>
            )}

            <div className="t-modal-actions">
              <button
                type="button"
                className="t-btn t-btn--outline t-btn--xl"
                disabled={closing}
                onClick={() => {
                  setGpsError(null);
                  setGpsModalOpen(false);
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                className="t-btn t-btn--primary t-btn--xl t-btn--grow"
                disabled={closing}
                onClick={handleGpsConfirm}
              >
                <Ic n="checkCircle" size={22} />
                <span>{closing ? 'Envoi en cours…' : gpsError ? 'Réessayer la position' : 'Clôturer l’intervention'}</span>
              </button>
            </div>
            {gpsError && (
              <button
                type="button"
                className="t-btn t-btn--danger-outline t-btn--lg t-btn--block"
                disabled={closing}
                onClick={() => void closeMission(null)}
              >
                <span>Clôturer sans position GPS</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
