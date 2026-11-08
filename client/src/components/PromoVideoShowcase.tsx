import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProGlyph, ProGlyphName } from './ProIcons';

interface SlideItem {
  id: string;
  tag: string;
  headerTitle: string;
  title: string;
  subtitle: string;
  layout: 'left-text' | 'right-text';
  screenshotUrl: string;
  secondaryScreenshotUrl?: string;
  cards: {
    icon: string;
    title: string;
    desc: string;
    color: string;
  }[];
}

const SLIDES: SlideItem[] = [
  {
    id: 'kpis',
    tag: 'COCKPIT OPÉRATIONNEL & FINANCIER',
    headerTitle: 'CENTRE DE PILOTAGE & KPIS',
    title: 'Pilotage Stratégique en Temps Réel',
    subtitle: 'Suivi instantané de vos marges, de vos volumes et de vos équipes.',
    layout: 'left-text',
    screenshotUrl: '/screenshots/kpis.png', // https://suivi.anelecgroupe.com/app/kpis
    cards: [
      {
        icon: 'chart',
        title: "Chiffre d'Affaires & Marges Réelles",
        desc: 'Calcul instantané HT & TTC depuis les missions terminées',
        color: '#10b981',
      },
      {
        icon: 'building',
        title: "Ventilation Donneurs d'Ordre",
        desc: 'Part de volume B2B / B2C et paniers moyens en direct',
        color: '#06b6d4',
      },
      {
        icon: 'alert',
        title: "Compteurs d'Urgences & Blocages",
        desc: 'Missions critiques identifiées en direct sur le cockpit',
        color: '#f59e0b',
      },
      {
        icon: 'chart',
        title: 'Export Situation Travaux Excel', // Faute "Travax" corrigée
        desc: 'Génération automatique hebdomadaire et situations mensuelles',
        color: '#3b82f6',
      },
    ],
  },
  {
    id: 'devis',
    tag: 'CYCLE COMMERCIAL COMPLET',
    headerTitle: 'PIPELINE COMMERCIAL & CHIFFRAGE DEVIS',
    title: 'Pipeline Devis 22 Colonnes',
    subtitle: 'Du premier contact jusqu’à la signature finale et la mise en chantier.',
    layout: 'right-text',
    screenshotUrl: '/screenshots/devis.png', // https://suivi.anelecgroupe.com/app/devis
    secondaryScreenshotUrl: '/screenshots/devis-modal.png',
    cards: [
      {
        icon: 'clipboard',
        title: 'Visites Devis Préalables (VIS-DEV)',
        desc: 'Relevés techniques et chiffrage intégrés aux tournées techniciens',
        color: '#10b981',
      },
      {
        icon: 'zap',
        title: 'Conversion en Intervention 1-Clic', // Formulation "Reconversion" corrigée
        desc: 'Basculez un devis signé en intervention planifiée en 1 clic',
        color: '#06b6d4',
      },
      {
        icon: 'target',
        title: 'Suivi du Taux de Concrétisation',
        desc: 'Visualisation en temps réel du potentiel commercial brut',
        color: '#8b5cf6',
      },
    ],
  },
  {
    id: 'dispatch',
    tag: 'PERFORMANCE & RÉACTIVITÉ 60 FPS',
    headerTitle: 'DISPATCHING MULTI-RESSOURCES & PLANNING GANTT',
    title: 'Planning Gantt Ultra-Fluide',
    subtitle: 'Planifiez vos équipes sans latence avec détection automatique des conflits.',
    layout: 'left-text',
    screenshotUrl: '/screenshots/dispatch.png', // https://suivi.anelecgroupe.com/app/dispatch
    cards: [
      {
        icon: 'cursor',
        title: 'Glisser-Déposer Instantané',
        desc: 'Fluidité native 60 images/seconde sur tout le planning',
        color: '#10b981',
      },
      {
        icon: 'rocket',
        title: 'Bourse de Dispatch Rapide',
        desc: 'Affectez les urgences aux techniciens disponibles en un éclair',
        color: '#f59e0b',
      },
      {
        icon: 'shield',
        title: 'Contrôle Anti-Chevauchement',
        desc: 'Alertes visuelles en cas de double réservation d’un technicien',
        color: '#06b6d4',
      },
      {
        icon: 'user',
        title: 'Gestion Sous-Traitants & Équipes',
        desc: 'Affectation par corps d’état (Électricité, Plomberie, CVC, Peinture)',
        color: '#8b5cf6',
      },
    ],
  },
  {
    id: 'tsp',
    tag: 'ALGORITHME TSP & TEMPS RÉEL',
    headerTitle: 'CARTOGRAPHIE INTERACTIVE & OPTIMISATION TSP',
    title: 'Tournées Intelligentes TSP',
    subtitle: 'Optimisation kilométrique et réduction drastique des temps de trajet.', // Phrase coupée corrigée
    layout: 'right-text',
    screenshotUrl: '/screenshots/map-tsp.png',
    cards: [
      {
        icon: 'map',
        title: 'Départ Siège Social & Trajets Optimisés',
        desc: 'Calcul d’itinéraire TSP optimal minimisant le temps sur route',
        color: '#10b981',
      },
      {
        icon: 'check',
        title: 'Retrait Automatique en Direct',
        desc: 'Les missions validées sur mobile disparaissent instantanément de la carte',
        color: '#06b6d4',
      },
      {
        icon: 'monitor',
        title: 'Mode Cockpit Plein Écran PC',
        desc: 'Bascule plein écran pour affichage mural en salle de supervision',
        color: '#f59e0b',
      },
    ],
  },
  {
    id: 'mobile',
    tag: 'APPLICATION TERRAIN PWA SÉCURISÉE',
    headerTitle: 'APPLICATION MOBILE TECHNICIEN PWA',
    title: "L'Application Mobile Technicien",
    subtitle: 'Fiabilité juridique, horodatage certifié et zéro saisie inutile.',
    layout: 'right-text',
    screenshotUrl: '/screenshots/mobile-gps.png',
    secondaryScreenshotUrl: '/screenshots/mobile-missions.png',
    cards: [
      {
        icon: 'clock',
        title: 'Pointage Matin Biométrique / Horodaté',
        desc: 'Heure d’embauche inviolable et suivi de présence en temps réel',
        color: '#10b981',
      },
      {
        icon: 'pin',
        title: 'Clôture avec Position GPS Obligatoire',
        desc: 'Transmission certifiée des coordonnées GPS précises au bureau',
        color: '#f59e0b',
      },
      {
        icon: 'camera',
        title: 'Photos Avant / Après & Signature Client',
        desc: 'Génération automatique du rapport PDF prêt pour facturation',
        color: '#8b5cf6',
      },
      {
        icon: 'chat',
        title: 'Messages Éphémères Professionnels',
        desc: 'Alertes bureau → équipe rédigées sans polluer l’historique dossier',
        color: '#06b6d4',
      },
    ],
  },
  {
    id: 'facturation',
    tag: 'FINANCE & RELATION CLIENT',
    headerTitle: 'FACTURATION & DIAGNOSTIC DES RETARDS',
    title: 'Studio Facturation 5 Bacs',
    subtitle: 'Accélérez vos encaissements et désamorcez les litiges clients.',
    layout: 'right-text',
    screenshotUrl: '/screenshots/facturation-top.png',
    secondaryScreenshotUrl: '/screenshots/facturation-bottom.png',
    cards: [
      {
        icon: 'scale',
        title: 'Arbitrage Automatique B2B / B2C',
        desc: 'Gestion distincte des règles fiscales HT, autoliquidation et TTC',
        color: '#10b981',
      },
      {
        icon: 'search',
        title: 'Diagnostic 1-Clic des Retards',
        desc: 'Identification instantanée de la cause exacte du blocage de paiement',
        color: '#06b6d4',
      },
      {
        icon: 'mail',
        title: 'Courriers Clients Prêts à l’Envoi',
        desc: 'Génération 1-clic des relances selon l’historique réel du chantier',
        color: '#f59e0b',
      },
      {
        icon: 'lock',
        title: 'Dossier de Preuves Complet (PV & Photos)',
        desc: 'Vérification automatique des pièces justificatives avant envoi',
        color: '#3b82f6',
      },
    ],
  },
];

