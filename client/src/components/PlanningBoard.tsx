// Interactive Technician Planning Board (Mouse Drag & Drop + Mouse Resize/Draw + Keyboard Interval Input)
import React, { useState, useMemo, useRef } from 'react';
import {
  Devis,
  Intervention,
  formatDateFR,
  parseTimeIntervalInput,
  computeDurationHours,
} from '../lib/api';
import toast from 'react-hot-toast';

interface PlanningBoardProps {
  interventions: Intervention[];
  devis: Devis[];
  techniciens: string[];
  corpsEtatList: string[];
  onUpdateIntervention: (id: number, data: Partial<Intervention>) => Promise<any>;
  onCreateIntervention: (data: any) => Promise<any>;
  onConvertDevis: (
    devisId: number,
    data: {
      mode: 'visite' | 'travaux';
      isVisiteDevis: boolean;
      entreprise?: string;
      datePlanifiee?: string;
      heureDebut?: string;
      heureFin?: string;
    }
  ) => Promise<any>;
  onSelectIntervention: (intervention: Intervention) => void;
  onSelectDevis: (devis: Devis) => void;
}

const DAYS_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const TIMELINE_START_HOUR = 7;  // 07:00
const TIMELINE_END_HOUR = 19;   // 19:00
const TOTAL_TIMELINE_MINUTES = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60; // 720 min

