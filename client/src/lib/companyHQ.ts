/**
 * Siège de l'entreprise connectée = point de départ et de retour des tournées.
 * Une seule source pour toutes les vues (carte, optimiseur de tournées, application mobile
 * technicien), ordinateur comme téléphone : chaque entreprise a son adresse, saisie par son
 * administrateur dans Administration → Apparence. Tant qu'elle n'est pas renseignée on retombe
 * sur une valeur neutre et `configured` vaut false pour pouvoir le signaler.
 */
import { useMemo } from 'react';
import { useAuth, useAuthStore } from '../stores/authStore';
import type { GeoPoint } from './geocoding';

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

const SAFE_DATA_IMG_RE = /^data:image\/(?:jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i;

export function safeImageSrc(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (SAFE_DATA_IMG_RE.test(trimmed)) return trimmed;
  if (/^\/(?!\/)/.test(trimmed) || /^blob:/i.test(trimmed)) return trimmed;
  return undefined;
}

export function safeExternalUrl(url: unknown): string {
  if (typeof url !== 'string') return '#';
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.toString();
  } catch {
    // ignore invalid URL
  }
  return '#';
}

export function safeHexColor(color: unknown, fallback = '#0f172a'): string {
  const s = String(color || '').trim();
  return /^#[0-9a-f]{3,8}$/i.test(s) ? s : fallback;
}

export interface CompanyHQ {
  name: string;
  addr: string;
  pos: [number, number];
  coords: GeoPoint;
  /** true quand l'entreprise a renseigné sa propre adresse */
  configured: boolean;
}

/**
 * Repli quand l'entreprise n'a pas encore renseigné son siège : valeur NEUTRE (centre de la France),
 * jamais l'adresse d'une autre entreprise. Les vues n'affichent alors ni marqueur, ni adresse, ni
 * distance calculée depuis un siège, et invitent l'administrateur à renseigner l'adresse.
 */
const FALLBACK_HQ: CompanyHQ = {
  name: 'Siège non configuré',
  addr: '',
  pos: [46.6034, 1.8883],
  coords: { lat: 46.6034, lng: 1.8883 },
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

/**
 * Nom de l'entreprise du compte connecté, à utiliser dans les rapports, e-mails et en-têtes.
 * Jamais le nom d'une autre entreprise : chaque entreprise ne voit et n'envoie que sa propre identité.
 */
export function getCompanyName(): string {
  const u = useAuthStore.getState().user;
  return u?.company?.name || u?.companyName || 'Votre entreprise';
}
