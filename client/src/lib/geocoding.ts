/**
 * Module d'Optimisation des Trajets & Géocodage Intelligent ANELEC TCE
 * - Géocodage automatique via Base Adresse Nationale (BAN data.gouv.fr) & Nominatim
 * - Algorithme TSP (Voyageur de commerce : Plus Proche Voisin + 2-Opt)
 * - Traçage d'itinéraires routiers réels (OSRM)
 * - Liens GPS directs pour techniciens (Waze, Google Maps, Apple Plans)
 */

export interface GeoPoint {
  lat: number;
  lng: number;
  label?: string;
}

export interface CircuitStop {
  id: string | number;
  reference: string;
  client: string;
  chantierOrSite: string;
  address: string;
  corpsEtat?: string;
  heurePrevue?: string;
  statut?: string;
  isVisiteDevis?: boolean;
  rawMission?: any;
  coordinates?: GeoPoint;
  geocodingStatus?: 'ok' | 'approx' | 'pending' | 'error';
}

export interface RouteLeg {
  fromName: string;
  toName: string;
  distanceKm: number;
  durationMin: number;
  navUrl: string;
}

export interface OptimizedTour {
  startPoint: GeoPoint;
  startAddress: string;
  orderedStops: (CircuitStop & { sequenceNumber: number; legFromPrevious?: RouteLeg })[];
  totalDistanceKm: number;
  totalDurationMin: number;
  originalDistanceKm: number;
  originalDurationMin: number;
  savedDistanceKm: number;
  savedDurationMin: number;
  routePolyline: [number, number][]; // Coordonnées réelles [lat, lng] pour la ligne Leaflet
}

export interface AddressSuggestion {
  label: string;
  lat: number;
  lng: number;
  postcode?: string;
  city?: string;
  score?: number;
}

const CACHE_KEY = 'anelec_geo_cache_v5';
const LEGACY_CACHE_KEYS = ['anelec_geo_cache_v4', 'anelec_geo_cache_v3'];
const MAX_GEO_CACHE_ENTRIES = 250;

function isValidFranceCoords(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 41.0 &&
    lat <= 51.5 &&
    lng >= -5.5 &&
    lng <= 10.0
  );
}

function getLocalCache(): Record<string, GeoPoint> {
  try {
    for (const oldKey of LEGACY_CACHE_KEYS) {
      localStorage.removeItem(oldKey);
    }
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, GeoPoint>;
    const clean: Record<string, GeoPoint> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (
        v &&
        typeof v.lat === 'number' &&
        typeof v.lng === 'number' &&
        isValidFranceCoords(v.lat, v.lng) &&
        !String(v.label || '').includes('(Zone Paris / IDF)')
      ) {
        clean[k] = v;
      }
    }
    return clean;
  } catch {
    return {};
  }
}

/** Vide le cache d'adresses de cet appareil (appelé quand l'identité connectée change). */
export function clearGeocodeCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    for (const oldKey of LEGACY_CACHE_KEYS) {
      localStorage.removeItem(oldKey);
    }
  } catch {
    // stockage indisponible : rien à purger
  }
}

