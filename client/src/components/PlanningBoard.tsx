import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Devis,
  Intervention,
  EquipeJournaliere,
  DEFAULT_REFERENTIELS,

  rankTechniciansForTrade,
  parseTimeIntervalInput,
  computeDurationHours,
  formatDateFR,
} from '../lib/api';
import toast from 'react-hot-toast';

export interface PlanningSlotItem {
  id: string;
  kind: 'VISITE_DEVIS' | 'INTERVENTION' | 'URGENCE';
  sourceType: 'DEVIS' | 'INTERVENTION';
  sourceId: number;
  reference: string;
  title: string;
  client: string;
  site: string;
  typePrestation: string;
  priorite: string;
  statut: string;
  technicien: string;
  date: string; // YYYY-MM-DD or ''
  heureDebut: string; // HH:mm
  heureFin: string; // HH:mm
  durationHours: number;
  rawDevis?: Devis;
  rawIntervention?: Intervention;
}

interface PlanningBoardProps {
  devisList: Devis[];
  interventionsList: Intervention[];
  techniciens?: string[];
  onUpdateDevisPlanning: (
    devisId: number,
    payload: {
      visiteNecessaire?: boolean;
      visiteTechnicien?: string;
      visiteDate?: string | null;
      visiteHeureDebut?: string;
      visiteHeureFin?: string;
      visiteStatut?: string;
      traitement?: string;
    }
  ) => Promise<void>;
  onUpdateInterventionPlanning: (
    interventionId: number,
    payload: {
      entreprise?: string;
      datePlanifiee?: string | null;
      heureDebut?: string;
      heureFin?: string;
      statutOperationnel?: string;
      modePlanification?: string;
    }
  ) => Promise<void>;
  onOpenDevisDrawer: (devis: Devis) => void;
  onOpenInterventionDrawer: (intervention: Intervention) => void;
  onCreateQuickIntervention?: (payload: Partial<Intervention>) => Promise<void>;
  onDeleteDevis?: (devisId: number) => Promise<void>;
  onDeleteIntervention?: (interventionId: number) => Promise<void>;
  onNavigateToRentabilite?: () => void;
  technicienCompetences?: Record<string, string[]>;
  corpsEtatList?: string[];
  clientsList?: string[];
  onUpdateCompetences?: (competences: Record<string, string[]>) => Promise<void>;
  equipesJournalieres?: EquipeJournaliere[];
  onUpdateEquipes?: (equipes: EquipeJournaliere[]) => Promise<void>;
}

const START_HOUR = 7; // 07:00
const END_HOUR = 19; // 19:00
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60; // 720 min
const HOURS_ARRAY = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

const TECH_SPECIALTIES: Record<string, { role: string; color: string }> = {
  Anouar: { role: 'Chef Équipe CFO/CFA', color: '#0a0f1d' },
  Mohamed: { role: 'Technicien CVC / Plomberie', color: '#00bf63' },
  Haitam: { role: 'Électricien Tertiaire', color: '#0f172a' },
  Jamal: { role: 'Multi-technique TCE', color: '#b45309' },
  Manneh: { role: 'Installation & Tirage', color: '#047857' },
  Yankoubou: { role: 'Maintenance & Dépannage', color: '#1e293b' },
  'Sous-traitant': { role: 'Renfort Externe TCE', color: '#475569' },
};