const STEP_DURATIONS = [5000, 6500, 6500, 6500, 6500, 6500, 6500, 6000];

export const PromoVideoShowcase: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<number>(0); // 0 = Intro, 1..6 = Slides, 7 = Outro
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isAudioActive, setIsAudioActive] = useState<boolean>(false);
  const [showVideoModal, setShowVideoModal] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Gérer le son
  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isAudioActive) {
      audioRef.current.pause();
      setIsAudioActive(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsAudioActive(true))
        .catch((err) => console.warn('Autoplay bloqué par le navigateur:', err));
    }
  };

  // Timer de progression automatique des étapes
  useEffect(() => {
    if (!isPlaying) return;

    const currentDuration = STEP_DURATIONS[step] || 6000;
    const intervalMs = 50;
    const increment = (intervalMs / currentDuration) * 100;

    setProgressPercent(0);

    const progressTimer = setInterval(() => {
      setProgressPercent((prev) => {
        if (prev >= 100) {
          clearInterval(progressTimer);
          setStep((old) => (old + 1) % STEP_DURATIONS.length);
          return 0;
        }
        return prev + increment;
      });
    }, intervalMs);

    return () => clearInterval(progressTimer);
  }, [step, isPlaying]);

  const handleNext = () => {
    setStep((prev) => (prev + 1) % STEP_DURATIONS.length);
    setProgressPercent(0);
  };

  const handlePrev = () => {
    setStep((prev) => (prev - 1 + STEP_DURATIONS.length) % STEP_DURATIONS.length);
    setProgressPercent(0);
  };

  const currentSlide = step >= 1 && step <= 6 ? SLIDES[step - 1] : null;

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#040914',
        color: '#ffffff',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Audio soundtrack */}
      <audio ref={audioRef} src="/soundtrack_anelec_tce.wav" loop preload="auto" />

      {/* Grille d'arrière-plan tech subtile + halos néon */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.12,
          pointerEvents: 'none',
          backgroundImage:
            'linear-gradient(to right, #38bdf8 1px, transparent 1px), linear-gradient(to bottom, #38bdf8 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '-140px',
          left: '-140px',
          width: '550px',
          height: '550px',
          borderRadius: '50%',
          background: 'rgba(16, 185, 129, 0.15)',
          filter: 'blur(130px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-140px',
          right: '-140px',
          width: '550px',
          height: '550px',
          borderRadius: '50%',
          background: 'rgba(14, 165, 233, 0.15)',
          filter: 'blur(130px)',
          pointerEvents: 'none',
        }}
      />

      {/* Barre supérieure permanente */}
      <header
        style={{
          position: 'relative',
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 36px',
          borderBottom: '1px solid rgba(51, 65, 85, 0.6)',
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '14px', fontWeight: 700, letterSpacing: '0.04em' }}>
          <img src="/brand/anelec-logo.png" alt="Logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
          <span style={{ color: '#f8fafc' }}>ANELEC GROUPE TCE</span>
          <span style={{ color: '#475569' }}>/</span>
          <span style={{ color: '#38bdf8' }}>
            {step === 0 ? 'PRÉSENTATION OFFICIELLE' : step === 7 ? 'DÉPLOIEMENT & ACCÈS' : currentSlide?.headerTitle}
          </span>
        </div>

        {/* Boutons d'action dans le header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={toggleAudio}
            title={isAudioActive ? 'Couper la musique' : 'Activer la bande sonore'}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              border: `1px solid ${isAudioActive ? '#10b981' : '#475569'}`,
              background: isAudioActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.6)',
              color: isAudioActive ? '#34d399' : '#94a3b8',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {isAudioActive ? 'Musique active' : 'Activer la musique'}
          </button>

          <button
            type="button"
            onClick={() => setShowVideoModal(true)}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: '1px solid rgba(56, 189, 248, 0.5)',
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#7dd3fc',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            Vidéo Full HD (1080p)
          </button>

          <div
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              background: 'rgba(6, 78, 59, 0.6)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#34d399',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
            LIVE PRODUCTION 2026
          </div>

          <button
            type="button"
            onClick={() => navigate('/login')}
            title="Quitter la démonstration"
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #334155',
              background: 'transparent',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Quitter
          </button>
        </div>
      </header>

      {/* Contenu principal */}
      <main
        style={{
          position: 'relative',
          zIndex: 10,
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 48px 80px 48px',
          overflow: 'hidden',
        }}
      >
        {/* ============================================================ */}
        {/* STEP 0 : INTRO BRANDING & HOOK */}
        {/* ============================================================ */}
        {step === 0 && (
          <div
            style={{
              textAlign: 'center',
              maxWidth: '920px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px',
              animation: 'fadeIn 0.6s ease-out',
            }}
          >
            {/* Logo avec halo */}
            <div
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '130px',
                height: '130px',
                borderRadius: '28px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '2px solid rgba(16, 185, 129, 0.4)',
                boxShadow: '0 0 50px rgba(16, 185, 129, 0.25)',
              }}
            >
              <img src="/brand/anelec-logo.png" alt="Logo Officiel" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
            </div>

            <h1
              style={{
                fontSize: '54px',
                fontWeight: 900,
                letterSpacing: '-0.03em',
                color: '#ffffff',
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              ANELEC GROUPE TCE
            </h1>

            <p
              style={{
                fontSize: '26px',
                fontWeight: 800,
                background: 'linear-gradient(to right, #38bdf8, #34d399, #a7f3d0)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                margin: 0,
              }}
            >
              La Plateforme SaaS Nouvelle Génération BTP & Second Œuvre
            </p>

            <p style={{ fontSize: '18px', color: '#cbd5e1', maxWidth: '720px', margin: 0, lineHeight: 1.5 }}>
              Pilotez 100 % de vos chantiers, tournées, devis et factures en temps réel avec isolation stricte des données et synchronisation mobile terrain.
            </p>

            {/* Badges de présentation */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px', marginTop: '10px' }}>
              {[
                { label: 'POSTGRESQL 17 MULTI-TENANT', border: '#38bdf8', color: '#7dd3fc' },
                { label: 'DISPATCH GANTT 60 FPS', border: '#10b981', color: '#6ee7b7' },
                { label: 'GÉOLOCALISATION TSP', border: '#f59e0b', color: '#fcd34d' },
                { label: 'PWA MOBILE INVIOLABLE', border: '#8b5cf6', color: '#c4b5fd' },
              ].map((b, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: `1.5px solid ${b.border}`,
                    background: 'rgba(30, 41, 59, 0.7)',
                    color: b.color,
                    fontSize: '13px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}
                >
                  {b.label}
                </div>
              ))}
            </div>

            {/* Boutons d'action immédiate */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '18px' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  padding: '14px 28px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(to right, #059669, #10b981)',
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 0 25px rgba(16, 185, 129, 0.4)',
                }}
              >
                Lancer la Visite Interactive
              </button>

              <button
                type="button"
                onClick={() => setShowVideoModal(true)}
                style={{
                  padding: '14px 24px',
                  borderRadius: '12px',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  background: 'rgba(15, 23, 42, 0.8)',
                  color: '#7dd3fc',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Voir le Clip Vidéo MP4 (44s)
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEPS 1..6 : SLIDES THÉMATIQUES */}
        {/* ============================================================ */}
        {currentSlide && (
          <div
            style={{
              width: '100%',
              maxWidth: '1720px',
              height: '100%',
              display: 'grid',
              gridTemplateColumns: currentSlide.layout === 'left-text' ? '460px 1fr' : '1fr 500px',
              gap: '40px',
              alignItems: 'center',
            }}
          >
            {/* Si layout === 'left-text', le texte est à gauche */}
            {currentSlide.layout === 'left-text' && (
              <SlideTextBlock slide={currentSlide} />
            )}

            {/* Mockup visuel (Browser ou Phone) */}
            <SlideVisualBlock slide={currentSlide} />

            {/* Si layout === 'right-text', le texte est à droite */}
            {currentSlide.layout === 'right-text' && (
              <SlideTextBlock slide={currentSlide} />
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 7 : OUTRO CALL TO ACTION */}
        {/* ============================================================ */}
        {step === 7 && (
          <div
            style={{
              width: '100%',
              maxWidth: '1520px',
              display: 'grid',
              gridTemplateColumns: '1fr 560px',
              gap: '48px',
              alignItems: 'center',
            }}
          >
            {/* Capture du formulaire Google */}
            <div
              style={{
                borderRadius: '14px',
                border: '1.5px solid rgba(16, 185, 129, 0.3)',
                background: '#0f172a',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '38px',
                  background: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 16px',
                  gap: '8px',
                }}
              >
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
                <div
                  style={{
                    marginLeft: '12px',
                    background: '#0f172a',
                    padding: '4px 16px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#94a3b8',
                  }}
                >
                  https://suivi.anelecgroupe.com/auth/login (Google 1-Clic)
                </div>
              </div>
              <img
                src="/screenshots/google-register.png"
                alt="Inscription Google"
                style={{ width: '100%', height: '540px', objectFit: 'cover', objectPosition: 'top' }}
              />
            </div>

            {/* Arguments & Bouton CTA */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 14px',
                  borderRadius: '16px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid #10b981',
                  color: '#34d399',
                  fontSize: '13px',
                  fontWeight: 700,
                  width: 'fit-content',
                }}
              >
                DÉPLOIEMENT INSTANTANÉ
              </div>

              <h2 style={{ fontSize: '42px', fontWeight: 900, color: '#ffffff', margin: 0, lineHeight: 1.15 }}>
                Démarrez en Moins de 30s
              </h2>

              <p style={{ fontSize: '18px', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                Créez l'espace entreprise de votre structure TCE en 1 clic grâce à votre compte Google professionnel.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  {
                    icon: 'rocket',
                    title: 'Connexion Google 1-Clic',
                    desc: 'Vos identifiants et e-mail entreprise pré-remplis automatiquement',
                    color: '#10b981',
                  },
                  {
                    icon: 'lock',
                    title: 'Base Dédiée Supabase PostgreSQL 17',
                    desc: 'Isolation stricte multi-tenant et sauvegardes automatiques',
                    color: '#06b6d4',
                  },
                  {
                    icon: 'phone',
                    title: 'Accessible Ordinateur & Smartphone',
                    desc: 'Application PWA installable sans passer par les stores d’applications',
                    color: '#8b5cf6',
                  },
                ].map((c, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '14px 18px',
                      borderRadius: '12px',
                      background: 'rgba(15, 23, 42, 0.75)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderLeft: `5px solid ${c.color}`,
                    }}
                  >
                    <ProGlyph name={c.icon as ProGlyphName} size={24} />
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>{c.title}</div>
                      <div style={{ fontSize: '13px', color: '#94a3b8' }}>{c.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Grand bouton vers le site */}
              <button
                type="button"
                onClick={() => navigate('/login')}
                style={{
                  marginTop: '10px',
                  padding: '18px 24px',
                  borderRadius: '14px',
                  border: '2px solid #6ee7b7',
                  background: 'linear-gradient(to right, #059669, #10b981)',
                  color: '#ffffff',
                  fontSize: '18px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 0 35px rgba(16, 185, 129, 0.5)',
                  textAlign: 'center',
                }}
              >
                Rejoignez la Plateforme : suivi.anelecgroupe.com →
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Barre de contrôle et dock inférieur */}
      <footer
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(51, 65, 85, 0.6)',
          padding: '12px 36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Boutons Lecture / Pause / Précédent / Suivant */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handlePrev}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #334155',
              background: '#1e293b',
              color: '#f8fafc',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            ‹ Préc.
          </button>

          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid #334155',
              background: isPlaying ? '#065f46' : '#1e293b',
              color: isPlaying ? '#34d399' : '#f8fafc',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            {isPlaying ? 'Pause' : 'Lecture'}
          </button>

          <button
            type="button"
            onClick={handleNext}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #334155',
              background: '#1e293b',
              color: '#f8fafc',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Suiv. ›
          </button>
        </div>

        {/* Pilules d'étapes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {[
            { idx: 0, label: 'Intro' },
            { idx: 1, label: '1. KPIs' },
            { idx: 2, label: '2. Devis' },
            { idx: 3, label: '3. Gantt' },
            { idx: 4, label: '4. Tournées' },
            { idx: 5, label: '5. Mobile PWA' },
            { idx: 6, label: '6. Facturation' },
            { idx: 7, label: 'Accès' },
          ].map((pill) => {
            const isCurrent = step === pill.idx;
            return (
              <button
                key={pill.idx}
                type="button"
                onClick={() => {
                  setStep(pill.idx);
                  setProgressPercent(0);
                }}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: `1px solid ${isCurrent ? '#10b981' : '#334155'}`,
                  background: isCurrent ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.6)',
                  color: isCurrent ? '#34d399' : '#94a3b8',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {pill.label}
                {isCurrent && isPlaying && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      height: '2.5px',
                      width: `${progressPercent}%`,
                      background: '#10b981',
                      transition: 'width 0.05s linear',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Bouton pour télécharger la vidéo ou voir en plein écran */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <a
            href="/video_publicitaire_anelec_tce.mp4"
            download="video_publicitaire_anelec_tce.mp4"
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid #334155',
              background: '#1e293b',
              color: '#94a3b8',
              fontSize: '12px',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            Télécharger MP4
          </a>
        </div>
      </footer>

      {/* Modal Lecteur Vidéo Plein Écran */}
      {showVideoModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
          }}
          onClick={() => setShowVideoModal(false)}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '1200px',
              background: '#0f172a',
              borderRadius: '16px',
              border: '2px solid rgba(16, 185, 129, 0.4)',
              boxShadow: '0 0 60px rgba(16, 185, 129, 0.3)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                background: '#1e293b',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ANELEC GROUPE TCE — Vidéo Publicitaire Officielle (Full HD 1080p, 44s)
              </div>
              <button
                type="button"
                onClick={() => setShowVideoModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '18px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>
            <video
              src="/video_publicitaire_anelec_tce.mp4"
              controls
              autoPlay
              style={{ width: '100%', maxHeight: '75vh', display: 'block', backgroundColor: '#000000' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// Composants Helpers de Contenu
// ============================================================

function SlideTextBlock({ slide }: { slide: SlideItem }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 14px',
          borderRadius: '16px',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid #10b981',
          color: '#34d399',
          fontSize: '12px',
          fontWeight: 700,
          width: 'fit-content',
        }}
      >
        {slide.tag}
      </div>

      <h2 style={{ fontSize: '38px', fontWeight: 900, color: '#ffffff', margin: 0, lineHeight: 1.15 }}>
        {slide.title}
      </h2>

      <p style={{ fontSize: '17px', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
        {slide.subtitle}
      </p>

      {/* Cartes caractéristiques */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {slide.cards.map((card, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderLeft: `4px solid ${card.color}`,
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
            }}
          >
            <ProGlyph name={card.icon as ProGlyphName} size={22} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>{card.title}</div>
              <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '2px' }}>{card.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideVisualBlock({ slide }: { slide: SlideItem }) {
  // Cas particulier Mobile PWA : deux smartphones côte à côte
  if (slide.id === 'mobile') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '28px', height: '100%' }}>
        <SmartphoneFrame
          title="Clôture GPS Obligatoire"
          src={slide.screenshotUrl}
        />
        {slide.secondaryScreenshotUrl && (
          <SmartphoneFrame
            title="Missions & Toasts Blancs Opaque"
            src={slide.secondaryScreenshotUrl}
          />
        )}
      </div>
    );
  }

  // Cas particulier Facturation : 2 fenêtres superposées
  if (slide.id === 'facturation') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%', height: '100%', justifyContent: 'center' }}>
        <BrowserFrame
          url="https://suivi.anelecgroupe.com/app/facturation (5 Bacs Comptables)"
          src={slide.screenshotUrl}
          height="320px"
        />
        {slide.secondaryScreenshotUrl && (
          <BrowserFrame
            url="https://suivi.anelecgroupe.com/app/facturation/diagnostic-retards"
            src={slide.secondaryScreenshotUrl}
            height="320px"
          />
        )}
      </div>
    );
  }

  // Cas standard ou Devis avec modal popup
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
      <BrowserFrame
        url={`https://suivi.anelecgroupe.com/app/${slide.id}`}
        src={slide.screenshotUrl}
        height="640px"
      />
      {slide.secondaryScreenshotUrl && (
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '-20px',
            width: '480px',
            borderRadius: '12px',
            border: '2px solid rgba(16, 185, 129, 0.5)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
            background: '#0f172a',
            overflow: 'hidden',
          }}
        >
          <div style={{ height: '32px', background: '#1e293b', display: 'flex', alignItems: 'center', padding: '0 12px', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
            <span style={{ marginLeft: '8px', fontSize: '11px', color: '#94a3b8' }}>Reconversion Devis → Travaux</span>
          </div>
          <img src={slide.secondaryScreenshotUrl} alt="Modal Popup" style={{ width: '100%', height: '340px', objectFit: 'cover' }} />
        </div>
      )}
    </div>
  );
}

function BrowserFrame({ url, src, height }: { url: string; src: string; height: string }) {
  return (
    <div
      style={{
        width: '100%',
        borderRadius: '14px',
        border: '1.5px solid rgba(56, 189, 248, 0.3)',
        background: '#0f172a',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '38px',
          background: '#1e293b',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: '8px',
        }}
      >
        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
        <div
          style={{
            marginLeft: '12px',
            background: '#0f172a',
            padding: '4px 16px',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#94a3b8',
            maxWidth: '480px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {url}
        </div>
      </div>
      <img src={src} alt="Capture d'écran" style={{ width: '100%', height, objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
    </div>
  );
}

function SmartphoneFrame({ title, src }: { title: string; src: string }) {
  return (
    <div
      style={{
        width: '320px',
        height: '620px',
        borderRadius: '36px',
        border: '3px solid #334155',
        background: '#1e293b',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Notch / Dynamic Island */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90px',
          height: '18px',
          borderRadius: '10px',
          background: '#0f172a',
          zIndex: 10,
        }}
      />
      {/* Titre miniature */}
      <div
        style={{
          position: 'absolute',
          top: '32px',
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: '10px',
          color: '#34d399',
          fontWeight: 700,
          zIndex: 10,
        }}
      >
        {title}
      </div>
      <img
        src={src}
        alt={title}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'top',
          borderRadius: '32px',
          display: 'block',
        }}
      />
    </div>
  );
}
export default PromoVideoShowcase;
