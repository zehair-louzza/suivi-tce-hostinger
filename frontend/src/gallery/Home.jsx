import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Columns3, Heart, AlertTriangle, CheckCircle2, Monitor, Smartphone, Layers, ShieldCheck, Type, LayoutPanelLeft, FileDown } from 'lucide-react';
import { DIRECTIONS } from '../data/directions';
import { SCREENS, MODAL_SCREENS, mockUrl } from '../data/screens';
import { AUDIT, PRINCIPLES } from '../data/audit';
import { BrandLink, ScaledDesktop } from './Chrome';
import { useElementWidth, useFavorite } from './hooks';

function DirectionCard({ d, fav, onFav }) {
  const [ref, w] = useElementWidth();
  return (
    <article className="g-dir-card" data-testid="gallery-direction-card" id={`direction-${d.id}`}>
      <div className="g-dir-info">
        <div className="g-dir-head">
          <span className="g-dir-num" style={{ background: d.swatches[0], color: d.dark ? '#06121F' : '#fff' }}>{d.num}</span>
          <div>
            <h3 data-testid={`gallery-direction-name-${d.id}`}>{d.name}</h3>
            <p className="g-dir-tagline">{d.tagline}</p>
          </div>
          <button type="button" className={`g-fav ${fav === d.id ? 'is-on' : ''}`} onClick={() => onFav(d.id)} title="Marquer comme préférée" data-testid={`gallery-direction-favorite-${d.id}`}>
            <Heart size={16} fill={fav === d.id ? 'currentColor' : 'none'} />
            <span>{fav === d.id ? 'Ma préférée' : 'Préférer'}</span>
          </button>
        </div>
        <p className="g-dir-for">{d.forWho}</p>
        <div className="g-swatches">
          {d.swatches.map((c) => (
            <span key={c} className="g-swatch" style={{ background: c }} title={c}><em>{c}</em></span>
          ))}
        </div>
        <dl className="g-dir-meta">
          <div><dt><Type size={14} /> Typographie</dt><dd><span style={{ fontFamily: d.fonts.display, fontWeight: 700 }}>{d.fonts.display}</span> / <span style={{ fontFamily: d.fonts.body }}>{d.fonts.body}</span></dd></div>
          <div><dt><LayoutPanelLeft size={14} /> Navigation</dt><dd>{d.nav}</dd></div>
          <div><dt><Smartphone size={14} /> Mobile</dt><dd>{d.navMobile}</dd></div>
          <div><dt><Layers size={14} /> Densité</dt><dd>{d.density} · {d.mood}</dd></div>
        </dl>
        <div className="g-proscons">
          <ul>{d.pros.map((p) => <li key={p}><CheckCircle2 size={14} /> {p}</li>)}</ul>
          <ul className="is-cons">{d.cons.map((p) => <li key={p}><AlertTriangle size={14} /> {p}</li>)}</ul>
        </div>
        <div className="g-dir-actions">
          <Link to={`/viewer?dir=${d.id}&screen=tableau-de-bord&device=desktop`} className="g-btn g-btn--primary" data-testid={`gallery-direction-open-${d.id}`}>
            Explorer cette direction <ArrowRight size={16} />
          </Link>
          <Link to={`/viewer?dir=${d.id}&screen=terrain&device=mobile`} className="g-btn" data-testid={`gallery-direction-mobile-${d.id}`}>
            <Smartphone size={15} /> Version mobile
          </Link>
        </div>
      </div>
      <Link to={`/viewer?dir=${d.id}&screen=tableau-de-bord&device=desktop`} className="g-dir-preview" ref={ref} data-testid={`gallery-direction-preview-${d.id}`}>
        <ScaledDesktop src={mockUrl(d.id, 'tableau-de-bord')} width={w} title={`Aperçu ${d.name}`} interactive={false} />
        <span className="g-dir-preview-cta">Ouvrir la maquette <ArrowRight size={14} /></span>
      </Link>
    </article>
  );
}

