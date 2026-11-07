import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, CheckCircle2, AlertTriangle, Check, Type, LayoutPanelLeft, Smartphone, Layers, Monitor } from 'lucide-react';
import { DIRECTIONS } from '../data/directions';
import { AUDIT, PRINCIPLES } from '../data/audit';
import { SCREENS, mockUrl } from '../data/screens';
import { BrandLink } from './Chrome';

// Dimensions logiques A4 en px (CSS) — 816×1123 ≈ A4 à 96 dpi.
const PAGE_W = 816;
const PAGE_H = 1123;

/* Petites visualisations synthétiques (pas d'iframe, imprimables à coup sûr). */
function MiniAtlas({ d }) {
  return (
    <div className="dos-mini" data-variant={d.id}>
      <aside style={{ background: '#F3F4F8', borderRight: '1px solid #E5E7EB' }}>
        <span className="dos-mini-logo" style={{ background: '#fff' }} />
        <ul>
          <li className="is-active" style={{ background: 'rgba(29,78,216,.08)', color: '#1D4ED8' }}><i /> Tableau</li>
          <li><i /> Planning</li>
          <li><i /> Devis</li>
          <li><i /> Interv.</li>
          <li><i /> Carte</li>
        </ul>
      </aside>
      <main>
        <div className="dos-mini-top"><span className="dos-mini-pill" style={{ background: '#EEF0F6' }} /><span className="dos-mini-pill" style={{ background: '#EEF0F6', width: 44 }} /></div>
        <h5>Tableau de bord</h5>
        <div className="dos-mini-kpis">{[0, 1, 2, 3].map((i) => <div key={i} style={{ background: '#fff', border: '1px solid #E5E7EB' }}><b style={{ background: '#1D4ED8' }} /><span /><em /></div>)}</div>
        <div className="dos-mini-chart" style={{ background: '#fff', border: '1px solid #E5E7EB' }}><svg viewBox="0 0 120 40" preserveAspectRatio="none"><polyline points="0,32 20,28 40,24 60,18 80,14 100,10 120,6" fill="none" stroke="#1D4ED8" strokeWidth="2" /></svg></div>
      </main>
    </div>
  );
}
function MiniCraft() {
  return (
    <div className="dos-mini" data-variant="craft">
      <header style={{ background: '#FFFDF9', borderBottom: '1px solid #E7E0D6', padding: 10 }}>
        <span className="dos-mini-logo" style={{ background: '#F3EFE8', borderRadius: 999 }} />
        <div className="dos-mini-pillrow">
          <span className="dos-mini-pill is-active" style={{ background: '#0F766E', color: '#fff', borderRadius: 999 }}>Pilotage</span>
          <span className="dos-mini-pill" style={{ borderRadius: 999, background: '#F3EFE8' }}>Planning</span>
          <span className="dos-mini-pill" style={{ borderRadius: 999, background: '#F3EFE8' }}>Devis</span>
          <span className="dos-mini-pill" style={{ borderRadius: 999, background: '#F3EFE8' }}>Travaux</span>
        </div>
      </header>
      <main style={{ background: '#FAF7F2' }}>
        <h5 style={{ fontFamily: 'Merriweather Sans', fontWeight: 800 }}>Tableau de bord</h5>
        <div className="dos-mini-kpis">{[0, 1, 2, 3].map((i) => <div key={i} style={{ background: '#FFFDF9', border: '1px solid #E7E0D6', borderRadius: 18 }}><b style={{ background: '#0F766E' }} /><span /><em style={{ color: '#D97706' }} /></div>)}</div>
        <div className="dos-mini-chart" style={{ background: '#FFFDF9', border: '1px solid #E7E0D6', borderRadius: 16 }}><svg viewBox="0 0 120 40" preserveAspectRatio="none"><polyline points="0,32 20,28 40,24 60,18 80,14 100,10 120,6" fill="none" stroke="#0F766E" strokeWidth="2" /></svg></div>
      </main>
    </div>
  );
}
function MiniSignal() {
  return (
    <div className="dos-mini" data-variant="signal" style={{ background: '#0B1220' }}>
      <aside style={{ background: '#0F1A2E', borderRight: '1px solid #23364F', width: 38 }}>
        <span className="dos-mini-logo" style={{ background: '#13213A' }} />
        <ul>
          {['', '', '', '', ''].map((_, i) => (
            <li key={i} style={{ background: i === 0 ? 'rgba(56,189,248,.14)' : 'transparent', color: i === 0 ? '#38BDF8' : '#8EA4C8' }}>•</li>
          ))}
        </ul>
      </aside>
      <main style={{ background: '#0B1220' }}>
        <div className="dos-mini-top"><span className="dos-mini-pill" style={{ background: 'rgba(248,113,113,.14)', color: '#F87171' }}>EN DIRECT</span><span className="dos-mini-pill" style={{ background: '#13213A', width: 60 }} /></div>
        <h5 style={{ color: '#fff' }}>Planning · 10:36</h5>
        <div className="dos-mini-kpis">{[0, 1, 2, 3].map((i) => <div key={i} style={{ background: '#13213A', border: '1px solid #23364F' }}><b style={{ background: '#38BDF8' }} /><span style={{ background: '#2E4568' }} /><em /></div>)}</div>
        <div className="dos-mini-chart" style={{ background: '#13213A', border: '1px solid #23364F' }}><svg viewBox="0 0 120 40" preserveAspectRatio="none"><polyline points="0,32 20,28 40,24 60,18 80,14 100,10 120,6" fill="none" stroke="#38BDF8" strokeWidth="2" /></svg></div>
      </main>
    </div>
  );
}
function MiniSwiss() {
  return (
    <div className="dos-mini" data-variant="swiss" style={{ background: '#fff' }}>
      <header style={{ borderBottom: '2px solid #0B1220', padding: '12px 12px' }}>
        <span style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 13, color: '#0B1220' }}>ANELEC<b style={{ color: '#0B3B8F' }}>—</b>TCE</span>
        <div className="dos-mini-pillrow">
          {['PILOTAGE', 'PLANNING', 'DEVIS', 'TRAVAUX', 'CARTE'].map((t, i) => (
            <span key={t} className="dos-mini-pill" style={{ background: 'transparent', color: i === 0 ? '#0B3B8F' : '#6B6B68', borderBottom: i === 0 ? '2px solid #0B3B8F' : 0, borderRadius: 0, fontFamily: 'Manrope', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.08em', padding: '2px 6px' }}>{t}</span>
          ))}
        </div>
      </header>
      <main>
        <h5 style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 24, letterSpacing: '-0.02em', color: '#000' }}>Tableau de bord</h5>
        <div className="dos-mini-kpis">{[0, 1, 2, 3].map((i) => <div key={i} style={{ background: '#fff', border: '1px solid #0B1220', borderBottom: '3px solid #0B1220', borderRadius: 0 }}><b style={{ background: '#0B3B8F' }} /><span /><em /></div>)}</div>
        <div className="dos-mini-chart" style={{ background: '#fff', border: '1px solid #0B1220', borderRadius: 0 }}><svg viewBox="0 0 120 40" preserveAspectRatio="none"><polyline points="0,32 20,28 40,24 60,18 80,14 100,10 120,6" fill="none" stroke="#0B3B8F" strokeWidth="2" /></svg></div>
      </main>
    </div>
  );
}
function MiniBento() {
  return (
    <div className="dos-mini" data-variant="bento" style={{ background: '#F2F3F5' }}>
      <aside style={{ background: '#fff', border: '1px solid #E3E6EC', borderRadius: 18, margin: 6 }}>
        <span className="dos-mini-logo" style={{ background: '#F2F3F5' }} />
        <ul>
          <li className="is-active" style={{ background: '#111827', color: '#fff', borderRadius: 10 }}>Tableau</li>
          <li>Planning</li>
          <li>Devis</li>
          <li>Travaux</li>
        </ul>
      </aside>
      <main>
        <h5 style={{ fontFamily: 'Sora', fontWeight: 700, color: '#0B0F19' }}>Tableau de bord</h5>
        <div className="dos-mini-kpis">{[0, 1, 2, 3].map((i) => <div key={i} style={{ background: '#fff', border: '1px solid #E3E6EC', borderRadius: 18 }}><b style={{ background: i === 1 ? '#F5B400' : i === 2 ? '#16A34A' : i === 3 ? '#EF5B4C' : '#111827' }} /><span /><em /></div>)}</div>
        <div className="dos-mini-chart" style={{ background: '#fff', border: '1px solid #E3E6EC', borderRadius: 18 }}><svg viewBox="0 0 120 40" preserveAspectRatio="none"><polyline points="0,32 20,28 40,24 60,18 80,14 100,10 120,6" fill="none" stroke="#111827" strokeWidth="2.5" /></svg></div>
      </main>
    </div>
  );
}

