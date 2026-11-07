import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, PlayCircle, ShieldCheck, Server, Users, FileText, CalendarRange, Map as MapIcon, Receipt, Smartphone, BarChart3, Check, Star, Mail, Phone, Building2, Sparkles, Zap } from 'lucide-react';
import { useMock, Logo, Btn, Pill, Card, Avatar } from '../ui';

const FEATURES = [
  { icon: FileText, title: 'Devis en une page', text: 'Chiffrage par corps d’état, envoi par e-mail, signature en ligne et conversion en intervention sans ressaisie.' },
  { icon: CalendarRange, title: 'Planning intelligent', text: 'Un planning lisible pour vos dispatchers — affectation en 1 clic et suggestions selon les compétences du technicien.' },
  { icon: MapIcon, title: 'Carte et tournées', text: 'Positions en direct, optimisation des trajets et estimation d’heure d’arrivée pour chaque mission.' },
  { icon: Smartphone, title: 'App mobile terrain', text: 'Photos avant / après, compte-rendu, clôture GPS. Les techniciens voient uniquement leurs missions.' },
  { icon: Receipt, title: 'Facturation guidée', text: 'Les interventions validées tombent automatiquement dans le bac « À facturer ». Export comptable en 1 clic.' },
  { icon: BarChart3, title: 'Pilotage sans effort', text: 'Chiffre d’affaires, rentabilité par corps d’état et classement des techniciens — lisibles d’un coup d’œil.' },
];

const PROOFS = [
  { icon: ShieldCheck, label: 'Données hébergées en France' },
  { icon: Server, label: 'Cloisonnées par entreprise' },
  { icon: Users, label: 'Multi-utilisateurs, rôles détaillés' },
  { icon: ShieldCheck, label: 'Conforme RGPD' },
];

const FLOW = [
  { k: '01', title: 'Un donneur d’ordre appelle', text: 'Vous saisissez la demande, l’envoyez en chiffrage ou la planifiez directement.' },
  { k: '02', title: 'Votre technicien intervient', text: 'Il reçoit la mission sur son téléphone, prend les photos et renvoie le rapport.' },
  { k: '03', title: 'Vous facturez… et sentez la différence', text: 'La facture est pré-remplie à partir du rapport. Plus d’oubli, plus de ressaisie.' },
];

const FAQ = [
  { q: 'Mes données sont-elles isolées des autres entreprises ?', a: 'Oui. Chaque entreprise dispose d’un espace cloisonné. Aucun autre client de la plateforme ne peut voir vos informations.' },
  { q: 'Les techniciens voient-ils tout ?', a: 'Non. L’application terrain ne présente aux techniciens que leurs propres missions et leur profil.' },
  { q: 'Puis-je essayer avant de m’engager ?', a: 'Oui. Créez un espace de démonstration en 1 minute et explorez la plateforme librement.' },
  { q: 'Comment récupérer mes données si je pars ?', a: 'Un export complet au format Excel et PDF est disponible à tout moment depuis l’administration.' },
];

const TESTI = [
  { name: 'Céline M.', role: 'Responsable administratif · Entreprise de 12 techniciens', quote: 'Les devis convertis en intervention sans ressaisie, c’est 6 heures économisées chaque semaine.' },
  { name: 'Reda S.', role: 'Gérant · TCE Multi-sites', quote: 'J’ai enfin un vrai tableau de bord « direction ». En 2 minutes, je sais où je perds de l’argent.' },
];