function toDateKey(d: Date | string | null | undefined): string {
  if (!d) return '';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) {
    return d.slice(0, 10);
  }
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '';
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getMonday(d: Date): Date {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
  dt.setDate(diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function addDays(d: Date, days: number): Date {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + days);
  return dt;
}

function formatDayShort(d: Date): string {
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
}

function timeToMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return 8 * 60;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function minutesToTime(totalMin: number): string {
  const clamped = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, Math.round(totalMin / 15) * 15));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function PlanningBoard({
  devisList,
  interventionsList,
  techniciens = [],
  onUpdateDevisPlanning,
  onUpdateInterventionPlanning,
  onOpenDevisDrawer,
  onOpenInterventionDrawer,
  onCreateQuickIntervention,
  onDeleteDevis,
  onDeleteIntervention,
  onNavigateToRentabilite,
  technicienCompetences = {},
  corpsEtatList = DEFAULT_REFERENTIELS.corps_etat,
  clientsList = [],
  onUpdateCompetences,
  equipesJournalieres = [],
  onUpdateEquipes,
}: PlanningBoardProps) {
  const [skillsModalOpen, setSkillsModalOpen] = useState(false);
  const [customSkillInputs, setCustomSkillInputs] = useState<Record<string, string>>({});

  // Modale de suppression / déplanification
  const [slotToDelete, setSlotToDelete] = useState<PlanningSlotItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // ==========================================================================
  // ÉQUIPES JOURNALIÈRES (Curseur Souris Drag & Drop + Option dépliante + Dates + Heures)
  // ==========================================================================
  const [draggedTechName, setDraggedTechName] = useState<string | null>(null);
  const [dragOverTechTarget, setDragOverTechTarget] = useState<string | null>(null);
  const [expandedTeamTech, setExpandedTeamTech] = useState<string | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [teamDurationMode, setTeamDurationMode] = useState<'jour' | 'duree'>('jour');
  const [teamDateDebut, setTeamDateDebut] = useState<string>(() => toDateKey(new Date()));
  const [teamDateFin, setTeamDateFin] = useState<string>(() => toDateKey(new Date()));
  const [teamAllDay, setTeamAllDay] = useState<boolean>(true);
  const [teamHeureDebut, setTeamHeureDebut] = useState<string>('08:00');
  const [teamHeureFin, setTeamHeureFin] = useState<string>('17:30');
  const [teamQuickInterval, setTeamQuickInterval] = useState<string>('');
  const [viewMode, setViewMode] = useState<'gantt' | 'week' | 'columns'>('gantt');
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [selectedDayKey, setSelectedDayKey] = useState<string>(() => toDateKey(new Date()));
  const [filterKind, setFilterKind] = useState<'ALL' | 'VISITE_DEVIS' | 'INTERVENTION' | 'URGENCE'>('ALL');
  const [filterTech, setFilterTech] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [backlogCollapsed, setBacklogCollapsed] = useState<boolean>(false);

  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [keyboardIntervalText, setKeyboardIntervalText] = useState<string>('');
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineInputVal, setInlineInputVal] = useState<string>('');

  // Optimistic UI cache (0ms instant update without waiting for network roundtrip)
  const [optimisticOverrides, setOptimisticOverrides] = useState<
    Record<
      string,
      {
        technicien?: string;
        date?: string;
        heureDebut?: string;
        heureFin?: string;
        statut?: string;
      }
    >
  >({});

  const [draggedSlot, setDraggedSlot] = useState<PlanningSlotItem | null>(null);
  const [resizingState, setResizingState] = useState<{
    slot: PlanningSlotItem;
    edge: 'left' | 'right';
    trackRect: DOMRect;
    previewDebut: string;
    previewFin: string;
  } | null>(null);

  // Unified 60fps Pointer Move State for scheduled Gantt blocks
  const [movingState, setMovingState] = useState<{
    slot: PlanningSlotItem;
    startClientX: number;
    startClientY: number;
    trackRect: DOMRect;
    origStartM: number;
    origEndM: number;
    origTech: string;
    previewDebut: string;
    previewFin: string;
    previewTech: string;
    hasMoved: boolean;
  } | null>(null);

  // Magnetic Hover Laser Guide on Gantt Tracks
  const [hoverGuide, setHoverGuide] = useState<{
    technicien: string;
    min: number;
    leftPct: number;
  } | null>(null);

  // Live Interactive Dual-Slider Preview in Glass Time Studio
  const [sliderPreview, setSliderPreview] = useState<{
    slotId: string;
    heureDebut: string;
    heureFin: string;
  } | null>(null);

  const [drawState, setDrawState] = useState<{
    technicien: string;
    dateKey: string;
    startMin: number;
    currentMin: number;
  } | null>(null);

  const [drawnSlotModal, setDrawnSlotModal] = useState<{
    technicien: string;
    dateKey: string;
    heureDebut: string;
    heureFin: string;
  } | null>(null);
  const [quickClient, setQuickClient] = useState('');
  const [isCustomQuickClient, setIsCustomQuickClient] = useState(false);
  const [quickSite, setQuickSite] = useState('');
  const [quickObjet, setQuickObjet] = useState('');
  const [quickKind, setQuickKind] = useState<'INTERVENTION' | 'VISITE_DEVIS'>('INTERVENTION');
  const [quickPriorite, setQuickPriorite] = useState('Normale');
  const [quickIntervalText, setQuickIntervalText] = useState('');

  const trackRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [nowMinutes, setNowMinutes] = useState<number>(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    const t = setInterval(() => {
      const now = new Date();
      setNowMinutes(now.getHours() * 60 + now.getMinutes());
    }, 30000);
    return () => clearInterval(t);
  }, []);

  const weekDays = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const date = addDays(weekStart, i);
      return {
        date,
        key: toDateKey(date),
        label: formatDayShort(date),
        isToday: toDateKey(date) === toDateKey(new Date()),
      };
    });
  }, [weekStart]);

  // Build unified Planning items from Devis + Interventions + Instant Optimistic Overrides
  const allItems = useMemo<PlanningSlotItem[]>(() => {
    const list: PlanningSlotItem[] = [];

    // Identification des devis dont la visite est déjà représentée par une intervention terrain
    const devisIdsWithVisitIntervention = new Set<number>();
    for (const intv of interventionsList) {
      if (intv.statutOperationnel === 'Annulée') continue;
      const isVisite = Boolean(intv.isVisiteDevis) || intv.typeIntervention === 'Visite technique devis';
      if (isVisite) {
        if (intv.devisId) devisIdsWithVisitIntervention.add(intv.devisId);
        if (intv.origineDevisId) devisIdsWithVisitIntervention.add(intv.origineDevisId);
      }
    }

    for (const d of devisList) {
      // RÈGLE ANTI-DOUBLON ANELEC : Si une intervention de visite existe déjà pour ce devis,
      // on ne crée pas de 2e bloc devis sur le planning. La boucle intervention ci-dessous
      // générera le bloc d'activité unique unifié (VIS • DEV).
      if (devisIdsWithVisitIntervention.has(d.id)) {
        continue;
      }

      const needsVisit =
        d.visiteNecessaire ||
        d.traitement === 'En attente technicien' ||
        Boolean(d.visiteDate) ||
        Boolean(d.visiteTechnicien);

      const isAcceptedWithoutIntervention =
        d.statutCommercial === 'Accepté' && (!d.interventionsCount || d.interventionsCount === 0);

      if (needsVisit || isAcceptedWithoutIntervention) {
        const slotId = `devis-${d.id}`;
        const opt = optimisticOverrides[slotId];
        const hDebut = opt?.heureDebut ?? d.visiteHeureDebut ?? '08:30';
        const hFin = opt?.heureFin ?? d.visiteHeureFin ?? '10:30';
        const tech = opt?.technicien !== undefined ? opt.technicien : d.visiteTechnicien || '';
        const dateVal = opt?.date !== undefined ? opt.date : toDateKey(d.visiteDate);
        const statutVal = opt?.statut ?? (d.visiteStatut || d.statutCommercial || 'À planifier');

        list.push({
          id: slotId,
          kind: 'VISITE_DEVIS',
          sourceType: 'DEVIS',
          sourceId: d.id,
          reference: d.reference || `DEV-${d.id}`,
          title: d.objet || 'Visite technique Devis',
          client: d.client || 'Client à préciser',
          site: d.site || 'Site à préciser',
          typePrestation: d.corpsEtat || 'Visite Devis',
          priorite: d.priorite || 'Normale',
          statut: statutVal,
          technicien: tech,
          date: dateVal,
          heureDebut: hDebut,
          heureFin: hFin,
          durationHours: computeDurationHours(hDebut, hFin) ?? 1.5,
          rawDevis: d,
        });
      }
    }

    for (const intv of interventionsList) {
      if (intv.statutOperationnel === 'Annulée') continue;
      const slotId = `intv-${intv.id}`;
      const opt = optimisticOverrides[slotId];
      const hDebut = opt?.heureDebut ?? intv.heureDebut ?? '08:00';
      const hFin = opt?.heureFin ?? intv.heureFin ?? '12:00';
      const tech = opt?.technicien !== undefined ? opt.technicien : intv.entreprise || '';
      const dateVal = opt?.date !== undefined ? opt.date : toDateKey(intv.datePlanifiee);
      const statutVal = opt?.statut ?? (intv.statutOperationnel || 'À planifier');

      const isUrgent =
        intv.priorite === 'Urgente' ||
        intv.typeIntervention === 'Dépannage' ||
        intv.typeIntervention === 'Urgente';
      const isVisite = Boolean(intv.isVisiteDevis) || intv.typeIntervention === 'Visite technique devis';

      // Recherche du devis lié pour fusion d'activité
      const linkedDevis = isVisite
        ? devisList.find((d) => d.id === (intv.devisId || intv.origineDevisId)) ||
          devisList.find((d) => Boolean(d.visiteNecessaire) && d.client === intv.client)
        : undefined;

      const refLabel = linkedDevis
        ? `${intv.reference || `VIS-${intv.id}`} • ${linkedDevis.reference || `DEV-${linkedDevis.id}`}`
        : (intv.reference || `INT-${intv.id}`);

      list.push({
        id: slotId,
        kind: isUrgent ? 'URGENCE' : isVisite ? 'VISITE_DEVIS' : 'INTERVENTION',
        sourceType: 'INTERVENTION',
        sourceId: intv.id,
        reference: refLabel,
        title: isVisite
          ? `[Visite Devis] ${intv.objet || linkedDevis?.objet || 'Visite technique'}`
          : (intv.objet || 'Intervention technique'),
        client: intv.client || linkedDevis?.client || 'Client',
        site: intv.chantier || linkedDevis?.site || 'Site',
        typePrestation: intv.corpsEtat || linkedDevis?.corpsEtat || intv.typeIntervention || 'Intervention',
        priorite: intv.priorite || linkedDevis?.priorite || 'Normale',
        statut: statutVal,
        technicien: tech,
        date: dateVal,
        heureDebut: hDebut,
        heureFin: hFin,
        durationHours: computeDurationHours(hDebut, hFin) ?? (isVisite ? 1.5 : 4),
        rawIntervention: intv,
        rawDevis: linkedDevis,
      });
    }

    return list;
  }, [devisList, interventionsList, optimisticOverrides]);

  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (filterKind !== 'ALL' && item.kind !== filterKind) return false;
      if (filterTech !== 'ALL' && item.technicien !== filterTech) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${item.reference} ${item.title} ${item.client} ${item.site} ${item.technicien} ${item.typePrestation}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allItems, filterKind, filterTech, searchQuery]);

  const unscheduledItems = useMemo(() => {
    return filteredItems.filter((i) => !i.date || !i.technicien || i.statut === 'À planifier');
  }, [filteredItems]);

  const scheduledItems = useMemo(() => {
    return filteredItems.filter((i) => Boolean(i.date) && Boolean(i.technicien));
  }, [filteredItems]);

  const selectedSlot = useMemo(
    () => allItems.find((i) => i.id === selectedSlotId) || null,
    [allItems, selectedSlotId]
  );

  const applySlotSchedule = useCallback(
    async (
      item: PlanningSlotItem,
      updates: { technicien?: string; date?: string | null; heureDebut?: string; heureFin?: string; statut?: string }
    ) => {
      const nextTech = updates.technicien !== undefined ? updates.technicien : item.technicien;
      const nextDate = updates.date !== undefined ? (updates.date || '') : item.date;
      const nextDebut = updates.heureDebut || item.heureDebut || '08:00';
      const nextFin = updates.heureFin || item.heureFin || '10:00';
      const nextStatut =
        updates.statut ||
        (['En cours', 'Terminée - à valider', 'Clôturée'].includes(item.statut)
          ? item.statut
          : nextDate && nextTech
          ? 'Planifiée'
          : 'À planifier');

      // 1. Instant Optimistic UI Update (0ms visual response)
      setOptimisticOverrides((prev) => ({
        ...prev,
        [item.id]: {
          technicien: nextTech,
          date: nextDate,
          heureDebut: nextDebut,
          heureFin: nextFin,
          statut: nextStatut,
        },
      }));
      if (selectedSlotId === item.id) {
        setKeyboardIntervalText(`${nextDebut}-${nextFin}`);
      }

      try {
        if (item.sourceType === 'DEVIS') {
          await onUpdateDevisPlanning(item.sourceId, {
            visiteNecessaire: true,
            visiteTechnicien: nextTech,
            visiteDate: nextDate || null,
            visiteHeureDebut: nextDebut,
            visiteHeureFin: nextFin,
            visiteStatut: nextDate && nextTech ? 'Planifiée' : 'À planifier',
          });
          if (item.rawIntervention) {
            await onUpdateInterventionPlanning(item.rawIntervention.id, {
              entreprise: nextTech,
              datePlanifiee: nextDate || null,
              heureDebut: nextDebut,
              heureFin: nextFin,
              statutOperationnel: nextStatut,
              modePlanification: nextDate && nextTech ? 'Planifiée' : 'Non planifiée',
            });
          }
        } else {
          await onUpdateInterventionPlanning(item.sourceId, {
            entreprise: nextTech,
            datePlanifiee: nextDate || null,
            heureDebut: nextDebut,
            heureFin: nextFin,
            statutOperationnel: nextStatut,
            modePlanification: nextDate && nextTech ? 'Planifiée' : 'Non planifiée',
          });
          if (item.rawDevis) {
            await onUpdateDevisPlanning(item.rawDevis.id, {
              visiteNecessaire: true,
              visiteTechnicien: nextTech,
              visiteDate: nextDate || null,
              visiteHeureDebut: nextDebut,
              visiteHeureFin: nextFin,
              visiteStatut: nextDate && nextTech ? 'Planifiée' : 'À planifier',
            });
          }
        }
        toast.success(`${item.reference} → ${nextTech || 'File'} (${nextDebut}–${nextFin})`, {
          duration: 1800,
        });
      } catch {
        // Revert optimistic override on failure
        setOptimisticOverrides((prev) => {
          const copy = { ...prev };
          delete copy[item.id];
          return copy;
        });
        toast.error('Erreur lors de la mise à jour du planning');
      }
    },
    [onUpdateDevisPlanning, onUpdateInterventionPlanning, selectedSlotId]
  );

  useEffect(() => {
    if (!resizingState && !movingState && !drawState) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (resizingState) {
        const { slot, edge, trackRect } = resizingState;
        const relX = Math.max(0, Math.min(trackRect.width, e.clientX - trackRect.left));
        const pointerMin = START_HOUR * 60 + (relX / trackRect.width) * TOTAL_MINUTES;
        const snappedMin = Math.round(pointerMin / 15) * 15;

        const curStart = timeToMinutes(slot.heureDebut);
        const curEnd = timeToMinutes(slot.heureFin);

        if (edge === 'left') {
          const newStart = Math.max(START_HOUR * 60, Math.min(curEnd - 15, snappedMin));
          setResizingState((prev) =>
            prev ? { ...prev, previewDebut: minutesToTime(newStart) } : null
          );
        } else {
          const newEnd = Math.min(END_HOUR * 60, Math.max(curStart + 15, snappedMin));
          setResizingState((prev) =>
            prev ? { ...prev, previewFin: minutesToTime(newEnd) } : null
          );
        }
      } else if (movingState) {
        const dx = e.clientX - movingState.startClientX;
        const dy = e.clientY - movingState.startClientY;
        const movedEnough = movingState.hasMoved || Math.hypot(dx, dy) > 4;
        if (!movedEnough) return;

        const { trackRect, origStartM, origEndM } = movingState;
        const durMin = Math.max(15, origEndM - origStartM);
        const deltaMinRaw = (dx / Math.max(1, trackRect.width)) * TOTAL_MINUTES;
        const deltaMinSnapped = Math.round(deltaMinRaw / 15) * 15;

        const clampedStart = Math.max(
          START_HOUR * 60,
          Math.min(END_HOUR * 60 - durMin, origStartM + deltaMinSnapped)
        );
        const clampedEnd = clampedStart + durMin;

        // Detect vertical hovered technician / team lane
        let targetTech = movingState.previewTech;
        for (const [techKey, el] of Object.entries(trackRefs.current)) {
          if (!el) continue;
          const r = el.getBoundingClientRect();
          if (e.clientY >= r.top && e.clientY <= r.bottom) {
            targetTech = techKey;
            break;
          }
        }

        setMovingState((prev) =>
          prev
            ? {
                ...prev,
                hasMoved: true,
                previewDebut: minutesToTime(clampedStart),
                previewFin: minutesToTime(clampedEnd),
                previewTech: targetTech,
              }
            : null
        );
      } else if (drawState) {
        const trackEl = trackRefs.current[drawState.technicien];
        if (!trackEl) return;
        const rect = trackEl.getBoundingClientRect();
        const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const pointerMin = START_HOUR * 60 + (relX / rect.width) * TOTAL_MINUTES;
        const snappedMin = Math.round(pointerMin / 15) * 15;
        setDrawState((prev) => (prev ? { ...prev, currentMin: snappedMin } : null));
      }
    };

    const handleMouseUp = async () => {
      if (resizingState) {
        const { slot, previewDebut, previewFin } = resizingState;
        setResizingState(null);
        if (previewDebut !== slot.heureDebut || previewFin !== slot.heureFin) {
          await applySlotSchedule(slot, { heureDebut: previewDebut, heureFin: previewFin });
        }
      } else if (movingState) {
        const { slot, previewDebut, previewFin, previewTech, hasMoved } = movingState;
        setMovingState(null);
        if (
          hasMoved &&
          (previewDebut !== slot.heureDebut ||
            previewFin !== slot.heureFin ||
            previewTech !== slot.technicien)
        ) {
          await applySlotSchedule(slot, {
            technicien: previewTech,
            heureDebut: previewDebut,
            heureFin: previewFin,
          });
        }
      } else if (drawState) {
        const startMin = Math.min(drawState.startMin, drawState.currentMin);
        const endMin = Math.max(drawState.startMin + 60, drawState.currentMin);
        const hDebut = minutesToTime(startMin);
        const hFin = minutesToTime(Math.min(END_HOUR * 60, endMin));
        const tech = drawState.technicien;
        const dateKey = drawState.dateKey;
        setDrawState(null);

        if (selectedSlot) {
          await applySlotSchedule(selectedSlot, {
            technicien: tech,
            date: dateKey,
            heureDebut: hDebut,
            heureFin: hFin,
          });
        } else {
          setQuickClient('');
          setIsCustomQuickClient(false);
          setQuickSite('');
          setQuickObjet('');
          setQuickIntervalText(`${hDebut}-${hFin}`);
          setDrawnSlotModal({
            technicien: tech,
            dateKey,
            heureDebut: hDebut,
            heureFin: hFin,
          });
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingState, movingState, drawState, applySlotSchedule, selectedSlot, unscheduledItems]);

  const nudgeSelectedSlot = useCallback(
    async (
      action:
        | 'EARLIER_15'
        | 'LATER_15'
        | 'EARLIER'
        | 'LATER'
        | 'SHORTER_15'
        | 'LONGER_15'
        | 'SHORTER'
        | 'LONGER'
        | 'PREV_TECH'
        | 'NEXT_TECH'
    ) => {
      if (!selectedSlot) return;
      const startM = timeToMinutes(selectedSlot.heureDebut);
      const endM = timeToMinutes(selectedSlot.heureFin);
      const dur = Math.max(15, endM - startM);

      if (action === 'EARLIER_15' || action === 'EARLIER') {
        const step = action === 'EARLIER_15' ? 15 : 30;
        const nextStart = Math.max(START_HOUR * 60, startM - step);
        await applySlotSchedule(selectedSlot, {
          heureDebut: minutesToTime(nextStart),
          heureFin: minutesToTime(nextStart + dur),
        });
      } else if (action === 'LATER_15' || action === 'LATER') {
        const step = action === 'LATER_15' ? 15 : 30;
        const nextEnd = Math.min(END_HOUR * 60, endM + step);
        await applySlotSchedule(selectedSlot, {
          heureDebut: minutesToTime(nextEnd - dur),
          heureFin: minutesToTime(nextEnd),
        });
      } else if (action === 'SHORTER_15' || action === 'SHORTER') {
        const step = action === 'SHORTER_15' ? 15 : 30;
        const nextEnd = Math.max(startM + 15, endM - step);
        await applySlotSchedule(selectedSlot, {
          heureFin: minutesToTime(nextEnd),
        });
      } else if (action === 'LONGER_15' || action === 'LONGER') {
        const step = action === 'LONGER_15' ? 15 : 30;
        const nextEnd = Math.min(END_HOUR * 60, endM + step);
        await applySlotSchedule(selectedSlot, {
          heureFin: minutesToTime(nextEnd),
        });
      } else if (action === 'PREV_TECH' || action === 'NEXT_TECH') {
        const idx = techniciens.indexOf(selectedSlot.technicien);
        const nextIdx =
          action === 'NEXT_TECH'
            ? (idx + 1) % techniciens.length
            : (idx - 1 + techniciens.length) % techniciens.length;
        await applySlotSchedule(selectedSlot, { technicien: techniciens[nextIdx] });
      }
    },
    [selectedSlot, applySlotSchedule, techniciens]
  );

  const handleApplyKeyboardInterval = async (slot: PlanningSlotItem, rawText: string) => {
    const parsed = parseTimeIntervalInput(rawText);
    if (!parsed) {
      toast.error('Format non reconnu. Exemples : 08:30-11:00, 14h-17h30, 9h+2h, matin, aprem');
      return;
    }
    await applySlotSchedule(slot, {
      heureDebut: parsed.heureDebut,
      heureFin: parsed.heureFin,
    });
    setInlineEditId(null);
    setKeyboardIntervalText(`${parsed.heureDebut}-${parsed.heureFin}`);
  };

  const toggleTechSkill = async (tech: string, skill: string) => {
    const current = Array.isArray(technicienCompetences[tech])
      ? technicienCompetences[tech]
      : [];
    const exists = current.includes(skill);
    const nextSkills = exists ? current.filter((s) => s !== skill) : [...current, skill];
    const nextMap = { ...technicienCompetences, [tech]: nextSkills };
    if (onUpdateCompetences) {
      await onUpdateCompetences(nextMap);
    }
  };

  const addCustomTechSkill = async (tech: string) => {
    const val = (customSkillInputs[tech] || '').trim();
    if (!val) return;
    const current = Array.isArray(technicienCompetences[tech])
      ? technicienCompetences[tech]
      : [];
    if (!current.includes(val)) {
      const nextMap = { ...technicienCompetences, [tech]: [...current, val] };
      if (onUpdateCompetences) {
        await onUpdateCompetences(nextMap);
      }
    }
    setCustomSkillInputs((prev) => ({ ...prev, [tech]: '' }));
  };

  // ==========================================================================
  // LOGIQUE ÉQUIPES JOURNALIÈRES (Curseur Souris + Menu dépliant + Dates + Heures)
  // ==========================================================================
  const activeTeamsForSelectedDay = useMemo(() => {
    return (equipesJournalieres || []).filter(
      (eq) => eq.dateDebut <= selectedDayKey && selectedDayKey <= eq.dateFin
    );
  }, [equipesJournalieres, selectedDayKey]);

  const getTeamsForTechOnDay = useCallback(
    (tech: string, dateKey: string) => {
      return (equipesJournalieres || []).filter(
        (eq) =>
          eq.dateDebut <= dateKey &&
          dateKey <= eq.dateFin &&
          Array.isArray(eq.membres) &&
          eq.membres.includes(tech)
      );
    },
    [equipesJournalieres]
  );

  const openTeamBuilderForTech = (anchorTech: string, existingTeam?: EquipeJournaliere) => {
    if (expandedTeamTech === anchorTech && !existingTeam) {
      setExpandedTeamTech(null);
      setEditingTeamId(null);
      return;
    }
    setExpandedTeamTech(anchorTech);
    if (existingTeam) {
      setEditingTeamId(existingTeam.id);
      setTeamMembers([...existingTeam.membres]);
      setTeamDurationMode(existingTeam.dateDebut === existingTeam.dateFin ? 'jour' : 'duree');
      setTeamDateDebut(existingTeam.dateDebut);
      setTeamDateFin(existingTeam.dateFin);
      setTeamAllDay(existingTeam.touteLaJournee !== false);
      setTeamHeureDebut(existingTeam.heureDebut || '08:00');
      setTeamHeureFin(existingTeam.heureFin || '17:30');
      setTeamQuickInterval(
        existingTeam.touteLaJournee ? '' : `${existingTeam.heureDebut}-${existingTeam.heureFin}`
      );
    } else {
      const existingOnDay = getTeamsForTechOnDay(anchorTech, selectedDayKey)[0];
      if (existingOnDay) {
        setEditingTeamId(existingOnDay.id);
        setTeamMembers([...existingOnDay.membres]);
        setTeamDurationMode(existingOnDay.dateDebut === existingOnDay.dateFin ? 'jour' : 'duree');
        setTeamDateDebut(existingOnDay.dateDebut);
        setTeamDateFin(existingOnDay.dateFin);
        setTeamAllDay(existingOnDay.touteLaJournee !== false);
        setTeamHeureDebut(existingOnDay.heureDebut || '08:00');
        setTeamHeureFin(existingOnDay.heureFin || '17:30');
        setTeamQuickInterval(
          existingOnDay.touteLaJournee ? '' : `${existingOnDay.heureDebut}-${existingOnDay.heureFin}`
        );
      } else {
        setEditingTeamId(null);
        setTeamMembers([anchorTech]);
        setTeamDurationMode('jour');
        setTeamDateDebut(selectedDayKey);
        setTeamDateFin(selectedDayKey);
        setTeamAllDay(true);
        setTeamHeureDebut('08:00');
        setTeamHeureFin('17:30');
        setTeamQuickInterval('');
      }
    }
  };

  const handleToggleMemberInTeamForm = (tech: string, anchorTech: string) => {
    if (tech === anchorTech) return; // le technicien d'origine reste dans son équipe
    setTeamMembers((prev) =>
      prev.includes(tech) ? prev.filter((m) => m !== tech) : [...prev, tech]
    );
  };

  const handleSaveTeamForm = async (anchorTech: string) => {
    const cleanMembers = Array.from(new Set([anchorTech, ...teamMembers].filter(Boolean)));
    if (cleanMembers.length < 2) {
      toast.error('Sélectionnez au moins un 2ème technicien pour former une équipe');
      return;
    }

    let finalDebut = teamHeureDebut || '08:00';
    let finalFin = teamHeureFin || '17:30';
    if (!teamAllDay && teamQuickInterval.trim()) {
      const parsed = parseTimeIntervalInput(teamQuickInterval.trim());
      if (parsed) {
        finalDebut = parsed.heureDebut;
        finalFin = parsed.heureFin;
      }
    }

    const dStart = teamDurationMode === 'jour' ? selectedDayKey : teamDateDebut || selectedDayKey;
    const dEnd =
      teamDurationMode === 'jour'
        ? selectedDayKey
        : teamDateFin && teamDateFin >= dStart
        ? teamDateFin
        : dStart;

    const newEntry: EquipeJournaliere = {
      id: editingTeamId || `eq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nomEquipe: cleanMembers.join(' + '),
      membres: cleanMembers,
      dateDebut: dStart,
      dateFin: dEnd,
      touteLaJournee: teamAllDay,
      heureDebut: teamAllDay ? '07:00' : finalDebut,
      heureFin: teamAllDay ? '19:00' : finalFin,
      createdAt: new Date().toISOString(),
    };

    const nextList = editingTeamId
      ? (equipesJournalieres || []).map((e) => (e.id === editingTeamId ? newEntry : e))
      : [...(equipesJournalieres || []), newEntry];

    if (onUpdateEquipes) {
      await onUpdateEquipes(nextList);
    }
    toast.success(
      `Équipe « ${newEntry.nomEquipe} » (${cleanMembers.length} techniciens) enregistrée ${
        dStart === dEnd ? `pour le ${formatDateFR(dStart)}` : `du ${formatDateFR(dStart)} au ${formatDateFR(dEnd)}`
      } (${teamAllDay ? 'Journée entière' : `${finalDebut}–${finalFin}`})`
    );
    setExpandedTeamTech(null);
    setEditingTeamId(null);
  };

  const handleDeleteDailyTeam = async (teamId: string) => {
    const nextList = (equipesJournalieres || []).filter((e) => e.id !== teamId);
    if (onUpdateEquipes) {
      await onUpdateEquipes(nextList);
    }
    toast.success('Équipe journalière dissoute');
    if (editingTeamId === teamId) {
      setExpandedTeamTech(null);
      setEditingTeamId(null);
    }
  };

  // Glisser-déposer d'un technicien à la souris sur un autre technicien ou sur une équipe existante
  const handleDropTechOnTechOrTeam = async (sourceTech: string, targetTechOrTeamId: string) => {
    setDraggedTechName(null);
    setDragOverTechTarget(null);
    if (!sourceTech || sourceTech === targetTechOrTeamId) return;

    // Cas 1 : Déposé sur une équipe déjà active ce jour-là -> ajoute un 3ème / 4ème individu à l'équipe !
    const targetTeam = activeTeamsForSelectedDay.find(
      (eq) => eq.id === targetTechOrTeamId || eq.nomEquipe === targetTechOrTeamId
    );
    if (targetTeam) {
      if (targetTeam.membres.includes(sourceTech)) {
        toast(`${sourceTech} fait déjà partie de l'équipe ${targetTeam.nomEquipe}`);
        openTeamBuilderForTech(targetTeam.membres[0], targetTeam);
        return;
      }
      const nextMembres = [...targetTeam.membres, sourceTech];
      const updatedTeam: EquipeJournaliere = {
        ...targetTeam,
        membres: nextMembres,
        nomEquipe: nextMembres.join(' + '),
      };
      const nextList = (equipesJournalieres || []).map((e) =>
        e.id === targetTeam.id ? updatedTeam : e
      );
      if (onUpdateEquipes) {
        await onUpdateEquipes(nextList);
      }
      toast.success(
        `${sourceTech} ajouté à l'équipe → « ${updatedTeam.nomEquipe} » (${nextMembres.length} individus)`
      );
      openTeamBuilderForTech(updatedTeam.membres[0], updatedTeam);
      return;
    }

    // Cas 2 : Déposé sur un technicien qui est déjà dans une équipe aujourd'hui -> agrandit cette équipe (3 individus ou +)
    const existingTargetTeam = getTeamsForTechOnDay(targetTechOrTeamId, selectedDayKey)[0];
    if (existingTargetTeam) {
      const mergedMembers = Array.from(new Set([...existingTargetTeam.membres, sourceTech]));
      const updatedTeam: EquipeJournaliere = {
        ...existingTargetTeam,
        membres: mergedMembers,
        nomEquipe: mergedMembers.join(' + '),
      };
      const nextList = (equipesJournalieres || []).map((e) =>
        e.id === existingTargetTeam.id ? updatedTeam : e
      );
      if (onUpdateEquipes) {
        await onUpdateEquipes(nextList);
      }
      toast.success(
        `Équipe élargie à ${mergedMembers.length} techniciens : « ${updatedTeam.nomEquipe} »`
      );
      openTeamBuilderForTech(targetTechOrTeamId, updatedTeam);
      return;
    }

    // Cas 3 : Création immédiate d'une équipe journalière entre les 2 techniciens pour la journée sélectionnée
    // + ouverture du volet dépliant pour ajouter un 3e individu, choisir une durée de dates ou des heures spécifiques !
    const newTeam: EquipeJournaliere = {
      id: `eq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nomEquipe: `${targetTechOrTeamId} + ${sourceTech}`,
      membres: [targetTechOrTeamId, sourceTech],
      dateDebut: selectedDayKey,
      dateFin: selectedDayKey,
      touteLaJournee: true,
      heureDebut: '07:00',
      heureFin: '19:00',
      createdAt: new Date().toISOString(),
    };
    const nextList = [...(equipesJournalieres || []), newTeam];
    if (onUpdateEquipes) {
      await onUpdateEquipes(nextList);
    }
    toast.success(
      `Équipe journalière formée par glisser-déposer : « ${newTeam.nomEquipe} » (${formatDateFR(selectedDayKey)}). Ajustez la durée ou les heures si besoin.`
    );
    openTeamBuilderForTech(targetTechOrTeamId, newTeam);
  };

  const handleSmartAutoDispatch = async () => {
    if (unscheduledItems.length === 0) {
      toast.success('Toutes les missions sont déjà planifiées !');
      return;
    }

    const priorityRank: Record<string, number> = { Urgente: 0, Haute: 1, Normale: 2, Basse: 3 };
    // Tri intelligent des missions :
    // 1) Priorité (Urgente > Haute > Normale > Basse)
    // 2) Rareté de la compétence demandée (les métiers ayant le moins de techniciens qualifiés passent d'abord)
    const queue = [...unscheduledItems].sort((a, b) => {
      const pDiff = (priorityRank[a.priorite] ?? 2) - (priorityRank[b.priorite] ?? 2);
      if (pDiff !== 0) return pDiff;
      const qualA = rankTechniciansForTrade(a.typePrestation, techniciens, technicienCompetences).qualified.length;
      const qualB = rankTechniciansForTrade(b.typePrestation, techniciens, technicienCompetences).qualified.length;
      return qualA - qualB;
    });

    const candidateWindows = [
      { debut: '08:00', fin: '10:00' },
      { debut: '10:00', fin: '12:00' },
      { debut: '13:30', fin: '15:30' },
      { debut: '15:30', fin: '17:30' },
    ];

    const targetDate = selectedDayKey || weekDays[0]?.key || toDateKey(new Date());
    const virtualOccupied = [...scheduledItems];
    let assignedCount = 0;
    const assignedSummary: string[] = [];
    const skippedNoSkill: string[] = [];

    for (const item of queue.slice(0, 10)) {
      const loadByTech: Record<string, number> = {};
      for (const t of techniciens) {
        loadByTech[t] = virtualOccupied
          .filter((s) => s.technicien === t && s.date === targetDate)
          .reduce((acc, s) => acc + s.durationHours, 0);
      }

      // Algorithme "Moindre de compétences" :
      // Parmi les techniciens qui maîtrisent le métier (item.typePrestation),
      // celui qui a LE MOINS de compétences passe en premier (ex: 1 compétence avant 3 compétences)
      // pour laisser les techniciens polyvalents disponibles pour d'autres métiers !
      const { qualified } = rankTechniciansForTrade(
        item.typePrestation,
        techniciens,
        technicienCompetences,
        loadByTech
      );

      if (qualified.length === 0) {
        skippedNoSkill.push(`${item.reference} (${item.typePrestation})`);
        continue;
      }

      let placed = false;
      for (const candidate of qualified) {
        if (placed) break;
        const tech = candidate.technicien;
        for (const win of candidateWindows) {
          const wStart = timeToMinutes(win.debut);
          const wEnd =
            item.kind === 'INTERVENTION'
              ? Math.min(END_HOUR * 60, wStart + 180)
              : timeToMinutes(win.fin);
          const winFinStr = minutesToTime(wEnd);

          const hasOverlap = virtualOccupied.some((s) => {
            if (s.technicien !== tech || s.date !== targetDate) return false;
            return timeToMinutes(s.heureDebut) < wEnd && timeToMinutes(s.heureFin) > wStart;
          });

          if (!hasOverlap) {
            await applySlotSchedule(item, {
              technicien: tech,
              date: targetDate,
              heureDebut: win.debut,
              heureFin: winFinStr,
            });
            virtualOccupied.push({
              ...item,
              technicien: tech,
              date: targetDate,
              heureDebut: win.debut,
              heureFin: winFinStr,
              durationHours: computeDurationHours(win.debut, winFinStr) ?? 2,
            });
            assignedCount++;
            assignedSummary.push(
              `${item.reference} (${item.typePrestation}) → ${tech} [${candidate.skillCount} comp.]`
            );
            placed = true;
            break;
          }
        }
      }
    }

    if (assignedCount > 0) {
      toast.success(
        `${assignedCount} mission(s) auto-planifiée(s) (priorité moindre compétence) : ${assignedSummary
          .slice(0, 2)
          .join(' • ')}`
      );
    }
    if (skippedNoSkill.length > 0) {
      toast.error(
        `Aucun technicien qualifié pour : ${skippedNoSkill.join(', ')}. Ajoutez la compétence dans « Compétences Métier ».`
      );
    }
  };

  const computeGanttLanes = (slots: PlanningSlotItem[]) => {
    const sorted = [...slots].sort(
      (a, b) => timeToMinutes(a.heureDebut) - timeToMinutes(b.heureDebut)
    );
    const lanes: number[] = [];
    const assignments: { slot: PlanningSlotItem; lane: number; hasConflict: boolean }[] = [];

    for (const slot of sorted) {
      const sStart = timeToMinutes(slot.heureDebut);
      const sEnd = timeToMinutes(slot.heureFin);
      let placedLane = -1;
      for (let i = 0; i < lanes.length; i++) {
        if (lanes[i] <= sStart) {
          placedLane = i;
          lanes[i] = sEnd;
          break;
        }
      }
      if (placedLane === -1) {
        placedLane = lanes.length;
        lanes.push(sEnd);
      }

      const hasConflict = sorted.some(
        (other) =>
          other.id !== slot.id &&
          timeToMinutes(other.heureDebut) < sEnd &&
          timeToMinutes(other.heureFin) > sStart
      );

      assignments.push({ slot, lane: placedLane, hasConflict });
    }

    return {
      totalLanes: Math.max(1, lanes.length),
      items: assignments,
    };
  };

  const getTechDayStats = (tech: string, dateKey: string) => {
    const slots = scheduledItems.filter((s) => {
      if (s.date !== dateKey) return false;
      if (s.technicien === tech) return true;
      // Si la mission est affectée à une équipe composée contenant ce technicien (ex: "Anouar + Haitam")
      if (s.technicien && s.technicien.includes('+')) {
        const parts = s.technicien.split('+').map((p) => p.trim().toLowerCase());
        if (parts.includes(tech.trim().toLowerCase())) return true;
      }
      return false;
    });
    const totalHours = slots.reduce((sum, s) => sum + s.durationHours, 0);
    const pct = Math.min(100, Math.round((totalHours / 8) * 100));
    return { slots, totalHours, pct };
  };

  const livePreviewInterval = useMemo(() => {
    if (!keyboardIntervalText.trim()) return null;
    const p = parseTimeIntervalInput(keyboardIntervalText);
    if (!p) return null;
    return {
      ...p,
      durationHours: computeDurationHours(p.heureDebut, p.heureFin) ?? 2,
    };
  }, [keyboardIntervalText]);

  const showNowLine =
    nowMinutes >= START_HOUR * 60 &&
    nowMinutes <= END_HOUR * 60 &&
    selectedDayKey === toDateKey(new Date());
  const nowLeftPct = ((nowMinutes - START_HOUR * 60) / TOTAL_MINUTES) * 100;

  return (
    <div className="fsm-console">
      {/* 1. TOP DISPATCH COMMAND TOOLBAR */}
      <div className="fsm-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div className="segmented-control">
            <button
              type="button"
              className={`segmented-btn ${viewMode === 'gantt' ? 'active' : ''}`}
              onClick={() => setViewMode('gantt')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="6" x2="14" y2="6" />
                <line x1="8" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="16" y2="18" />
              </svg>
              <span className="desktop-only-el">Timeline Gantt Pro</span>
              <span className="mobile-only-el">Gantt</span>
            </button>
            <button
              type="button"
              className={`segmented-btn ${viewMode === 'week' ? 'active' : ''}`}
              onClick={() => setViewMode('week')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <line x1="9" y1="4" x2="9" y2="20" />
                <line x1="15" y1="4" x2="15" y2="20" />
              </svg>
              <span className="desktop-only-el">Matrice Semaine</span>
              <span className="mobile-only-el">Semaine</span>
            </button>
            <button
              type="button"
              className={`segmented-btn ${viewMode === 'columns' ? 'active' : ''}`}
              onClick={() => setViewMode('columns')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="5" height="18" rx="1" />
                <rect x="10" y="3" width="5" height="18" rx="1" />
                <rect x="17" y="3" width="4" height="18" rx="1" />
              </svg>
              <span className="desktop-only-el">Agenda Colonnes</span>
              <span className="mobile-only-el">Agenda</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const prev = addDays(weekStart, -7);
                setWeekStart(prev);
                setSelectedDayKey(toDateKey(prev));
              }}
            >
              ‹
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const today = new Date();
                setWeekStart(getMonday(today));
                setSelectedDayKey(toDateKey(today));
              }}
            >
              Aujourd'hui
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const next = addDays(weekStart, 7);
                setWeekStart(next);
                setSelectedDayKey(toDateKey(next));
              }}
            >
              ›
            </button>
          </div>

          <div className="drawer-subtabs-strip" style={{ display: 'flex', gap: '4px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%', padding: '2px 0' }}>
            {weekDays.map((d) => {
              const active = selectedDayKey === d.key;
              const countForDay = scheduledItems.filter((s) => s.date === d.key).length;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setSelectedDayKey(d.key)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '7px',
                    fontSize: '11.5px',
                    fontWeight: active ? 700 : 500,
                    border: active
                      ? '1px solid var(--brand-primary)'
                      : d.isToday
                      ? '1px solid rgba(16, 185, 129, 0.5)'
                      : '1px solid var(--border-subtle)',
                    background: active ? 'var(--brand-glow)' : 'var(--bg-elevated)',
                    color: active ? '#60a5fa' : 'var(--text-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>{d.label}</span>
                  {countForDay > 0 && (
                    <span
                      className="font-mono"
                      style={{
                        fontSize: '10px',
                        padding: '0 5px',
                        borderRadius: '999px',
                        background: active ? '#3b82f6' : 'rgba(255,255,255,0.08)',
                        color: active ? '#fff' : 'var(--text-secondary)',
                      }}
                    >
                      {countForDay}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div className="segmented-control" style={{ overflowX: 'auto', maxWidth: '100%' }}>
            {[
              { id: 'ALL', label: `Tout (${allItems.length})`, shortLabel: `Tout (${allItems.length})`, dot: null },
              {
                id: 'VISITE_DEVIS',
                label: `Visites Devis (${allItems.filter((i) => i.kind === 'VISITE_DEVIS').length})`,
                shortLabel: `Devis (${allItems.filter((i) => i.kind === 'VISITE_DEVIS').length})`,
                dot: '#d97706',
              },
              {
                id: 'INTERVENTION',
                label: `Travaux (${allItems.filter((i) => i.kind === 'INTERVENTION').length})`,
                shortLabel: `Travaux (${allItems.filter((i) => i.kind === 'INTERVENTION').length})`,
                dot: '#059669',
              },
              {
                id: 'URGENCE',
                label: `Urgences (${allItems.filter((i) => i.kind === 'URGENCE').length})`,
                shortLabel: `Urg. (${allItems.filter((i) => i.kind === 'URGENCE').length})`,
                dot: '#e11d48',
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`segmented-btn ${filterKind === tab.id ? 'active' : ''}`}
                onClick={() => setFilterKind(tab.id as any)}
              >
                {tab.dot && (
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: tab.dot }} />
                )}
                <span className="desktop-only-el">{tab.label}</span>
                <span className="mobile-only-el">{tab.shortLabel}</span>
              </button>
            ))}
          </div>

          <select
            className="select"
            style={{ width: '155px', padding: '5px 9px', fontSize: '12px' }}
            value={filterTech}
            onChange={(e) => setFilterTech(e.target.value)}
          >
            <option value="ALL">Tous techniciens</option>
            {techniciens.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setSkillsModalOpen(true)}
            className="btn btn-secondary btn-sm"
            title="Configurer les compétences métier de chaque technicien pour l'auto-planification (règle du moindre de compétences)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            Compétences Métier
          </button>

          <button
            type="button"
            onClick={handleSmartAutoDispatch}
            className="btn btn-ai-dispatch btn-sm"
            title="Auto-distribution par compétences métier : sélectionne le technicien qualifié ayant le moindre de compétences afin de préserver les polyvalents"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Auto-Planifier ({unscheduledItems.length})
          </button>

          {onNavigateToRentabilite && (
            <button
              type="button"
              onClick={onNavigateToRentabilite}
              className="btn btn-secondary btn-sm"
              style={{ color: '#059669', borderColor: 'rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.08)' }}
              title="Consulter les KPI de rentabilité des techniciens et équipes"
            >
              ⊞ Rentabilité & Marges →
            </button>
          )}
        </div>
      </div>

      {/* 2. GLASS TIME STUDIO : DOUBLE SLIDER TACTILE + PRESETS 1-CLIC + CLAVIER */}
      {selectedSlot && (() => {
        const activeStartStr =
          sliderPreview?.slotId === selectedSlot.id
            ? sliderPreview.heureDebut
            : selectedSlot.heureDebut;
        const activeEndStr =
          sliderPreview?.slotId === selectedSlot.id
            ? sliderPreview.heureFin
            : selectedSlot.heureFin;
        const startMinVal = Math.max(START_HOUR * 60, timeToMinutes(activeStartStr));
        const endMinVal = Math.min(END_HOUR * 60, Math.max(startMinVal + 15, timeToMinutes(activeEndStr)));
        const durHoursVal = Math.round(((endMinVal - startMinVal) / 60) * 100) / 100;

        return (
          <div className="glass-time-studio" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Top row: Mission identity + Quick Keyboard + Actions */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' }}>
                <span
                  className="font-mono"
                  style={{
                    padding: '3px 9px',
                    borderRadius: '999px',
                    fontWeight: 800,
                    fontSize: '11.5px',
                    background:
                      selectedSlot.kind === 'VISITE_DEVIS'
                        ? '#b45309'
                        : selectedSlot.kind === 'URGENCE'
                        ? '#b91c1c'
                        : '#047857',
                    color: '#ffffff',
                  }}
                >
                  {selectedSlot.reference}
                </span>
                <span style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-primary)' }}>
                  {selectedSlot.client}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                  • {selectedSlot.title}
                </span>
                <span
                  className="font-mono"
                  style={{
                    fontSize: '12px',
                    color: '#0f172a',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    fontWeight: 700,
                  }}
                >
                  {activeStartStr} → {activeEndStr} ({durHoursVal}h) • {selectedSlot.technicien || 'Non affecté'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await handleApplyKeyboardInterval(selectedSlot, keyboardIntervalText);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <input
                    type="text"
                    className="input font-mono"
                    style={{ width: '175px', padding: '4px 10px', fontSize: '12px', height: '30px' }}
                    placeholder="Ex: 08:30-11:00, 14h+2h"
                    value={keyboardIntervalText}
                    onChange={(e) => setKeyboardIntervalText(e.target.value)}
                  />
                  {livePreviewInterval && (
                    <span
                      className="font-mono"
                      style={{
                        fontSize: '11px',
                        color: '#059669',
                        background: 'rgba(16, 185, 129, 0.14)',
                        padding: '3px 7px',
                        borderRadius: '999px',
                        fontWeight: 700,
                      }}
                    >
                      → {livePreviewInterval.heureDebut}–{livePreviewInterval.heureFin}
                    </span>
                  )}
                  <button type="submit" className="btn btn-primary btn-sm">
                    Valider
                  </button>
                </form>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    selectedSlot.rawDevis
                      ? onOpenDevisDrawer(selectedSlot.rawDevis)
                      : selectedSlot.rawIntervention
                      ? onOpenInterventionDrawer(selectedSlot.rawIntervention)
                      : undefined
                  }
                >
                  Ouvrir fiche
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ color: '#d97706', borderColor: 'rgba(217, 119, 6, 0.4)' }}
                  title="Retirer ce créneau du planning et le renvoyer dans la liste d'attente à planifier"
                  onClick={async () => {
                    await applySlotSchedule(selectedSlot, {
                      date: null,
                      statut: 'À planifier',
                    });
                    setSelectedSlotId(null);
                    setSliderPreview(null);
                  }}
                >
                  ↩ Déplanifier
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ color: '#dc2626', borderColor: 'rgba(220, 38, 38, 0.4)' }}
                  title="Supprimer définitivement cette intervention ou devis"
                  onClick={() => setSlotToDelete(selectedSlot)}
                >
                  ✕ Supprimer
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setSliderPreview(null);
                    setSelectedSlotId(null);
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Bottom row: Interactive Mouse Dual Sliders + 1-Click Duration & Period Chips */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '12px',
                alignItems: 'center',
                paddingTop: '8px',
                borderTop: '1px solid rgba(59, 130, 246, 0.16)',
              }}
            >
              {/* Slider Début */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', minWidth: '82px' }}>
                  Début : <strong className="font-mono" style={{ color: '#2563eb' }}>{activeStartStr}</strong>
                </span>
                <input
                  type="range"
                  className="glass-range-slider"
                  min={START_HOUR * 60}
                  max={END_HOUR * 60 - 15}
                  step={15}
                  value={startMinVal}
                  onChange={(e) => {
                    const nextStart = Number(e.target.value);
                    const nextEnd = Math.max(nextStart + 15, endMinVal);
                    setSliderPreview({
                      slotId: selectedSlot.id,
                      heureDebut: minutesToTime(nextStart),
                      heureFin: minutesToTime(Math.min(END_HOUR * 60, nextEnd)),
                    });
                  }}
                  onMouseUp={async () => {
                    if (sliderPreview && sliderPreview.slotId === selectedSlot.id) {
                      const { heureDebut, heureFin } = sliderPreview;
                      setSliderPreview(null);
                      await applySlotSchedule(selectedSlot, { heureDebut, heureFin });
                    }
                  }}
                  onTouchEnd={async () => {
                    if (sliderPreview && sliderPreview.slotId === selectedSlot.id) {
                      const { heureDebut, heureFin } = sliderPreview;
                      setSliderPreview(null);
                      await applySlotSchedule(selectedSlot, { heureDebut, heureFin });
                    }
                  }}
                />
              </div>

              {/* Slider Fin */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', minWidth: '78px' }}>
                  Fin : <strong className="font-mono" style={{ color: '#2563eb' }}>{activeEndStr}</strong>
                </span>
                <input
                  type="range"
                  className="glass-range-slider"
                  min={START_HOUR * 60 + 15}
                  max={END_HOUR * 60}
                  step={15}
                  value={endMinVal}
                  onChange={(e) => {
                    const nextEnd = Math.max(startMinVal + 15, Number(e.target.value));
                    setSliderPreview({
                      slotId: selectedSlot.id,
                      heureDebut: minutesToTime(startMinVal),
                      heureFin: minutesToTime(nextEnd),
                    });
                  }}
                  onMouseUp={async () => {
                    if (sliderPreview && sliderPreview.slotId === selectedSlot.id) {
                      const { heureDebut, heureFin } = sliderPreview;
                      setSliderPreview(null);
                      await applySlotSchedule(selectedSlot, { heureDebut, heureFin });
                    }
                  }}
                  onTouchEnd={async () => {
                    if (sliderPreview && sliderPreview.slotId === selectedSlot.id) {
                      const { heureDebut, heureFin } = sliderPreview;
                      setSliderPreview(null);
                      await applySlotSchedule(selectedSlot, { heureDebut, heureFin });
                    }
                  }}
                />
              </div>

              {/* 1-Click Duration & Shift Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {[
                  { label: '1h', min: 60 },
                  { label: '1h30', min: 90 },
                  { label: '2h', min: 120 },
                  { label: '3h', min: 180 },
                  { label: '4h', min: 240 },
                ].map((d) => (
                  <button
                    key={d.label}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{
                      padding: '2px 8px',
                      fontSize: '11px',
                      background: endMinVal - startMinVal === d.min ? 'rgba(37, 99, 235, 0.16)' : undefined,
                      borderColor: endMinVal - startMinVal === d.min ? '#2563eb' : undefined,
                      color: endMinVal - startMinVal === d.min ? '#1d4ed8' : undefined,
                      fontWeight: 700,
                    }}
                    onClick={() => {
                      const nextEnd = Math.min(END_HOUR * 60, startMinVal + d.min);
                      applySlotSchedule(selectedSlot, {
                        heureDebut: minutesToTime(startMinVal),
                        heureFin: minutesToTime(nextEnd),
                      });
                    }}
                  >
                    {d.label}
                  </button>
                ))}

                <span style={{ color: 'var(--border-default)', margin: '0 2px' }}>|</span>

                {[
                  { label: '• Matin', val: '08:00-12:00' },
                  { label: '• Aprem', val: '13:30-17:30' },
                  { label: 'Journée', val: '08:00-17:30' },
                ].map((p) => (
                  <button
                    key={p.val}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '2px 8px', fontSize: '11px' }}
                    onClick={() => handleApplyKeyboardInterval(selectedSlot, p.val)}
                  >
                    {p.label}
                  </button>
                ))}

                <span style={{ color: 'var(--border-default)', margin: '0 2px' }}>|</span>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '2px 7px', fontSize: '11px' }}
                  onClick={() => nudgeSelectedSlot('EARLIER_15')}
                  title="Décaler 15 min plus tôt"
                >
                  ‹ -15m
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '2px 7px', fontSize: '11px' }}
                  onClick={() => nudgeSelectedSlot('LATER_15')}
                  title="Décaler 15 min plus tard"
                >
                  +15m ▸
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 3. MAIN WORKSPACE */}
      <div className={`fsm-workspace ${backlogCollapsed ? 'backlog-collapsed' : ''}`}>
        {!backlogCollapsed && (
          <aside
            className="fsm-dispatch-tray"
            onDragOver={(e) => e.preventDefault()}
            onDrop={async () => {
              if (!draggedSlot) return;
              await applySlotSchedule(draggedSlot, {
                technicien: '',
                date: null,
                statut: 'À planifier',
              });
              setDraggedSlot(null);
            }}
          >
            <div className="fsm-tray-header">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 800, fontSize: '12.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Bourse de Dispatch
                  </span>
                  <span
                    className="font-mono"
                    style={{
                      padding: '1px 7px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: unscheduledItems.length > 0 ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-surface)',
                      color: unscheduledItems.length > 0 ? '#fbbf24' : 'var(--text-secondary)',
                    }}
                  >
                    {unscheduledItems.length}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setBacklogCollapsed(true)}
                >
                  ‹
                </button>
              </div>

              <input
                type="text"
                className="input"
                placeholder="Filtrer réf, client, site..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '12px' }}
              />
            </div>

            <div className="fsm-tray-list">
              {unscheduledItems.length === 0 ? (
                <div
                  style={{
                    padding: '28px 16px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <div>Aucune mission en attente. Tout est planifié !</div>
                </div>
              ) : (
                unscheduledItems.map((item) => {
                  const isSelected = selectedSlotId === item.id;
                  const accent =
                    item.kind === 'VISITE_DEVIS'
                      ? '#ffcc00'
                      : item.kind === 'URGENCE'
                      ? '#ff0000'
                      : '#00bf63';
                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => {
                        setDraggedSlot(item);
                        setSelectedSlotId(item.id);
                      }}
                      onDragEnd={() => setDraggedSlot(null)}
                      onClick={() => {
                        setSelectedSlotId(item.id);
                        setKeyboardIntervalText(`${item.heureDebut}-${item.heureFin}`);
                      }}
                      style={{
                        background: isSelected ? 'var(--bg-active)' : 'var(--bg-elevated)',
                        border: isSelected ? `1.5px solid ${accent}` : '1px solid var(--border-default)',
                        borderLeft: `4px solid ${accent}`,
                        borderRadius: '9px',
                        padding: '10px 11px',
                        cursor: 'grab',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <span className="font-mono" style={{ fontSize: '10.5px', fontWeight: 700, color: accent }}>
                          {item.kind === 'VISITE_DEVIS' ? 'VISITE DEVIS' : item.kind === 'URGENCE' ? 'URGENCE' : 'TRAVAUX'} • {item.reference}
                        </span>
                        <span className="font-mono" style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                          {item.durationHours}h
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <div style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--text-primary)' }}>
                          {item.client}
                        </div>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-default)',
                            color: 'var(--brand-primary)',
                          }}
                        >
                          {item.typePrestation}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '11.5px',
                          color: 'var(--text-secondary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.title}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '6px',
                          marginTop: '4px',
                          paddingTop: '6px',
                          borderTop: '1px solid var(--border-subtle)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          className="select"
                          style={{ padding: '3px 6px', fontSize: '11px', height: '25px' }}
                          value=""
                          onChange={async (e) => {
                            if (!e.target.value) return;
                            await applySlotSchedule(item, {
                              technicien: e.target.value,
                              date: selectedDayKey,
                              heureDebut: item.heureDebut || '08:30',
                              heureFin: item.heureFin || '10:30',
                            });
                          }}
                        >
                          <option value="">Affecter par compétence ({selectedDayKey.slice(5)})...</option>
                          {activeTeamsForSelectedDay.length > 0 && (
                            <optgroup label={`Équipes Journalières (${selectedDayKey})`}>
                              {activeTeamsForSelectedDay.map((eq) => (
                                <option key={eq.id} value={eq.nomEquipe}>
                                  Équipe ({eq.membres.length}) : {eq.nomEquipe} [
                                  {eq.touteLaJournee ? 'Journée' : `${eq.heureDebut}-${eq.heureFin}`}]
                                </option>
                              ))}
                            </optgroup>
                          )}
                          <optgroup label="Techniciens Individuels (Moindre Compétence)">
                            {rankTechniciansForTrade(item.typePrestation, techniciens, technicienCompetences).allRanked.map(
                              (r, idx) => (
                                <option key={r.technicien} value={r.technicien}>
                                  {r.isQualified
                                    ? idx === 0
                                      ? `${r.technicien} (Prioritaire • ${r.skillCount} comp.)`
                                      : `✓ ${r.technicien} (Qualifié • ${r.skillCount} comp.)`
                                    : `${r.technicien} (Hors métier • ${r.skillCount} comp.)`}
                                </option>
                              )
                            )}
                          </optgroup>
                        </select>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '2px 6px', fontSize: '11px' }}
                          onClick={() =>
                            item.rawDevis
                              ? onOpenDevisDrawer(item.rawDevis)
                              : item.rawIntervention
                              ? onOpenInterventionDrawer(item.rawIntervention)
                              : undefined
                          }
                        >
                          Fiche
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}

        <div className="fsm-canvas-card">
          <div
            style={{
              padding: '10px 16px',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'var(--bg-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {backlogCollapsed && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setBacklogCollapsed(false)}
                >
                  Afficher Bourse ({unscheduledItems.length})
                </button>
              )}
              <span style={{ fontWeight: 700, fontSize: '12.5px' }}>
                {viewMode === 'gantt' && `Timeline Multi-Ressources • ${selectedDayKey}`}
                {viewMode === 'week' && `Matrice Hebdomadaire Capacitaire • Semaine du ${weekDays[0]?.label}`}
                {viewMode === 'columns' && `Agenda Vertical Multi-Techniciens • ${selectedDayKey}`}
              </span>
            </div>

            <div className="desktop-only-flex" style={{ alignItems: 'center', gap: '14px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              <span>
                <strong>Souris :</strong> Glisser-déposer • Étirer les bords • Tracer un créneau au clic-glisser
              </span>
              <span>•</span>
              <span>
                <strong>Clavier :</strong> Double-clic ou sélection → <code className="font-mono">08:30-11:00</code> / <code className="font-mono">14h+2h</code>
              </span>
            </div>
          </div>

          {viewMode === 'gantt' && (
            <div style={{ overflowX: 'auto', flex: 1 }}>
              <div style={{ minWidth: '960px' }}>
                <div className="gantt-header-row">
                  <div className="gantt-resource-col-header">
                    <span>Technicien / Équipes du Jour</span>
                    <span>Charge / 8h</span>
                  </div>
                  <div className="gantt-time-ruler">
                    {HOURS_ARRAY.map((hr) => (
                      <div key={hr} className="gantt-hour-marker">
                        <span>{String(hr).padStart(2, '0')}:00</span>
                        <div className="gantt-half-tick" />
                      </div>
                    ))}
                    {showNowLine && (
                      <div className="gantt-now-line" style={{ left: `${nowLeftPct}%` }}>
                        <span className="gantt-now-badge">{minutesToTime(nowMinutes)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* =========================================================
                    PISTES DES ÉQUIPES JOURNALIÈRES ACTIVES CE JOUR (2, 3+ INDIVIDUS)
                   ========================================================= */}
                {activeTeamsForSelectedDay.map((eq) => {
                  const teamSlots = scheduledItems.filter(
                    (s) => s.date === selectedDayKey && s.technicien === eq.nomEquipe
                  );
                  const { totalLanes: teamLanes, items: teamLaneItems } = computeGanttLanes(teamSlots);
                  const teamRowHeight = Math.max(76, teamLanes * 60 + 14);
                  const teamSkills = Array.from(
                    new Set(
                      eq.membres.flatMap(
                        (m) => technicienCompetences[m] || []
                      )
                    )
                  );
                  const teamActiveStartM = eq.touteLaJournee
                    ? START_HOUR * 60
                    : Math.max(START_HOUR * 60, timeToMinutes(eq.heureDebut || '08:00'));
                  const teamActiveEndM = eq.touteLaJournee
                    ? END_HOUR * 60
                    : Math.min(END_HOUR * 60, timeToMinutes(eq.heureFin || '17:30'));
                  const activeBandLeftPct =
                    ((teamActiveStartM - START_HOUR * 60) / TOTAL_MINUTES) * 100;
                  const activeBandWidthPct =
                    Math.max(4, ((teamActiveEndM - teamActiveStartM) / TOTAL_MINUTES) * 100);

                  const isDropTargetTeam = dragOverTechTarget === eq.id;

                  return (
                    <div
                      key={eq.id}
                      className="gantt-resource-row"
                      style={{
                        background: isDropTargetTeam
                          ? 'rgba(16, 185, 129, 0.12)'
                          : 'rgba(124, 58, 237, 0.04)',
                        borderBottom: '2px solid rgba(124, 58, 237, 0.25)',
                      }}
                    >
                      <div
                        className="gantt-resource-info"
                        onDragOver={(e) => {
                          if (draggedTechName) {
                            e.preventDefault();
                            setDragOverTechTarget(eq.id);
                          }
                        }}
                        onDragLeave={() => {
                          if (dragOverTechTarget === eq.id) setDragOverTechTarget(null);
                        }}
                        onDrop={async (e) => {
                          if (draggedTechName) {
                            e.preventDefault();
                            e.stopPropagation();
                            await handleDropTechOnTechOrTeam(draggedTechName, eq.id);
                          }
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 800,
                                  padding: '2px 6px',
                                  borderRadius: '5px',
                                  background: '#7c3aed',
                                  color: '#ffffff',
                                }}
                              >
                                ÉQUIPE ({eq.membres.length})
                              </span>
                              <span style={{ fontWeight: 800, fontSize: '12.5px', color: 'var(--text-primary)' }}>
                                {eq.nomEquipe}
                              </span>
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                              <span
                                className="font-mono"
                                style={{
                                  fontSize: '10px',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(16, 185, 129, 0.14)',
                                  color: '#059669',
                                  fontWeight: 700,
                                }}
                              >
                                {eq.touteLaJournee ? 'Toute la journée' : `${eq.heureDebut}–${eq.heureFin}`}
                              </span>
                              <span
                                className="font-mono"
                                style={{
                                  fontSize: '10px',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: 'var(--bg-elevated)',
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                {eq.dateDebut === eq.dateFin
                                  ? `Jour (${formatDateFR(eq.dateDebut)})`
                                  : `Du ${formatDateFR(eq.dateDebut)} au ${formatDateFR(eq.dateFin)}`}
                              </span>
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
                              {teamSkills.slice(0, 4).map((sk) => (
                                <span
                                  key={sk}
                                  style={{
                                    fontSize: '9px',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    background: 'var(--bg-surface)',
                                    border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-secondary)',
                                  }}
                                >
                                  {sk}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 6px', fontSize: '10px' }}
                              onClick={() => openTeamBuilderForTech(eq.membres[0], eq)}
                              title="Ajouter un 3ème/4ème technicien ou modifier la durée / les heures"
                            >
                              Modifier / +Tech
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '1px 5px', fontSize: '10px', color: '#dc2626' }}
                              onClick={() => handleDeleteDailyTeam(eq.id)}
                              title="Dissoudre cette équipe"
                            >
                              ✕ Dissoudre
                            </button>
                          </div>
                        </div>
                        {isDropTargetTeam && draggedTechName && (
                          <div
                            style={{
                              marginTop: '4px',
                              padding: '3px 6px',
                              borderRadius: '5px',
                              background: '#059669',
                              color: '#fff',
                              fontSize: '10.5px',
                              fontWeight: 700,
                            }}
                          >
                            + Relâcher pour ajouter {draggedTechName} à cette équipe ({eq.membres.length + 1} pers.)
                          </div>
                        )}
                      </div>

                      <div
                        ref={(el) => {
                          trackRefs.current[eq.nomEquipe] = el;
                        }}
                        className="gantt-track-canvas"
                        style={{ height: `${teamRowHeight}px` }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={async (e) => {
                          e.preventDefault();
                          if (draggedTechName) {
                            await handleDropTechOnTechOrTeam(draggedTechName, eq.id);
                            return;
                          }
                          if (!draggedSlot) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
                          const dropMin =
                            START_HOUR * 60 + Math.round(((relX / rect.width) * TOTAL_MINUTES) / 15) * 15;
                          const durMin = Math.max(60, Math.round(draggedSlot.durationHours * 60));
                          const clampedStart = Math.max(
                            START_HOUR * 60,
                            Math.min(END_HOUR * 60 - durMin, dropMin)
                          );
                          await applySlotSchedule(draggedSlot, {
                            technicien: eq.nomEquipe,
                            date: selectedDayKey,
                            heureDebut: minutesToTime(clampedStart),
                            heureFin: minutesToTime(clampedStart + durMin),
                          });
                          setDraggedSlot(null);
                        }}
                        onMouseDown={(e) => {
                          if (e.target !== e.currentTarget) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
                          const startMin =
                            START_HOUR * 60 + Math.round(((relX / rect.width) * TOTAL_MINUTES) / 15) * 15;
                          setDrawState({
                            technicien: eq.nomEquipe,
                            dateKey: selectedDayKey,
                            startMin,
                            currentMin: startMin + 90,
                          });
                        }}
                      >
                        {/* Plage horaire active de l'équipe dans la journée */}
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: `${activeBandLeftPct}%`,
                            width: `${activeBandWidthPct}%`,
                            background: 'rgba(124, 58, 237, 0.09)',
                            borderLeft: '2px dashed rgba(124, 58, 237, 0.45)',
                            borderRight: '2px dashed rgba(124, 58, 237, 0.45)',
                            pointerEvents: 'none',
                          }}
                        />

                        {teamLaneItems.map(({ slot, lane }) => {
                          const isResizingThis = resizingState?.slot.id === slot.id;
                          const isMovingThis = movingState?.slot.id === slot.id && movingState.hasMoved;
                          const isSlidingThis = sliderPreview?.slotId === slot.id;
                          const dispDebut = isResizingThis
                            ? resizingState.previewDebut
                            : isMovingThis
                            ? movingState.previewDebut
                            : isSlidingThis
                            ? sliderPreview.heureDebut
                            : slot.heureDebut;
                          const dispFin = isResizingThis
                            ? resizingState.previewFin
                            : isMovingThis
                            ? movingState.previewFin
                            : isSlidingThis
                            ? sliderPreview.heureFin
                            : slot.heureFin;

                          const startM = Math.max(START_HOUR * 60, timeToMinutes(dispDebut));
                          const endM = Math.min(END_HOUR * 60, Math.max(startM + 15, timeToMinutes(dispFin)));
                          const leftPct = ((startM - START_HOUR * 60) / TOTAL_MINUTES) * 100;
                          const widthPct = ((endM - startM) / TOTAL_MINUTES) * 100;
                          const laneHeight = 54;
                          const topPx = 8 + lane * (laneHeight + 6);
                          const typeClass =
                            slot.kind === 'VISITE_DEVIS'
                              ? 'type-visite'
                              : slot.kind === 'URGENCE'
                              ? 'type-urgence'
                              : 'type-travaux';

                          return (
                            <div
                              key={slot.id}
                              onMouseDown={(e) => {
                                if (e.button !== 0) return;
                                e.stopPropagation();
                                setSelectedSlotId(slot.id);
                                setKeyboardIntervalText(`${slot.heureDebut}-${slot.heureFin}`);
                                const trackEl = trackRefs.current[eq.nomEquipe];
                                if (!trackEl) return;
                                setMovingState({
                                  slot,
                                  startClientX: e.clientX,
                                  startClientY: e.clientY,
                                  trackRect: trackEl.getBoundingClientRect(),
                                  origStartM: timeToMinutes(slot.heureDebut),
                                  origEndM: timeToMinutes(slot.heureFin),
                                  origTech: eq.nomEquipe,
                                  previewDebut: slot.heureDebut,
                                  previewFin: slot.heureFin,
                                  previewTech: eq.nomEquipe,
                                  hasMoved: false,
                                });
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSlotId(slot.id);
                                setKeyboardIntervalText(`${slot.heureDebut}-${slot.heureFin}`);
                              }}
                              className={`gantt-event-block ${typeClass} ${
                                selectedSlotId === slot.id ? 'selected' : ''
                              } ${isResizingThis || isMovingThis ? 'is-manipulating' : ''}`}
                              style={{
                                left: `${leftPct}%`,
                                width: `${Math.max(4.5, widthPct)}%`,
                                top: `${topPx}px`,
                                height: `${laneHeight}px`,
                              }}
                            >
                              <div
                                className="gantt-resize-handle left"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  const trackEl = trackRefs.current[eq.nomEquipe];
                                  if (!trackEl) return;
                                  setResizingState({
                                    slot,
                                    edge: 'left',
                                    trackRect: trackEl.getBoundingClientRect(),
                                    previewDebut: slot.heureDebut,
                                    previewFin: slot.heureFin,
                                  });
                                }}
                              />

                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 700, color: '#fff' }}>
                                <span className="font-mono">{dispDebut}–{dispFin}</span>
                                <span className="font-mono">{slot.reference}</span>
                              </div>
                              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {slot.client} — {slot.title}
                              </div>

                              <div
                                className="gantt-resize-handle right"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  const trackEl = trackRefs.current[eq.nomEquipe];
                                  if (!trackEl) return;
                                  setResizingState({
                                    slot,
                                    edge: 'right',
                                    trackRect: trackEl.getBoundingClientRect(),
                                    previewDebut: slot.heureDebut,
                                    previewFin: slot.heureFin,
                                  });
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {techniciens
                  .filter((t) => filterTech === 'ALL' || t === filterTech)
                  .map((tech) => {
                    const { slots, totalHours, pct } = getTechDayStats(tech, selectedDayKey);
                    const { totalLanes, items: laneItems } = computeGanttLanes(slots);
                    const rowHeight = Math.max(78, totalLanes * 62 + 14);
                    const meta = TECH_SPECIALTIES[tech] || { role: 'Technicien TCE', color: '#3b82f6' };
                    const techTeamsToday = getTeamsForTechOnDay(tech, selectedDayKey);
                    const isExpandedTeam = expandedTeamTech === tech;
                    const isDropTargetTech = dragOverTechTarget === tech && draggedTechName !== tech;

                    const isDrawingHere =
                      drawState && drawState.technicien === tech && drawState.dateKey === selectedDayKey;
                    const drawStartM = isDrawingHere
                      ? Math.min(drawState.startMin, drawState.currentMin)
                      : 0;
                    const drawEndM = isDrawingHere
                      ? Math.max(drawState.startMin + 30, drawState.currentMin)
                      : 0;
                    const drawLeftPct = ((drawStartM - START_HOUR * 60) / TOTAL_MINUTES) * 100;
                    const drawWidthPct = ((drawEndM - drawStartM) / TOTAL_MINUTES) * 100;

                    return (
                      <div
                        key={tech}
                        className="gantt-resource-row"
                        style={{
                          background: isDropTargetTech ? 'rgba(16, 185, 129, 0.10)' : undefined,
                        }}
                      >
                        <div
                          className="gantt-resource-info"
                          onDragOver={(e) => {
                            if (draggedTechName && draggedTechName !== tech) {
                              e.preventDefault();
                              setDragOverTechTarget(tech);
                            }
                          }}
                          onDragLeave={() => {
                            if (dragOverTechTarget === tech) setDragOverTechTarget(null);
                          }}
                          onDrop={async (e) => {
                            if (draggedTechName && draggedTechName !== tech) {
                              e.preventDefault();
                              e.stopPropagation();
                              await handleDropTechOnTechOrTeam(draggedTechName, tech);
                            }
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {/* Avatar Technicien glissable à la souris pour former une équipe */}
                              <div
                                draggable
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  setDraggedTechName(tech);
                                  e.dataTransfer.setData('text/tech-name', tech);
                                }}
                                onDragEnd={() => {
                                  setDraggedTechName(null);
                                  setDragOverTechTarget(null);
                                }}
                                title={`Glissez ${tech} avec la souris sur un autre technicien pour former une équipe journalière`}
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  borderRadius: '8px',
                                  background: `${meta.color}22`,
                                  border: `1.5px solid ${meta.color}88`,
                                  color: meta.color,
                                  fontWeight: 800,
                                  fontSize: '11.5px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'grab',
                                  flexShrink: 0,
                                }}
                              >
                                {tech.slice(0, 2).toUpperCase()}
                              </div>

                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                  <span
                                    draggable
                                    onDragStart={(e) => {
                                      e.stopPropagation();
                                      setDraggedTechName(tech);
                                      e.dataTransfer.setData('text/tech-name', tech);
                                    }}
                                    onDragEnd={() => {
                                      setDraggedTechName(null);
                                      setDragOverTechTarget(null);
                                    }}
                                    style={{ fontWeight: 700, fontSize: '13px', cursor: 'grab' }}
                                    title="Glissez ce nom sur un autre technicien ou cliquez sur « + Équipe » à côté"
                                  >
                                    {tech}
                                  </span>

                                  {/* BOUTON DÉPLIANT À CÔTÉ DU NOM DU TECHNICIEN POUR FORMER UNE ÉQUIPE */}
                                  <button
                                    type="button"
                                    onClick={() => openTeamBuilderForTech(tech)}
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      padding: '2px 6px',
                                      borderRadius: '5px',
                                      border:
                                        isExpandedTeam || techTeamsToday.length > 0
                                          ? '1px solid #7c3aed'
                                          : '1px solid var(--border-default)',
                                      background:
                                        isExpandedTeam || techTeamsToday.length > 0
                                          ? 'rgba(124, 58, 237, 0.14)'
                                          : 'var(--bg-elevated)',
                                      color:
                                        isExpandedTeam || techTeamsToday.length > 0
                                          ? '#7c3aed'
                                          : 'var(--text-secondary)',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                    }}
                                    title="Déplier pour former une équipe journalière (2, 3 individus ou plus, sur ce jour ou une durée, avec heures spécifiques)"
                                  >
                                    <span>
                                      {techTeamsToday.length > 0
                                        ? `Équipe (${techTeamsToday[0].membres.length})`
                                        : '+ Équipe'}
                                    </span>
                                    <span>{isExpandedTeam ? '▴' : '▾'}</span>
                                  </button>

                                  <span
                                    onClick={() => setSkillsModalOpen(true)}
                                    className="font-mono"
                                    style={{
                                      fontSize: '9.5px',
                                      fontWeight: 700,
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      background:
                                        (technicienCompetences[tech]?.length || 1) === 1
                                          ? 'rgba(16, 185, 129, 0.14)'
                                          : 'var(--bg-elevated)',
                                      color:
                                        (technicienCompetences[tech]?.length || 1) === 1
                                          ? 'var(--success-accent)'
                                          : 'var(--text-secondary)',
                                      border: '1px solid var(--border-default)',
                                      cursor: 'pointer',
                                    }}
                                    title="Cliquez pour modifier les compétences de ce technicien"
                                  >
                                    {(technicienCompetences[tech] || []).length} comp.
                                  </span>
                                </div>

                                {/* Badge d'équipe active pour ce technicien sur la journée sélectionnée */}
                                {techTeamsToday.map((eq) => (
                                  <div
                                    key={eq.id}
                                    onClick={() => openTeamBuilderForTech(tech, eq)}
                                    style={{
                                      marginTop: '3px',
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      color: '#7c3aed',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Avec {eq.membres.filter((m) => m !== tech).join(' + ')} (
                                    {eq.touteLaJournee ? 'Journée' : `${eq.heureDebut}–${eq.heureFin}`})
                                  </div>
                                ))}

                                <div
                                  onClick={() => setSkillsModalOpen(true)}
                                  style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '3px',
                                    marginTop: '3px',
                                    cursor: 'pointer',
                                  }}
                                  title="Cliquez pour ajouter ou retirer des compétences métier"
                                >
                                  {(technicienCompetences[tech] || [meta.role]).map(
                                    (sk) => (
                                      <span
                                        key={sk}
                                        style={{
                                          fontSize: '9.5px',
                                          padding: '1px 5px',
                                          borderRadius: '4px',
                                          background: 'var(--bg-elevated)',
                                          border: '1px solid var(--border-subtle)',
                                          color: 'var(--text-secondary)',
                                        }}
                                      >
                                        {sk}
                                      </span>
                                    )
                                  )}
                                </div>
                              </div>
                            </div>
                            <span
                              className="font-mono"
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: totalHours > 8 ? '#ef4444' : totalHours >= 6 ? '#10b981' : 'var(--text-secondary)',
                              }}
                            >
                              {totalHours.toFixed(1)}h
                            </span>
                          </div>

                          {/* Indicateur visuel lors du survol à la souris d'un autre technicien */}
                          {isDropTargetTech && draggedTechName && (
                            <div
                              style={{
                                marginTop: '5px',
                                padding: '4px 7px',
                                borderRadius: '6px',
                                background: '#059669',
                                color: '#ffffff',
                                fontSize: '10.5px',
                                fontWeight: 700,
                              }}
                            >
                              Relâcher pour associer {draggedTechName} avec {tech} ({selectedDayKey})
                            </div>
                          )}

                          {/* =======================================================
                              OPTION DÉPLIANTE INLINE POUR FORMER UNE ÉQUIPE JOURNALIÈRE
                             ======================================================= */}
                          {isExpandedTeam && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                marginTop: '8px',
                                padding: '10px',
                                borderRadius: '8px',
                                background: 'var(--bg-surface)',
                                border: '1.5px solid #7c3aed',
                                boxShadow: 'var(--shadow-elevated)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                zIndex: 20,
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', fontWeight: 800, color: '#7c3aed' }}>
                                  Former Équipe avec {tech} ({teamMembers.length} pers.)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setExpandedTeamTech(null)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    color: 'var(--text-muted)',
                                  }}
                                >
                                  ✕
                                </button>
                              </div>

                              {/* 1. Choix des techniciens à associer (2, 3 individus ou plus) */}
                              <div>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                  1. Coéquipiers à associer (2, 3 individus ou +) :
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {techniciens
                                    .filter((other) => other !== tech)
                                    .map((other) => {
                                      const selected = teamMembers.includes(other);
                                      return (
                                        <button
                                          key={other}
                                          type="button"
                                          onClick={() => handleToggleMemberInTeamForm(other, tech)}
                                          style={{
                                            padding: '3px 7px',
                                            borderRadius: '5px',
                                            fontSize: '10.5px',
                                            fontWeight: selected ? 800 : 500,
                                            cursor: 'pointer',
                                            border: selected
                                              ? '1px solid #7c3aed'
                                              : '1px solid var(--border-default)',
                                            background: selected
                                              ? 'rgba(124, 58, 237, 0.16)'
                                              : 'var(--bg-elevated)',
                                            color: selected ? '#7c3aed' : 'var(--text-primary)',
                                          }}
                                        >
                                          {selected ? `✓ ${other}` : `+ ${other}`}
                                        </button>
                                      );
                                    })}
                                </div>
                              </div>

                              {/* 2. Par journée uniquement ou sur une durée (choix des dates) */}
                              <div>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                  2. Portée (Par journée ou sur une durée) :
                                </div>
                                <div style={{ display: 'flex', gap: '4px', marginBottom: teamDurationMode === 'duree' ? '6px' : 0 }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTeamDurationMode('jour');
                                      setTeamDateDebut(selectedDayKey);
                                      setTeamDateFin(selectedDayKey);
                                    }}
                                    style={{
                                      flex: 1,
                                      padding: '4px 6px',
                                      borderRadius: '5px',
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      border:
                                        teamDurationMode === 'jour'
                                          ? '1px solid var(--accent-primary)'
                                          : '1px solid var(--border-default)',
                                      background:
                                        teamDurationMode === 'jour'
                                          ? 'var(--accent-glow)'
                                          : 'var(--bg-elevated)',
                                      color:
                                        teamDurationMode === 'jour'
                                          ? 'var(--accent-primary)'
                                          : 'var(--text-secondary)',
                                    }}
                                  >
                                    Ce jour ({selectedDayKey.slice(5)})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setTeamDurationMode('duree')}
                                    style={{
                                      flex: 1,
                                      padding: '4px 6px',
                                      borderRadius: '5px',
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      border:
                                        teamDurationMode === 'duree'
                                          ? '1px solid var(--accent-primary)'
                                          : '1px solid var(--border-default)',
                                      background:
                                        teamDurationMode === 'duree'
                                          ? 'var(--accent-glow)'
                                          : 'var(--bg-elevated)',
                                      color:
                                        teamDurationMode === 'duree'
                                          ? 'var(--accent-primary)'
                                          : 'var(--text-secondary)',
                                    }}
                                  >
                                    Sur une durée (Dates)
                                  </button>
                                </div>

                                {teamDurationMode === 'duree' && (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                                    <div>
                                      <label style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>Du :</label>
                                      <input
                                        type="date"
                                        className="input"
                                        style={{ padding: '2px 5px', fontSize: '10.5px', height: '24px' }}
                                        value={teamDateDebut}
                                        onChange={(e) => setTeamDateDebut(e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>Au :</label>
                                      <input
                                        type="date"
                                        className="input"
                                        style={{ padding: '2px 5px', fontSize: '10.5px', height: '24px' }}
                                        value={teamDateFin}
                                        min={teamDateDebut}
                                        onChange={(e) => setTeamDateFin(e.target.value)}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* 3. Heures spécifiques dans la journée */}
                              <div>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                  3. Créneau horaire de l'équipe :
                                </div>
                                <div style={{ display: 'flex', gap: '4px', marginBottom: !teamAllDay ? '6px' : 0 }}>
                                  <button
                                    type="button"
                                    onClick={() => setTeamAllDay(true)}
                                    style={{
                                      flex: 1,
                                      padding: '4px 6px',
                                      borderRadius: '5px',
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      border: teamAllDay
                                        ? '1px solid #059669'
                                        : '1px solid var(--border-default)',
                                      background: teamAllDay
                                        ? 'rgba(16, 185, 129, 0.14)'
                                        : 'var(--bg-elevated)',
                                      color: teamAllDay ? '#059669' : 'var(--text-secondary)',
                                    }}
                                  >
                                    Journée entière
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setTeamAllDay(false)}
                                    style={{
                                      flex: 1,
                                      padding: '4px 6px',
                                      borderRadius: '5px',
                                      fontSize: '10px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      border: !teamAllDay
                                        ? '1px solid #059669'
                                        : '1px solid var(--border-default)',
                                      background: !teamAllDay
                                        ? 'rgba(16, 185, 129, 0.14)'
                                        : 'var(--bg-elevated)',
                                      color: !teamAllDay ? '#059669' : 'var(--text-secondary)',
                                    }}
                                  >
                                    Heures spécifiques
                                  </button>
                                </div>

                                {!teamAllDay && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                                      <input
                                        type="time"
                                        className="input font-mono"
                                        style={{ padding: '2px 5px', fontSize: '11px', height: '24px' }}
                                        value={teamHeureDebut}
                                        onChange={(e) => setTeamHeureDebut(e.target.value)}
                                      />
                                      <input
                                        type="time"
                                        className="input font-mono"
                                        style={{ padding: '2px 5px', fontSize: '11px', height: '24px' }}
                                        value={teamHeureFin}
                                        onChange={(e) => setTeamHeureFin(e.target.value)}
                                      />
                                    </div>
                                    <input
                                      type="text"
                                      className="input font-mono"
                                      placeholder="Ou clavier : 08:30-12:30, 14h+3h"
                                      style={{ padding: '2px 6px', fontSize: '10.5px', height: '24px' }}
                                      value={teamQuickInterval}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setTeamQuickInterval(val);
                                        const parsed = parseTimeIntervalInput(val);
                                        if (parsed) {
                                          setTeamHeureDebut(parsed.heureDebut);
                                          setTeamHeureFin(parsed.heureFin);
                                        }
                                      }}
                                    />
                                  </div>
                                )}
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', marginTop: '2px' }}>
                                {editingTeamId && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    style={{ color: '#dc2626', padding: '3px 7px', fontSize: '10.5px' }}
                                    onClick={() => handleDeleteDailyTeam(editingTeamId)}
                                  >
                                    Dissoudre
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  style={{ flex: 1, padding: '4px 8px', fontSize: '11px', background: '#7c3aed', borderColor: '#7c3aed' }}
                                  onClick={() => handleSaveTeamForm(tech)}
                                >
                                  ✓ Enregistrer Équipe ({teamMembers.length} pers.)
                                </button>
                              </div>
                            </div>
                          )}

                          <div
                            style={{
                              height: '5px',
                              width: '100%',
                              borderRadius: '999px',
                              background: 'var(--bg-app)',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                width: `${pct}%`,
                                background:
                                  totalHours > 8
                                    ? '#ef4444'
                                    : totalHours >= 6
                                    ? '#10b981'
                                    : meta.color,
                                borderRadius: '999px',
                              }}
                            />
                          </div>
                        </div>

                        <div
                          ref={(el) => {
                            trackRefs.current[tech] = el;
                          }}
                          className="gantt-track-canvas"
                          style={{
                            height: `${rowHeight}px`,
                            background:
                              movingState?.hasMoved && movingState.previewTech === tech
                                ? 'rgba(37, 99, 235, 0.08)'
                                : undefined,
                          }}
                          onMouseMove={(e) => {
                            if (resizingState || movingState || drawState) {
                              if (hoverGuide) setHoverGuide(null);
                              return;
                            }
                            const rect = e.currentTarget.getBoundingClientRect();
                            const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
                            const pointerMin = START_HOUR * 60 + (relX / rect.width) * TOTAL_MINUTES;
                            const snappedMin = Math.round(pointerMin / 15) * 15;
                            const leftPct = ((snappedMin - START_HOUR * 60) / TOTAL_MINUTES) * 100;
                            setHoverGuide({ technicien: tech, min: snappedMin, leftPct });
                          }}
                          onMouseLeave={() => {
                            if (hoverGuide?.technicien === tech) setHoverGuide(null);
                          }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={async (e) => {
                            e.preventDefault();
                            if (!draggedSlot) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
                            const dropMin =
                              START_HOUR * 60 + Math.round(((relX / rect.width) * TOTAL_MINUTES) / 15) * 15;
                            const durMin = Math.max(60, Math.round(draggedSlot.durationHours * 60));
                            const clampedStart = Math.max(
                              START_HOUR * 60,
                              Math.min(END_HOUR * 60 - durMin, dropMin)
                            );
                            const newDebut = minutesToTime(clampedStart);
                            const newFin = minutesToTime(clampedStart + durMin);

                            await applySlotSchedule(draggedSlot, {
                              technicien: tech,
                              date: selectedDayKey,
                              heureDebut: newDebut,
                              heureFin: newFin,
                            });
                            setDraggedSlot(null);
                          }}
                          onMouseDown={(e) => {
                            if (e.target !== e.currentTarget) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
                            const startMin =
                              START_HOUR * 60 + Math.round(((relX / rect.width) * TOTAL_MINUTES) / 15) * 15;
                            setDrawState({
                              technicien: tech,
                              dateKey: selectedDayKey,
                              startMin,
                              currentMin: startMin + 90,
                            });
                          }}
                        >
                          {showNowLine && (
                            <div className="gantt-now-line" style={{ left: `${nowLeftPct}%` }} />
                          )}

                          {/* Magnetic Hover Laser Line showing exact 15-min time under cursor */}
                          {hoverGuide &&
                            hoverGuide.technicien === tech &&
                            !resizingState &&
                            !movingState &&
                            !drawState && (
                              <div
                                className="gantt-hover-laser"
                                style={{ left: `${hoverGuide.leftPct}%` }}
                              >
                                <span className="gantt-hover-laser-badge">
                                  {minutesToTime(hoverGuide.min)}
                                </span>
                              </div>
                            )}

                          {isDrawingHere && (
                            <div
                              className="gantt-ghost-selection font-mono"
                              style={{
                                left: `${Math.max(0, drawLeftPct)}%`,
                                width: `${Math.max(4, drawWidthPct)}%`,
                              }}
                            >
                              <span
                                style={{
                                  background: '#2563eb',
                                  color: '#fff',
                                  padding: '2px 7px',
                                  borderRadius: '5px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                }}
                              >
                                {minutesToTime(drawStartM)} → {minutesToTime(drawEndM)}
                              </span>
                            </div>
                          )}

                          {/* Ghost preview when dragging a slot vertically from another technician onto this track */}
                          {movingState &&
                            movingState.hasMoved &&
                            movingState.previewTech === tech &&
                            movingState.origTech !== tech && (() => {
                              const gStartM = Math.max(START_HOUR * 60, timeToMinutes(movingState.previewDebut));
                              const gEndM = Math.min(END_HOUR * 60, Math.max(gStartM + 15, timeToMinutes(movingState.previewFin)));
                              const gLeft = ((gStartM - START_HOUR * 60) / TOTAL_MINUTES) * 100;
                              const gWidth = ((gEndM - gStartM) / TOTAL_MINUTES) * 100;
                              return (
                                <div
                                  className="gantt-ghost-selection font-mono"
                                  style={{
                                    left: `${gLeft}%`,
                                    width: `${Math.max(4.5, gWidth)}%`,
                                    background: 'rgba(37, 99, 235, 0.28)',
                                    border: '2px solid #2563eb',
                                  }}
                                >
                                  <span
                                    style={{
                                      background: '#1d4ed8',
                                      color: '#fff',
                                      padding: '3px 8px',
                                      borderRadius: '999px',
                                      fontSize: '11px',
                                      fontWeight: 800,
                                    }}
                                  >
                                    → {tech} • {movingState.previewDebut}–{movingState.previewFin}
                                  </span>
                                </div>
                              );
                            })()}

                          {laneItems.map(({ slot, lane, hasConflict }) => {
                            const isResizingThis = resizingState?.slot.id === slot.id;
                            const isMovingThis = movingState?.slot.id === slot.id && movingState.hasMoved;
                            const isSlidingThis = sliderPreview?.slotId === slot.id;

                            const dispDebut = isResizingThis
                              ? resizingState.previewDebut
                              : isMovingThis
                              ? movingState.previewDebut
                              : isSlidingThis
                              ? sliderPreview.heureDebut
                              : slot.heureDebut;
                            const dispFin = isResizingThis
                              ? resizingState.previewFin
                              : isMovingThis
                              ? movingState.previewFin
                              : isSlidingThis
                              ? sliderPreview.heureFin
                              : slot.heureFin;

                            const startM = Math.max(START_HOUR * 60, timeToMinutes(dispDebut));
                            const endM = Math.min(END_HOUR * 60, Math.max(startM + 15, timeToMinutes(dispFin)));
                            const liveDurH = Math.round(((endM - startM) / 60) * 100) / 100;

                            const leftPct = ((startM - START_HOUR * 60) / TOTAL_MINUTES) * 100;
                            const widthPct = ((endM - startM) / TOTAL_MINUTES) * 100;
                            const laneHeight = 56;
                            const topPx = 8 + lane * (laneHeight + 6);

                            const typeClass =
                              slot.kind === 'VISITE_DEVIS'
                                ? 'type-visite'
                                : slot.kind === 'URGENCE'
                                ? 'type-urgence'
                                : 'type-travaux';

                            const isSelected = selectedSlotId === slot.id;
                            const isInlineEditing = inlineEditId === slot.id;

                            return (
                              <div
                                key={slot.id}
                                onMouseDown={(e) => {
                                  if (e.button !== 0 || isInlineEditing) return;
                                  e.stopPropagation();
                                  setSelectedSlotId(slot.id);
                                  setKeyboardIntervalText(`${slot.heureDebut}-${slot.heureFin}`);
                                  const trackEl = trackRefs.current[tech];
                                  if (!trackEl) return;
                                  setMovingState({
                                    slot,
                                    startClientX: e.clientX,
                                    startClientY: e.clientY,
                                    trackRect: trackEl.getBoundingClientRect(),
                                    origStartM: timeToMinutes(slot.heureDebut),
                                    origEndM: timeToMinutes(slot.heureFin),
                                    origTech: tech,
                                    previewDebut: slot.heureDebut,
                                    previewFin: slot.heureFin,
                                    previewTech: tech,
                                    hasMoved: false,
                                  });
                                }}
                                onWheel={(e) => {
                                  if (!e.altKey && !e.shiftKey) return;
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const delta = e.deltaY < 0 ? 15 : -15;
                                  const curStart = timeToMinutes(slot.heureDebut);
                                  const curEnd = timeToMinutes(slot.heureFin);
                                  const dur = Math.max(15, curEnd - curStart);
                                  if (e.shiftKey) {
                                    // Shift + Wheel: extend/shorten end time by 15 min
                                    const nextEnd = Math.min(END_HOUR * 60, Math.max(curStart + 15, curEnd + delta));
                                    applySlotSchedule(slot, { heureFin: minutesToTime(nextEnd) });
                                  } else {
                                    // Alt + Wheel: shift whole slot by 15 min
                                    const nextStart = Math.max(
                                      START_HOUR * 60,
                                      Math.min(END_HOUR * 60 - dur, curStart + delta)
                                    );
                                    applySlotSchedule(slot, {
                                      heureDebut: minutesToTime(nextStart),
                                      heureFin: minutesToTime(nextStart + dur),
                                    });
                                  }
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedSlotId(slot.id);
                                  setKeyboardIntervalText(`${slot.heureDebut}-${slot.heureFin}`);
                                }}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  setInlineEditId(slot.id);
                                  setInlineInputVal(`${slot.heureDebut}-${slot.heureFin}`);
                                }}
                                title="Glisser pour déplacer • Étirer les bords gauche/droite • Alt+Molette pour décaler de 15m • Shift+Molette pour ajuster la durée"
                                className={`gantt-event-block ${typeClass} ${isSelected ? 'selected' : ''} ${
                                  isResizingThis || isMovingThis || isSlidingThis ? 'is-manipulating' : ''
                                }`}
                                style={{
                                  left: `${leftPct}%`,
                                  width: `${Math.max(4.5, widthPct)}%`,
                                  top: `${topPx}px`,
                                  height: `${laneHeight}px`,
                                  opacity:
                                    isMovingThis && movingState.previewTech !== tech ? 0.35 : 1,
                                }}
                              >
                                <div
                                  className="gantt-resize-handle left"
                                  title="Glisser pour modifier l'heure de début (pas de 15 min)"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setSelectedSlotId(slot.id);
                                    const trackEl = trackRefs.current[tech];
                                    if (!trackEl) return;
                                    setResizingState({
                                      slot,
                                      edge: 'left',
                                      trackRect: trackEl.getBoundingClientRect(),
                                      previewDebut: slot.heureDebut,
                                      previewFin: slot.heureFin,
                                    });
                                  }}
                                />

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                  {isInlineEditing ? (
                                    <form
                                      onSubmit={async (e) => {
                                        e.preventDefault();
                                        await handleApplyKeyboardInterval(slot, inlineInputVal);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      style={{ display: 'flex', gap: '4px', width: '100%' }}
                                    >
                                      <input
                                        autoFocus
                                        type="text"
                                        className="input font-mono"
                                        style={{ padding: '1px 5px', fontSize: '10.5px', height: '20px' }}
                                        value={inlineInputVal}
                                        onChange={(e) => setInlineInputVal(e.target.value)}
                                        onBlur={() => setInlineEditId(null)}
                                      />
                                    </form>
                                  ) : (
                                    <>
                                      <span
                                        className="font-mono"
                                        style={{
                                          fontSize: '10.5px',
                                          fontWeight: 800,
                                          color: '#ffffff',
                                          background:
                                            isResizingThis || isMovingThis || isSlidingThis
                                              ? 'rgba(15, 23, 42, 0.72)'
                                              : 'transparent',
                                          padding:
                                            isResizingThis || isMovingThis || isSlidingThis
                                              ? '1px 6px'
                                              : 0,
                                          borderRadius: '4px',
                                        }}
                                      >
                                        {dispDebut}–{dispFin} ({liveDurH}h)
                                      </span>
                                      <span className="font-mono" style={{ fontSize: '10px', opacity: 0.85 }}>
                                        {slot.reference}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSlotToDelete(slot);
                                        }}
                                        title="Options de suppression / déplanification"
                                        style={{
                                          background: 'rgba(0,0,0,0.25)',
                                          border: 'none',
                                          borderRadius: '3px',
                                          cursor: 'pointer',
                                          padding: '1px 3px',
                                          color: '#ffffff',
                                          opacity: 0.85,
                                          fontSize: '10px',
                                          lineHeight: 1,
                                          marginLeft: 'auto',
                                        }}
                                      >
                                        ✕
                                      </button>
                                    </>
                                  )}
                                  {hasConflict && (
                                    <span
                                      style={{
                                        background: '#ef4444',
                                        color: '#fff',
                                        fontSize: '9px',
                                        fontWeight: 800,
                                        padding: '0 4px',
                                        borderRadius: '3px',
                                      }}
                                    >
                                      CONFLIT
                                    </span>
                                  )}
                                </div>

                                <div
                                  style={{
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    color: '#ffffff',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {slot.client} — <span style={{ fontWeight: 400, opacity: 0.85 }}>{slot.title}</span>
                                </div>

                                <div
                                  className="gantt-resize-handle right"
                                  title="Glisser pour modifier l'heure de fin (pas de 15 min)"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setSelectedSlotId(slot.id);
                                    const trackEl = trackRefs.current[tech];
                                    if (!trackEl) return;
                                    setResizingState({
                                      slot,
                                      edge: 'right',
                                      trackRect: trackEl.getBoundingClientRect(),
                                      previewDebut: slot.heureDebut,
                                      previewFin: slot.heureFin,
                                    });
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {viewMode === 'week' && (
            <div style={{ overflowX: 'auto', flex: 1 }}>
              <table className="pro-table" style={{ minWidth: '980px', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: '190px' }}>Technicien</th>
                    {weekDays.map((d) => (
                      <th
                        key={d.key}
                        onClick={() => setSelectedDayKey(d.key)}
                        style={{
                          cursor: 'pointer',
                          background:
                            selectedDayKey === d.key
                              ? 'rgba(59, 130, 246, 0.12)'
                              : 'var(--bg-elevated)',
                          borderLeft: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{d.label}</span>
                          {d.isToday && (
                            <span style={{ color: '#10b981', fontSize: '10px' }}>Auj.</span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {techniciens
                    .filter((t) => filterTech === 'ALL' || t === filterTech)
                    .map((tech) => {
                      const meta = TECH_SPECIALTIES[tech] || { role: 'Technicien TCE', color: '#3b82f6' };
                      const weekTotal = weekDays.reduce(
                        (acc, d) => acc + getTechDayStats(tech, d.key).totalHours,
                        0
                      );

                      return (
                        <tr key={tech}>
                          <td style={{ verticalAlign: 'top', background: 'var(--bg-surface)' }}>
                            <div style={{ fontWeight: 700, fontSize: '13px' }}>{tech}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{meta.role}</div>
                            <div className="font-mono" style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                              Hebdo : <strong>{weekTotal.toFixed(1)}h</strong> / 40h
                            </div>
                          </td>

                          {weekDays.map((d) => {
                            const { slots, totalHours, pct } = getTechDayStats(tech, d.key);
                            const sorted = [...slots].sort(
                              (a, b) => timeToMinutes(a.heureDebut) - timeToMinutes(b.heureDebut)
                            );

                            return (
                              <td
                                key={d.key}
                                style={{
                                  verticalAlign: 'top',
                                  borderLeft: '1px solid var(--border-subtle)',
                                  padding: '8px',
                                  minHeight: '120px',
                                }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={async () => {
                                  if (!draggedSlot) return;
                                  await applySlotSchedule(draggedSlot, {
                                    technicien: tech,
                                    date: d.key,
                                  });
                                  setDraggedSlot(null);
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontSize: '10.5px',
                                    color: 'var(--text-muted)',
                                    marginBottom: '6px',
                                  }}
                                >
                                  <div
                                    style={{
                                      flex: 1,
                                      height: '4px',
                                      background: 'var(--bg-app)',
                                      borderRadius: '999px',
                                      marginRight: '6px',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: `${pct}%`,
                                        height: '100%',
                                        background: totalHours > 8 ? '#ef4444' : '#3b82f6',
                                      }}
                                    />
                                  </div>
                                  <span className="font-mono">{totalHours.toFixed(1)}h</span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {sorted.map((slot) => {
                                    const accent =
                                      slot.kind === 'VISITE_DEVIS'
                                        ? '#ffcc00'
                                        : slot.kind === 'URGENCE'
                                        ? '#ff0000'
                                        : '#00bf63';
                                    const isSelected = selectedSlotId === slot.id;

                                    return (
                                      <div
                                        key={slot.id}
                                        draggable
                                        onDragStart={() => {
                                          setDraggedSlot(slot);
                                          setSelectedSlotId(slot.id);
                                        }}
                                        onDragEnd={() => setDraggedSlot(null)}
                                        onClick={() => {
                                          setSelectedSlotId(slot.id);
                                          setKeyboardIntervalText(`${slot.heureDebut}-${slot.heureFin}`);
                                        }}
                                        style={{
                                          padding: '6px 8px',
                                          borderRadius: '7px',
                                          background: isSelected ? 'var(--bg-active)' : 'var(--bg-elevated)',
                                          border: isSelected
                                            ? `1.5px solid ${accent}`
                                            : '1px solid var(--border-default)',
                                          borderLeft: `3.5px solid ${accent}`,
                                          fontSize: '11.5px',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: '3px',
                                        }}
                                      >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <span className="font-mono" style={{ fontSize: '10.5px', fontWeight: 700, color: accent }}>
                                            {slot.heureDebut}–{slot.heureFin}
                                          </span>
                                          <span className="font-mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                            {slot.reference}
                                          </span>
                                        </div>
                                        <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {slot.client}
                                        </div>
                                        <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {slot.title}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          {viewMode === 'columns' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `64px repeat(${
                  techniciens.filter((t) => filterTech === 'ALL' || t === filterTech).length
                }, minmax(180px, 1fr))`,
                overflowX: 'auto',
                flex: 1,
              }}
            >
              <div style={{ borderRight: '1px solid var(--border-default)', background: 'var(--bg-elevated)' }}>
                <div style={{ height: '48px', borderBottom: '1px solid var(--border-default)' }} />
                {HOURS_ARRAY.map((hr) => (
                  <div
                    key={hr}
                    className="font-mono"
                    style={{
                      height: '56px',
                      borderBottom: '1px solid var(--border-subtle)',
                      padding: '4px 8px',
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      textAlign: 'right',
                    }}
                  >
                    {String(hr).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {techniciens
                .filter((t) => filterTech === 'ALL' || t === filterTech)
                .map((tech) => {
                  const { slots, totalHours } = getTechDayStats(tech, selectedDayKey);
                  const totalCanvasHeight = HOURS_ARRAY.length * 56;

                  return (
                    <div
                      key={tech}
                      style={{ borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column' }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={async (e) => {
                        if (!draggedSlot) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const relY = Math.max(0, e.clientY - rect.top - 48);
                        const dropMin =
                          START_HOUR * 60 +
                          Math.round(((relY / totalCanvasHeight) * TOTAL_MINUTES) / 15) * 15;
                        const durMin = Math.max(60, Math.round(draggedSlot.durationHours * 60));
                        const clampedStart = Math.max(
                          START_HOUR * 60,
                          Math.min(END_HOUR * 60 - durMin, dropMin)
                        );
                        await applySlotSchedule(draggedSlot, {
                          technicien: tech,
                          date: selectedDayKey,
                          heureDebut: minutesToTime(clampedStart),
                          heureFin: minutesToTime(clampedStart + durMin),
                        });
                        setDraggedSlot(null);
                      }}
                    >
                      <div
                        style={{
                          height: '48px',
                          padding: '8px 12px',
                          borderBottom: '1px solid var(--border-default)',
                          background: 'var(--bg-elevated)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: '12.5px' }}>{tech}</span>
                        <span className="font-mono" style={{ fontSize: '11px', color: '#60a5fa' }}>
                          {totalHours.toFixed(1)}h
                        </span>
                      </div>

                      <div style={{ position: 'relative', height: `${totalCanvasHeight}px` }}>
                        {HOURS_ARRAY.map((hr) => (
                          <div
                            key={hr}
                            style={{
                              height: '56px',
                              borderBottom: '1px dashed var(--border-subtle)',
                            }}
                          />
                        ))}

                        {slots.map((slot) => {
                          const startM = Math.max(START_HOUR * 60, timeToMinutes(slot.heureDebut));
                          const endM = Math.min(END_HOUR * 60, Math.max(startM + 30, timeToMinutes(slot.heureFin)));
                          const topPx = ((startM - START_HOUR * 60) / TOTAL_MINUTES) * totalCanvasHeight;
                          const heightPx = Math.max(36, ((endM - startM) / TOTAL_MINUTES) * totalCanvasHeight);

                          const typeClass =
                            slot.kind === 'VISITE_DEVIS'
                              ? 'type-visite'
                              : slot.kind === 'URGENCE'
                              ? 'type-urgence'
                              : 'type-travaux';

                          return (
                            <div
                              key={slot.id}
                              draggable
                              onDragStart={() => {
                                setDraggedSlot(slot);
                                setSelectedSlotId(slot.id);
                              }}
                              onDragEnd={() => setDraggedSlot(null)}
                              onClick={() => {
                                setSelectedSlotId(slot.id);
                                setKeyboardIntervalText(`${slot.heureDebut}-${slot.heureFin}`);
                              }}
                              className={`gantt-event-block ${typeClass} ${
                                selectedSlotId === slot.id ? 'selected' : ''
                              }`}
                              style={{
                                left: '6px',
                                right: '6px',
                                top: `${topPx}px`,
                                height: `${heightPx}px`,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                <div className="font-mono" style={{ fontSize: '10.5px', fontWeight: 700 }}>
                                  {slot.heureDebut}–{slot.heureFin} • {slot.reference}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSlotToDelete(slot);
                                  }}
                                  title="Options de suppression / déplanification"
                                  style={{
                                    background: 'rgba(0,0,0,0.25)',
                                    border: 'none',
                                    borderRadius: '3px',
                                    cursor: 'pointer',
                                    padding: '1px 3px',
                                    color: '#ffffff',
                                    opacity: 0.85,
                                    fontSize: '10px',
                                    lineHeight: 1,
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                              <div style={{ fontWeight: 700, fontSize: '11.5px' }}>{slot.client}</div>
                              <div style={{ fontSize: '10.5px', opacity: 0.85 }}>{slot.title}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* 4. QUICK-ASSIGN & QUICK-CREATE MODAL AFTER CLICK-DRAG DRAWING */}
      {drawnSlotModal && (
        <div className="cmd-palette-backdrop" onClick={() => setDrawnSlotModal(null)}>
          <div
            className="cmd-palette-modal"
            style={{ maxWidth: '540px', padding: '20px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700 }}>
                  Nouveau créneau — {drawnSlotModal.technicien} ({drawnSlotModal.dateKey})
                </h3>
                <p className="font-mono" style={{ fontSize: '12px', color: '#60a5fa', marginTop: '2px' }}>
                  {drawnSlotModal.heureDebut} → {drawnSlotModal.heureFin}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setDrawnSlotModal(null)}
              >
                ✕
              </button>
            </div>

            {unscheduledItems.length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '7px', textTransform: 'uppercase' }}>
                  Option A : Placer une mission existante en attente ({unscheduledItems.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto' }}>
                  {unscheduledItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={async () => {
                        const parsed = parseTimeIntervalInput(quickIntervalText);
                        await applySlotSchedule(item, {
                          technicien: drawnSlotModal.technicien,
                          date: drawnSlotModal.dateKey,
                          heureDebut: parsed?.heureDebut || drawnSlotModal.heureDebut,
                          heureFin: parsed?.heureFin || drawnSlotModal.heureFin,
                        });
                        setDrawnSlotModal(null);
                      }}
                      style={{
                        textAlign: 'left',
                        padding: '8px 11px',
                        borderRadius: '8px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '12px' }}>
                          {item.reference} — {item.client}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{item.title}</div>
                      </div>
                      <span className="btn btn-secondary btn-sm">Placer ici</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {onCreateQuickIntervention && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const parsed = parseTimeIntervalInput(quickIntervalText);
                  const hDebut = parsed?.heureDebut || drawnSlotModal.heureDebut;
                  const hFin = parsed?.heureFin || drawnSlotModal.heureFin;
                  await onCreateQuickIntervention({
                    client: quickClient.trim() || 'Client ANELEC',
                    chantier: quickSite.trim() || quickClient.trim() || 'Site à préciser',
                    objet: quickObjet.trim() || (quickKind === 'VISITE_DEVIS' ? 'Visite technique devis' : 'Intervention travaux'),
                    entreprise: drawnSlotModal.technicien,
                    datePlanifiee: drawnSlotModal.dateKey,
                    heureDebut: hDebut,
                    heureFin: hFin,
                    priorite: quickPriorite,
                    isVisiteDevis: quickKind === 'VISITE_DEVIS',
                    typeIntervention: quickKind === 'VISITE_DEVIS' ? 'Visite technique devis' : 'Corrective',
                    statutOperationnel: 'Planifiée',
                    modePlanification: 'Planifiée',
                  });
                  setDrawnSlotModal(null);
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}
              >
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Option B : Créer directement une nouvelle mission sur ce créneau
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Intervalle au clavier (ex: 08:30-11:00, 14h+2h)</label>
                    <input
                      className="input font-mono"
                      value={quickIntervalText}
                      onChange={(e) => setQuickIntervalText(e.target.value)}
                      placeholder="08:00-11:00"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Nature de mission</label>
                    <select
                      className="select"
                      value={quickKind}
                      onChange={(e) => setQuickKind(e.target.value as any)}
                    >
                      <option value="INTERVENTION">Intervention Travaux / Dépannage</option>
                      <option value="VISITE_DEVIS">Visite Technique Devis</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Client (Donneur d'ordre) *</label>
                    <select
                      required
                      className="select"
                      value={isCustomQuickClient ? '__CUSTOM__' : quickClient}
                      onChange={(e) => {
                        if (e.target.value === '__CUSTOM__') {
                          setIsCustomQuickClient(true);
                          setQuickClient('');
                        } else {
                          setIsCustomQuickClient(false);
                          setQuickClient(e.target.value);
                        }
                      }}
                    >
                      <option value="">— Sélectionner un Donneur d'ordre —</option>
                      {clientsList.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      {quickClient && !clientsList.includes(quickClient) && (
                        <option value={quickClient}>{quickClient} (Personnalisé)</option>
                      )}
                      <option value="__CUSTOM__">+ Nouveau donneur d'ordre (saisie libre)...</option>
                    </select>
                    {isCustomQuickClient && (
                      <div style={{ marginTop: '6px', display: 'flex', gap: '6px' }}>
                        <input
                          required
                          className="input"
                          style={{ flex: 1, borderColor: '#2563eb' }}
                          value={quickClient}
                          onChange={(e) => setQuickClient(e.target.value)}
                          placeholder="Ex: Presta maintenance"
                          autoFocus
                        />
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          title="Revenir à la liste déroulante"
                          onClick={() => {
                            setIsCustomQuickClient(false);
                            setQuickClient(clientsList[0] || '');
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Site / Chantier / Adresse *</label>
                    <input
                      required
                      className="input"
                      value={quickSite}
                      onChange={(e) => setQuickSite(e.target.value)}
                      placeholder="Ex: Immeuble Pasteur"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Objet de la mission</label>
                    <input
                      className="input"
                      value={quickObjet}
                      onChange={(e) => setQuickObjet(e.target.value)}
                      placeholder="Description rapide..."
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Priorité</label>
                    <select
                      className="select"
                      value={quickPriorite}
                      onChange={(e) => setQuickPriorite(e.target.value)}
                    >
                      <option value="Normale">Normale</option>
                      <option value="Haute">Haute</option>
                      <option value="Urgente">Urgente</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDrawnSlotModal(null)}>
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Enregistrer sur le planning
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 5. MATRICE DES COMPÉTENCES TECHNICIENS PAR MÉTIER (RÈGLE DU MOINDRE DE COMPÉTENCES) */}
      {skillsModalOpen && (
        <div className="cmd-palette-backdrop" onClick={() => setSkillsModalOpen(false)}>
          <div
            className="cmd-palette-modal"
            style={{ width: 'min(820px, 95vw)', maxHeight: '85vh', padding: '20px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800 }}>
                  Compétences Métier des Techniciens (Auto-Distribution)
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.45 }}>
                  <strong>Règle du Moindre de Compétences :</strong> Lors d'une auto-planification, le système choisit en priorité le technicien qualifié ayant <strong>le moins de compétences au total</strong> (ex. celui qui maîtrise uniquement <em>Électricité</em> passe avant celui qui maîtrise <em>Électricité + Plomberie + Serrurerie</em>), afin de garder vos techniciens polyvalents disponibles pour les autres corps d'état.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSkillsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
              {techniciens.map((tech) => {
                const techSkills =
                  technicienCompetences[tech] || [];
                const isSpecialist = techSkills.length === 1;

                return (
                  <div
                    key={tech}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '9px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, fontSize: '13.5px' }}>{tech}</span>
                        <span
                          className="font-mono"
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: isSpecialist ? 'var(--success-bg)' : 'var(--brand-glow)',
                            color: isSpecialist ? 'var(--success-accent)' : 'var(--brand-primary)',
                          }}
                        >
                          {techSkills.length} compétence(s) •{' '}
                          {isSpecialist
                            ? 'Spécialiste (Priorité #1 sur son métier)'
                            : `Polyvalent (Réservé si spécialiste disponible)`}
                        </span>
                      </div>

                      {/* Case pour ajouter une compétence personnalisée par rapport au métier */}
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          await addCustomTechSkill(tech);
                        }}
                        style={{ display: 'flex', gap: '6px' }}
                      >
                        <input
                          type="text"
                          className="input"
                          style={{ width: '190px', padding: '4px 8px', fontSize: '11.5px', height: '27px' }}
                          placeholder="Ajouter une compétence..."
                          value={customSkillInputs[tech] || ''}
                          onChange={(e) =>
                            setCustomSkillInputs((prev) => ({ ...prev, [tech]: e.target.value }))
                          }
                        />
                        <button type="submit" className="btn btn-secondary btn-sm" style={{ height: '27px' }}>
                          + Ajouter
                        </button>
                      </form>
                    </div>

                    {/* Cases à cocher / pastilles cliquables pour tous les corps d'état ANELEC */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {Array.from(new Set([...corpsEtatList, ...techSkills])).map((metier) => {
                        const active = techSkills.includes(metier);
                        return (
                          <button
                            key={metier}
                            type="button"
                            onClick={() => toggleTechSkill(tech, metier)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: active ? 700 : 500,
                              cursor: 'pointer',
                              border: active
                                ? '1.5px solid var(--brand-primary)'
                                : '1px solid var(--border-default)',
                              background: active ? 'var(--brand-glow)' : 'var(--bg-surface)',
                              color: active ? 'var(--brand-primary)' : 'var(--text-secondary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                            }}
                          >
                            <span>{active ? '✓' : ''}</span>
                            <span>{metier}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
              <button type="button" className="btn btn-primary" onClick={() => setSkillsModalOpen(false)}>
                Terminé
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE DE CONFIRMATION SUPPRESSION / DÉPLANIFICATION */}
      {slotToDelete && (
        <div
          className="cmd-palette-backdrop"
          onClick={() => {
            if (!isDeleting) setSlotToDelete(null);
          }}
          style={{ zIndex: 9999 }}
        >
          <div
            className="cmd-palette-modal"
            style={{ maxWidth: '520px', padding: '24px', borderRadius: '16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  flexShrink: 0,
                }}
              >
                ✕
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Gérer / Supprimer le créneau
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {slotToDelete.sourceType === 'DEVIS' ? 'Visite / Devis' : 'Intervention'} :{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{slotToDelete.reference}</strong> — {slotToDelete.client}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  Planifié le {slotToDelete.date || 'Date non définie'} ({slotToDelete.heureDebut} - {slotToDelete.heureFin}) avec {slotToDelete.technicien || 'Non affecté'}.
                </p>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '18px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              • <strong>Deux choix s'offrent à vous :</strong>
              <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                <li><strong>Déplanifier uniquement</strong> : Conserve le dossier intact dans la base et le renvoie en liste d'attente à planifier ultérieurement.</li>
                <li><strong>Supprimer définitivement</strong> : Efface irréversiblement ce dossier de l'application et de la base de données.</li>
              </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={isDeleting}
                onClick={() => setSlotToDelete(null)}
              >
                Annuler
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={isDeleting}
                style={{ color: '#d97706', borderColor: 'rgba(217, 119, 6, 0.4)' }}
                onClick={async () => {
                  try {
                    setIsDeleting(true);
                    await applySlotSchedule(slotToDelete, {
                      date: null,
                      statut: 'À planifier',
                    });
                    if (selectedSlotId === slotToDelete.id) {
                      setSelectedSlotId(null);
                      setSliderPreview(null);
                    }
                    setSlotToDelete(null);
                  } catch (err) {
                    console.error('Erreur déplanification:', err);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
              >
                ↩ Déplanifier uniquement
              </button>

              <button
                type="button"
                className="btn btn-sm"
                disabled={isDeleting}
                style={{ background: '#dc2626', color: '#ffffff', border: 'none', fontWeight: 700 }}
                onClick={async () => {
                  try {
                    setIsDeleting(true);
                    if (slotToDelete.sourceType === 'DEVIS') {
                      if (onDeleteDevis) {
                        await onDeleteDevis(slotToDelete.sourceId);
                      }
                    } else {
                      if (onDeleteIntervention) {
                        await onDeleteIntervention(slotToDelete.sourceId);
                      }
                    }
                    if (selectedSlotId === slotToDelete.id) {
                      setSelectedSlotId(null);
                      setSliderPreview(null);
                    }
                    setSlotToDelete(null);
                  } catch (err) {
                    console.error('Erreur suppression:', err);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
              >
                {isDeleting ? 'Suppression...' : '✕ Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