function setLocalCache(cache: Record<string, GeoPoint>) {
  try {
    const keys = Object.keys(cache);
    if (keys.length > MAX_GEO_CACHE_ENTRIES) {
      const trimmed: Record<string, GeoPoint> = {};
      for (const k of keys.slice(keys.length - MAX_GEO_CACHE_ENTRIES)) {
        trimmed[k] = cache[k];
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
      return;
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

/**
 * Nettoie une adresse en retirant les emojis, préfixes d'immeuble, etc.
 */
export function cleanAddressString(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/[⌖▪•▲✓✓]/g, '')
    .replace(/\[[^\]]+\]/g, '') // supprime les [Visite Devis]
    .replace(/\s*\(Zone Paris \/ IDF\)\s*/gi, '')
    .replace(/^(site|adresse|chantier)\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function queryBanEndpoint(
  baseUrl: string,
  query: string,
  limit = 1,
  minScore = 0.4
): Promise<AddressSuggestion[]> {
  try {
    const url = `${baseUrl}?q=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data?.features)) return [];
    const out: AddressSuggestion[] = [];
    for (const feat of data.features) {
      const coords = feat?.geometry?.coordinates;
      const props = feat?.properties || {};
      if (!Array.isArray(coords) || coords.length < 2) continue;
      const lng = Number(coords[0]);
      const lat = Number(coords[1]);
      const score = typeof props.score === 'number' ? props.score : 1;
      if (score < minScore || !isValidFranceCoords(lat, lng)) continue;
      out.push({
        label: String(props.label || query),
        lat,
        lng,
        postcode: props.postcode ? String(props.postcode) : undefined,
        city: props.city ? String(props.city) : undefined,
        score,
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function queryNominatim(query: string): Promise<GeoPoint | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=fr&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const item = data[0];
    const lat = Number(item?.lat);
    const lng = Number(item?.lon);
    if (!isValidFranceCoords(lat, lng)) return null;
    return {
      lat,
      lng,
      label: String(item?.display_name || query),
    };
  } catch {
    return null;
  }
}

/**
 * Autocomplétion d'adresses françaises (BAN data.gouv.fr avec repli IGN Géoplateforme)
 */
export async function searchAddressSuggestions(
  rawQuery: string,
  limit = 5
): Promise<AddressSuggestion[]> {
  const query = cleanAddressString(rawQuery);
  if (!query || query.length < 3) return [];

  const ban = await queryBanEndpoint('https://api-adresse.data.gouv.fr/search/', query, limit, 0.3);
  if (ban.length > 0) return ban;

  return queryBanEndpoint('https://data.geopf.fr/geocodage/search', query, limit, 0.3);
}

/**
 * Géocode automatiquement une adresse textuelle en coordonnées réelles {lat, lng}.
 * Ne fabrique JAMAIS de coordonnées fictives : retourne null si l'adresse est introuvable.
 */
export async function geocodeAddress(rawAddress: string): Promise<GeoPoint | null> {
  const query = cleanAddressString(rawAddress);
  if (!query || query.length < 3) return null;

  const cache = getLocalCache();
  if (cache[query]) {
    return cache[query];
  }

  const saveAndReturn = (pt: GeoPoint): GeoPoint => {
    cache[query] = pt;
    setLocalCache(cache);
    return pt;
  };

  // 1. API officielle française BAN (Base Adresse Nationale)
  const banHits = await queryBanEndpoint('https://api-adresse.data.gouv.fr/search/', query, 1, 0.4);
  if (banHits.length > 0) {
    return saveAndReturn({ lat: banHits[0].lat, lng: banHits[0].lng, label: banHits[0].label });
  }

  // 2. Repli officiel IGN Géoplateforme (même référentiel BAN)
  const geopfHits = await queryBanEndpoint('https://data.geopf.fr/geocodage/search', query, 1, 0.4);
  if (geopfHits.length > 0) {
    return saveAndReturn({ lat: geopfHits[0].lat, lng: geopfHits[0].lng, label: geopfHits[0].label });
  }

  // 3. Si la requête contient des barres obliques (ex: "orange / pantin / 20 rue ..."), retenter avec les sous-parties
  if (query.includes('/')) {
    const parts = query.split('/').map((p) => p.trim()).filter(Boolean);
    const street = parts.find((p) => /\d+|rue|avenue|bd|boulevard|chemin|allée|place|impasse|route/i.test(p));
    const city = parts.find((p) => !/\d+|rue|avenue|bd|boulevard|chemin|allée|place|impasse|route/i.test(p) && p.length > 2);
    const combined = [street, city].filter(Boolean).join(' ');
    if (combined && combined !== query) {
      const splitBan = await queryBanEndpoint('https://api-adresse.data.gouv.fr/search/', combined, 1, 0.4);
      if (splitBan.length > 0) {
        return saveAndReturn({ lat: splitBan[0].lat, lng: splitBan[0].lng, label: splitBan[0].label });
      }
      const splitGeopf = await queryBanEndpoint('https://data.geopf.fr/geocodage/search', combined, 1, 0.4);
      if (splitGeopf.length > 0) {
        return saveAndReturn({ lat: splitGeopf[0].lat, lng: splitGeopf[0].lng, label: splitGeopf[0].label });
      }
    }
  }

  // 4. Repli Nominatim OpenStreetMap (France)
  const nomHit = await queryNominatim(query);
  if (nomHit) {
    return saveAndReturn(nomHit);
  }

  // Adresse introuvable : ne jamais inventer une fausse coordonnée
  return null;
}

/**
 * Formule d'Haversine : distance à vol d'oiseau (km)
 */
export function haversineDistanceKm(p1: GeoPoint, p2: GeoPoint): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLon = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Conversion distance vol d'oiseau -> distance routière réelle estimée
 * Coefficient de sinuosité urbaine en Île-de-France = 1.35
 */
export function estimateRoadDistanceAndDuration(p1: GeoPoint, p2: GeoPoint): { distanceKm: number; durationMin: number } {
  const straight = haversineDistanceKm(p1, p2);
  const roadKm = Math.max(0.5, Math.round(straight * 1.35 * 10) / 10);
  // Vitesse moyenne urbaine/périurbaine estimée : 28 km/h + 3 min de trafic/manœuvres
  const minutes = Math.max(4, Math.round((roadKm / 28) * 60) + 3);
  return { distanceKm: roadKm, durationMin: minutes };
}

/**
 * Résolution automatique du problème du voyageur de commerce (TSP)
 * Algorithme : Plus Proche Voisin (Nearest Neighbor) + Optimisation locale 2-Opt
 */
export function solveTSP(
  depot: GeoPoint,
  stops: CircuitStop[]
): {
  orderedStops: CircuitStop[];
  totalDistanceKm: number;
  totalDurationMin: number;
  originalDistanceKm: number;
  originalDurationMin: number;
} {
  if (stops.length <= 1) {
    let d = 0;
    let t = 0;
    if (stops.length === 1 && stops[0].coordinates) {
      const leg = estimateRoadDistanceAndDuration(depot, stops[0].coordinates);
      d = leg.distanceKm * 2; // aller-retour
      t = leg.durationMin * 2;
    }
    return {
      orderedStops: stops,
      totalDistanceKm: d,
      totalDurationMin: t,
      originalDistanceKm: d,
      originalDurationMin: t,
    };
  }

  // 1. Calcul de la distance dans l'ordre initial (non optimisé)
  let origKm = 0;
  let origMin = 0;
  let currPoint = depot;
  for (const s of stops) {
    if (s.coordinates) {
      const leg = estimateRoadDistanceAndDuration(currPoint, s.coordinates);
      origKm += leg.distanceKm;
      origMin += leg.durationMin;
      currPoint = s.coordinates;
    }
  }
  if (currPoint !== depot) {
    const ret = estimateRoadDistanceAndDuration(currPoint, depot);
    origKm += ret.distanceKm;
    origMin += ret.durationMin;
  }

  // 2. Construction de la tournée par le Plus Proche Voisin (Nearest Neighbor)
  const unvisited = [...stops];
  const ordered: CircuitStop[] = [];
  let currentLoc = depot;

  while (unvisited.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const coords = unvisited[i].coordinates || depot;
      const dist = haversineDistanceKm(currentLoc, coords);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }

    const nextStop = unvisited.splice(bestIdx, 1)[0];
    ordered.push(nextStop);
    currentLoc = nextStop.coordinates || currentLoc;
  }

  // 3. Amélioration par 2-Opt (élimine les croisements de routes)
  let improved = true;
  let iterations = 0;
  while (improved && iterations < 30) {
    improved = false;
    iterations++;
    for (let i = 0; i < ordered.length - 1; i++) {
      for (let k = i + 1; k < ordered.length; k++) {
        const pA = i === 0 ? depot : ordered[i - 1].coordinates || depot;
        const pB = ordered[i].coordinates || depot;
        const pC = ordered[k].coordinates || depot;
        const pD = k === ordered.length - 1 ? depot : ordered[k + 1].coordinates || depot;

        const currentDist = haversineDistanceKm(pA, pB) + haversineDistanceKm(pC, pD);
        const newDist = haversineDistanceKm(pA, pC) + haversineDistanceKm(pB, pD);

        if (newDist < currentDist - 0.05) {
          // Inversion de la sous-branche de i à k
          const sub = ordered.slice(i, k + 1).reverse();
          ordered.splice(i, k - i + 1, ...sub);
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  // 4. Calcul de la distance et durée optimisées
  let optKm = 0;
  let optMin = 0;
  let cur = depot;
  for (const s of ordered) {
    if (s.coordinates) {
      const leg = estimateRoadDistanceAndDuration(cur, s.coordinates);
      optKm += leg.distanceKm;
      optMin += leg.durationMin;
      cur = s.coordinates;
    }
  }
  if (cur !== depot) {
    const back = estimateRoadDistanceAndDuration(cur, depot);
    optKm += back.distanceKm;
    optMin += back.durationMin;
  }

  return {
    orderedStops: ordered,
    totalDistanceKm: Math.round(optKm * 10) / 10,
    totalDurationMin: Math.round(optMin),
    originalDistanceKm: Math.round(origKm * 10) / 10,
    originalDurationMin: Math.round(origMin),
  };
}

/**
 * Récupère le tracé routier réel via le moteur public OSRM
 * (si indisponible, trace les segments directs entre les points)
 */
export async function fetchOsrmPolyline(points: GeoPoint[]): Promise<[number, number][]> {
  if (points.length < 2) return [];

  try {
    const coordsStr = points.map((p) => `${p.lng},${p.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        // GeoJSON renvoie [lng, lat], Leaflet a besoin de [lat, lng]
        return data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]);
      }
    }
  } catch {
    // ignore
  }

  // Fallback : tracé direct
  return points.map((p) => [p.lat, p.lng]);
}

/**
 * Génère le lien Google Maps / Waze de navigation directe pour le smartphone du technicien
 */
export function getNavigationUrl(stop: CircuitStop, userCoords?: GeoPoint | null): {
  googleMapsUrl: string;
  wazeUrl: string;
  appleMapsUrl: string;
} {
  const dest = stop.coordinates
    ? `${stop.coordinates.lat},${stop.coordinates.lng}`
    : encodeURIComponent(cleanAddressString(stop.address || stop.chantierOrSite));

  const originParam = userCoords ? `&origin=${userCoords.lat},${userCoords.lng}` : '';

  return {
    googleMapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${dest}${originParam}&travelmode=driving`,
    wazeUrl: stop.coordinates
      ? `https://waze.com/ul?ll=${stop.coordinates.lat},${stop.coordinates.lng}&navigate=yes`
      : `https://waze.com/ul?q=${encodeURIComponent(stop.address || stop.chantierOrSite)}&navigate=yes`,
    appleMapsUrl: `https://maps.apple.com/?daddr=${dest}&dirflg=d`,
  };
}

/**
 * Génère le lien Google Maps Itinéraire Complet multi-étapes pour l'ensemble de la journée
 */
export function getFullTourGoogleMapsUrl(depot: GeoPoint, stops: CircuitStop[]): string {
  if (stops.length === 0) return 'https://www.google.com/maps';

  const origin = `${depot.lat},${depot.lng}`;
  const validStops = stops.filter((s) => s.coordinates);
  if (validStops.length === 0) return 'https://www.google.com/maps';

  const destination = `${validStops[validStops.length - 1].coordinates!.lat},${validStops[validStops.length - 1].coordinates!.lng}`;
  const waypoints = validStops
    .slice(0, validStops.length - 1)
    .map((s) => `${s.coordinates!.lat},${s.coordinates!.lng}`)
    .join('|');

  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  if (waypoints) {
    url += `&waypoints=${waypoints}`;
  }
  return url;
}