const MINIS = { atlas: MiniAtlas, craft: MiniCraft, signal: MiniSignal, swiss: MiniSwiss, bento: MiniBento };

function MiniPhone({ d }) {
  return (
    <div className="dos-phone" style={{ background: d.dark ? '#0B1220' : '#fff', border: `1px solid ${d.dark ? '#23364F' : '#E5E7EB'}` }}>
      <div className="dos-phone-head" style={{ borderBottom: `1px solid ${d.dark ? '#23364F' : '#E5E7EB'}` }}>
        <span style={{ fontFamily: d.fonts.display, fontSize: 9, fontWeight: 700, color: d.dark ? '#fff' : '#0F172A' }}>{d.name.split(' ')[0]}</span>
      </div>
      <div className="dos-phone-body">
        <span className="dos-phone-card" style={{ background: d.dark ? '#13213A' : '#F7F8FB', border: `1px solid ${d.dark ? '#23364F' : '#E5E7EB'}` }} />
        <span className="dos-phone-card" style={{ background: d.dark ? '#13213A' : '#F7F8FB', border: `1px solid ${d.dark ? '#23364F' : '#E5E7EB'}` }} />
        <span className="dos-phone-card" style={{ background: d.dark ? '#13213A' : '#F7F8FB', border: `1px solid ${d.dark ? '#23364F' : '#E5E7EB'}` }} />
      </div>
      <div className="dos-phone-nav" style={{ background: d.dark ? '#13213A' : '#fff', borderTop: `1px solid ${d.dark ? '#23364F' : '#E5E7EB'}` }}>
        {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ background: i === 0 ? d.swatches[0] : d.dark ? '#637CA4' : '#CBD1DA', borderRadius: '50%', width: 5, height: 5 }} />)}
      </div>
    </div>
  );
}

