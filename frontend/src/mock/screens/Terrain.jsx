import React, { useState } from 'react';
import {
  Clock,
  MapPin,
  Camera,
  CheckCircle2,
  Phone,
  Navigation,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Home,
  LogOut,
  User,
  FileText,
  Image as ImageIcon,
  PlayCircle,
  Pause,
  Square,
  AlertTriangle,
  History,
  Wrench,
  ArrowLeft,
  Signal,
  Battery,
  Wifi,
} from 'lucide-react';
import { useMock, useToast, Logo, Btn, Avatar, Pill, StatusPill, Modal, IconBtn } from '../ui';
import { MapView as RealMap } from '../MapView';
import { INTERVENTIONS, CLIENT_BY_ID, TECH_BY_ID, hhmm, eur } from '../../data/sample';

const TECH_ID = 'anouar';

function StatusBar() {
  return (
    <div className="t-sbar" aria-hidden="true">
      <span>10:36</span>
      <span className="t-sbar-mid" />
      <Signal size={13} />
      <Wifi size={13} />
      <span className="t-sbar-bat"><Battery size={15} /> 78%</span>
    </div>
  );
}

function GpsModal({ open, onClose, onConfirm, mission }) {
  const [precision] = useState(6);
  if (!mission) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={MapPin}
      title="Clôturer avec la position GPS"
      subtitle="Nous enregistrons votre position actuelle comme preuve d’exécution."
      width={420}
      testid="mock-gps-modal"
      footer={(
        <>
          <Btn variant="ghost" onClick={onClose} data-testid="mock-gps-cancel">Annuler</Btn>
          <Btn variant="primary" icon={CheckCircle2} onClick={onConfirm} data-testid="mock-gps-confirm">Clôturer l’intervention</Btn>
        </>
      )}
    >
      <div className="t-gps-map" aria-hidden="true">
        <div className="t-gps-pin"><MapPin size={22} /></div>
        <span className="t-gps-accuracy">± {precision} m</span>
      </div>
      <div className="m-callout m-callout--note">
        <strong>Position verrouillée</strong>
        <p style={{ margin: 0 }}>
          {mission.addr}<br />Lat 48.87260 · Lon 2.31650 · Précision ± {precision} m
        </p>
      </div>
      <p className="m-muted m-small" style={{ margin: 0 }}>
        En confirmant, le rapport part automatiquement à l’équipe bureau pour validation.
      </p>
    </Modal>
  );
}

function Header({ title, onBack }) {
  return (
    <header className="t-head">
      {onBack ? <IconBtn icon={ArrowLeft} label="Retour" onClick={onBack} data-testid="mock-terrain-back" /> : <Logo compact />}
      <h1>{title}</h1>
      <span className="t-head-time"><Clock size={14} /> 10:36</span>
    </header>
  );
}