function getMondayOfISOWeek(baseDate: Date): Date {
  const d = new Date(baseDate);
  const day = d.getDay(); // 0 = Sun, 1 = Mon...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function timeToMinutes(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function minutesToHHMM(totalMin: number): string {
  const snapped = Math.round(totalMin / 15) * 15;
  const clamped = Math.max(TIMELINE_START_HOUR * 60, Math.min(TIMELINE_END_HOUR * 60, snapped));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function PlanningBoard({
  interventions,
  devis,
  techniciens,
  corpsEtatList,
  onUpdateIntervention,
  onCreateIntervention,
  onConvertDevis,
  onSelectIntervention,
  onSelectDevis,
}: PlanningBoardProps) {
  // View mode: 'week' (Techniciens × Jours) or 'timeline' (Grille Horaire 07:00-19:00)
  const [viewMode, setViewMode] = useState<'week' | 'timeline'>('week');
  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMondayOfISOWeek(new Date()));
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    const todayDay = new Date().getDay();
    return todayDay >= 1 && todayDay <= 6 ? todayDay - 1 : 0;
  });

  // Filters
  const [filterTech, setFilterTech] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<'ALL' | 'VISITE' | 'TRAVAUX' | 'URGENCE'>('ALL');
  const [filterCorpsEtat, setFilterCorpsEtat] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Inline keyboard interval editor state
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null);
  const [intervalInputText, setIntervalInputText] = useState<string>('');

  // Quick create modal / popover when drawing a time range with the mouse
  const [drawnSlot, setDrawnSlot] = useState<{
    technicien: string;
    dateISO: string;
    heureDebut: string;
    heureFin: string;
  } | null>(null);
  const [quickSlotForm, setQuickSlotForm] = useState<{
    sourceType: 'new_intervention' | 'new_visite' | 'existing_backlog';
    backlogItemId: string;
    client: string;
    chantier: string;
    objet: string;
    corpsEtat: string;
    priorite: string;
  }>({
    sourceType: 'new_intervention',
    backlogItemId: '',
    client: '',
    chantier: '',
    objet: '',
    corpsEtat: 'Électricité',
    priorite: 'Normale',
  });

  // Mouse drag-to-draw / resize state on the hourly timeline
  const [mouseDragState, setMouseDragState] = useState<{
    mode: 'draw' | 'resize-start' | 'resize-end' | 'move';
    technicien: string;
    dateISO: string;
    interventionId?: number;
    startMin: number;
    currentMin: number;
    initialStartMin?: number;
    initialEndMin?: number;
  } | null>(null);

  const timelineTrackRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Compute the 6 days of the selected week (Lun -> Sam)
  const weekDays = useMemo(() => {
    return DAYS_LABELS.map((label, idx) => {
      const d = new Date(currentMonday);
      d.setDate(currentMonday.getDate() + idx);
      const iso = toISODate(d);
      const isToday = iso === toISODate(new Date());
      return {
        index: idx,
        label,
        shortDate: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        iso,
        isToday,
      };
    });
  }, [currentMonday]);

  const activeTimelineDay = weekDays[selectedDayIndex] || weekDays[0];

  // Filtered technicians
  const visibleTechniciens = useMemo(() => {
    if (filterTech === 'ALL') return techniciens;
    return techniciens.filter((t) => t === filterTech);
  }, [techniciens, filterTech]);

  // Filter interventions helper
  const matchesFilters = (item: Intervention) => {
    if (filterType === 'VISITE' && !item.isVisiteDevis) return false;
    if (filterType === 'TRAVAUX' && item.isVisiteDevis) return false;
    if (
      filterType === 'URGENCE' &&
      item.priorite !== 'Urgente' &&
      item.typeIntervention !== 'Dépannage' &&
      item.typeIntervention !== 'Urgente'
    ) {
      return false;
    }
    if (filterCorpsEtat !== 'ALL' && item.corpsEtat !== filterCorpsEtat) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const hay = `${item.reference || ''} ${item.client || ''} ${item.chantier || ''} ${item.objet || ''} ${item.entreprise || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  // Unscheduled / Backlog items ("À placer dans le planning")
  const backlogInterventions = useMemo(() => {
    return interventions.filter(
      (i) =>
        (!i.datePlanifiee || !i.entreprise || !techniciens.includes(i.entreprise)) &&
        !['Clôturée', 'Annulée'].includes(i.statutOperationnel) &&
        matchesFilters(i)
    );
  }, [interventions, techniciens, filterType, filterCorpsEtat, searchQuery]);

  // Devis that need a visit or were accepted but have no linked intervention yet
  const actionableDevisForPlanning = useMemo(() => {
    return devis.filter((d) => {
      const hasLinked = (d.interventionsCount || 0) > 0;
      const needsVisite = d.visiteNecessaire || d.traitement === 'En attente technicien';
      const isAcceptedReady = d.statutCommercial === 'Accepté' || d.prochaineAction === 'Planifier après accord';
      return !hasLinked && (needsVisite || isAcceptedReady);
    });
  }, [devis]);

  // Detect overlapping slots for a technician on a given day
  const getOverlappingIds = (daySlots: Intervention[]): Set<number> => {
    const overlaps = new Set<number>();
    for (let a = 0; a < daySlots.length; a++) {
      const sA = timeToMinutes(daySlots[a].heureDebut || '08:00') ?? 480;
      const eA = timeToMinutes(daySlots[a].heureFin || '10:00') ?? 600;
      for (let b = a + 1; b < daySlots.length; b++) {
        const sB = timeToMinutes(daySlots[b].heureDebut || '08:00') ?? 480;
        const eB = timeToMinutes(daySlots[b].heureFin || '10:00') ?? 600;
        if (sA < eB && sB < eA) {
          overlaps.add(daySlots[a].id);
          overlaps.add(daySlots[b].id);
        }
      }
    }
    return overlaps;
  };

  // Drag & Drop handlers (HTML5 Drag for Week Matrix & Backlog)
  const handleDragStartSlot = (e: React.DragEvent, item: Intervention) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ kind: 'intervention', id: item.id }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragStartDevis = (e: React.DragEvent, d: Devis, mode: 'visite' | 'travaux') => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ kind: 'devis', devisId: d.id, mode })
    );
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDropOnCell = async (
    e: React.DragEvent,
    technicien: string,
    dateISO: string,
    defaultHeureDebut?: string,
    defaultHeureFin?: string
  ) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;

    try {
      const payload = JSON.parse(raw);
      if (payload.kind === 'intervention') {
        const target = interventions.find((i) => i.id === payload.id);
        if (!target) return;
        const heureDebut = defaultHeureDebut || target.heureDebut || '08:30';
        const heureFin = defaultHeureFin || target.heureFin || '11:30';
        await onUpdateIntervention(target.id, {
          entreprise: technicien,
          datePlanifiee: dateISO,
          heureDebut,
          heureFin,
          statutOperationnel:
            target.statutOperationnel === 'À planifier' || target.statutOperationnel === 'Nouvelle demande'
              ? 'Planifiée'
              : target.statutOperationnel,
          modePlanification: 'Planifiée',
        });
        toast.success(`Affecté à ${technicien} le ${formatDateFR(dateISO)} (${heureDebut}-${heureFin})`);
      } else if (payload.kind === 'devis') {
        const isVisite = payload.mode === 'visite';
        const heureDebut = defaultHeureDebut || (isVisite ? '09:00' : '08:30');
        const heureFin = defaultHeureFin || (isVisite ? '10:30' : '12:30');
        await onConvertDevis(payload.devisId, {
          mode: payload.mode,
          isVisiteDevis: isVisite,
          entreprise: technicien,
          datePlanifiee: dateISO,
          heureDebut,
          heureFin,
        });
      }
    } catch {
      toast.error('Impossible de déplacer cet élément');
    }
  };

  // Keyboard interval submission ("08:30-11:00", "14h-17h30", "9h+2h", "matin")
  const handleApplyKeyboardInterval = async (item: Intervention, rawInput?: string) => {
    const textToParse = rawInput !== undefined ? rawInput : intervalInputText;
    const parsed = parseTimeIntervalInput(textToParse);
    if (!parsed) {
      toast.error(
        'Format non reconnu. Exemples : "08:30-11:00", "14h-17h30", "09:00+2h", "matin", "aprem"'
      );
      return;
    }

    await onUpdateIntervention(item.id, {
      heureDebut: parsed.heureDebut,
      heureFin: parsed.heureFin,
    });
    setEditingSlotId(null);
    toast.success(`Créneau mis à jour : ${parsed.heureDebut} – ${parsed.heureFin}`);
  };

  // Shift slot by +/- minutes
  const handleShiftSlot = async (item: Intervention, deltaMin: number) => {
    const s = timeToMinutes(item.heureDebut || '08:30') ?? 510;
    const e = timeToMinutes(item.heureFin || '11:30') ?? 690;
    const newStart = Math.max(TIMELINE_START_HOUR * 60, Math.min(TIMELINE_END_HOUR * 60 - 30, s + deltaMin));
    const duration = Math.max(30, e - s);
    const newEnd = Math.min(TIMELINE_END_HOUR * 60, newStart + duration);
    await onUpdateIntervention(item.id, {
      heureDebut: minutesToHHMM(newStart),
      heureFin: minutesToHHMM(newEnd),
    });
  };

  // Duplicate slot to next day (multi-day chantier)
  const handleDuplicateNextDay = async (item: Intervention) => {
    if (!item.datePlanifiee) return;
    const [y, m, d] = item.datePlanifiee.split('-').map(Number);
    const nextDate = new Date(y, m - 1, d + 1);
    if (nextDate.getDay() === 0) nextDate.setDate(nextDate.getDate() + 1); // skip Sunday
    const nextISO = toISODate(nextDate);

    await onCreateIntervention({
      client: item.client,
      chantier: item.chantier,
      objet: `${item.objet || item.chantier} (Suite)`,
      origine: item.origine,
      typeIntervention: item.typeIntervention,
      modePlanification: 'Planifiée',
      corpsEtat: item.corpsEtat,
      priorite: item.priorite,
      datePlanifiee: nextISO,
      statutOperationnel: 'Planifiée',
      traitement: 'En cours de traitement',
      entreprise: item.entreprise,
      heureDebut: item.heureDebut || '08:30',
      heureFin: item.heureFin || '12:00',
      isVisiteDevis: item.isVisiteDevis,
      devisId: item.devisId,
      refDevisTexte: item.refDevisTexte,
      amount: item.amount,
    });
    toast.success(`Créneau dupliqué au ${formatDateFR(nextISO)}`);
  };

  // ============================================================================
  // MOUSE TIMELINE MANIPULATION (Click-and-Drag to Draw / Resize / Move)
  // ============================================================================

  const getMinutesFromMouseEvent = (e: React.MouseEvent, technicien: string): number => {
    const track = timelineTrackRefs.current[technicien];
    if (!track) return 8 * 60;
    const rect = track.getBoundingClientRect();
    const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const ratio = relX / rect.width;
    const rawMin = TIMELINE_START_HOUR * 60 + ratio * TOTAL_TIMELINE_MINUTES;
    return Math.round(rawMin / 15) * 15; // Snap to 15-minute increments!
  };

  const handleTimelineMouseDownTrack = (e: React.MouseEvent, technicien: string) => {
    if (e.button !== 0) return;
    // Ignore if clicking inside an existing slot
    if ((e.target as HTMLElement).closest('.timeline-slot-block')) return;
    const startMin = getMinutesFromMouseEvent(e, technicien);
    setMouseDragState({
      mode: 'draw',
      technicien,
      dateISO: activeTimelineDay.iso,
      startMin,
      currentMin: Math.min(TIMELINE_END_HOUR * 60, startMin + 60),
    });
  };

  const handleTimelineMouseDownResize = (
    e: React.MouseEvent,
    item: Intervention,
    edge: 'resize-start' | 'resize-end'
  ) => {
    e.stopPropagation();
    if (!item.entreprise) return;
    const s = timeToMinutes(item.heureDebut || '08:30') ?? 510;
    const end = timeToMinutes(item.heureFin || '11:30') ?? 690;
    setMouseDragState({
      mode: edge,
      technicien: item.entreprise,
      dateISO: activeTimelineDay.iso,
      interventionId: item.id,
      startMin: edge === 'resize-start' ? end : s,
      currentMin: edge === 'resize-start' ? s : end,
      initialStartMin: s,
      initialEndMin: end,
    });
  };

  const handleTimelineMouseMove = (e: React.MouseEvent, technicien: string) => {
    if (!mouseDragState || mouseDragState.technicien !== technicien) return;
    const min = getMinutesFromMouseEvent(e, technicien);
    setMouseDragState((prev) => (prev ? { ...prev, currentMin: min } : null));
  };

  const handleTimelineMouseUp = async () => {
    if (!mouseDragState) return;
    const state = mouseDragState;
    setMouseDragState(null);

    const minA = Math.min(state.startMin, state.currentMin);
    const minB = Math.max(state.startMin, state.currentMin);
    const finalStart = minA;
    const finalEnd = Math.max(minA + 30, minB); // minimum 30 min slot

    const heureDebut = minutesToHHMM(finalStart);
    const heureFin = minutesToHHMM(finalEnd);

    if (state.mode === 'draw') {
      setDrawnSlot({
        technicien: state.technicien,
        dateISO: state.dateISO,
        heureDebut,
        heureFin,
      });
      setQuickSlotForm((prev) => ({
        ...prev,
        sourceType: backlogInterventions.length > 0 ? 'existing_backlog' : 'new_intervention',
        backlogItemId: backlogInterventions[0] ? String(backlogInterventions[0].id) : '',
      }));
    } else if (
      (state.mode === 'resize-start' || state.mode === 'resize-end') &&
      state.interventionId
    ) {
      await onUpdateIntervention(state.interventionId, {
        heureDebut,
        heureFin,
      });
      toast.success(`Horaire ajusté : ${heureDebut} – ${heureFin}`);
    }
  };

  const handleConfirmDrawnSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawnSlot) return;

    if (quickSlotForm.sourceType === 'existing_backlog' && quickSlotForm.backlogItemId) {
      const id = parseInt(quickSlotForm.backlogItemId, 10);
      await onUpdateIntervention(id, {
        entreprise: drawnSlot.technicien,
        datePlanifiee: drawnSlot.dateISO,
        heureDebut: drawnSlot.heureDebut,
        heureFin: drawnSlot.heureFin,
        statutOperationnel: 'Planifiée',
        modePlanification: 'Planifiée',
      });
      toast.success('Mission affectée sur le créneau tracé à la souris !');
    } else {
      const isVisite = quickSlotForm.sourceType === 'new_visite';
      await onCreateIntervention({
        client: quickSlotForm.client || 'Client ANELEC',
        chantier: quickSlotForm.chantier || quickSlotForm.client || 'Site à préciser',
        objet:
          quickSlotForm.objet ||
          (isVisite ? '[Visite Devis] Relevé technique sur site' : 'Intervention planifiée'),
        corpsEtat: quickSlotForm.corpsEtat,
        priorite: quickSlotForm.priorite,
        typeIntervention: isVisite ? 'Visite technique devis' : 'Corrective',
        modePlanification: 'Planifiée',
        statutOperationnel: 'Planifiée',
        traitement: 'En cours de traitement',
        entreprise: drawnSlot.technicien,
        datePlanifiee: drawnSlot.dateISO,
        heureDebut: drawnSlot.heureDebut,
        heureFin: drawnSlot.heureFin,
        isVisiteDevis: isVisite,
      });
    }
    setDrawnSlot(null);
  };

  // Navigate weeks
  const changeWeek = (deltaWeeks: number) => {
    const next = new Date(currentMonday);
    next.setDate(currentMonday.getDate() + deltaWeeks * 7);
    setCurrentMonday(next);
  };

  return (
    <div className="planning-workspace">
      {/* Top control bar */}
      <div className="planning-header-bar">
        <div className="planning-header-left">
          <div className="view-switcher" role="tablist" aria-label="Mode d'affichage du planning">
            <button
              type="button"
              className={`view-switch-btn ${viewMode === 'week' ? 'active' : ''}`}
              onClick={() => setViewMode('week')}
            >
              🗓️ Matrice Semaine (Techniciens × Jours)
            </button>
            <button
              type="button"
              className={`view-switch-btn ${viewMode === 'timeline' ? 'active' : ''}`}
              onClick={() => setViewMode('timeline')}
            >
              ⏱️ Timeline Horaire (Souris & Clavier 07h–19h)
            </button>
          </div>

          <div className="week-navigator">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => changeWeek(-1)}>
              ◀ Sem. préc.
            </button>
            <span className="week-range-label">
              Semaine du <strong>{ weekDays[0].shortDate }</strong> au <strong>{ weekDays[5].shortDate }</strong>
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setCurrentMonday(getMondayOfISOWeek(new Date()))}
            >
              Aujourd’hui
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => changeWeek(1)}>
              Sem. suiv. ▶
            </button>
          </div>
        </div>

        <div className="planning-header-filters">
          <input
            type="text"
            className="input input-sm"
            placeholder="Rechercher client, site, réf..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '200px' }}
          />
          <select
            className="select select-sm"
            value={filterTech}
            onChange={(e) => setFilterTech(e.target.value)}
            aria-label="Filtrer par technicien"
          >
            <option value="ALL">👷 Tous les techniciens ({techniciens.length})</option>
            {techniciens.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            className="select select-sm"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            aria-label="Filtrer par type de mission"
          >
            <option value="ALL">📋 Tous types (Visites & Travaux)</option>
            <option value="VISITE">🟣 Visites techniques Devis</option>
            <option value="TRAVAUX">🔵 Interventions Travaux / SAV</option>
            <option value="URGENCE">🔴 Urgences & Dépannages</option>
          </select>

          <select
            className="select select-sm"
            value={filterCorpsEtat}
            onChange={(e) => setFilterCorpsEtat(e.target.value)}
            aria-label="Filtrer par corps d'état"
          >
            <option value="ALL">🛠️ Tous corps d’état</option>
            {corpsEtatList.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Interactive instruction banner */}
      <div className="planning-helper-strip">
        <div className="helper-badges">
          <span className="mission-legend-pill visite">🟣 Visite technique Devis</span>
          <span className="mission-legend-pill travaux">🔵 Intervention Planifiée</span>
          <span className="mission-legend-pill urgence">🔴 Urgence / Dépannage</span>
          <span className="mission-legend-pill termine">🟢 Terminée / Clôturée</span>
        </div>
        <div className="helper-tips">
          <span>🖱️ <strong>Souris :</strong> Glissez-déposez les cartes, étirez les bords ou dessinez un créneau sur la timeline.</span>
          <span>⌨️ <strong>Clavier :</strong> Cliquez sur l’heure d’une mission et tapez <code>08:30-11:00</code>, <code>14h-17h30</code>, <code>9h+2h</code> ou <code>matin</code>.</span>
        </div>
      </div>

      <div className="planning-body-grid">
        {/* LEFT/MAIN AREA: Matrix or Hourly Timeline */}
        <div className="planning-main-canvas">
          {viewMode === 'week' ? (
            /* ================================================================
               MODE 1: MATRICE SEMAINE (TECHNICIENS × JOURS LUN-SAM)
               ================================================================ */
            <div className="week-matrix-wrapper">
              <table className="week-matrix-table">
                <thead>
                  <tr>
                    <th className="tech-col-header">Technicien / Charge sem.</th>
                    {weekDays.map((day) => (
                      <th
                        key={day.iso}
                        className={`day-col-header ${day.isToday ? 'is-today' : ''}`}
                        onClick={() => {
                          setSelectedDayIndex(day.index);
                          setViewMode('timeline');
                        }}
                        title="Cliquer pour ouvrir la Timeline Horaire détaillée de ce jour"
                      >
                        <div className="day-header-top">
                          <span className="day-name">{day.label}</span>
                          <span className="day-date">{day.shortDate}</span>
                        </div>
                        {day.isToday && <span className="today-pill">Aujourd’hui</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleTechniciens.map((tech) => {
                    const techWeekSlots = interventions.filter(
                      (i) =>
                        i.entreprise === tech &&
                        i.datePlanifiee &&
                        weekDays.some((d) => d.iso === i.datePlanifiee) &&
                        matchesFilters(i)
                    );
                    const totalWeekHours = techWeekSlots.reduce((acc, s) => {
                      return acc + (computeDurationHours(s.heureDebut || '08:30', s.heureFin || '11:30') || 2);
                    }, 0);
                    const capacityPct = Math.min(100, Math.round((totalWeekHours / 39) * 100));

                    return (
                      <tr key={tech}>
                        {/* Technician info & weekly capacity bar */}
                        <td className="tech-row-cell">
                          <div className="tech-identity">
                            <div className="tech-avatar">{tech.slice(0, 2).toUpperCase()}</div>
                            <div>
                              <div className="tech-name">{tech}</div>
                              <div className="tech-stats-sub">
                                {techWeekSlots.length} mission{techWeekSlots.length > 1 ? 's' : ''} •{' '}
                                <strong>{totalWeekHours}h</strong> / 39h
                              </div>
                            </div>
                          </div>
                          <div className="capacity-bar-track" title={`Charge hebdomadaire : ${totalWeekHours}h / 39h (${capacityPct}%)`}>
                            <div
                              className={`capacity-bar-fill ${
                                capacityPct > 90 ? 'overload' : capacityPct > 60 ? 'optimal' : 'light'
                              }`}
                              style={{ width: `${capacityPct}%` }}
                            />
                          </div>
                        </td>

                        {/* 6 day cells */}
                        {weekDays.map((day) => {
                          const cellSlots = techWeekSlots
                            .filter((i) => i.datePlanifiee === day.iso)
                            .sort((a, b) => (a.heureDebut || '08:00').localeCompare(b.heureDebut || '08:00'));

                          const overlaps = getOverlappingIds(cellSlots);
                          const dayHours = cellSlots.reduce(
                            (sum, s) => sum + (computeDurationHours(s.heureDebut || '08:30', s.heureFin || '11:30') || 2),
                            0
                          );

                          return (
                            <td
                              key={day.iso}
                              className={`matrix-day-cell ${day.isToday ? 'is-today' : ''}`}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.currentTarget.classList.add('drag-over');
                              }}
                              onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
                              onDrop={(e) => {
                                e.currentTarget.classList.remove('drag-over');
                                handleDropOnCell(e, tech, day.iso);
                              }}
                            >
                              <div className="cell-top-bar">
                                <span className="cell-hours-sum">
                                  {dayHours > 0 ? `${dayHours}h planifiées` : 'Disponible'}
                                </span>
                                <button
                                  type="button"
                                  className="cell-quick-add-btn"
                                  title={`Ajouter un créneau pour ${tech} le ${day.label} ${day.shortDate}`}
                                  onClick={() => {
                                    setDrawnSlot({
                                      technicien: tech,
                                      dateISO: day.iso,
                                      heureDebut: cellSlots.length > 0 ? '14:00' : '08:30',
                                      heureFin: cellSlots.length > 0 ? '17:00' : '12:00',
                                    });
                                  }}
                                >
                                  +
                                </button>
                              </div>

                              <div className="cell-slots-stack">
                                {cellSlots.map((slot) => {
                                  const isConflict = overlaps.has(slot.id);
                                  const isEditing = editingSlotId === slot.id;
                                  const duration = computeDurationHours(slot.heureDebut, slot.heureFin);
                                  const cardTone = slot.isVisiteDevis
                                    ? 'tone-visite'
                                    : ['Clôturée', 'Terminée - à valider'].includes(slot.statutOperationnel)
                                    ? 'tone-termine'
                                    : slot.priorite === 'Urgente' || slot.typeIntervention === 'Dépannage'
                                    ? 'tone-urgence'
                                    : 'tone-travaux';

                                  return (
                                    <div
                                      key={slot.id}
                                      className={`planning-slot-card ${cardTone} ${isConflict ? 'has-conflict' : ''}`}
                                      draggable
                                      onDragStart={(e) => handleDragStartSlot(e, slot)}
                                    >
                                      {/* Time interval row: clickable to type keyboard interval! */}
                                      <div className="slot-time-row">
                                        {isEditing ? (
                                          <form
                                            className="inline-interval-form"
                                            onSubmit={(e) => {
                                              e.preventDefault();
                                              handleApplyKeyboardInterval(slot);
                                            }}
                                          >
                                            <input
                                              type="text"
                                              className="interval-keyboard-input"
                                              value={intervalInputText}
                                              onChange={(e) => setIntervalInputText(e.target.value)}
                                              placeholder="ex: 08:30-11:30 ou matin"
                                              autoFocus
                                              onBlur={() => setEditingSlotId(null)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Escape') setEditingSlotId(null);
                                              }}
                                            />
                                          </form>
                                        ) : (
                                          <button
                                            type="button"
                                            className="slot-time-pill"
                                            title="Cliquer pour saisir l'intervalle au clavier (ex: 08:30-11:00, 14h-17h, matin)"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingSlotId(slot.id);
                                              setIntervalInputText(
                                                `${slot.heureDebut || '08:30'}-${slot.heureFin || '11:30'}`
                                              );
                                            }}
                                          >
                                            ⌨️ {slot.heureDebut || '08:30'} – {slot.heureFin || '11:30'}
                                            {duration ? ` (${duration}h)` : ''}
                                          </button>
                                        )}

                                        <div className="slot-micro-actions">
                                          <button
                                            type="button"
                                            title="Décaler de -30 min"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleShiftSlot(slot, -30);
                                            }}
                                          >
                                            -30m
                                          </button>
                                          <button
                                            type="button"
                                            title="Décaler de +30 min"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleShiftSlot(slot, 30);
                                            }}
                                          >
                                            +30m
                                          </button>
                                          <button
                                            type="button"
                                            title="Dupliquer sur le jour suivant"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDuplicateNextDay(slot);
                                            }}
                                          >
                                            J+1
                                          </button>
                                        </div>
                                      </div>

                                      {/* Main body clickable to open full drawer */}
                                      <div
                                        className="slot-card-body"
                                        onClick={() => onSelectIntervention(slot)}
                                      >
                                        <div className="slot-badges-line">
                                          <span className="slot-ref-tag">{slot.reference}</span>
                                          <span className="slot-type-tag">
                                            {slot.isVisiteDevis ? '🟣 Visite Devis' : slot.typeIntervention || 'Travaux'}
                                          </span>
                                          {slot.corpsEtat && (
                                            <span className="slot-metier-tag">{slot.corpsEtat}</span>
                                          )}
                                        </div>
                                        <div className="slot-client-title">
                                          {slot.client ? `${slot.client} — ` : ''}
                                          <span>{slot.chantier}</span>
                                        </div>
                                        {slot.objet && <div className="slot-objet-sub">{slot.objet}</div>}
                                        {isConflict && (
                                          <div className="slot-conflict-warning">
                                            ⚠️ Chevauchement horaire détecté
                                          </div>
                                        )}
                                      </div>

                                      {/* Quick preset buttons */}
                                      <div className="slot-quick-presets">
                                        <button
                                          type="button"
                                          onClick={() => handleApplyKeyboardInterval(slot, '08:00-12:00')}
                                          title="Affecter au Matin (08:00-12:00)"
                                        >
                                          Matin
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleApplyKeyboardInterval(slot, '13:30-17:30')}
                                          title="Affecter à l'Après-midi (13:30-17:30)"
                                        >
                                          Après-midi
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            onUpdateIntervention(slot.id, {
                                              datePlanifiee: null,
                                              statutOperationnel: 'À planifier',
                                            })
                                          }
                                          title="Remettre dans le bac À planifier"
                                        >
                                          ↩ Bac
                                        </button>
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
          ) : (
            /* ================================================================
               MODE 2: TIMELINE HORAIRE INTERACTIVE (07:00 -> 19:00 À LA SOURIS)
               ================================================================ */
            <div className="timeline-view-container" onMouseUp={handleTimelineMouseUp}>
              {/* Day selector tabs */}
              <div className="timeline-day-tabs">
                {weekDays.map((d) => (
                  <button
                    key={d.iso}
                    type="button"
                    className={`timeline-day-tab ${d.index === selectedDayIndex ? 'active' : ''} ${
                      d.isToday ? 'today' : ''
                    }`}
                    onClick={() => setSelectedDayIndex(d.index)}
                  >
                    <span>{d.label}</span>
                    <strong>{d.shortDate}</strong>
                  </button>
                ))}
              </div>

              {/* Hours ruler header (07:00 to 19:00) */}
              <div className="timeline-grid-header">
                <div className="timeline-tech-col-label">Technicien ({activeTimelineDay.label} {activeTimelineDay.shortDate})</div>
                <div className="timeline-hours-ruler">
                  {Array.from({ length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 }).map((_, idx) => {
                    const h = TIMELINE_START_HOUR + idx;
                    return (
                      <div key={h} className="ruler-hour-mark" style={{ left: `${(idx / 12) * 100}%` }}>
                        <span>{String(h).padStart(2, '0')}:00</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rows per technician */}
              <div className="timeline-rows-list">
                {visibleTechniciens.map((tech) => {
                  const daySlots = interventions.filter(
                    (i) =>
                      i.entreprise === tech &&
                      i.datePlanifiee === activeTimelineDay.iso &&
                      matchesFilters(i)
                  );
                  const overlaps = getOverlappingIds(daySlots);

                  // Preview box while drawing with mouse
                  const isDrawingHere =
                    mouseDragState &&
                    mouseDragState.mode === 'draw' &&
                    mouseDragState.technicien === tech;

                  const drawStartMin = isDrawingHere
                    ? Math.min(mouseDragState.startMin, mouseDragState.currentMin)
                    : 0;
                  const drawEndMin = isDrawingHere
                    ? Math.max(drawStartMin + 30, Math.max(mouseDragState.startMin, mouseDragState.currentMin))
                    : 0;

                  return (
                    <div key={tech} className="timeline-tech-row">
                      <div className="timeline-tech-info">
                        <div className="tech-avatar">{tech.slice(0, 2).toUpperCase()}</div>
                        <div>
                          <div className="tech-name">{tech}</div>
                          <div className="tech-stats-sub">{daySlots.length} créneau(x)</div>
                        </div>
                      </div>

                      <div
                        ref={(el) => {
                          timelineTrackRefs.current[tech] = el;
                        }}
                        className="timeline-track-canvas"
                        onMouseDown={(e) => handleTimelineMouseDownTrack(e, tech)}
                        onMouseMove={(e) => handleTimelineMouseMove(e, tech)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          const dropMin = getMinutesFromMouseEvent(e, tech);
                          const startHHMM = minutesToHHMM(dropMin);
                          const endHHMM = minutesToHHMM(dropMin + 120);
                          handleDropOnCell(e, tech, activeTimelineDay.iso, startHHMM, endHHMM);
                        }}
                      >
                        {/* Vertical half-hour grid lines */}
                        {Array.from({ length: (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 2 }).map((_, idx) => (
                          <div
                            key={idx}
                            className={`timeline-grid-line ${idx % 2 === 0 ? 'hour-line' : 'half-line'}`}
                            style={{ left: `${(idx / 24) * 100}%` }}
                          />
                        ))}

                        {/* Active mouse draw ghost */}
                        {isDrawingHere && (
                          <div
                            className="timeline-draw-ghost"
                            style={{
                              left: `${((drawStartMin - TIMELINE_START_HOUR * 60) / TOTAL_TIMELINE_MINUTES) * 100}%`,
                              width: `${((drawEndMin - drawStartMin) / TOTAL_TIMELINE_MINUTES) * 100}%`,
                            }}
                          >
                            <span>
                              {minutesToHHMM(drawStartMin)} – {minutesToHHMM(drawEndMin)}
                            </span>
                          </div>
                        )}

                        {/* Rendered slots */}
                        {daySlots.map((slot) => {
                          const isResizingThis =
                            mouseDragState &&
                            mouseDragState.interventionId === slot.id &&
                            (mouseDragState.mode === 'resize-start' || mouseDragState.mode === 'resize-end');

                          const rawStart = isResizingThis
                            ? Math.min(mouseDragState.startMin, mouseDragState.currentMin)
                            : timeToMinutes(slot.heureDebut || '08:30') ?? 510;
                          const rawEnd = isResizingThis
                            ? Math.max(rawStart + 30, Math.max(mouseDragState.startMin, mouseDragState.currentMin))
                            : timeToMinutes(slot.heureFin || '11:30') ?? 690;

                          const clampedStart = Math.max(TIMELINE_START_HOUR * 60, rawStart);
                          const clampedEnd = Math.min(TIMELINE_END_HOUR * 60, Math.max(clampedStart + 30, rawEnd));

                          const leftPct =
                            ((clampedStart - TIMELINE_START_HOUR * 60) / TOTAL_TIMELINE_MINUTES) * 100;
                          const widthPct = ((clampedEnd - clampedStart) / TOTAL_TIMELINE_MINUTES) * 100;

                          const isConflict = overlaps.has(slot.id);
                          const toneClass = slot.isVisiteDevis
                            ? 'tone-visite'
                            : slot.priorite === 'Urgente'
                            ? 'tone-urgence'
                            : 'tone-travaux';

                          return (
                            <div
                              key={slot.id}
                              className={`timeline-slot-block ${toneClass} ${isConflict ? 'has-conflict' : ''}`}
                              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                              draggable
                              onDragStart={(e) => handleDragStartSlot(e, slot)}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectIntervention(slot);
                              }}
                              title={`${minutesToHHMM(clampedStart)} - ${minutesToHHMM(clampedEnd)} • ${
                                slot.client || ''
                              } (${slot.chantier}) — Étirez les bords gauche/droit à la souris !`}
                            >
                              {/* Left resize handle */}
                              <div
                                className="slot-resize-handle left"
                                title="Étirer le début à la souris"
                                onMouseDown={(e) => handleTimelineMouseDownResize(e, slot, 'resize-start')}
                              />

                              <div className="timeline-slot-inner">
                                <div className="timeline-slot-time">
                                  {minutesToHHMM(clampedStart)}–{minutesToHHMM(clampedEnd)}
                                  {slot.isVisiteDevis ? ' • 🟣 Visite Devis' : ''}
                                </div>
                                <div className="timeline-slot-title">
                                  <strong>{slot.client || slot.reference}</strong> — {slot.chantier}
                                </div>
                                {slot.objet && <div className="timeline-slot-sub">{slot.objet}</div>}
                              </div>

                              {/* Right resize handle */}
                              <div
                                className="slot-resize-handle right"
                                title="Étirer la fin à la souris"
                                onMouseDown={(e) => handleTimelineMouseDownResize(e, slot, 'resize-end')}
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
        </div>

        {/* RIGHT SIDEBAR: BACKLOG ("MISSIONS & VISITES DEVIS À PLACER") */}
        <aside className="planning-backlog-sidebar">
          <div className="backlog-header">
            <h3>📥 À placer au planning</h3>
            <span className="backlog-count">
              {backlogInterventions.length + actionableDevisForPlanning.length}
            </span>
          </div>
          <p className="backlog-subtitle">
            Glissez une carte vers un technicien ou cliquez sur <strong>Affecter</strong>.
          </p>

          <div className="backlog-list">
            {/* 1. Devis nécessitant une visite ou une intervention */}
            {actionableDevisForPlanning.map((d) => {
              const isVisite = d.visiteNecessaire || d.traitement === 'En attente technicien';
              return (
                <div
                  key={`devis-${d.id}`}
                  className={`backlog-card ${isVisite ? 'visite-card' : 'travaux-card'}`}
                  draggable
                  onDragStart={(e) => handleDragStartDevis(e, d, isVisite ? 'visite' : 'travaux')}
                >
                  <div className="backlog-card-top">
                    <span className="backlog-badge">
                      {isVisite ? '🟣 Visite Devis à créer' : '🔵 Devis Accepté à planifier'}
                    </span>
                    <span className="backlog-ref">{d.reference}</span>
                  </div>
                  <div className="backlog-client" onClick={() => onSelectDevis(d)}>
                    <strong>{d.client}</strong> — {d.site || 'Site à préciser'}
                  </div>
                  {d.objet && <div className="backlog-objet">{d.objet}</div>}
                  <div className="backlog-meta">
                    <span>🛠️ {d.corpsEtat || 'TCE'}</span>
                    <span>⚡ {d.priorite}</span>
                  </div>
                  <div className="backlog-quick-assign">
                    <button
                      type="button"
                      className="btn btn-primary btn-xs"
                      onClick={() =>
                        onConvertDevis(d.id, {
                          mode: isVisite ? 'visite' : 'travaux',
                          isVisiteDevis: isVisite,
                          entreprise: d.visiteTechnicien || techniciens[0] || 'Anouar',
                          datePlanifiee: activeTimelineDay.iso,
                          heureDebut: isVisite ? '09:00' : '08:30',
                          heureFin: isVisite ? '10:30' : '12:00',
                        })
                      }
                    >
                      + Placer ({d.visiteTechnicien || techniciens[0] || 'Anouar'} • {activeTimelineDay.label})
                    </button>
                  </div>
                </div>
              );
            })}

            {/* 2. Interventions / Visites en attente de date ou de technicien */}
            {backlogInterventions.map((item) => (
              <div
                key={`interv-${item.id}`}
                className={`backlog-card ${item.isVisiteDevis ? 'visite-card' : 'travaux-card'}`}
                draggable
                onDragStart={(e) => handleDragStartSlot(e, item)}
              >
                <div className="backlog-card-top">
                  <span className="backlog-badge">
                    {item.isVisiteDevis ? '🟣 Visite Devis' : `🔧 ${item.typeIntervention || 'Intervention'}`}
                  </span>
                  <span className="backlog-ref">{item.reference}</span>
                </div>
                <div className="backlog-client" onClick={() => onSelectIntervention(item)}>
                  <strong>{item.client || 'Client'}</strong> — {item.chantier}
                </div>
                {item.objet && <div className="backlog-objet">{item.objet}</div>}
                <div className="backlog-meta">
                  <span>🛠️ {item.corpsEtat || 'TCE'}</span>
                  <span>👷 {item.entreprise || 'Non affecté'}</span>
                </div>
                <div className="backlog-quick-assign">
                  <select
                    className="select select-xs"
                    value=""
                    onChange={(e) => {
                      const chosenTech = e.target.value;
                      if (!chosenTech) return;
                      onUpdateIntervention(item.id, {
                        entreprise: chosenTech,
                        datePlanifiee: activeTimelineDay.iso,
                        heureDebut: item.heureDebut || '08:30',
                        heureFin: item.heureFin || '11:30',
                        statutOperationnel: 'Planifiée',
                        modePlanification: 'Planifiée',
                      });
                      toast.success(`Placé sur ${chosenTech} (${activeTimelineDay.label})`);
                    }}
                  >
                    <option value="">Placer sur {activeTimelineDay.label} ({activeTimelineDay.shortDate})…</option>
                    {techniciens.map((t) => (
                      <option key={t} value={t}>
                        👷 {t} ({item.heureDebut || '08:30'}-{item.heureFin || '11:30'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}

            {backlogInterventions.length === 0 && actionableDevisForPlanning.length === 0 && (
              <div className="backlog-empty">
                ✅ Toutes les visites devis et interventions actives sont placées sur le planning !
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Modal when user draws a slot with the mouse or clicks '+' on a cell */}
      {drawnSlot && (
        <div className="modal-overlay" onClick={() => setDrawnSlot(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                Nouveau créneau — {drawnSlot.technicien} ({formatDateFR(drawnSlot.dateISO)})
              </h2>
              <button className="modal-close" onClick={() => setDrawnSlot(null)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleConfirmDrawnSlot}>
              <div className="modal-body">
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Heure début</label>
                    <input
                      type="time"
                      className="input"
                      value={drawnSlot.heureDebut}
                      onChange={(e) => setDrawnSlot({ ...drawnSlot, heureDebut: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Heure fin</label>
                    <input
                      type="time"
                      className="input"
                      value={drawnSlot.heureFin}
                      onChange={(e) => setDrawnSlot({ ...drawnSlot, heureFin: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Saisie rapide d’intervalle au clavier (optionnel)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Tapez ex: 08:30-11:30, 14h-17h, matin, aprem puis Entrée"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const parsed = parseTimeIntervalInput(e.currentTarget.value);
                        if (parsed) {
                          setDrawnSlot({
                            ...drawnSlot,
                            heureDebut: parsed.heureDebut,
                            heureFin: parsed.heureFin,
                          });
                          toast.success(`Intervalle appliqué : ${parsed.heureDebut} - ${parsed.heureFin}`);
                        }
                      }
                    }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Type d’affectation</label>
                  <select
                    className="select"
                    value={quickSlotForm.sourceType}
                    onChange={(e) =>
                      setQuickSlotForm({
                        ...quickSlotForm,
                        sourceType: e.target.value as any,
                      })
                    }
                  >
                    {backlogInterventions.length > 0 && (
                      <option value="existing_backlog">
                        📥 Placer une mission en attente du bac ({backlogInterventions.length})
                      </option>
                    )}
                    <option value="new_visite">🟣 Nouvelle Visite technique pour Devis</option>
                    <option value="new_intervention">🔵 Nouvelle Intervention Travaux / Dépannage</option>
                  </select>
                </div>

                {quickSlotForm.sourceType === 'existing_backlog' && backlogInterventions.length > 0 ? (
                  <div className="form-group">
                    <label className="form-label">Mission à affecter</label>
                    <select
                      className="select"
                      value={quickSlotForm.backlogItemId}
                      onChange={(e) =>
                        setQuickSlotForm({ ...quickSlotForm, backlogItemId: e.target.value })
                      }
                    >
                      {backlogInterventions.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.reference} — {b.client || ''} ({b.chantier})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
                    <div className="form-row-2">
                      <div className="form-group">
                        <label className="form-label">Client (Donneur d’ordre)</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="Ex: EMALEC, GMS, C-Multi-Serv..."
                          value={quickSlotForm.client}
                          onChange={(e) =>
                            setQuickSlotForm({ ...quickSlotForm, client: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Site / Adresse</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="Ex: Agence Orléans Centre"
                          value={quickSlotForm.chantier}
                          onChange={(e) =>
                            setQuickSlotForm({ ...quickSlotForm, chantier: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Objet de la visite / intervention</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="Ex: Relevé côtes armoire électrique / Dépannage CVC"
                        value={quickSlotForm.objet}
                        onChange={(e) =>
                          setQuickSlotForm({ ...quickSlotForm, objet: e.target.value })
                        }
                      />
                    </div>
                    <div className="form-row-2">
                      <div className="form-group">
                        <label className="form-label">Corps d’état</label>
                        <select
                          className="select"
                          value={quickSlotForm.corpsEtat}
                          onChange={(e) =>
                            setQuickSlotForm({ ...quickSlotForm, corpsEtat: e.target.value })
                          }
                        >
                          {corpsEtatList.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Priorité</label>
                        <select
                          className="select"
                          value={quickSlotForm.priorite}
                          onChange={(e) =>
                            setQuickSlotForm({ ...quickSlotForm, priorite: e.target.value })
                          }
                        >
                          <option value="Basse">Basse</option>
                          <option value="Normale">Normale</option>
                          <option value="Haute">Haute</option>
                          <option value="Urgente">Urgente</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setDrawnSlot(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Enregistrer sur le planning
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