function PageA4({ children, variant = 'light', last }) {
  return <section className={`dos-page dos-page--${variant} ${last ? 'is-last' : ''}`}>{children}</section>;
}

function Palette({ d }) {
  return (
    <div className="dos-palette">
      {d.swatches.map((c, i) => (
        <div key={c} className="dos-swatch">
          <span className="dos-swatch-color" style={{ background: c }} />
          <strong>{['Primaire', 'Accent', 'Encre', 'Fond', 'Signal'][i] || `Teinte ${i + 1}`}</strong>
          <code>{c}</code>
        </div>
      ))}
    </div>
  );
}

function Typo({ d }) {
  return (
    <div className="dos-typo">
      <div className="dos-typo-block">
        <span className="dos-typo-eyebrow">Titres · Display</span>
        <h3 style={{ fontFamily: d.fonts.display, fontWeight: 700, margin: 0 }}>{d.fonts.display}</h3>
        <p style={{ fontFamily: d.fonts.display, fontSize: 20, margin: 4, letterSpacing: '-0.015em' }}>Tableau de bord · 47 200 €</p>
      </div>
      <div className="dos-typo-block">
        <span className="dos-typo-eyebrow">Corps de texte · Body</span>
        <h3 style={{ fontFamily: d.fonts.body, fontWeight: 600, margin: 0 }}>{d.fonts.body}</h3>
        <p style={{ fontFamily: d.fonts.body, fontSize: 13, margin: 4, lineHeight: 1.55, color: '#4B5563' }}>Devis, planning et interventions, enfin réunis. Du chiffrage à la facture, pilotez vos chantiers en temps réel.</p>
      </div>
      <div className="dos-typo-block">
        <span className="dos-typo-eyebrow">Références · Code</span>
        <h3 style={{ fontFamily: d.fonts.mono, fontWeight: 500, margin: 0 }}>{d.fonts.mono}</h3>
        <p style={{ fontFamily: d.fonts.mono, fontSize: 12, margin: 4, color: '#1F2937' }}>INT-2026-004 · 06/11 · 1 200 € HT</p>
      </div>
    </div>
  );
}