function HomeView({
  onOpen,
  onStart,
  pointageStatus,
  setPointageStatus,
  selectedMonth,
  setSelectedMonth,
  selectedDate,
  setSelectedDate,
}) {
  const toast = useToast();
  const me = TECH_BY_ID[TECH_ID];
  const mine = INTERVENTIONS.filter((i) => i.tech === TECH_ID).slice(0, 3);
  const done = mine.filter((i) => ['Clôturée', 'Terminée — à valider'].includes(i.status)).length;

  const weekDays = [
    { label: 'Lun', num: '02', date: '2026-11-02', count: 2 },
    { label: 'Mar', num: '03', date: '2026-11-03', count: 3 },
    { label: 'Mer', num: '04', date: '2026-11-04', count: 1 },
    { label: 'Jeu', num: '05', date: '2026-11-05', count: 4 },
    { label: 'Ven', num: '06', date: '2026-11-06', count: 3, isToday: true },
    { label: 'Sam', num: '07', date: '2026-11-07', count: 0 },
    { label: 'Dim', num: '08', date: '2026-11-08', count: 0 },
  ];

  return (
    <main className="t-main" data-testid="mock-terrain-home">
      {/* 1. Pointage : Commencer la journée / Finir la journée */}
      <section className="t-welcome">
        <Avatar name={me.name} initials={me.initials} color={me.color} size={44} />
        <div>
          <strong>Bonjour {me.name}</strong>
          <span>Vendredi 6 novembre · 3 missions aujourd’hui</span>
        </div>
        <div className="t-welcome-actions">
          {pointageStatus === 'idle' && (
            <Btn
              variant="primary"
              size="sm"
              icon={PlayCircle}
              onClick={() => {
                setPointageStatus('started');
                toast('Journée commencée à 07:52', 'success');
              }}
              data-testid="mock-terrain-clockin"
            >
              Commencer la journée
            </Btn>
          )}
          {pointageStatus === 'started' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Pill tone="green">Pointé à 07:52</Pill>
              <Btn
                variant="danger"
                size="sm"
                icon={Square}
                onClick={() => {
                  setPointageStatus('ended');
                  toast('Journée terminée à 17:30', 'info');
                }}
                data-testid="mock-terrain-clockout"
              >
                Finir la journée
              </Btn>
            </div>
          )}
          {pointageStatus === 'ended' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Pill tone="slate">Journée terminée</Pill>
              <Btn
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPointageStatus('started');
                  toast('Journée reprise', 'info');
                }}
              >
                Reprendre
              </Btn>
            </div>
          )}
        </div>
      </section>

      {/* 2. Filtre Mois & Choix des jours de la semaine */}
      <section className="t-date-picker" data-testid="mock-terrain-date-picker">
        <div className="t-month-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={15} style={{ color: 'var(--muted)' }} />
            <select
              className="t-month-select"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setSelectedDate(`${e.target.value}-06`);
                toast(`Mois filtré : ${e.target.value}`, 'info');
              }}
              aria-label="Filtre mois"
            >
              <option value="2026-10">Octobre 2026</option>
              <option value="2026-11">Novembre 2026</option>
              <option value="2026-12">Décembre 2026</option>
              <option value="2027-01">Janvier 2027</option>
            </select>
          </div>
          <div className="t-month-nav">
            <button
              type="button"
              className="m-icon-btn"
              onClick={() => toast('Semaine précédente', 'info')}
              title="Semaine précédente"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              className="m-btn m-btn--xs"
              onClick={() => {
                setSelectedMonth('2026-11');
                setSelectedDate('2026-11-06');
                toast('Retour à aujourd’hui', 'info');
              }}
            >
              Aujourd’hui
            </button>
            <button
              type="button"
              className="m-icon-btn"
              onClick={() => toast('Semaine suivante', 'info')}
              title="Semaine suivante"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="t-week-strip" role="radiogroup" aria-label="Jours de la semaine">
          {weekDays.map((d) => {
            const active = selectedDate === d.date;
            return (
              <button
                key={d.date}
                type="button"
                className={`t-day-btn ${active ? 'is-active' : ''} ${d.isToday ? 'is-today' : ''}`}
                onClick={() => {
                  setSelectedDate(d.date);
                  toast(`${d.label} ${d.num} sélectionné (${d.count} mission${d.count > 1 ? 's' : ''})`, 'info');
                }}
                aria-pressed={active}
              >
                <span>{d.label}</span>
                <strong className="t-day-num">{d.num}</strong>
                <span className="t-day-count">{d.count > 0 ? `${d.count} m.` : '–'}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Progression */}
      <section className="t-progress">
        <strong>{done}/3 missions terminées</strong>
        <div className="m-progress">
          <span className="m-progress-bar" style={{ width: `${(done / 3) * 100}%` }} />
        </div>
      </section>

      {/* 4. Missions du jour */}
      <h2 className="t-h2">Mes missions du jour</h2>
      <ul className="t-list" data-testid="mock-terrain-missions">
        {mine.map((m) => {
          const c = CLIENT_BY_ID[m.client];
          return (
            <li key={m.ref}>
              <button
                type="button"
                className="t-card"
                onClick={() => onOpen(m.ref)}
                data-testid={`mock-terrain-mission-${m.ref}`}
              >
                <div className="t-card-top">
                  <span className="m-mono m-small">{hhmm(m.start)}</span>
                  <StatusPill status={m.status} />
                </div>
                <strong>{c.name}</strong>
                <span className="t-card-objet">{m.corps} · {m.objet}</span>
                <div className="t-card-foot">
                  <span className="t-card-addr"><MapPin size={13} /> {m.addr.split(',')[0]}</span>
                  <ChevronRight size={16} />
                </div>
              </button>
              {m.status === 'Planifiée' && (
                <Btn
                  variant="primary"
                  size="lg"
                  icon={PlayCircle}
                  block
                  onClick={() => onStart(m.ref)}
                  data-testid={`mock-terrain-start-${m.ref}`}
                >
                  Commencer l’intervention
                </Btn>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}

function MissionView({ missionRef, onBack, onClose }) {
  const toast = useToast();
  const m = INTERVENTIONS.find((x) => x.ref === missionRef);
  const c = CLIENT_BY_ID[m.client];
  const [photos, setPhotos] = useState([
    { label: 'Avant — vue générale', done: true },
    { label: 'Avant — détail', done: true },
  ]);
  const [running, setRunning] = useState(m.status === 'En cours');
  const addPhoto = (kind) => {
    setPhotos((l) => [...l, { label: kind, done: true }]);
    toast(`Photo ajoutée : ${kind}`, 'success');
  };
  return (
    <main className="t-main t-main--mission" data-testid="mock-terrain-mission-detail">
      <Header title="Mission en cours" onBack={onBack} />
      <div className="t-mission-top">
        <span className="m-mono m-small">{m.ref}</span>
        <Pill tone={running ? 'indigo' : 'blue'}>{running ? 'En cours' : 'Planifiée'}</Pill>
      </div>
      <h2 className="t-mission-title">{c.name}</h2>
      <p className="t-mission-sub">{m.corps} · {m.objet}</p>
      <div className="t-mission-amounts">
        <div><span>Créneau</span><strong>{hhmm(m.start)}–{hhmm(m.end)}</strong></div>
        <div><span>Montant</span><strong>{eur(m.ht)}</strong></div>
        <div><span>Durée</span><strong>{(m.end - m.start).toFixed(1)} h</strong></div>
      </div>
      <div className="t-mission-section">
        <div className="t-section-head"><strong><MapPin size={14} /> Adresse</strong></div>
        <p className="t-addr">{m.addr}</p>
        <div className="t-row-actions">
          <Btn icon={Navigation} data-testid="mock-terrain-nav" onClick={() => toast('Ouverture de l’itinéraire…', 'info')}>Itinéraire</Btn>
          <Btn icon={Phone} onClick={() => toast(`Appel : ${c.phone}`)} data-testid="mock-terrain-call">Appeler</Btn>
        </div>
      </div>
      <div className="t-mission-section">
        <div className="t-section-head"><strong><AlertTriangle size={14} /> Consignes</strong></div>
        <p className="t-callout">{c.consignes}</p>
      </div>
      <div className="t-mission-section">
        <div className="t-section-head"><strong><Camera size={14} /> Photos avant / après</strong><span className="m-muted m-small">{photos.length} prises</span></div>
        <div className="t-photos">
          {photos.map((p, i) => (
            <figure key={i} className={`t-photo t-photo--${i % 3}`}>
              <ImageIcon size={18} />
              <figcaption>{p.label}</figcaption>
            </figure>
          ))}
          <button
            type="button"
            className="t-photo t-photo--add"
            onClick={() => addPhoto(`Pendant — étape ${photos.length - 1}`)}
            data-testid="mock-terrain-photo-add"
          >
            <Camera size={22} />
            <span>Ajouter</span>
          </button>
        </div>
      </div>
      <div className="t-mission-section">
        <div className="t-section-head"><strong><FileText size={14} /> Compte-rendu</strong></div>
        <textarea
          className="m-textarea"
          rows={3}
          placeholder="Travaux réalisés, matériel posé, mesures prises…"
          defaultValue="Remplacement du disjoncteur différentiel 63 A — test de déclenchement OK."
          data-testid="mock-terrain-report"
        />
      </div>
      <div className="t-actions" data-testid="mock-terrain-actions">
        {!running && (
          <Btn
            variant="primary"
            size="lg"
            block
            icon={PlayCircle}
            onClick={() => setRunning(true)}
            data-testid="mock-terrain-begin"
          >
            Démarrer sur site
          </Btn>
        )}
        {running && (
          <>
            <Btn variant="ghost" size="lg" icon={Pause} onClick={() => toast('Pause enregistrée', 'info')} data-testid="mock-terrain-pause">Pause</Btn>
            <Btn variant="primary" size="lg" block icon={CheckCircle2} onClick={onClose} data-testid="mock-terrain-finish">Clôturer avec GPS</Btn>
          </>
        )}
      </div>
    </main>
  );
}

function MapView({ onOpen }) {
  const stops = [
    { num: 1, title: 'Presta maintenance', addr: '8 rue de Penthièvre, 75008 · 09:00', status: 'En cours', tone: 'indigo', ref: 'INT-2026-001' },
    { num: 2, title: 'Syndic Paris 08', addr: '18 rue de Miromesnil · 13:30', status: 'Suivant', tone: 'blue', ref: 'INT-2026-002' },
    { num: 3, title: 'Presta maintenance', addr: '5 rue de Rome · 16:30', status: 'Prévu', tone: 'slate', ref: 'INT-2026-003' },
  ];

  return (
    <main className="t-main" data-testid="mock-terrain-mapview">
      <div
        className="t-map-wrap"
        style={{
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          border: '1px solid var(--border)',
          height: 280,
          position: 'relative',
        }}
      >
        <RealMap
          tiles="positron"
          center={[48.8745, 2.3160]}
          zoom={14}
          markers={[
            { type: 'tech', label: 'AN', pos: [48.8726, 2.3165], color: '#2563EB', popup: 'Anouar · En tournée' },
            { type: 'stop', label: '1', pos: [48.8752, 2.3120], color: '#2563EB', popup: '1. Presta maintenance · 8 rue de Penthièvre' },
            { type: 'stop', label: '2', pos: [48.8735, 2.3142], color: '#2563EB', popup: '2. Syndic Paris 08 · 18 rue de Miromesnil' },
            { type: 'stop', label: '3', pos: [48.8768, 2.3250], color: '#64748B', popup: '3. Presta maintenance · 5 rue de Rome' },
          ]}
          routes={[
            {
              points: [
                [48.8726, 2.3165],
                [48.8752, 2.3120],
                [48.8735, 2.3142],
                [48.8768, 2.3250],
              ],
              color: '#2563EB',
              dashed: true,
            },
          ]}
          hq={{ name: 'Siège ANELEC', addr: '9 rue de Penthièvre, 75008 Paris', pos: [48.8726, 2.3165] }}
          height="280px"
          interactive={true}
          testid="mock-terrain-leaflet-map"
        />
      </div>

      <h2 className="t-h2" style={{ marginTop: 14 }}>Ma tournée · 3 étapes</h2>
      <ul className="t-list t-list--route" data-testid="mock-terrain-route">
        {stops.map((s) => (
          <li key={s.num}>
            <button
              type="button"
              className="t-route-item"
              onClick={() => onOpen?.(s.ref)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '12px 14px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span
                className="t-stop-num"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: s.status === 'En cours' ? 'var(--primary)' : 'var(--text-strong)',
                  color: s.status === 'En cours' ? '#ffffff' : '#ffc107',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                {s.num}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: 14, color: 'var(--text-strong)', display: 'block' }}>{s.title}</strong>
                <span style={{ fontSize: 12.5, color: 'var(--muted)', display: 'block' }}>{s.addr}</span>
              </div>
              <Pill tone={s.tone}>{s.status}</Pill>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

function HistoryView({ onOpen }) {
  const done = INTERVENTIONS.filter((i) => i.tech === TECH_ID && ['Clôturée', 'Terminée — à valider'].includes(i.status));
  return (
    <main className="t-main" data-testid="mock-terrain-history">
      <h2 className="t-h2">Mes interventions passées</h2>
      <ul className="t-list">
        {done.map((m) => (
          <li key={m.ref}>
            <button
              type="button"
              className="t-card"
              onClick={() => onOpen?.(m.ref)}
              style={{ textAlign: 'left', cursor: 'pointer' }}
            >
              <div className="t-card-top">
                <span className="m-mono m-small">{m.ref}</span>
                <StatusPill status={m.status} />
              </div>
              <strong>{CLIENT_BY_ID[m.client].name}</strong>
              <span className="t-card-objet">{m.objet}</span>
              <div className="t-card-foot">
                <span className="m-muted m-small">{m.date}</span>
                <span className="m-mono m-small">{m.photos} photos</span>
              </div>
            </button>
          </li>
        ))}
        {!done.length && <li className="t-empty">Pas encore d’interventions terminées.</li>}
      </ul>
    </main>
  );
}

function ProfileView() {
  const { go } = useMock();
  const me = TECH_BY_ID[TECH_ID];
  return (
    <main className="t-main" data-testid="mock-terrain-profile">
      <section className="t-profile">
        <Avatar name={me.name} initials={me.initials} color={me.color} size={64} />
        <strong>{me.name}</strong>
        <span className="m-muted m-small">{me.skills.join(' · ')}</span>
      </section>
      <ul className="t-prof-list">
        <li><Clock size={16} /> Semaine : 36,8 h <span className="m-mono m-muted">(sur 35 h)</span></li>
        <li><Wrench size={16} /> Missions ce mois : 18</li>
        <li><Camera size={16} /> Photos envoyées : 94</li>
        <li><History size={16} /> Taux de clôture GPS : 100 %</li>
      </ul>
      <Btn variant="ghost" icon={LogOut} block onClick={() => go('connexion')} data-testid="mock-terrain-logout">
        Se déconnecter
      </Btn>
    </main>
  );
}

export default function Terrain() {
  const { isMobile } = useMock();
  const [tab, setTab] = useState('home');
  const [open, setOpen] = useState(null);
  const [pointageStatus, setPointageStatus] = useState('started');
  const [selectedMonth, setSelectedMonth] = useState('2026-11');
  const [selectedDate, setSelectedDate] = useState('2026-11-06');
  const [gps, setGps] = useState(false);
  const toast = useToast();
  const mission = open ? INTERVENTIONS.find((x) => x.ref === open) : null;

  const currentTitle =
    tab === 'home'
      ? `Bonjour ${TECH_BY_ID[TECH_ID].name.split(' ')[0]}`
      : tab === 'map'
      ? 'Ma tournée'
      : tab === 'hist'
      ? 'Historique'
      : 'Profil';

  const renderActiveScreen = () => {
    if (open) {
      return <MissionView missionRef={open} onBack={() => setOpen(null)} onClose={() => setGps(true)} />;
    }
    return (
      <>
        <Header title={currentTitle} />
        {tab === 'home' && (
          <HomeView
            onOpen={(r) => setOpen(r)}
            onStart={(r) => setOpen(r)}
            pointageStatus={pointageStatus}
            setPointageStatus={setPointageStatus}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        )}
        {tab === 'map' && <MapView onOpen={(r) => setOpen(r)} />}
        {tab === 'hist' && <HistoryView onOpen={(r) => setOpen(r)} />}
        {tab === 'prof' && <ProfileView />}
      </>
    );
  };

  const renderBottomNav = () => (
    <nav className="t-bnav" data-testid="mock-terrain-bnav">
      <button
        type="button"
        className={tab === 'home' && !open ? 'is-active' : ''}
        onClick={() => { setTab('home'); setOpen(null); }}
        data-testid="mock-terrain-tab-home"
      >
        <Home size={22} />
        <span>Missions</span>
      </button>
      <button
        type="button"
        className={tab === 'map' && !open ? 'is-active' : ''}
        onClick={() => { setTab('map'); setOpen(null); }}
        data-testid="mock-terrain-tab-map"
      >
        <Navigation size={22} />
        <span>Tournée</span>
      </button>
      <button
        type="button"
        className={tab === 'hist' && !open ? 'is-active' : ''}
        onClick={() => { setTab('hist'); setOpen(null); }}
        data-testid="mock-terrain-tab-hist"
      >
        <History size={22} />
        <span>Historique</span>
      </button>
      <button
        type="button"
        className={tab === 'prof' && !open ? 'is-active' : ''}
        onClick={() => { setTab('prof'); setOpen(null); }}
        data-testid="mock-terrain-tab-prof"
      >
        <User size={22} />
        <span>Profil</span>
      </button>
    </nav>
  );

  if (!isMobile) {
    // Vue desktop : affiche l'app technicien interactive dans le cadre smartphone avec explications
    return (
      <div className="m-page" data-testid="mock-screen-terrain-desk">
        <header className="m-page-head">
          <div className="m-page-titles">
            <span className="m-eyebrow">App terrain</span>
            <h1>Vue technicien</h1>
            <p>L’app est optimisée pour le téléphone des techniciens. Cliquez sur les onglets pour tester.</p>
          </div>
        </header>
        <div className="t-preview">
          <div className="t-phone-frame">
            <div className="t-phone-inner">
              <StatusBar />
              {renderActiveScreen()}
              {renderBottomNav()}
            </div>
          </div>
          <aside className="t-notes">
            <h3>Différences majeures avec l’existant</h3>
            <ul>
              <li>Boutons <strong>Commencer la journée</strong> et <strong>Finir la journée</strong> intégrés dans l'accueil.</li>
              <li>Filtre mois direct et sélection fluide des <strong>jours de la semaine</strong>.</li>
              <li>Deuxième onglet <strong>Tournée avec carte Leaflet temps réel</strong> et tracé d'itinéraire.</li>
              <li>Barre d’onglets dédiée <strong>technicien</strong> — plus de menu admin visible.</li>
              <li>Clôture GPS expliquée en une phrase et un seul bouton.</li>
              <li>Compte-rendu et photos avant / après alignés au workflow de terrain.</li>
            </ul>
          </aside>
        </div>
        <GpsModal
          open={gps}
          onClose={() => setGps(false)}
          onConfirm={() => {
            setGps(false);
            setOpen(null);
            toast('Intervention clôturée · rapport envoyé au bureau', 'success');
          }}
          mission={mission}
        />
      </div>
    );
  }

  return (
    <div className="t-app" data-testid="mock-screen-terrain">
      <StatusBar />
      {renderActiveScreen()}
      {renderBottomNav()}
      <GpsModal
        open={gps}
        onClose={() => setGps(false)}
        onConfirm={() => {
          setGps(false);
          setOpen(null);
          toast('Intervention clôturée · rapport envoyé au bureau', 'success');
        }}
        mission={mission}
      />
    </div>
  );
}