export default function Home() {
  const [fav, toggleFav] = useFavorite();
  const favDir = DIRECTIONS.find((d) => d.id === fav);
  return (
    <div className="g-page">
      <header className="g-top">
        <BrandLink />
        <nav className="g-top-nav">
          <a href="#audit" data-testid="gallery-nav-audit">Diagnostic</a>
          <a href="#directions" data-testid="gallery-nav-directions">Les 5 directions</a>
          <a href="#ecrans" data-testid="gallery-nav-screens">Écrans</a>
          <Link to="/compare?screen=tableau-de-bord&device=desktop" className="g-btn g-btn--sm" data-testid="gallery-nav-compare"><Columns3 size={15} /> Comparer</Link>
          <Link to="/dossier" className="g-btn g-btn--sm" data-testid="gallery-nav-dossier"><FileDown size={15} /> Dossier PDF</Link>
        </nav>
      </header>

      <section className="g-hero">
        <div className="g-hero-text">
          <span className="g-eyebrow">ANELEC GROUPE · Suivi TCE · Proposition de refonte</span>
          <h1>5 directions de design pour une plateforme plus professionnelle.</h1>
          <p>
            Votre application a été lue écran par écran. Voici un diagnostic d’expert puis cinq maquettes cliquables, chacune couvrant
            <strong> tous les écrans</strong> du site, sur <strong>ordinateur et mobile</strong>. Parcourez-les, comparez-les, marquez votre préférée.
          </p>
          <div className="g-hero-actions">
            <Link to="/viewer?dir=atlas&screen=tableau-de-bord&device=desktop" className="g-btn g-btn--primary g-btn--lg" data-testid="gallery-home-open-viewer-button">
              Ouvrir les maquettes <ArrowRight size={18} />
            </Link>
            <Link to="/compare?screen=tableau-de-bord&device=desktop" className="g-btn g-btn--lg" data-testid="gallery-home-open-compare-button">
              <Columns3 size={17} /> Comparer côte à côte
            </Link>
            <Link to="/dossier" className="g-btn g-btn--lg" data-testid="gallery-home-open-dossier-button">
              <FileDown size={17} /> Télécharger le dossier PDF
            </Link>
          </div>
          {favDir && (
            <p className="g-fav-note" data-testid="gallery-favorite-note"><Heart size={14} fill="currentColor" /> Votre préférée pour l’instant : <strong>{favDir.num}. {favDir.name}</strong></p>
          )}
        </div>
        <dl className="g-facts">
          <div><dt>5</dt><dd>directions distinctes</dd></div>
          <div><dt>13</dt><dd>écrans + 3 fenêtres</dd></div>
          <div><dt><Monitor size={22} /> <Smartphone size={22} /></dt><dd>ordinateur et mobile</dd></div>
          <div><dt>0</dt><dd>ligne modifiée dans votre site</dd></div>
        </dl>
      </section>

      <section className="g-section" id="audit" data-testid="gallery-audit-section">
        <div className="g-section-head">
          <span className="g-eyebrow">01 · Diagnostic</span>
          <h2>Ce qui freine aujourd’hui l’image professionnelle</h2>
          <p>Constats relevés dans le code (<code>client/src</code>) et les captures du dépôt. Chaque direction ci-dessous corrige l’ensemble de ces points.</p>
        </div>
        <div className="g-audit-grid">
          {AUDIT.map((a, i) => (
            <article key={a.title} className="g-audit" data-testid={`gallery-audit-item-${i}`}>
              <div className="g-audit-top">
                <span className={`g-sev g-sev--${a.sev === 'Élevé' ? 'high' : a.sev === 'Moyen' ? 'mid' : 'low'}`}>{a.sev}</span>
                <h3>{a.title}</h3>
              </div>
              <p>{a.what}</p>
              <p className="g-audit-fix"><CheckCircle2 size={15} /> {a.fix}</p>
            </article>
          ))}
        </div>
        <div className="g-principles">
          <h3><ShieldCheck size={18} /> Principes communs aux 5 directions</h3>
          <div className="g-principles-grid">
            {PRINCIPLES.map((p, i) => (
              <div key={p.title} className="g-principle">
                <span>{String(i + 1).padStart(2, '0')}</span>
                <strong>{p.title}</strong>
                <p>{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="g-section" id="directions">
        <div className="g-section-head">
          <span className="g-eyebrow">02 · Propositions</span>
          <h2>Les 5 directions de design</h2>
          <p>Mêmes fonctionnalités, mêmes données d’exemple : seules l’apparence, la navigation et l’ergonomie changent. L’aperçu ci-contre est la vraie maquette du tableau de bord.</p>
        </div>
        <div className="g-dir-list">
          {DIRECTIONS.map((d) => <DirectionCard key={d.id} d={d} fav={fav} onFav={toggleFav} />)}
        </div>
      </section>

      <section className="g-section" id="ecrans">
        <div className="g-section-head">
          <span className="g-eyebrow">03 · Inventaire</span>
          <h2>Tous les écrans maquettés</h2>
          <p>Cliquez sur un écran pour l’ouvrir directement dans votre direction préférée (ou la n°1 par défaut).</p>
        </div>
        <div className="g-screens-grid">
          {[...SCREENS, ...MODAL_SCREENS].map((s, i) => (
            <Link key={s.id} to={`/viewer?dir=${fav || 'atlas'}&screen=${s.id}&device=${s.id === 'terrain' || s.id === 'fenetre-gps' ? 'mobile' : 'desktop'}`} className="g-screen-tile" data-testid={`gallery-screen-tile-${s.id}`}>
              <span className="g-screen-idx">{String(i + 1).padStart(2, '0')}</span>
              <span className="g-screen-group">{s.group}</span>
              <strong>{s.label}</strong>
              <ArrowRight size={15} />
            </Link>
          ))}
        </div>
      </section>

      <footer className="g-footer">
        <p>Maquettes non connectées · données d’exemple uniquement. Le code de votre site (<code>client/</code>, <code>server/</code>) n’a pas été modifié ; cette galerie vit dans un dossier séparé (<code>frontend/</code>) supprimable à tout moment.</p>
      </footer>
    </div>
  );
}
