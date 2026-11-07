import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Users, Inbox, Clock, MapPin, ArrowRight, CalendarDays, GripVertical, UserPlus } from 'lucide-react';
import { useMock, useToast, Page, SubNav, Btn, IconBtn, Avatar, KindTag, Segmented, Dropdown, Card, Drawer, Pill, Progress } from '../ui';
import { BLOCKS, BOURSE, TECHS, TECH_BY_ID, NOW_HOUR, hhmm, num, KIND_LABEL } from '../../data/sample';

const START = 7;
const END = 19;
const SPAN = END - START;
const HOURS = Array.from({ length: SPAN }, (_, i) => START + i);
const DAYS = [
  { id: 'lun', label: 'Lun. 2' }, { id: 'mar', label: 'Mar. 3' }, { id: 'mer', label: 'Mer. 4' },
  { id: 'jeu', label: 'Jeu. 5' }, { id: 'ven', label: 'Ven. 6', today: true }, { id: 'sam', label: 'Sam. 7' },
];

function freeSlot(blocks, tech, duration) {
  const own = blocks.filter((b) => b.tech === tech).sort((a, b) => a.start - b.start);
  let t = Math.max(11, Math.ceil(NOW_HOUR * 2) / 2);
  for (const b of own) {
    if (b.end <= t) continue;
    if (b.start - t >= duration) break;
    t = Math.max(t, b.end);
  }
  return t + duration <= END ? t : null;
}

