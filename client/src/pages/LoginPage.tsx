import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../stores/authStore';
import { api } from '../lib/api';
import toast from 'react-hot-toast';
import { BubbleBackdrop } from '../components/BubbleBackdrop';
import { InstallAppButton } from '../components/InstallAppButton';
import { LegalTermsModal } from '../components/LegalTermsModal';

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Mot de passe trop court (min 8 caractères)'),
});

type LoginForm = z.infer<typeof loginSchema>;

const registerCompanySchema = z
  .object({
    companyName: z
      .string()
      .min(2, "Le nom de l'entreprise est obligatoire (2 car. min)")
      .max(120, 'Nom trop long'),
    siretOrSiren: z
      .string()
      .min(9, 'Numéro SIREN (9 chiffres) ou SIRET (14 chiffres) requis')
      .max(20, 'Format invalide')
      .refine(
        (val) => {
          const cleaned = val.replace(/\s+/g, '');
          return /^\d{9}$/.test(cleaned) || /^\d{14}$/.test(cleaned);
        },
        {
          message:
            'Format invalide : saisissez soit un SIREN (9 chiffres), soit un SIRET (14 chiffres)',
        }
      ),
    name: z
      .string()
      .min(2, "Nom et prénom de l'administrateur requis")
      .max(100),
    email: z.string().email('Email professionnel invalide'),
    password: z
      .string()
      .min(8, 'Le mot de passe doit comporter au moins 8 caractères'),
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({
        message: 'Vous devez accepter les CGU et la Politique RGPD pour initialiser votre espace',
      }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

type RegisterCompanyForm = z.infer<typeof registerCompanySchema>;

export function LoginPage() {
  const { login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [emailConfirmationSentTo, setEmailConfirmationSentTo] = useState<string | null>(null);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<'cgu' | 'rgpd' | 'mentions'>('cgu');

  // Google OAuth State
  const [googleClientId, setGoogleClientId] = useState<string>('116679717813-chmnnnkeghjf6qs78qrts9m2o7dl4p20.apps.googleusercontent.com');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showGoogleOnboardingModal, setShowGoogleOnboardingModal] = useState(false);
  const [showGoogleConfigModal, setShowGoogleConfigModal] = useState(false);
  const [pendingGoogleCredential, setPendingGoogleCredential] = useState<string | null>(null);
  const [pendingGoogleProfile, setPendingGoogleProfile] = useState<{ email: string; name: string; picture?: string } | null>(null);
  const [googleCompanyName, setGoogleCompanyName] = useState('');
  const [googleSiretOrSiren, setGoogleSiretOrSiren] = useState('');
  const [googleAcceptTerms, setGoogleAcceptTerms] = useState(false);
  const [googleOnboardingError, setGoogleOnboardingError] = useState<string | null>(null);

  // Initialisation Google Identity Services (GIS)
  useEffect(() => {
    const initGis = (id: string) => {
      const g = (window as any).google;
      if (g?.accounts?.id) {
        try {
          g.accounts.id.initialize({
            client_id: id,
            callback: (response: { credential: string }) => {
              handleGoogleCredential(response.credential);
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          });
        } catch (e) {
          console.warn('Erreur initialisation Google GIS :', e);
        }
      }
    };

    initGis(googleClientId);

    api
      .get<{ googleClientId: string }>('/auth/config')
      .then((res) => {
        const id = res.data?.googleClientId || googleClientId;
        if (id) {
          setGoogleClientId(id);
          initGis(id);
        }
      })
      .catch(() => {});
  }, [googleClientId]);

  const handleGoogleCredential = async (
    credential: string,
    extraCompanyInfo?: { companyName: string; siretOrSiren: string; acceptTerms: boolean }
  ) => {
    setIsGoogleLoading(true);
    setGoogleOnboardingError(null);
    try {
      const regValues = registerForm.getValues();
      const payload = {
        credential,
        companyName: extraCompanyInfo?.companyName || (activeTab === 'register' ? regValues.companyName : undefined),
        siretOrSiren: extraCompanyInfo?.siretOrSiren || (activeTab === 'register' ? regValues.siretOrSiren : undefined),
        acceptTerms: extraCompanyInfo?.acceptTerms ?? (activeTab === 'register' ? regValues.acceptTerms : undefined),
      };

      const res = await loginWithGoogle(payload);

      if (res.requiresCompanyInfo) {
        setPendingGoogleCredential(credential);
        setPendingGoogleProfile(res.googleProfile);
        setGoogleCompanyName(regValues.companyName || '');
        setGoogleSiretOrSiren(regValues.siretOrSiren || '');
        setGoogleAcceptTerms(regValues.acceptTerms || false);
        setShowGoogleOnboardingModal(true);
        toast('Veuillez renseigner les informations de votre entreprise pour finaliser', { icon: '🏢' });
      } else {
        setShowGoogleOnboardingModal(false);
        toast.success(res.message || 'Connexion Google réussie');
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erreur lors de l’authentification Google';
      setGoogleOnboardingError(msg);
      toast.error(msg);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const triggerGoogleAuth = (_tab: 'login' | 'register') => {
    const g = (window as any).google;
    if (googleClientId && g?.accounts?.id) {
      try {
        g.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setShowGoogleConfigModal(true);
          }
        });
      } catch {
        setShowGoogleConfigModal(true);
      }
    } else {
      setShowGoogleConfigModal(true);
    }
  };

  const handleCompleteGoogleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    setGoogleOnboardingError(null);

    if (!googleCompanyName.trim()) {
      setGoogleOnboardingError('Le nom de votre entreprise est obligatoire');
      return;
    }

    const cleanedDigits = googleSiretOrSiren.replace(/\s+/g, '').replace(/[^0-9]/g, '');
    if (cleanedDigits.length !== 9 && cleanedDigits.length !== 14) {
      setGoogleOnboardingError('Format invalide : saisissez un SIREN (9 chiffres) ou un SIRET (14 chiffres)');
      return;
    }

    if (!googleAcceptTerms) {
      setGoogleOnboardingError('Vous devez accepter les CGU et la Politique RGPD');
      return;
    }

    if (!pendingGoogleCredential) {
      setGoogleOnboardingError('Session Google expirée, veuillez recommencer');
      return;
    }

    await handleGoogleCredential(pendingGoogleCredential, {
      companyName: googleCompanyName.trim(),
      siretOrSiren: cleanedDigits,
      acceptTerms: true,
    });
  };

  const from = (location.state as any)?.from?.pathname || '/';
  const isJustActivated = new URLSearchParams(location.search).get('activated') === '1';

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onLoginSubmit = async (data: LoginForm) => {
    try {
      await login(data.email, data.password);
      toast.success('Connexion réussie');
      navigate(from, { replace: true });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erreur de connexion');
    }
  };

  const registerForm = useForm<RegisterCompanyForm>({
    resolver: zodResolver(registerCompanySchema),
    defaultValues: {
      companyName: '',
      siretOrSiren: '',
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false as any,
    },
  });

  const onRegisterSubmit = async (data: RegisterCompanyForm) => {
    try {
      const cleanedSiret = data.siretOrSiren.replace(/\s+/g, '');
      await register(
        data.name.trim(),
        data.email.trim(),
        data.password,
        data.companyName.trim(),
        cleanedSiret
      );
      setEmailConfirmationSentTo(data.email.trim());
      setActiveTab('login');
      toast.success("E-mail de confirmation expédié depuis zehair@anelecgroupe.com !");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Erreur lors de la création de l'espace");
    }
  };

  const openLegal = (tabName: 'cgu' | 'rgpd' | 'mentions') => {
    setLegalModalTab(tabName);
    setShowLegalModal(true);
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        position: 'relative',
        background: 'var(--bg-app)',
        color: 'var(--text-primary)',
      }}
    >
      <BubbleBackdrop />

      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: '20px',
          padding: '36px 32px',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.08)',
          position: 'relative',
          zIndex: 2,
          backdropFilter: 'blur(10px)',
        }}
      >
        {/* LOGO & EN-TÊTE SOBRE */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
            <img
              src="/brand/anelec-logo.png"
              alt="Logo"
              className="logo-light-only"
              style={{ height: '48px', objectFit: 'contain' }}
            />
            <img
              src="/brand/anelec-logo-white.png"
              alt="Logo"
              className="logo-dark-only"
              style={{ height: '48px', objectFit: 'contain' }}
            />
          </div>
          <h1
            style={{
              fontSize: '21px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              margin: '0 0 6px 0',
            }}
          >
            Plateforme Métier Multi-Entreprises
          </h1>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--text-secondary)',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Gestion des Devis, Interventions TCE, Dispatch & Planning Techniciens
          </p>
        </div>

                {/* BANNIÈRE DE VALIDATION SI ACTIVÉ VIA LE LIEN D'EMAIL */}
        {isJustActivated && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'rgba(0, 191, 99, 0.1)',
              border: '1px solid rgba(0, 191, 99, 0.35)',
              marginBottom: '20px',
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
              fontSize: '12.5px',
              color: 'var(--text-primary)',
            }}
          >
            <span style={{ fontSize: '20px' }}>✅</span>
            <div>
              <strong>Votre espace entreprise est validé et activé !</strong>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Vous pouvez maintenant vous connecter avec votre email et mot de passe.
              </div>
            </div>
          </div>
        )}

        {/* BANNIÈRE D'ATTENTE DE CONFIRMATION EMAIL */}
        {emailConfirmationSentTo && (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              background: 'rgba(0, 191, 99, 0.08)',
              border: '1px solid rgba(0, 191, 99, 0.3)',
              marginBottom: '20px',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
              fontSize: '12.5px',
              color: 'var(--text-primary)',
              lineHeight: 1.5,
            }}
          >
            <span style={{ fontSize: '22px' }}>📩</span>
            <div>
              <strong>E-mail de confirmation envoyé à {emailConfirmationSentTo}</strong>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Un e-mail d'activation expédié depuis <strong>zehair@anelecgroupe.com</strong> vient de vous être envoyé.
                Veuillez cliquer sur le lien reçu pour <strong>valider les conditions d'utilisation et activer votre espace entreprise</strong> avant de vous connecter.
              </div>
            </div>
          </div>
        )}

        {/* ONGLETS MODERNES */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: 'rgba(0, 0, 0, 0.04)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '4px',
            marginBottom: '24px',
            gap: '4px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('login')}
            style={{
              padding: '10px 12px',
              borderRadius: '9px',
              border: 'none',
              background: activeTab === 'login' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === 'login' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'login' ? 700 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: activeTab === 'login' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Connexion
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('register')}
            style={{
              padding: '10px 12px',
              borderRadius: '9px',
              border: 'none',
              background: activeTab === 'register' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === 'register' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'register' ? 700 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: activeTab === 'register' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 21h18" />
              <path d="M5 21V7l8-4v18" />
              <path d="M19 21V11l-6-4" />
              <line x1="9" y1="9" x2="9" y2="9.01" />
              <line x1="9" y1="13" x2="9" y2="13.01" />
              <line x1="9" y1="17" x2="9" y2="17.01" />
            </svg>
            Créer un Espace Entreprise
          </button>
        </div>

        {/* ONGLET 1 : CONNEXION */}
        {activeTab === 'login' && (
          <form
            onSubmit={loginForm.handleSubmit(onLoginSubmit)}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            noValidate
          >
            {/* BOUTON GOOGLE DIRECT */}
            <button
              type="button"
              onClick={() => triggerGoogleAuth('login')}
              disabled={isGoogleLoading}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-default, #cbd5e1)',
                background: 'var(--bg-elevated, #ffffff)',
                color: 'var(--text-primary, #0f172a)',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>{isGoogleLoading ? 'Connexion Google...' : 'Continuer avec Google'}</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '-4px 0 -4px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle, #e2e8f0)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ou par identifiant classique</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle, #e2e8f0)' }} />
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px',
                }}
              >
                Adresse email professionnelle
              </label>
              <input
                type="email"
                className="input"
                autoComplete="email"
                placeholder="nom@entreprise.fr"
                {...loginForm.register('email')}
              />
              {loginForm.formState.errors.email && (
                <p style={{ color: '#dc2626', fontSize: '11.5px', marginTop: '4px' }}>
                  {loginForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px',
                }}
              >
                <label
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                  }}
                >
                  Mot de passe
                </label>
              </div>
              <input
                type="password"
                className="input"
                autoComplete="current-password"
                placeholder="••••••••"
                {...loginForm.register('password')}
              />
              {loginForm.formState.errors.password && (
                <p style={{ color: '#dc2626', fontSize: '11.5px', marginTop: '4px' }}>
                  {loginForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '11px',
                fontSize: '13.5px',
                fontWeight: 700,
                marginTop: '4px',
              }}
              disabled={loginForm.formState.isSubmitting}
            >
              {loginForm.formState.isSubmitting ? 'Connexion en cours...' : 'Se connecter'}
            </button>
          </form>
        )}

        {/* ONGLET 2 : NOUVEL ESPACE ENTREPRISE (MULTI-TENANT ONBOARDING) */}
        {activeTab === 'register' && (
          <form
            onSubmit={registerForm.handleSubmit(onRegisterSubmit)}
            style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            noValidate
          >
            {/* BOUTON GOOGLE DIRECT INSCRIPTION RAPIDE */}
            <button
              type="button"
              onClick={() => triggerGoogleAuth('register')}
              disabled={isGoogleLoading}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-default, #cbd5e1)',
                background: 'var(--bg-elevated, #ffffff)',
                color: 'var(--text-primary, #0f172a)',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>{isGoogleLoading ? 'Connexion Google...' : 'Inscription directe avec Google'}</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '-4px 0 -2px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle, #e2e8f0)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ou formulaire complet d'entreprise</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle, #e2e8f0)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '5px',
                  }}
                >
                  Nom de l'entreprise *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ex: ANELEC GROUPE"
                  {...registerForm.register('companyName')}
                />
                {registerForm.formState.errors.companyName && (
                  <p style={{ color: '#dc2626', fontSize: '11px', marginTop: '3px' }}>
                    {registerForm.formState.errors.companyName.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '5px',
                  }}
                >
                  N° SIRET ou SIREN *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="14 ou 9 chiffres"
                  {...registerForm.register('siretOrSiren')}
                />
                {registerForm.formState.errors.siretOrSiren && (
                  <p style={{ color: '#dc2626', fontSize: '11px', marginTop: '3px' }}>
                    {registerForm.formState.errors.siretOrSiren.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '5px',
                }}
              >
                Nom et prénom du responsable *
              </label>
              <input
                type="text"
                className="input"
                placeholder="Ex: Jean Dupont"
                {...registerForm.register('name')}
              />
              {registerForm.formState.errors.name && (
                <p style={{ color: '#dc2626', fontSize: '11px', marginTop: '3px' }}>
                  {registerForm.formState.errors.name.message}
                </p>
              )}
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '5px',
                }}
              >
                Email professionnel (identifiant) *
              </label>
              <input
                type="email"
                className="input"
                placeholder="contact@entreprise.fr"
                {...registerForm.register('email')}
              />
              {registerForm.formState.errors.email && (
                <p style={{ color: '#dc2626', fontSize: '11px', marginTop: '3px' }}>
                  {registerForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '5px',
                  }}
                >
                  Mot de passe *
                </label>
                <input
                  type="password"
                  className="input"
                  placeholder="Min. 8 car."
                  {...registerForm.register('password')}
                />
                {registerForm.formState.errors.password && (
                  <p style={{ color: '#dc2626', fontSize: '11px', marginTop: '3px' }}>
                    {registerForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '5px',
                  }}
                >
                  Confirmer le mot de passe *
                </label>
                <input
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  {...registerForm.register('confirmPassword')}
                />
                {registerForm.formState.errors.confirmPassword && (
                  <p style={{ color: '#dc2626', fontSize: '11px', marginTop: '3px' }}>
                    {registerForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>
            </div>

            {/* CASE À COCHER D'ACCEPTATION DES CGU & RGPD (PROTECTION JURIDIQUE) */}
            <div style={{ marginTop: '4px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  fontSize: '11.5px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  lineHeight: 1.45,
                }}
              >
                <input
                  type="checkbox"
                  style={{
                    marginTop: '2px',
                    accentColor: 'var(--accent-primary, #00bf63)',
                    width: '15px',
                    height: '15px',
                    cursor: 'pointer',
                  }}
                  {...registerForm.register('acceptTerms')}
                />
                <span>
                  J'ai lu et j'accepte expressément les{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      openLegal('cgu');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'var(--accent-primary, #00bf63)',
                      fontWeight: 700,
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      fontSize: '11.5px',
                    }}
                  >
                    Conditions Générales (CGU)
                  </button>{' '}
                  et la{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      openLegal('rgpd');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'var(--accent-primary, #00bf63)',
                      fontWeight: 700,
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      fontSize: '11.5px',
                    }}
                  >
                    Politique RGPD
                  </button>
                  . Je reconnais que nos données restent la propriété exclusive de notre entreprise et ne sont pas exploitées par l'hébergeur.
                </span>
              </label>
              {registerForm.formState.errors.acceptTerms && (
                <p style={{ color: '#dc2626', fontSize: '11px', marginTop: '4px' }}>
                  {registerForm.formState.errors.acceptTerms.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '11px',
                fontSize: '13.5px',
                fontWeight: 700,
                marginTop: '6px',
              }}
              disabled={registerForm.formState.isSubmitting}
            >
              {registerForm.formState.isSubmitting
                ? 'Création en cours...'
                : 'Initialiser mon Espace Entreprise'}
            </button>
          </form>
        )}

        {/* PIED DE CARTE & LIENS JURIDIQUES TRANSPARENTS */}
        <div
          style={{
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'center',
            fontSize: '11.5px',
            color: 'var(--text-muted)',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
              justifyContent: 'center',
              fontSize: '11px',
              color: 'var(--text-muted)',
            }}
          >
            <button
              type="button"
              onClick={() => openLegal('cgu')}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '11px',
              }}
            >
              CGU
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => openLegal('rgpd')}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '11px',
              }}
            >
              Politique RGPD
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => openLegal('mentions')}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '11px',
              }}
            >
              Hébergeurs (Supabase & Hostinger)
            </button>
          </div>

          <InstallAppButton variant="banner" />
        </div>
      </div>

      
      {/* MODALE ONBOARDING GOOGLE : COMPLÉTER LES INFORMATIONS DE L'ENTREPRISE (SIRET/SIREN & CGU) */}
      {showGoogleOnboardingModal && pendingGoogleProfile && (
        <div className="inspector-backdrop" onClick={() => !isGoogleLoading && setShowGoogleOnboardingModal(false)}>
          <div
            className="pro-table-container"
            style={{
              maxWidth: '520px',
              width: '92%',
              padding: '24px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              boxShadow: '0 20px 45px rgba(0,0,0,0.3)',
              borderRadius: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {pendingGoogleProfile.picture ? (
                  <img src={pendingGoogleProfile.picture} alt="Google Avatar" style={{ width: '100%', height: '100%' }} />
                ) : (
                  <span style={{ fontSize: '20px' }}>🏢</span>
                )}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                  Finaliser votre Espace Entreprise
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Compte Google certifié : <strong>{pendingGoogleProfile.name}</strong> ({pendingGoogleProfile.email})
                </p>
              </div>
            </div>

            <form onSubmit={handleCompleteGoogleOnboarding} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Nom de l'entreprise *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ex: ANELEC GROUPE"
                  value={googleCompanyName}
                  onChange={(e) => setGoogleCompanyName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  N° SIRET (14 chiffres) ou SIREN (9 chiffres) *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="14 ou 9 chiffres"
                  value={googleSiretOrSiren}
                  onChange={(e) => setGoogleSiretOrSiren(e.target.value)}
                  required
                />
              </div>

              {/* Acceptation des CGU & RGPD */}
              <div style={{ marginTop: '4px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    fontSize: '11.5px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    lineHeight: 1.45,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={googleAcceptTerms}
                    onChange={(e) => setGoogleAcceptTerms(e.target.checked)}
                    style={{ marginTop: '2px', accentColor: '#00bf63', width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span>
                    J'ai lu et j'accepte expressément les{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        openLegal('cgu');
                      }}
                      style={{ background: 'none', border: 'none', padding: 0, color: '#00bf63', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontSize: '11.5px' }}
                    >
                      Conditions Générales (CGU)
                    </button>{' '}
                    et la{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        openLegal('rgpd');
                      }}
                      style={{ background: 'none', border: 'none', padding: 0, color: '#00bf63', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontSize: '11.5px' }}
                    >
                      Politique RGPD
                    </button>
                    . Nos données restent la propriété exclusive de notre entreprise et sont hébergées sur Supabase (France).
                  </span>
                </label>
              </div>

              {googleOnboardingError && (
                <p style={{ color: '#dc2626', fontSize: '12px', margin: '2px 0 0 0' }}>
                  {googleOnboardingError}
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowGoogleOnboardingModal(false)}
                  disabled={isGoogleLoading}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isGoogleLoading}
                  style={{ fontWeight: 700 }}
                >
                  {isGoogleLoading ? 'Création en cours...' : 'Créer et Accéder à mon Espace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE D'ASSISTANCE / MODE TEST GOOGLE OAUTH */}
      {showGoogleConfigModal && (
        <div className="inspector-backdrop" onClick={() => setShowGoogleConfigModal(false)}>
          <div
            className="pro-table-container"
            style={{
              maxWidth: '520px',
              width: '92%',
              padding: '24px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              boxShadow: '0 20px 45px rgba(0,0,0,0.3)',
              borderRadius: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{ fontSize: '24px' }}>🔐</span>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                Connexion Google Direct (OAuth 2.0)
              </h3>
            </div>

            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '14px' }}>
              Le connecteur Google Identity Services est complètement intégré au code backend et frontend de votre application.
            </p>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                fontSize: '12px',
                color: 'var(--text-primary)',
                lineHeight: 1.5,
                marginBottom: '16px',
              }}
            >
              ℹ️ <strong>Pour activer la fenêtre officielle Google en production :</strong>
              <div style={{ marginTop: '6px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                Renseignez simplement la variable <code>GOOGLE_CLIENT_ID</code> dans votre fichier <code>.env</code> (créée gratuitement depuis <em>Google Cloud Console &gt; Identifiants OAuth 2.0 Web</em>).
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setShowGoogleConfigModal(false);
                  const demoEmail = 'artisan.' + Math.floor(1000 + Math.random() * 9000) + '@gmail.com';
                  handleGoogleCredential(`simulated_google_:${demoEmail}:Artisan Partenaire`);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                }}
              >
                <span>🚀</span>
                <span>Tester l'Inscription Google Immédiate (Simulation en direct)</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowGoogleConfigModal(false)}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE CGU & RGPD */}
      <LegalTermsModal
        isOpen={showLegalModal}
        onClose={() => setShowLegalModal(false)}
        onAccept={() => registerForm.setValue('acceptTerms', true, { shouldValidate: true })}
        defaultTab={legalModalTab}
      />
    </div>
  );
}
