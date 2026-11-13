/**
 * Siège de l'entreprise connectée = point de départ et de retour des tournées.
 * Une seule source pour toutes les vues (carte, optimiseur de tournées, application mobile
 * technicien), ordinateur comme téléphone : chaque entreprise a son adresse, saisie par son
 * administrateur dans Administration → Apparence. Tant qu'elle n'est pas renseignée on retombe
 * sur l'adresse par défaut et `configured` vaut false pour pouvoir le signaler.
 */
import { useMemo } from 'react';
import { useAuth } from '../stores/authStore';
import { DEFAULT_DEPOT_ADDRESS, DEFAULT_DEPOT_COORDS, type GeoPoint } from './geocoding';

/**
 * À utiliser pour toute valeur saisie par un utilisateur (adresse, nom d'entreprise) placée dans le
 * HTML d'une bulle Leaflet : sans cela, une adresse contenant du HTML s'exécuterait chez tous les
 * membres de l'équipe.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}

export interface CompanyHQ {
  name: string;
  addr: string;
  pos: [number, number];
  coords: GeoPoint;
  /** true quand l'entreprise a renseigné sa propre adresse */
  configured: boolean;
}

const FALLBACK_HQ: CompanyHQ = {
  name: 'Siège (adresse non configurée)',
  addr: DEFAULT_DEPOT_ADDRESS,
  pos: [DEFAULT_DEPOT_COORDS.lat, DEFAULT_DEPOT_COORDS.lng],
  coords: { lat: DEFAULT_DEPOT_COORDS.lat, lng: DEFAULT_DEPOT_COORDS.lng },
  configured: false,
};

export function useCompanyHQ(): CompanyHQ {
  const { user } = useAuth();
  const company = user?.company;
  const adresse = company?.siegeAdresse;
  const lat = company?.siegeLat;
  const lng = company?.siegeLng;
  const nom = company?.name;

  return useMemo<CompanyHQ>(() => {
    if (adresse && typeof lat === 'number' && typeof lng === 'number') {
      return {
        name: `Siège ${nom || ''}`.trim(),
        addr: adresse,
        pos: [lat, lng],
        coords: { lat, lng },
        configured: true,
      };
    }
    return FALLBACK_HQ;
  }, [adresse, lat, lng, nom]);
}
