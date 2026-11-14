import { Devis, GpsPositionPayload, Intervention, rankTechniciansForTrade } from './api';

export interface TechAvailability {
  technicien: string;
  isQualified: boolean;
  skills: string[];
  loadMinutes: number;
  isBusyAtSlot: boolean;
  conflictRef?: string;
  gps?: GpsPositionPayload;
  hasActiveGps: boolean;
  distanceKm: number | null;
  optionLabel: string;
}

function toMinutes(hhmm?: string | null, fallback = 9 * 60): number {
  if (!hhmm || !hhmm.includes(':')) return fallback;
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  if (!Number.isFinite(h)) return fallback;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

export function evaluateTechniciansAvailability(params: {
  techniciens: string[];
  corpsEtat?: string | null;
  dateISO?: string | null;
  heureDebut?: string | null;
  heureFin?: string | null;
  excludeIntvId?: number;
  excludeDevisId?: number;
  interventionsList: Intervention[];
  devisList: Devis[];
  competencesMap?: Record<string, string[]>;
  positionsGps?: Record<string, GpsPositionPayload>;
  targetCoords?: { lat: number; lng: number } | null;
}): TechAvailability[] {
  const {
    techniciens,
    corpsEtat,
    dateISO,
    heureDebut,
    heureFin,
    excludeIntvId,
    excludeDevisId,
    interventionsList,
    devisList,
    competencesMap,
    positionsGps = {},
    targetCoords,
  } = params;

  const targetDate = (dateISO || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const slotStart = heureDebut ? toMinutes(heureDebut) : null;
  const slotEnd = heureFin ? toMinutes(heureFin, (slotStart ?? 9 * 60) + 120) : slotStart !== null ? slotStart + 120 : null;

  const loadByTech: Record<string, number> = {};
  const busyByTech: Record<string, string> = {};

  for (const intv of interventionsList) {
    if (excludeIntvId && intv.id === excludeIntvId) continue;
    if (['Clôturée', 'Annulée'].includes(intv.statutOperationnel || '')) continue;
    const tech = (intv.entreprise || '').trim();
    if (!tech) continue;
    const d = intv.datePlanifiee ? String(intv.datePlanifiee).slice(0, 10) : '';
    if (d !== targetDate) continue;

    const dur = Number((intv as any).dureePrevueMinutes) || 120;
    loadByTech[tech] = (loadByTech[tech] || 0) + dur;

    if (slotStart !== null && slotEnd !== null) {
      const s = toMinutes(intv.heureDebut, 9 * 60);
      const e = intv.heureFin ? toMinutes(intv.heureFin, s + dur) : s + dur;
      if (slotStart < e && slotEnd > s && !busyByTech[tech]) {
        busyByTech[tech] = `${intv.heureDebut || '09:00'}–${intv.heureFin || '11:00'}`;
      }
    }
  }

  for (const dev of devisList) {
    if (excludeDevisId && dev.id === excludeDevisId) continue;
    if (!dev.visiteNecessaire || ['Refusé', 'Annulé'].includes(dev.statutCommercial || '')) continue;
    const tech = (dev.visiteTechnicien || '').trim();
    if (!tech) continue;
    const d = dev.visiteDate ? String(dev.visiteDate).slice(0, 10) : '';
    if (d !== targetDate) continue;

    loadByTech[tech] = (loadByTech[tech] || 0) + 90;
    if (slotStart !== null && slotEnd !== null) {
      const s = toMinutes(dev.visiteHeureDebut, 8 * 60 + 30);
      const e = dev.visiteHeureFin ? toMinutes(dev.visiteHeureFin, s + 90) : s + 90;
      if (slotStart < e && slotEnd > s && !busyByTech[tech]) {
        busyByTech[tech] = `${dev.visiteHeureDebut || '08:30'}–${dev.visiteHeureFin || '10:00'}`;
      }
    }
  }

  const ranked = rankTechniciansForTrade(corpsEtat, techniciens, competencesMap, loadByTech);
  const nowMs = Date.now();

  const items: TechAvailability[] = ranked.allRanked.map((r) => {
    const gps = positionsGps[r.technicien];
    const gpsTs = gps?.timestamp ? new Date(gps.timestamp).getTime() : 0;
    const hasActiveGps = Boolean(gps && Number.isFinite(gps.lat) && Number.isFinite(gps.lng) && nowMs - gpsTs < 24 * 3600 * 1000);
    const distanceKm =
      gps && targetCoords && Number.isFinite(gps.lat) && Number.isFinite(gps.lng)
        ? haversineKm(gps.lat, gps.lng, targetCoords.lat, targetCoords.lng)
        : null;
    const loadMinutes = loadByTech[r.technicien] || 0;
    const conflictRef = busyByTech[r.technicien];
    const isBusyAtSlot = Boolean(conflictRef);

    const tags: string[] = [];
    if (r.isQualified) tags.push('★ Qualifié');
    if (isBusyAtSlot) tags.push(`Occupé ${conflictRef}`);
    else if (loadMinutes === 0) tags.push('Libre');
    else tags.push(`${Math.round((loadMinutes / 60) * 10) / 10}h prévues`);
    if (distanceKm !== null) tags.push(`${distanceKm} km`);
    else if (hasActiveGps) tags.push('GPS actif');

    return {
      technicien: r.technicien,
      isQualified: r.isQualified,
      skills: r.skills,
      loadMinutes,
      isBusyAtSlot,
      conflictRef,
      gps,
      hasActiveGps,
      distanceKm,
      optionLabel: tags.length > 0 ? `${r.technicien} (${tags.join(' · ')})` : r.technicien,
    };
  });

  // Sort: 1) not busy at slot, 2) qualified, 3) closest distance if known, 4) active GPS, 5) lowest daily load
  return items.sort((a, b) => {
    if (a.isBusyAtSlot !== b.isBusyAtSlot) return a.isBusyAtSlot ? 1 : -1;
    if (a.isQualified !== b.isQualified) return a.isQualified ? -1 : 1;
    if (a.distanceKm !== null && b.distanceKm !== null && a.distanceKm !== b.distanceKm) {
      return a.distanceKm - b.distanceKm;
    }
    if (a.hasActiveGps !== b.hasActiveGps) return a.hasActiveGps ? -1 : 1;
    return a.loadMinutes - b.loadMinutes;
  });
}