function WeekMatrix({ blocks }) {
  const seed = [5.5, 7, 6, 8, 0, 3.5];
  return (
    <div className="m-week" data-testid="mock-planning-week">
      <div className="m-week-row m-week-head"><span>Technicien</span>{DAYS.map((d) => <span key={d.id} className={d.today ? 'is-today' : ''}>{d.label}</span>)}</div>
      {TECHS.map((t, ti) => (
        <div key={t.id} className="m-week-row">
          <span className="m-week-tech"><Avatar name={t.name} initials={t.initials} color={t.color} size={24} /> {t.name}</span>
          {DAYS.map((d, di) => {
            const h = d.today ? blocks.filter((b) => b.tech === t.id).reduce((s, b) => s + b.end - b.start, 0) : (seed[(ti + di) % seed.length] * (di === 5 ? 0.4 : 1));
            const lvl = h === 0 ? 0 : h < 4 ? 1 : h < 6.5 ? 2 : 3;
            return (
              <span key={d.id} className={`m-week-cell m-week-l${lvl} ${d.today ? 'is-today' : ''}`}>
                <b className="m-mono">{h ? `${num(h, 1)} h` : '—'}</b>
                <small>{h ? `${Math.max(1, Math.round(h / 2.4))} mission${h > 2.4 ? 's' : ''}` : 'Libre'}</small>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Gantt({ blocks, techs, onPick, selected }) {
  return (
    <div className="m-gantt" data-testid="mock-gantt">
      <div className="m-gantt-head">
        <div className="m-gantt-corner">Équipe <small>charge / 8 h</small></div>
        <div className="m-gantt-hours">
          {HOURS.map((h) => <span key={h} style={{ left: `${((h - START) / SPAN) * 100}%` }}>{String(h).padStart(2, '0')}:00</span>)}
          <i className="m-gantt-now-head" style={{ left: `${((NOW_HOUR - START) / SPAN) * 100}%` }}><em>{hhmm(NOW_HOUR)}</em></i>
        </div>
      </div>
      {techs.map((t) => {
        const own = blocks.filter((b) => b.tech === t.id);
        const load = own.reduce((s, b) => s + b.end - b.start, 0);
        return (
          <div key={t.id} className="m-gantt-row" data-testid={`mock-gantt-row-${t.id}`}>
            <div className="m-gantt-tech">
              <Avatar name={t.name} initials={t.initials} color={t.color} size={30} />
              <div className="m-gantt-tech-text">
                <strong>{t.name}</strong>
                <span>{t.skills.slice(0, 2).join(' · ')}{t.skills.length > 2 ? ` +${t.skills.length - 2}` : ''}</span>
                <div className="m-gantt-load"><Progress value={(load / 8) * 100} tone={load > 7.5 ? 'danger' : 'primary'} /><em className="m-mono">{num(load, 1)} h</em></div>
              </div>
            </div>
            <div className="m-gantt-track">
              {HOURS.map((h) => <i key={h} className="m-gantt-grid" style={{ left: `${((h - START) / SPAN) * 100}%` }} />)}
              {own.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={`m-gantt-block m-blk--${b.kind} ${selected === b.id ? 'is-sel' : ''} ${b.fresh ? 'is-fresh' : ''}`}
                  style={{ left: `${((b.start - START) / SPAN) * 100}%`, width: `${((b.end - b.start) / SPAN) * 100}%` }}
                  onClick={() => onPick(b)}
                  data-testid={`mock-gantt-block-${b.ref}`}
                  title={`${hhmm(b.start)}–${hhmm(b.end)} · ${b.client} · ${b.label}`}
                >
                  <span className="m-gantt-block-time m-mono">{hhmm(b.start)}–{hhmm(b.end)}</span>
                  <strong>{b.client}</strong>
                  <span className="m-gantt-block-label">{b.label}</span>
                </button>
              ))}
              <i className="m-gantt-now" style={{ left: `${((NOW_HOUR - START) / SPAN) * 100}%` }}><em>{hhmm(NOW_HOUR)}</em></i>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Bourse({ items, onAssign, compact }) {
  return (
    <Card className="m-bourse" title="Bourse de dispatch" subtitle={`${items.length} mission${items.length > 1 ? 's' : ''} à affecter`} icon={Inbox} testid="mock-bourse" pad>
      {items.length === 0 && <div className="m-empty">Toutes les missions sont planifiées.</div>}
      <div className="m-bourse-list">
        {items.map((q) => {
          const s = TECH_BY_ID[q.suggest];
          return (
            <article key={q.id} className={`m-bourse-item m-blk-edge--${q.kind}`} data-testid={`mock-bourse-item-${q.ref}`}>
              {!compact && <GripVertical size={14} className="m-bourse-grip" />}
              <div className="m-bourse-top"><KindTag kind={q.kind} /><span className="m-mono m-small">{q.ref}</span><span className="m-bourse-dur m-mono">{num(q.duration, 1)} h</span></div>
              <strong>{q.client}</strong>
              <span className="m-muted m-small">{q.label} · {q.city}</span>
              <div className="m-bourse-suggest">
                <Avatar name={s.name} initials={s.initials} color={s.color} size={20} />
                <span>Suggéré : <b>{s.name}</b> · {q.corps}</span>
              </div>
              <Btn size="sm" variant="primary" icon={UserPlus} block onClick={() => onAssign(q)} data-testid={`mock-bourse-assign-${q.ref}`}>Affecter à {s.name}</Btn>
            </article>
          );
        })}
      </div>
    </Card>
  );
}

export default function Planning() {
  const { isMobile, go } = useMock();
  const toast = useToast();
  const [blocks, setBlocks] = useState(BLOCKS);
  const [queue, setQueue] = useState(BOURSE);
  const [view, setView] = useState('jour');
  const [kind, setKind] = useState('all');
  const [tech, setTech] = useState('all');
  const [sel, setSel] = useState(null);
  const [mTech, setMTech] = useState('anouar');

  const assign = (q, silent) => {
    let ok = false;
    setBlocks((bs) => {
      const st = freeSlot(bs, q.suggest, q.duration);
      if (st == null) return bs;
      ok = true;
      return [...bs, { id: `n-${q.id}`, tech: q.suggest, start: st, end: st + q.duration, kind: q.kind, ref: q.ref, client: q.client, label: q.label, fresh: true }];
    });
    setQueue((l) => l.filter((x) => x.id !== q.id));
    if (!silent) toast(`${q.ref} affectée à ${TECH_BY_ID[q.suggest].name}`);
    return ok;
  };
  const autoPlan = () => {
    const n = queue.length;
    queue.forEach((q) => assign(q, true));
    toast(`${n} mission${n > 1 ? 's' : ''} planifiée${n > 1 ? 's' : ''} selon les compétences`);
  };

  const shown = useMemo(() => blocks.filter((b) => kind === 'all' || b.kind === kind), [blocks, kind]);
  const techs = tech === 'all' ? TECHS : TECHS.filter((t) => t.id === tech);
  const counts = { all: blocks.length, visite: blocks.filter((b) => b.kind === 'visite').length, travaux: blocks.filter((b) => b.kind === 'travaux').length, urgence: blocks.filter((b) => b.kind === 'urgence').length };
  const selBlock = blocks.find((b) => b.id === sel);

  return (
    <Page
      testid="mock-screen-planning"
      eyebrow="Vendredi 6 novembre 2026"
      title="Planning"
      subtitle={`${blocks.length} missions planifiées · ${queue.length} à affecter · 6 techniciens`}
      actions={(
        <>
          <div className="m-daynav">
            <IconBtn icon={ChevronLeft} label="Jour précédent" data-testid="mock-planning-prev" />
            <Btn size="sm" data-testid="mock-planning-today">Aujourd’hui</Btn>
            <IconBtn icon={ChevronRight} label="Jour suivant" data-testid="mock-planning-next" />
          </div>
          <Btn variant="primary" icon={Sparkles} disabled={!queue.length} onClick={autoPlan} data-testid="mock-planning-autoplan">Auto-planifier{queue.length ? ` (${queue.length})` : ''}</Btn>
        </>
      )}
      subnav={(
        <SubNav
          testid="mock-planning-kind"
          value={kind}
          onChange={setKind}
          items={[
            { id: 'all', label: 'Toutes les missions', count: counts.all },
            { id: 'travaux', label: 'Travaux', count: counts.travaux },
            { id: 'visite', label: 'Visites devis', count: counts.visite },
            { id: 'urgence', label: 'Urgences', count: counts.urgence, alert: true },
          ]}
        />
      )}
    >
      {isMobile ? (
        <div className="m-plan-mobile">
          {queue.length > 0 && (
            <div className="m-banner m-tone-amber" data-testid="mock-planning-mobile-queue">
              <Inbox size={18} />
              <div><strong>{queue.length} mission{queue.length > 1 ? 's' : ''} à affecter</strong><span>Dont 1 urgence · Presta maintenance</span></div>
              <Btn size="sm" variant="primary" onClick={autoPlan} data-testid="mock-planning-mobile-autoplan">Auto</Btn>
            </div>
          )}
          <div className="m-hscroll">
            {TECHS.map((t) => (
              <button key={t.id} type="button" className={`m-chip ${mTech === t.id ? 'is-on' : ''}`} onClick={() => setMTech(t.id)} data-testid={`mock-planning-mobile-tech-${t.id}`}>
                <Avatar name={t.name} initials={t.initials} color={t.color} size={20} /> {t.name}
              </button>
            ))}
          </div>
          <ul className="m-agenda m-agenda--big">
            {shown.filter((b) => b.tech === mTech).sort((a, b) => a.start - b.start).map((b) => (
              <li key={b.id} className={`m-agenda-item m-agenda--${b.kind}`} onClick={() => setSel(b.id)}>
                <span className="m-agenda-time m-mono">{hhmm(b.start)}<small>{hhmm(b.end)}</small></span>
                <i className="m-agenda-bar" />
                <div className="m-agenda-text"><strong>{b.client}</strong><span>{b.label} · <span className="m-mono">{b.ref}</span></span></div>
                <KindTag kind={b.kind} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <div className="m-toolbar">
            <Segmented testid="mock-planning-view" value={view} onChange={setView} options={[{ id: 'jour', label: 'Jour', icon: Clock }, { id: 'semaine', label: 'Semaine', icon: CalendarDays }]} />
            <Dropdown testid="mock-planning-tech" icon={Users} value={tech} onChange={setTech} options={[{ id: 'all', label: 'Tous les techniciens' }, ...TECHS.map((t) => ({ id: t.id, label: t.name }))]} />
            <div className="m-legend"><span><i className="m-capa--travaux" />Travaux</span><span><i className="m-capa--visite" />Visite devis</span><span><i className="m-capa--urgence" />Urgence</span></div>
          </div>
          <div className="m-plan">
            <Bourse items={queue} onAssign={(q) => assign(q)} />
            <div className="m-plan-main">
              {view === 'jour' ? <Gantt blocks={shown} techs={techs} onPick={(b) => setSel(b.id)} selected={sel} /> : <WeekMatrix blocks={blocks} />}
            </div>
          </div>
        </>
      )}
      <Drawer
        open={!!selBlock}
        onClose={() => setSel(null)}
        testid="mock-planning-drawer"
        head={selBlock && <div className="m-drawer-tags"><KindTag kind={selBlock.kind} /><span className="m-mono">{selBlock.ref}</span></div>}
        title={selBlock ? selBlock.client : ''}
        subtitle={selBlock ? selBlock.label : ''}
        footer={selBlock && (
          <>
            <Btn onClick={() => { setSel(null); toast('Créneau décalé de 30 min'); }} data-testid="mock-planning-shift">Décaler de 30 min</Btn>
            <Btn variant="primary" iconRight={ArrowRight} onClick={() => go(selBlock.ref.startsWith('DEV') ? 'devis' : 'interventions')} data-testid="mock-planning-open-fiche">Ouvrir la fiche</Btn>
          </>
        )}
      >
        {selBlock && (
          <dl className="m-dl">
            <div><dt>Technicien</dt><dd><Avatar name={TECH_BY_ID[selBlock.tech].name} initials={TECH_BY_ID[selBlock.tech].initials} color={TECH_BY_ID[selBlock.tech].color} size={22} /> {TECH_BY_ID[selBlock.tech].name}</dd></div>
            <div><dt>Créneau</dt><dd className="m-mono">{hhmm(selBlock.start)} – {hhmm(selBlock.end)} ({num(selBlock.end - selBlock.start, 1)} h)</dd></div>
            <div><dt>Type</dt><dd>{KIND_LABEL[selBlock.kind]}</dd></div>
            <div><dt>Statut</dt><dd>{selBlock.start < NOW_HOUR && selBlock.end > NOW_HOUR ? <Pill tone="indigo">En cours</Pill> : selBlock.end <= NOW_HOUR ? <Pill tone="teal">Terminée</Pill> : <Pill tone="blue">Planifiée</Pill>}</dd></div>
            <div><dt>Adresse</dt><dd><MapPin size={14} /> Île-de-France · voir la fiche</dd></div>
          </dl>
        )}
      </Drawer>
    </Page>
  );
}
