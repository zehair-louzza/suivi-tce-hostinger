import React, { useState } from 'react';
import { Clock, MapPin, Camera, CheckCircle2, Phone, Navigation, ChevronRight, Home, LogOut, User, FileText, Image as ImageIcon, PlayCircle, Pause, Square, AlertTriangle, History, Wrench, ArrowLeft, Upload, Signal, Battery, Wifi } from 'lucide-react';
import { useMock, useToast, Logo, Btn, Avatar, Pill, StatusPill, Modal, Field, Input, Checkbox, IconBtn } from '../ui';
import { INTERVENTIONS, CLIENT_BY_ID, TECH_BY_ID, TECHS, ME, hhmm, eur } from '../../data/sample';

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
    <Modal open={open} onClose={onClose} icon={MapPin} title="Clôturer avec la position GPS" subtitle="Nous enregistrons votre position actuelle comme preuve d’exécution." width={420} testid="mock-gps-modal"
      footer={<><Btn variant="ghost" onClick={onClose} data-testid="mock-gps-cancel">Annuler</Btn><Btn variant="primary" icon={CheckCircle2} onClick={onConfirm} data-testid="mock-gps-confirm">Clôturer l’intervention</Btn></>}>
      <div className="t-gps-map" aria-hidden="true">
        <div className="t-gps-pin"><MapPin size={22} /></div>
        <span className="t-gps-accuracy">± {precision} m</span>
      </div>
      <div className="m-callout m-callout--note"><strong>Position verrouillée</strong><p style={{ margin: 0 }}>{mission.addr}<br />Lat 48.87260 · Lon 2.31650 · Précision ± {precision} m</p></div>
      <p className="m-muted m-small" style={{ margin: 0 }}>En confirmant, le rapport part automatiquement à l’équipe bureau pour validation.</p>
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