export default function Vitrine() {
  const { go } = useMock();
  const [open, setOpen] = useState(null);
  return (
    <div className="v-page" data-testid="mock-screen-vitrine">
      <header className="v-nav">
        <button type="button" className="v-nav-logo" onClick={() => go('connexion')} data-testid="mock-vitrine-logo"><Logo /></button>
        <nav className="v-nav-links">
          <a href="#fonctions">Fonctionnalités</a>
          <a href="#flow">Comment ça marche</a>
          <a href="#faq">Questions fréquentes</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="v-nav-actions">
          <Btn onClick={() => go('connexion')} data-testid="mock-vitrine-login">Se connecter</Btn>
          <Btn variant="primary" iconRight={ArrowRight} onClick={() => go('connexion')} data-testid="mock-vitrine-signup">Créer mon espace</Btn>
        </div>
      </header>

      <section className="v-hero">
        <div className="v-hero-text">
          <Pill tone="blue">Plateforme Tout Corps d’État</Pill>
          <h1>Devis, interventions, carte et factures — enfin réunis.</h1>
          <p>Pilotez vos chantiers et vos techniciens en temps réel — au bureau comme sur le terrain. Pensé pour les entreprises TCE françaises : devis en 1 page, clôture GPS, autoliquidation automatique.</p>
          <div className="v-hero-actions">
            <Btn variant="primary" size="lg" iconRight={ArrowRight} onClick={() => go('connexion')} data-testid="mock-vitrine-cta">Créer mon espace gratuitement</Btn>
            <Btn size="lg" icon={PlayCircle} onClick={() => setOpen('video')} data-testid="mock-vitrine-demo">Voir la démo (1 min 28)</Btn>
          </div>
          <div className="v-proofs">
            {PROOFS.map((p) => <span key={p.label} className="v-proof"><p.icon size={14} /> {p.label}</span>)}
          </div>
        </div>
        <div className="v-hero-mock" aria-hidden="true">
          <div className="v-hero-mock-top"><span /><span /><span /><em>suivi.anelecgroupe.com/dashboard</em></div>
          <div className="v-hero-mock-grid">
            <div className="v-mock-kpi v-mock-kpi--primary"><span>CA Novembre</span><strong>47 200 €</strong><em>+12 %</em></div>
            <div className="v-mock-kpi"><span>À facturer</span><strong>4 200 €</strong></div>
            <div className="v-mock-kpi"><span>Rapports</span><strong>1</strong></div>
            <div className="v-mock-kpi"><span>Devis</span><strong>6</strong></div>
            <div className="v-mock-chart"><svg viewBox="0 0 160 60" preserveAspectRatio="none"><polyline fill="none" stroke="currentColor" strokeWidth="2.5" points="0,45 20,42 40,36 60,32 80,20 100,24 120,16 140,12 160,20" /></svg><span>Chiffre d’affaires 2026</span></div>
            <div className="v-mock-list">
              <strong><Zap size={12} /> À traiter</strong>
              <div><i className="v-dot v-dot--teal" />Valider INT-2026-004</div>
              <div><i className="v-dot v-dot--red" />Affecter urgence</div>
              <div><i className="v-dot v-dot--green" />Facturer 2 chantiers</div>
            </div>
          </div>
        </div>
      </section>

      <section className="v-section v-section--light" id="fonctions">
        <div className="v-section-head">
          <Pill tone="blue">Ce que vous gagnez</Pill>
          <h2>Du premier appel à la facture, tout est fluide.</h2>
          <p>Chaque module parle aux autres — fini les tableurs parallèles et la double saisie.</p>
        </div>
        <div className="v-feat-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className="v-feat" data-testid={`mock-vitrine-feature-${f.title}`}>
              <span className="v-feat-ic"><f.icon size={20} /></span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="v-section" id="flow">
        <div className="v-section-head">
          <Pill tone="teal">Comment ça marche</Pill>
          <h2>3 étapes concrètes, aucune formation.</h2>
        </div>
        <ol className="v-flow">
          {FLOW.map((f) => (
            <li key={f.k} data-testid={`mock-vitrine-flow-${f.k}`}>
              <span className="v-flow-k">{f.k}</span>
              <strong>{f.title}</strong>
              <p>{f.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="v-section v-section--testi">
        <div className="v-section-head">
          <Pill tone="amber">Ils nous font confiance</Pill>
          <h2>Des entreprises TCE comme la vôtre.</h2>
        </div>
        <div className="v-testi-grid">
          {TESTI.map((t) => (
            <article key={t.name} className="v-testi">
              <div className="v-testi-stars">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={14} fill="currentColor" />)}</div>
              <p>« {t.quote} »</p>
              <footer><Avatar name={t.name} size={32} /><div><strong>{t.name}</strong><span>{t.role}</span></div></footer>
            </article>
          ))}
        </div>
      </section>

      <section className="v-section" id="faq">
        <div className="v-section-head">
          <Pill tone="slate">FAQ</Pill>
          <h2>Questions souvent posées.</h2>
        </div>
        <ul className="v-faq">
          {FAQ.map((f, i) => (
            <li key={f.q} className={open === i ? 'is-open' : ''}>
              <button type="button" onClick={() => setOpen(open === i ? null : i)} data-testid={`mock-vitrine-faq-${i}`}><span>{f.q}</span><ArrowRight size={16} /></button>
              {open === i && <p>{f.a}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section className="v-cta" id="contact">
        <div className="v-cta-inner">
          <Sparkles size={22} />
          <h2>Essayez la plateforme en moins d’une minute.</h2>
          <p>Créez votre espace entreprise avec des données d’exemple. Rien à installer.</p>
          <div className="v-cta-actions">
            <Btn variant="primary" size="lg" iconRight={ArrowRight} onClick={() => go('connexion')} data-testid="mock-vitrine-cta-bottom">Créer mon espace</Btn>
            <a href="mailto:contact@anelecgroupe.com" className="v-cta-mail"><Mail size={14} /> contact@anelecgroupe.com</a>
          </div>
        </div>
      </section>

      <footer className="v-foot">
        <div><Logo /><p className="m-muted m-small">© ANELEC GROUPE · 9 rue des Colonnes, 75002 Paris</p></div>
        <nav><a href="#fonctions">Fonctionnalités</a><a href="#flow">Comment ça marche</a><a href="#faq">FAQ</a><a href="#contact">Contact</a></nav>
        <p className="m-muted m-small">Données hébergées en France · Conforme RGPD · Hébergement Hostinger</p>
      </footer>
    </div>
  );
}