export default function Dossier() {
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [progress, setProgress] = useState(0);
  const sheetRef = useRef(null);

  const today = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  const generate = useCallback(async () => {
    setStatus('loading');
    setProgress(0);
    try {
      const [{ jsPDF }, html2canvas] = await Promise.all([
        import('jspdf'),
        import('html2canvas').then((m) => m.default),
      ]);
      const pages = Array.from(sheetRef.current.querySelectorAll('.dos-page'));
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
      const PW = pdf.internal.pageSize.getWidth();
      const PH = pdf.internal.pageSize.getHeight();
      for (let i = 0; i < pages.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const canvas = await html2canvas(pages[i], { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: PAGE_W, windowHeight: PAGE_H });
        const img = canvas.toDataURL('image/jpeg', 0.9);
        if (i > 0) pdf.addPage();
        pdf.addImage(img, 'JPEG', 0, 0, PW, PH, undefined, 'FAST');
        setProgress(Math.round(((i + 1) / pages.length) * 100));
      }
      pdf.save(`ANELEC-TCE-Dossier-maquettes-${new Date().toISOString().slice(0, 10)}.pdf`);
      setStatus('done');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      setStatus('error');
    }
  }, []);

  useEffect(() => { if (status === 'done') { const t = setTimeout(() => setStatus('idle'), 3000); return () => clearTimeout(t); } return undefined; }, [status]);

  return (
    <div className="dos">
      <header className="dos-top" data-testid="dossier-top">
        <BrandLink />
        <nav className="g-top-nav">
          <Link to="/" className="g-btn g-btn--sm" data-testid="dossier-back"><ArrowLeft size={14} /> Retour à la galerie</Link>
        </nav>
        <div className="dos-actions">
          <button type="button" className="g-btn g-btn--primary g-btn--lg" onClick={generate} disabled={status === 'loading'} data-testid="dossier-download">
            {status === 'loading' ? <Loader2 size={16} className="dos-spin" /> : status === 'done' ? <CheckCircle2 size={16} /> : <Download size={16} />}
            <span>{status === 'loading' ? `Génération… ${progress} %` : status === 'done' ? 'Dossier téléchargé' : 'Télécharger le dossier PDF'}</span>
          </button>
          <span className="dos-help">Ouvrez le PDF, imprimez-le ou partagez-le par e-mail à vos décideurs.</span>
        </div>
      </header>

      <main className="dos-sheet" ref={sheetRef} data-testid="dossier-sheet">
        {/* Page 1 — Couverture */}
        <PageA4 variant="cover">
          <div className="dos-cover">
            <div className="dos-cover-brand">
              <img src="/brand/anelec-logo.png" alt="ANELEC GROUPE" />
              <span>Suivi TCE</span>
            </div>
            <div className="dos-cover-main">
              <span className="dos-eyebrow">Dossier de refonte UI/UX</span>
              <h1>5 directions de design pour une plateforme plus professionnelle.</h1>
              <p>Ce dossier résume le diagnostic d’expert, les cinq directions proposées, les palettes, les typographies et les repères pour choisir sans se tromper — à partager avec vos décideurs non connectés à la galerie interactive.</p>
            </div>
            <dl className="dos-cover-facts">
              <div><dt>5</dt><dd>directions distinctes</dd></div>
              <div><dt>13</dt><dd>écrans + 3 fenêtres</dd></div>
              <div><dt><Monitor size={16} /> <Smartphone size={16} /></dt><dd>ordinateur et mobile</dd></div>
              <div><dt>0</dt><dd>ligne modifiée dans votre site</dd></div>
            </dl>
            <footer className="dos-cover-foot">
              <span>Préparé le {today}</span>
              <span>ANELEC GROUPE · 9 rue des Colonnes, 75002 Paris</span>
            </footer>
          </div>
        </PageA4>

        {/* Page 2 — Diagnostic */}
        <PageA4>
          <header className="dos-head">
            <span className="dos-eyebrow">01 · Diagnostic</span>
            <h2>Ce qui freine aujourd’hui l’image professionnelle.</h2>
          </header>
          <div className="dos-audit-grid">
            {AUDIT.slice(0, 8).map((a) => (
              <article key={a.title} className="dos-audit">
                <div className="dos-audit-top">
                  <span className={`g-sev g-sev--${a.sev === 'Élevé' ? 'high' : a.sev === 'Moyen' ? 'mid' : 'low'}`}>{a.sev}</span>
                  <h3>{a.title}</h3>
                </div>
                <p className="dos-audit-what">{a.what}</p>
                <p className="dos-audit-fix"><CheckCircle2 size={13} /> {a.fix}</p>
              </article>
            ))}
          </div>
          <div className="dos-principles">
            <h3>Principes communs aux 5 directions</h3>
            <div className="dos-princ-grid">
              {PRINCIPLES.map((p, i) => (
                <div key={p.title} className="dos-princ">
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <strong>{p.title}</strong>
                  <em>{p.text}</em>
                </div>
              ))}
            </div>
          </div>
          <footer className="dos-foot"><span>ANELEC GROUPE · Suivi TCE · Diagnostic</span><span>Page 2 / {DIRECTIONS.length + 4}</span></footer>
        </PageA4>

        {/* Pages 3..7 — une page par direction */}
        {DIRECTIONS.map((d, idx) => {
          const Mini = MINIS[d.id];
          return (
            <PageA4 key={d.id} variant={d.dark ? 'dark' : 'light'}>
              <header className="dos-head">
                <span className="dos-dir-num" style={{ background: d.swatches[0], color: d.dark ? '#06121F' : '#fff' }}>{d.num}</span>
                <div>
                  <span className="dos-eyebrow">Direction · {String(idx + 1).padStart(2, '0')} / 05</span>
                  <h2>{d.name}</h2>
                  <p className="dos-dir-tag">{d.tagline}</p>
                </div>
              </header>

              <div className="dos-dir-forwho"><strong>Pour qui ? </strong>{d.forWho}</div>

              <div className="dos-dir-grid">
                <div className="dos-dir-preview">
                  <Mini d={d} />
                </div>
                <aside className="dos-dir-phone">
                  <MiniPhone d={d} />
                </aside>
              </div>

              <section className="dos-dir-sec">
                <h4>Palette</h4>
                <Palette d={d} />
              </section>

              <section className="dos-dir-sec">
                <h4>Typographie</h4>
                <Typo d={d} />
              </section>

              <section className="dos-dir-sec dos-dir-meta">
                <div><strong><LayoutPanelLeft size={13} /> Navigation bureau</strong><span>{d.nav}</span></div>
                <div><strong><Smartphone size={13} /> Mobile</strong><span>{d.navMobile}</span></div>
                <div><strong><Layers size={13} /> Densité · Ambiance</strong><span>{d.density} · {d.mood}</span></div>
                <div><strong>Référence visuelle</strong><span>{d.references}</span></div>
              </section>

              <section className="dos-dir-proscons">
                <ul className="is-pros">{d.pros.map((p) => <li key={p}><CheckCircle2 size={13} /> {p}</li>)}</ul>
                <ul className="is-cons">{d.cons.map((p) => <li key={p}><AlertTriangle size={13} /> {p}</li>)}</ul>
              </section>

              <footer className="dos-foot"><span>{d.name} · {d.tagline}</span><span>Page {3 + idx} / {DIRECTIONS.length + 4}</span></footer>
            </PageA4>
          );
        })}

        {/* Avant-dernière page — tableau comparatif */}
        <PageA4>
          <header className="dos-head">
            <span className="dos-eyebrow">03 · Comparatif</span>
            <h2>Comment choisir en un coup d’œil.</h2>
          </header>
          <table className="dos-compare">
            <thead>
              <tr>
                <th>Direction</th>
                <th>Ambiance</th>
                <th>Densité</th>
                <th>Navigation bureau</th>
                <th>Palette dominante</th>
                <th>Idéal pour</th>
              </tr>
            </thead>
            <tbody>
              {DIRECTIONS.map((d) => (
                <tr key={d.id}>
                  <td>
                    <span className="dos-dir-num" style={{ background: d.swatches[0], color: d.dark ? '#06121F' : '#fff' }}>{d.num}</span>
                    <div><strong>{d.name}</strong><em>{d.tagline}</em></div>
                  </td>
                  <td>{d.mood}</td>
                  <td>{d.density}</td>
                  <td>{d.nav}</td>
                  <td><span className="dos-dot-list">{d.swatches.slice(0, 4).map((c) => <i key={c} style={{ background: c }} />)}</span></td>
                  <td>{d.tags.join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <section className="dos-screens-cover">
            <h3>Écrans couverts par chaque direction</h3>
            <div className="dos-screens-grid">
              {SCREENS.map((s) => (
                <div key={s.id} className="dos-screen">
                  <span className="dos-screen-group">{s.group}</span>
                  <strong>{s.label}</strong>
                  <span className="dos-screen-check"><Check size={11} /> desktop · mobile</span>
                </div>
              ))}
            </div>
          </section>
          <footer className="dos-foot"><span>Tableau comparatif</span><span>Page {DIRECTIONS.length + 3} / {DIRECTIONS.length + 4}</span></footer>
        </PageA4>

        {/* Dernière page — Prochaines étapes */}
        <PageA4 variant="cta" last>
          <div className="dos-end">
            <span className="dos-eyebrow" style={{ color: '#CBD5E1' }}>04 · Prochaines étapes</span>
            <h2>Comment avancer après ce dossier.</h2>
            <ol>
              <li><strong>Choisir une direction préférée.</strong><p>Idéalement en comparant deux finalistes côte à côte dans la galerie interactive.</p></li>
              <li><strong>Lister les ajustements souhaités.</strong><p>Couleurs secondaires, logo, écrans à prioriser — tout est encore ajustable à ce stade.</p></li>
              <li><strong>Lancer la refonte progressive.</strong><p>Les tokens (couleurs, typographie, composants) sont définis : la mise en œuvre peut démarrer écran par écran, sans rupture pour vos équipes.</p></li>
            </ol>
            <div className="dos-end-contact">
              <strong>Pour la revue avec vos décideurs</strong>
              <p>Ouvrez la galerie interactive, utilisez « Comparer » puis enregistrez votre direction préférée pour la partager avec l’équipe.</p>
              <span className="dos-end-url">suivi.anelecgroupe.com · démo UI/UX</span>
            </div>
          </div>
          <footer className="dos-foot dos-foot--dark"><span>ANELEC GROUPE · Suivi TCE</span><span>Page {DIRECTIONS.length + 4} / {DIRECTIONS.length + 4}</span></footer>
        </PageA4>
      </main>
    </div>
  );
}
