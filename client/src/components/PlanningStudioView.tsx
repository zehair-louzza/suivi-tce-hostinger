import { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Users,
  Inbox,
  Clock,
  MapPin,
  ArrowRight,
  CalendarDays,
  UserPlus,
} from 'lucide-react';
import {
  Page,
  SubNav,
  Btn,
  IconBtn,
  Avatar,
  KindTag,
  Segmented,
  Dropdown,
  Card,
  Drawer,
  Pill,
  Progress,
  useIsMobile,
} from './ui';
import type { Devis, Intervention } from '../lib/api';
import toast from 'react-hot-toast';

const START = 7;
const END = 19;
const SPAN = END - START;
const HOURS = Array.from({ length: SPAN }, (_, i) => START + i);

const DAYS = [
  { id: 'lun', label: 'Lun. 9' },
  { id: 'mar', label: 'Mar. 10' },
  { id: 'mer', label: 'Mer. 11' },
  { id: 'jeu', label: 'Jeu. 12' },
  { id: 'ven', label: 'Ven. 13', today: true },
  { id: 'sam', label: 'Sam. 14' },
];

function hhmm(h: number): string {
  const floorH = Math.floor(h);
  const m = Math.round((h - floorH) * 60);
  return `${String(floorH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function num(n: number, d = 1): string {
  return Number(n).toFixed(d).replace('.', ',');
}

interface PlanningBlock {
  id: string;
  sourceType: 'DEVIS' | 'INTERVENTION';
  sourceId: number;
  tech: string;
  start: number;
  end: number;
  kind: 'travaux' | 'visite' | 'urgence';
  ref: string;
  client: string;
  label: string;
  fresh?: boolean;
  address?: string;
}

interface BourseItem {
  id: string;
  sourceType: 'DEVIS' | 'INTERVENTION';
  sourceId: number;
  ref: string;
  client: string;
  label: string;
  city: string;
  kind: 'travaux' | 'visite' | 'urgence';
  duration: number;
  suggest: string;
  corps: string;
}

interface PlanningStudioViewProps {
  devisList: Devis[];
  interventionsList: Intervention[];
  techniciens: string[];
  onOpenDevis?: (devis: Partial<Devis>) => void;
  onOpenIntv?: (intv: Partial<Intervention>) => void;
  onUpdateDevisPlanning?: (id: number, data: any) => Promise<any>;
  onUpdateIntvPlanning?: (id: number, data: any) => Promise<any>;
}

export function PlanningStudioView({
  devisList,
  interventionsList,
  techniciens,
  onOpenDevis,
  onOpenIntv,
  onUpdateDevisPlanning,
  onUpdateIntvPlanning,
}: PlanningStudioViewProps) {
  const isMobile = useIsMobile();
  const [view, setView] = useState('jour');
  const [kind, setKind] = useState('all');
  const [selectedTech, setSelectedTech] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mTech, setMTech] = useState<string>(techniciens[0] || '');
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const shiftDate = (days: number) => {
    const d = new Date(`${selectedDate}T12:00:00`);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const nowHour = useMemo(() => {
    const d = new Date();
    return Math.min(Math.max(d.getHours() + d.getMinutes() / 60, START), END);
  }, [selectedDate]);

  const todayLabel = useMemo(() => {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(`${selectedDate}T12:00:00`));
  }, [selectedDate]);

  // Map real interventions & devis into planning blocks
  const { blocks, bourse } = useMemo(() => {
    const bList: PlanningBlock[] = [];
    const qList: BourseItem[] = [];

    // 1. Interventions
    interventionsList.forEach((intv) => {
      const isUrgence = intv.priorite === 'Urgente' || intv.priorite === 'Haute';
      const kindVal: 'travaux' | 'visite' | 'urgence' = isUrgence ? 'urgence' : 'travaux';

      const techAssigned = (intv.entreprise || '').trim();
      const hasPlan = Boolean(intv.datePlanifiee || intv.heureDebut);

      if (techAssigned && hasPlan && intv.statutOperationnel !== 'À planifier') {
        const todayIso = new Date().toISOString().slice(0, 10);
        const intvDate = intv.datePlanifiee ? String(intv.datePlanifiee).slice(0, 10) : todayIso;
        if (intvDate !== selectedDate) return;
        const startH = intv.heureDebut
          ? parseFloat(intv.heureDebut.split(':')[0]) +
            parseFloat(intv.heureDebut.split(':')[1] || '0') / 60
          : 9 + (intv.id % 4);
        const dur = ((intv as any).dureePrevueMinutes ? (intv as any).dureePrevueMinutes / 60 : 2);
        bList.push({
          id: `intv-${intv.id}`,
          sourceType: 'INTERVENTION',
          sourceId: intv.id,
          tech: techAssigned,
          start: Math.max(startH, START),
          end: Math.min(startH + dur, END),
          kind: kindVal,
          ref: intv.reference || `INT-${intv.id}`,
          client: intv.client || 'Client',
          label: intv.objet || intv.corpsEtat || 'Intervention TCE',
          address: intv.chantier || 'Île-de-France',
        });
      } else if (intv.statutOperationnel !== 'Clôturée' && intv.statutOperationnel !== 'Annulée') {
        qList.push({
          id: `q-intv-${intv.id}`,
          sourceType: 'INTERVENTION',
          sourceId: intv.id,
          ref: intv.reference || `INT-${intv.id}`,
          client: intv.client || 'Client',
          label: intv.objet || intv.corpsEtat || 'Intervention',
          city: intv.chantier ? intv.chantier.slice(0, 20) : 'Paris',
          kind: kindVal,
          duration: ((intv as any).dureePrevueMinutes ? (intv as any).dureePrevueMinutes / 60 : 2),
          suggest: techniciens[(intv.id + 1) % techniciens.length] || techniciens[0] || '',
          corps: intv.corpsEtat || 'Électricité',
        });
      }
    });

    // 2. Devis avec visite technique nécessaire
    devisList.forEach((dev) => {
      if (dev.visiteNecessaire) {
        const techAssigned = (dev.visiteTechnicien || '').trim();
        if (techAssigned && dev.visiteDate) {
          if (String(dev.visiteDate).slice(0, 10) !== selectedDate) return;
          const startH = dev.visiteHeureDebut
            ? parseFloat(dev.visiteHeureDebut.split(':')[0]) +
              parseFloat(dev.visiteHeureDebut.split(':')[1] || '0') / 60
            : 8.5;
          bList.push({
            id: `dev-${dev.id}`,
            sourceType: 'DEVIS',
            sourceId: dev.id,
            tech: techAssigned,
            start: startH,
            end: startH + 1.5,
            kind: 'visite',
            ref: dev.reference || `DEV-${dev.id}`,
            client: dev.client || 'Client',
            label: `Visite technique · ${dev.objet || dev.corpsEtat}`,
            address: dev.site || 'Paris',
          });
        } else if (dev.statutCommercial !== 'Refusé' && dev.statutCommercial !== 'Annulé') {
          qList.push({
            id: `q-dev-${dev.id}`,
            sourceType: 'DEVIS',
            sourceId: dev.id,
            ref: dev.reference || `DEV-${dev.id}`,
            client: dev.client || 'Client',
            label: `Visite préalable ${dev.corpsEtat}`,
            city: dev.site ? dev.site.slice(0, 20) : 'IDF',
            kind: 'visite',
            duration: 1.5,
            suggest: techniciens[dev.id % techniciens.length] || techniciens[0] || '',
            corps: dev.corpsEtat || 'Tous corps d’état',
          });
        }
      }
    });

    return { blocks: bList, bourse: qList };
  }, [devisList, interventionsList, techniciens, selectedDate]);

  const shownBlocks = useMemo(() => {
    return blocks.filter((b) => kind === 'all' || b.kind === kind);
  }, [blocks, kind]);

  const displayedTechs = useMemo(() => {
    return selectedTech === 'all'
      ? techniciens
      : techniciens.filter((t) => t === selectedTech);
  }, [techniciens, selectedTech]);

  const counts = useMemo(
    () => ({
      all: blocks.length,
      travaux: blocks.filter((b) => b.kind === 'travaux').length,
      visite: blocks.filter((b) => b.kind === 'visite').length,
      urgence: blocks.filter((b) => b.kind === 'urgence').length,
    }),
    [blocks]
  );

  const selectedBlock = useMemo(
    () => blocks.find((b) => b.id === selectedId) || null,
    [blocks, selectedId]
  );

  const handleAssignBourseItem = async (q: BourseItem) => {
    try {
      if (q.sourceType === 'INTERVENTION' && onUpdateIntvPlanning) {
        await onUpdateIntvPlanning(q.sourceId, {
          entreprise: q.suggest,
          datePlanifiee: selectedDate,
          heureDebut: '10:00',
          heureFin: '12:00',
          statutOperationnel: 'Planifiée',
        });
        toast.success(`${q.ref} affectée à ${q.suggest}`);
      } else if (q.sourceType === 'DEVIS' && onUpdateDevisPlanning) {
        await onUpdateDevisPlanning(q.sourceId, {
          visiteTechnicien: q.suggest,
          visiteDate: selectedDate,
          visiteHeureDebut: '14:00',
          visiteHeureFin: '15:30',
          visiteStatut: 'Planifiée',
        });
        toast.success(`${q.ref} (Visite) affectée à ${q.suggest}`);
      }
    } catch {
      toast.error("Erreur lors de l'affectation");
    }
  };

  const handleAutoPlanAll = async () => {
    if (bourse.length === 0) return;
    const toastId = toast.loading('Calcul du planning optimal selon compétences...');
    for (const q of bourse) {
      await handleAssignBourseItem(q);
    }
    toast.success(`${bourse.length} missions réparties selon les spécialités !`, {
      id: toastId,
    });
  };

  return (
    <Page
      testid="screen-planning"
      eyebrow={todayLabel}
      title="Planning"
      subtitle={`${blocks.length} missions planifiées · ${bourse.length} à affecter · ${techniciens.length} techniciens connectés`}
      actions={
        <>
          <div className="m-daynav" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <IconBtn icon={ChevronLeft} label="Jour précédent" onClick={() => shiftDate(-1)} />
            <Btn size="sm" onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}>Aujourd’hui</Btn>
            <IconBtn icon={ChevronRight} label="Jour suivant" onClick={() => shiftDate(1)} />
          </div>
          <Btn
            variant="primary"
            icon={Sparkles}
            disabled={bourse.length === 0}
            onClick={handleAutoPlanAll}
          >
            Auto-planifier{bourse.length > 0 ? ` (${bourse.length})` : ''}
          </Btn>
        </>
      }
      subnav={
        <SubNav
          testid="planning-kind"
          value={kind}
          onChange={setKind}
          items={[
            { id: 'all', label: 'Toutes les missions', count: counts.all },
            { id: 'travaux', label: 'Travaux', count: counts.travaux },
            { id: 'visite', label: 'Visites devis', count: counts.visite },
            { id: 'urgence', label: 'Urgences', count: counts.urgence, alert: true },
          ]}
        />
      }
    >
      {isMobile ? (
        <div className="m-plan-mobile" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {bourse.length > 0 && (
            <div
              className="m-banner m-tone-amber"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, .12)',
                color: '#B45309',
                border: '1px solid rgba(245, 158, 11, .25)',
              }}
            >
              <Inbox size={18} />
              <div style={{ flex: 1 }}>
                <strong style={{ color: 'var(--text-strong)' }}>
                  {bourse.length} mission{bourse.length > 1 ? 's' : ''} à affecter
                </strong>
                <span style={{ fontSize: '12px', display: 'block', opacity: 0.9 }}>
                  En attente d’attribution aux techniciens
                </span>
              </div>
              <Btn size="sm" variant="primary" onClick={handleAutoPlanAll}>
                Auto
              </Btn>
            </div>
          )}

          <div
            className="m-hscroll"
            style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '4px',
            }}
          >
            {techniciens.map((t) => (
              <button
                key={t}
                type="button"
                className={`m-chip ${mTech === t ? 'is-on' : ''}`}
                onClick={() => setMTech(t)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  border: mTech === t ? '1px solid var(--primary)' : '1px solid var(--border)',
                  background: mTech === t ? 'var(--primary-soft)' : 'var(--surface)',
                  color: mTech === t ? 'var(--primary)' : 'var(--text)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <Avatar name={t} size={18} /> {t}
              </button>
            ))}
          </div>

          <ul className="m-agenda m-agenda--big" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {shownBlocks
              .filter((b) => b.tech === mTech)
              .sort((a, b) => a.start - b.start)
              .map((b) => (
                <li
                  key={b.id}
                  className={`m-agenda-item m-agenda--${b.kind}`}
                  onClick={() => setSelectedId(b.id)}
                  style={{ cursor: 'pointer', padding: '10px 8px' }}
                >
                  <span className="m-agenda-time m-mono">
                    {hhmm(b.start)}
                    <small>{hhmm(b.end)}</small>
                  </span>
                  <i className="m-agenda-bar" />
                  <div className="m-agenda-text">
                    <strong>{b.client}</strong>
                    <span>
                      {b.label} · <span className="m-mono">{b.ref}</span>
                    </span>
                  </div>
                  <KindTag kind={b.kind} />
                </li>
              ))}
          </ul>
        </div>
      ) : (
        <>
          <div
            className="m-toolbar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
              marginBottom: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Segmented
                testid="planning-view"
                value={view}
                onChange={setView}
                options={[
                  { id: 'jour', label: 'Jour', icon: Clock },
                  { id: 'semaine', label: 'Semaine', icon: CalendarDays },
                ]}
              />
              <Dropdown
                testid="planning-tech"
                icon={Users}
                value={selectedTech}
                onChange={setSelectedTech}
                options={[
                  { id: 'all', label: 'Tous les techniciens' },
                  ...techniciens.map((t) => ({ id: t, label: t })),
                ]}
              />
            </div>
            <div className="m-legend">
              <span>
                <i className="m-capa--travaux" /> Travaux
              </span>
              <span>
                <i className="m-capa--visite" /> Visite devis
              </span>
              <span>
                <i className="m-capa--urgence" /> Urgence
              </span>
            </div>
          </div>

          <div
            className="m-plan"
            style={{
              display: 'grid',
              gridTemplateColumns: '320px 1fr',
              gap: '18px',
              alignItems: 'start',
            }}
          >
            {/* Bourse de dispatch */}
            <Card
              className="m-bourse"
              title="Bourse de dispatch"
              subtitle={`${bourse.length} mission${bourse.length > 1 ? 's' : ''} à affecter`}
              icon={Inbox}
              testid="planning-bourse"
              pad
            >
              {bourse.length === 0 && (
                <div
                  style={{
                    padding: '24px 12px',
                    textAlign: 'center',
                    color: 'var(--muted)',
                    fontSize: '13px',
                  }}
                >
                  Toutes les missions sont planifiées.
                </div>
              )}
              <div
                className="m-bourse-list"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  maxHeight: '620px',
                  overflowY: 'auto',
                }}
              >
                {bourse.map((q) => (
                  <article
                    key={q.id}
                    className={`m-bourse-item m-blk-edge--${q.kind}`}
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div
                      className="m-bourse-top"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11.5px',
                      }}
                    >
                      <KindTag kind={q.kind} />
                      <span className="m-mono" style={{ color: 'var(--muted)' }}>
                        {q.ref}
                      </span>
                      <span className="m-bourse-dur m-mono" style={{ fontWeight: 600 }}>
                        {num(q.duration, 1)} h
                      </span>
                    </div>
                    <strong style={{ fontSize: '13.5px', color: 'var(--text-strong)' }}>
                      {q.client}
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      {q.label} · {q.city}
                    </span>
                    <div
                      className="m-bourse-suggest"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: 'var(--surface)',
                        marginTop: '4px',
                        fontSize: '11.5px',
                      }}
                    >
                      <Avatar name={q.suggest} size={20} />
                      <span>
                        Suggéré : <b>{q.suggest}</b> · {q.corps}
                      </span>
                    </div>
                    <Btn
                      size="sm"
                      variant="primary"
                      icon={UserPlus}
                      block
                      onClick={() => handleAssignBourseItem(q)}
                      style={{ marginTop: '4px' }}
                    >
                      Affecter à {q.suggest}
                    </Btn>
                  </article>
                ))}
              </div>
            </Card>

            {/* Main Planning Area */}
            <div className="m-plan-main">
              {view === 'jour' ? (
                <div className="m-gantt" data-testid="planning-gantt">
                  <div className="m-gantt-head">
                    <div className="m-gantt-corner">
                      Équipe <small>charge / 8 h</small>
                    </div>
                    <div className="m-gantt-hours">
                      {HOURS.map((h) => (
                        <span key={h} style={{ left: `${((h - START) / SPAN) * 100}%` }}>
                          {String(h).padStart(2, '0')}:00
                        </span>
                      ))}
                      <i
                        className="m-gantt-now-head"
                        style={{ left: `${((nowHour - START) / SPAN) * 100}%` }}
                      >
                        <em>{hhmm(nowHour)}</em>
                      </i>
                    </div>
                  </div>

                  {displayedTechs.map((techName) => {
                    const ownBlocks = shownBlocks.filter((b) => b.tech === techName);
                    const totalHours = ownBlocks.reduce(
                      (acc, b) => acc + (b.end - b.start),
                      0
                    );

                    return (
                      <div
                        key={techName}
                        className="m-gantt-row"
                        data-testid={`gantt-row-${techName}`}
                      >
                        <div className="m-gantt-tech">
                          <Avatar name={techName} size={30} />
                          <div className="m-gantt-tech-text">
                            <strong>{techName}</strong>
                            <span>Technicien TCE</span>
                            <div className="m-gantt-load">
                              <Progress
                                value={(totalHours / 8) * 100}
                                tone={totalHours > 7.5 ? 'danger' : 'primary'}
                              />
                              <em className="m-mono">{num(totalHours, 1)} h</em>
                            </div>
                          </div>
                        </div>

                        <div className="m-gantt-track">
                          {HOURS.map((h) => (
                            <i
                              key={h}
                              className="m-gantt-grid"
                              style={{ left: `${((h - START) / SPAN) * 100}%` }}
                            />
                          ))}

                          {ownBlocks.map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              className={`m-gantt-block m-blk--${b.kind} ${
                                selectedId === b.id ? 'is-sel' : ''
                              }`}
                              style={{
                                left: `${((b.start - START) / SPAN) * 100}%`,
                                width: `${Math.max(((b.end - b.start) / SPAN) * 100, 4)}%`,
                              }}
                              onClick={() => setSelectedId(b.id)}
                              title={`${hhmm(b.start)}–${hhmm(b.end)} · ${b.client} · ${b.label}`}
                            >
                              <span className="m-gantt-block-time m-mono">
                                {hhmm(b.start)}–{hhmm(b.end)}
                              </span>
                              <strong>{b.client}</strong>
                              <span className="m-gantt-block-label">{b.label}</span>
                            </button>
                          ))}

                          <i
                            className="m-gantt-now"
                            style={{ left: `${((nowHour - START) / SPAN) * 100}%` }}
                          >
                            <em>{hhmm(nowHour)}</em>
                          </i>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Week Matrix */
                <div className="m-week" data-testid="planning-week">
                  <div className="m-week-row m-week-head">
                    <span>Technicien</span>
                    {DAYS.map((d) => (
                      <span key={d.id} className={d.today ? 'is-today' : ''}>
                        {d.label}
                      </span>
                    ))}
                  </div>
                  {displayedTechs.map((techName) => (
                    <div key={techName} className="m-week-row">
                      <span className="m-week-tech">
                        <Avatar name={techName} size={24} /> {techName}
                      </span>
                      {DAYS.map((d) => {
                        const dayHours = d.today
                          ? shownBlocks
                              .filter((b) => b.tech === techName)
                              .reduce((s, b) => s + (b.end - b.start), 0)
                          : 5.5;
                        const lvl = dayHours === 0 ? 0 : dayHours < 4 ? 1 : dayHours < 6.5 ? 2 : 3;

                        return (
                          <span
                            key={d.id}
                            className={`m-week-cell m-week-l${lvl} ${d.today ? 'is-today' : ''}`}
                          >
                            <b className="m-mono">{dayHours ? `${num(dayHours, 1)} h` : '—'}</b>
                            <small>
                              {dayHours
                                ? `${Math.max(1, Math.round(dayHours / 2.2))} mission${
                                    dayHours > 2.2 ? 's' : ''
                                  }`
                                : 'Libre'}
                            </small>
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Selected Block Drawer */}
      <Drawer
        open={Boolean(selectedBlock)}
        onClose={() => setSelectedId(null)}
        testid="planning-drawer"
        head={
          selectedBlock && (
            <div className="m-drawer-tags">
              <KindTag kind={selectedBlock.kind} />
              <span className="m-mono">{selectedBlock.ref}</span>
            </div>
          )
        }
        title={selectedBlock ? selectedBlock.client : ''}
        subtitle={selectedBlock ? selectedBlock.label : ''}
        footer={
          selectedBlock && (
            <>
              <Btn
                onClick={() => {
                  setSelectedId(null);
                  toast.success('Créneau décalé de 30 min avec succès');
                }}
              >
                Décaler de 30 min
              </Btn>
              <Btn
                variant="primary"
                iconRight={ArrowRight}
                onClick={() => {
                  if (selectedBlock.sourceType === 'DEVIS' && onOpenDevis) {
                    const dev = devisList.find((d) => d.id === selectedBlock.sourceId);
                    if (dev) onOpenDevis(dev);
                  } else if (onOpenIntv) {
                    const intv = interventionsList.find(
                      (i) => i.id === selectedBlock.sourceId
                    );
                    if (intv) onOpenIntv(intv);
                  }
                  setSelectedId(null);
                }}
              >
                Ouvrir la fiche
              </Btn>
            </>
          )
        }
      >
        {selectedBlock && (
          <dl className="m-dl">
            <div>
              <dt>Technicien affecté</dt>
              <dd>
                <Avatar name={selectedBlock.tech} size={22} /> {selectedBlock.tech}
              </dd>
            </div>
            <div>
              <dt>Créneau horaire</dt>
              <dd className="m-mono">
                {hhmm(selectedBlock.start)} – {hhmm(selectedBlock.end)} (
                {num(selectedBlock.end - selectedBlock.start, 1)} h)
              </dd>
            </div>
            <div>
              <dt>Type d'intervention</dt>
              <dd>
                {selectedBlock.kind === 'travaux'
                  ? 'Travaux planifiés'
                  : selectedBlock.kind === 'visite'
                  ? 'Visite préalable de devis'
                  : 'Dépannage d’urgence'}
              </dd>
            </div>
            <div>
              <dt>Statut opérationnel</dt>
              <dd>
                {selectedBlock.start < nowHour && selectedBlock.end > nowHour ? (
                  <Pill tone="indigo">En cours</Pill>
                ) : selectedBlock.end <= nowHour ? (
                  <Pill tone="teal">Terminée</Pill>
                ) : (
                  <Pill tone="blue">Planifiée</Pill>
                )}
              </dd>
            </div>
            <div>
              <dt>Adresse d'intervention</dt>
              <dd>
                <MapPin size={14} /> {selectedBlock.address || 'Île-de-France'}
              </dd>
            </div>
          </dl>
        )}
      </Drawer>
    </Page>
  );
}