function HomeView({ onOpen, onStart, pointed, setPointed }) {
  const toast = useToast();
  const me = TECH_BY_ID[TECH_ID];
  const mine = INTERVENTIONS.filter((i) => i.tech === TECH_ID).slice(0, 3);
  const done = mine.filter((i) => ['Clôturée', 'Terminée — à valider'].includes(i.status)).length;
  return (
    <main className="t-main" data-testid="mock-terrain-home">
      <section className="t-welcome">
        <Avatar name={me.name} initials={me.initials} color={me.color} size={44} />
        <div>
          <strong>Bonjour {me.name}</strong>
          <span>Vendredi 6 novembre · 3 missions aujourd’hui</span>
        </div>
        {!pointed && <Btn variant="primary" size="sm" onClick={() => { setPointed(true); toast('Arrivée pointée à 10:36', 'success'); }} data-testid="mock-terrain-clockin">Pointer</Btn>}
        {pointed && <Pill tone="green">Pointé à 07:52</Pill>}
      </section>
      <section className="t-progress">
        <strong>{done}/3 missions terminées</strong>
        <div className="m-progress"><span className="m-progress-bar" style={{ width: `${(done / 3) * 100}%` }} /></div>
      </section>
      <h2 className="t-h2">Mes missions du jour</h2>
      <ul className="t-list" data-testid="mock-terrain-missions">
        {mine.map((m) => {
          const c = CLIENT_BY_ID[m.client];
          return (
            <li key={m.ref}>
              <button type="button" className="t-card" onClick={() => onOpen(m.ref)} data-testid={`mock-terrain-mission-${m.ref}`}>
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
              {m.status === 'Planifiée' && <Btn variant="primary" size="lg" icon={PlayCircle} block onClick={() => onStart(m.ref)} data-testid={`mock-terrain-start-${m.ref}`}>Commencer l’intervention</Btn>}
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
  const [photos, setPhotos] = useState([{ label: 'Avant — vue générale', done: true }, { label: 'Avant — détail', done: true }]);
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
          {photos.map((p, i) => <figure key={i} className={`t-photo t-photo--${i % 3}`}><ImageIcon size={18} /><figcaption>{p.label}</figcaption></figure>)}
          <button type="button" className="t-photo t-photo--add" onClick={() => addPhoto(`Pendant — étape ${photos.length - 1}`)} data-testid="mock-terrain-photo-add"><Camera size={22} /><span>Ajouter</span></button>
        </div>
      </div>
      <div className="t-mission-section">
        <div className="t-section-head"><strong><FileText size={14} /> Compte-rendu</strong></div>
        <textarea className="m-textarea" rows={3} placeholder="Travaux réalisés, matériel posé, mesures prises…" defaultValue="Remplacement du disjoncteur différentiel 63 A — test de déclenchement OK." data-testid="mock-terrain-report" />
      </div>
      <div className="t-actions" data-testid="mock-terrain-actions">
        {!running && <Btn variant="primary" size="lg" block icon={PlayCircle} onClick={() => setRunning(true)} data-testid="mock-terrain-begin">Démarrer sur site</Btn>}
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

function MapView() {
  return (
    <main className="t-main" data-testid="mock-terrain-mapview">
      <div className="t-map-wrap">
        <div className="t-map" aria-hidden="true">
          <div className="t-map-pin t-map-pin--me"><Avatar name="Anouar" initials="AN" color="#2563EB" size={28} /></div>
          <div className="t-map-pin t-map-pin--stop" style={{ top: '38%', left: '62%' }}>1</div>
          <div className="t-map-pin t-map-pin--stop" style={{ top: '60%', left: '76%' }}>2</div>
          <div className="t-map-pin t-map-pin--stop" style={{ top: '72%', left: '38%' }}>3</div>
        </div>
      </div>
      <h2 className="t-h2" style={{ marginTop: 14 }}>Ma tournée</h2>
      <ul className="t-list t-list--route" data-testid="mock-terrain-route">
        <li><span className="t-stop-num">1</span><div><strong>Presta maintenance</strong><span>8 rue de Penthièvre, 75008 · 09:00</span></div><Pill tone="indigo">En cours</Pill></li>
        <li><span className="t-stop-num">2</span><div><strong>Syndic Paris 08</strong><span>18 rue de Miromesnil · 13:30</span></div><Pill tone="blue">Suivant</Pill></li>
        <li><span className="t-stop-num">3</span><div><strong>Presta maintenance</strong><span>5 rue de Rome · 16:30</span></div><Pill tone="slate">Prévu</Pill></li>
      </ul>
    </main>
  );
}

function HistoryView() {
  const done = INTERVENTIONS.filter((i) => i.tech === TECH_ID && ['Clôturée', 'Terminée — à valider'].includes(i.status));
  return (
    <main className="t-main" data-testid="mock-terrain-history">
      <h2 className="t-h2">Mes interventions passées</h2>
      <ul className="t-list">
        {done.map((m) => (
          <li key={m.ref}>
            <div className="t-card">
              <div className="t-card-top"><span className="m-mono m-small">{m.ref}</span><StatusPill status={m.status} /></div>
              <strong>{CLIENT_BY_ID[m.client].name}</strong>
              <span className="t-card-objet">{m.objet}</span>
              <div className="t-card-foot"><span className="m-muted m-small">{m.date}</span><span className="m-mono m-small">{m.photos} photos</span></div>
            </div>
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
      <Btn variant="ghost" icon={LogOut} block onClick={() => go('connexion')} data-testid="mock-terrain-logout">Se déconnecter</Btn>
    </main>
  );
}

export default function Terrain() {
  const { isMobile } = useMock();
  const [tab, setTab] = useState('home');
  const [open, setOpen] = useState(null);
  const [pointed, setPointed] = useState(true);
  const [gps, setGps] = useState(false);
  const toast = useToast();
  const mission = open ? INTERVENTIONS.find((x) => x.ref === open) : null;

  if (!isMobile) {
    // Vue desktop : affiche l'app technicien dans un cadre + capture d'écran explicative
    return (
      <div className="m-page" data-testid="mock-screen-terrain-desk">
        <header className="m-page-head">
          <div className="m-page-titles">
            <span className="m-eyebrow">App terrain</span>
            <h1>Vue technicien</h1>
            <p>L’app est optimisée pour le téléphone des techniciens. Voici un aperçu.</p>
          </div>
        </header>
        <div className="t-preview">
          <div className="t-phone-frame">
            <div className="t-phone-inner">
              <StatusBar />
              <HomeView onOpen={(r) => setOpen(r)} onStart={(r) => setOpen(r)} pointed={pointed} setPointed={setPointed} />
              <nav className="t-bnav">
                <button type="button" className="is-active"><Home size={20} /><span>Missions</span></button>
                <button type="button"><Navigation size={20} /><span>Tournée</span></button>
                <button type="button"><History size={20} /><span>Historique</span></button>
                <button type="button"><User size={20} /><span>Profil</span></button>
              </nav>
            </div>
          </div>
          <aside className="t-notes">
            <h3>Différences majeures avec l’existant</h3>
            <ul>
              <li>Bouton principal <strong>dans la zone du pouce</strong>, aucune ligne qui déborde.</li>
              <li>Barre d’onglets dédiée <strong>technicien</strong> — plus de menu admin visible.</li>
              <li>Clôture GPS expliquée en une phrase et un seul bouton.</li>
              <li>Compte-rendu et photos avant / après alignés au workflow de terrain.</li>
              <li>Fonctionne aussi hors ligne : les photos remontent dès qu’il y a du réseau.</li>
            </ul>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="t-app" data-testid="mock-screen-terrain">
      <StatusBar />
      {open ? (
        <MissionView missionRef={open} onBack={() => setOpen(null)} onClose={() => setGps(true)} />
      ) : (
        <>
          <Header title={tab === 'home' ? `Bonjour ${TECH_BY_ID[TECH_ID].name.split(' ')[0]}` : tab === 'map' ? 'Ma tournée' : tab === 'hist' ? 'Historique' : 'Profil'} />
          {tab === 'home' && <HomeView onOpen={(r) => setOpen(r)} onStart={(r) => setOpen(r)} pointed={pointed} setPointed={setPointed} />}
          {tab === 'map' && <MapView />}
          {tab === 'hist' && <HistoryView />}
          {tab === 'prof' && <ProfileView />}
        </>
      )}
      <nav className="t-bnav" data-testid="mock-terrain-bnav">
        <button type="button" className={tab === 'home' ? 'is-active' : ''} onClick={() => { setTab('home'); setOpen(null); }} data-testid="mock-terrain-tab-home"><Home size={22} /><span>Missions</span></button>
        <button type="button" className={tab === 'map' ? 'is-active' : ''} onClick={() => { setTab('map'); setOpen(null); }} data-testid="mock-terrain-tab-map"><Navigation size={22} /><span>Tournée</span></button>
        <button type="button" className={tab === 'hist' ? 'is-active' : ''} onClick={() => { setTab('hist'); setOpen(null); }} data-testid="mock-terrain-tab-hist"><History size={22} /><span>Historique</span></button>
        <button type="button" className={tab === 'prof' ? 'is-active' : ''} onClick={() => { setTab('prof'); setOpen(null); }} data-testid="mock-terrain-tab-prof"><User size={22} /><span>Profil</span></button>
      </nav>
      <GpsModal open={gps} onClose={() => setGps(false)} onConfirm={() => { setGps(false); setOpen(null); toast('Intervention clôturée · rapport envoyé au bureau', 'success'); }} mission={mission} />
    </div>
  );
}
