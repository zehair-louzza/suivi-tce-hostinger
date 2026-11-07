import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Columns3, ExternalLink, Heart, PanelRightOpen, PanelRightClose, ChevronLeft, ChevronRight, Info, FileDown } from 'lucide-react';
import { DIRECTIONS, DIR_BY_ID } from '../data/directions';
import { ALL_SCREENS, SCREEN_BY_ID, mockUrl } from '../data/screens';
import { BrandLink, DirectionSwitcher, DeviceToggle, ScreenPicker, PhoneFrame } from './Chrome';
import { useElementSize, useFavorite } from './hooks';

export default function Viewer() {
  const [params, setParams] = useSearchParams();
  const dir = DIR_BY_ID[params.get('dir')] ? params.get('dir') : 'atlas';
  const screen = SCREEN_BY_ID[params.get('screen')] ? params.get('screen') : 'tableau-de-bord';
  const device = params.get('device') === 'mobile' ? 'mobile' : 'desktop';
  const [src, setSrc] = useState(() => mockUrl(dir, screen));
  const [notes, setNotes] = useState(device === 'mobile');
  const [fav, toggleFav] = useFavorite();
  const [stageRef, stage] = useElementSize();
  const d = DIR_BY_ID[dir];
  const s = SCREEN_BY_ID[screen];

  const go = useCallback((next) => {
    const p = { dir, screen, device, ...next };
    setParams(p, { replace: false });
    if (next.dir || next.screen) setSrc(mockUrl(p.dir, p.screen));
  }, [dir, screen, device, setParams]);

  // Synchronise la barre d'outils lorsque l'on navigue à l'intérieur de la maquette
  useEffect(() => {
    const onMsg = (e) => {
      if (!e.data || e.data.type !== 'anelec-mock-nav') return;
      if (e.data.screen && e.data.screen !== screen && !SCREEN_BY_ID[screen]?.target) {
        setParams({ dir, screen: e.data.screen, device }, { replace: true });
      } else if (e.data.screen && SCREEN_BY_ID[screen]?.target && e.data.screen !== SCREEN_BY_ID[screen].target) {
        setParams({ dir, screen: e.data.screen, device }, { replace: true });
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [dir, screen, device, setParams]);

  // Raccourcis clavier : flèches gauche/droite = direction
  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      const i = DIRECTIONS.findIndex((x) => x.id === dir);
      if (e.key === 'ArrowRight') go({ dir: DIRECTIONS[(i + 1) % 5].id });
      if (e.key === 'ArrowLeft') go({ dir: DIRECTIONS[(i + 4) % 5].id });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dir, go]);

  const phoneScale = useMemo(() => {
    if (!stage.h) return 0.85;
    return Math.min(1, (stage.h - 32) / 868, (stage.w - 32) / 414);
  }, [stage]);

  const sIdx = ALL_SCREENS.findIndex((x) => x.id === screen);
  const prevScreen = ALL_SCREENS[(sIdx - 1 + ALL_SCREENS.length) % ALL_SCREENS.length];
  const nextScreen = ALL_SCREENS[(sIdx + 1) % ALL_SCREENS.length];

  return (
    <div className="g-viewer" data-testid="gallery-viewer">
      <header className="g-toolbar">
        <BrandLink />
        <div className="g-toolbar-mid">
          <DirectionSwitcher value={dir} onChange={(id) => go({ dir: id })} compact={stage.w && stage.w < 1180} />
          <div className="g-screen-nav">
            <button type="button" className="g-icon-btn" onClick={() => go({ screen: prevScreen.id })} title={`Précédent : ${prevScreen.label}`} data-testid="gallery-viewer-prev-screen"><ChevronLeft size={16} /></button>
            <ScreenPicker value={screen} onChange={(id) => go({ screen: id })} />
            <button type="button" className="g-icon-btn" onClick={() => go({ screen: nextScreen.id })} title={`Suivant : ${nextScreen.label}`} data-testid="gallery-viewer-next-screen"><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="g-toolbar-end">
          <DeviceToggle value={device} onChange={(v) => go({ device: v })} />
          <button type="button" className={`g-icon-btn ${fav === dir ? 'is-fav' : ''}`} onClick={() => toggleFav(dir)} title="Marquer cette direction comme préférée" data-testid="gallery-viewer-favorite-button">
            <Heart size={16} fill={fav === dir ? 'currentColor' : 'none'} />
          </button>
          <button type="button" className={`g-icon-btn ${notes ? 'is-on' : ''}`} onClick={() => setNotes((n) => !n)} title="Ce qui change sur cet écran" data-testid="gallery-viewer-notes-toggle">
            {notes ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>
          <Link to={`/compare?screen=${screen}&device=${device}`} className="g-btn g-btn--sm" data-testid="gallery-viewer-compare-button"><Columns3 size={15} /> <span className="g-hide-sm">Comparer</span></Link>
          <Link to="/dossier" className="g-icon-btn" title="Télécharger le dossier PDF" data-testid="gallery-viewer-dossier"><FileDown size={16} /></Link>
          <a href={src} target="_blank" rel="noreferrer" className="g-icon-btn" title="Ouvrir la maquette seule dans un nouvel onglet" data-testid="gallery-viewer-open-new-tab"><ExternalLink size={16} /></a>
        </div>
      </header>

      <div className="g-viewer-body">
        <div className={`g-stage g-stage--${device}`} ref={stageRef} data-testid="gallery-viewer-stage">
          {device === 'desktop' ? (
            <div className="g-desktop-frame">
              <div className="g-browser-bar"><span /><span /><span /><em>suivi.anelecgroupe.com · {d.name}</em></div>
              <iframe key={`desk-${dir}`} title={`${d.name} — ${s.label}`} src={src} data-testid="gallery-viewer-iframe" />
            </div>
          ) : (
            <PhoneFrame key={`mob-${dir}`} src={src} scale={phoneScale} title={`${d.name} — ${s.label}`} testid="gallery-viewer-phone" />
          )}
        </div>
        {notes && (
          <aside className="g-notes" data-testid="gallery-viewer-notes">
            <div className="g-notes-dir">
              <span className="g-dir-num" style={{ background: d.swatches[0], color: d.dark ? '#06121F' : '#fff' }}>{d.num}</span>
              <div>
                <strong>{d.name}</strong>
                <small>{d.mood}</small>
              </div>
            </div>
            <div className="g-swatches g-swatches--sm">{d.swatches.map((c) => <span key={c} className="g-swatch" style={{ background: c }} />)}</div>
            <h4><Info size={14} /> Ce qui change sur « {s.label} »</h4>
            <ul className="g-notes-list">{s.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            <h4>Signature de la direction</h4>
            <dl className="g-notes-meta">
              <div><dt>Navigation</dt><dd>{device === 'mobile' ? d.navMobile : d.nav}</dd></div>
              <div><dt>Typographie</dt><dd>{d.fonts.display} · {d.fonts.body}</dd></div>
              <div><dt>Densité</dt><dd>{d.density}</dd></div>
              <div><dt>Référence</dt><dd>{d.references}</dd></div>
            </dl>
            <p className="g-notes-tip">Astuce : les flèches ← → du clavier changent de direction. Tout est cliquable dans la maquette (menu, onglets, fiches, fenêtres).</p>
            <p className="g-notes-tip">Données d’exemple, aucune connexion à votre base.</p>
          </aside>
        )}
      </div>
    </div>
  );
}
