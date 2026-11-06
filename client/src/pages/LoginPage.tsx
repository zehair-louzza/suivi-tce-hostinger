import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../stores/authStore';
import toast from 'react-hot-toast';
import { BubbleBackdrop } from '../components/BubbleBackdrop';
import { InstallAppButton } from '../components/InstallAppButton';

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
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

type RegisterCompanyForm = z.infer<typeof registerCompanySchema>;

export function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  const from = (location.state as any)?.from?.pathname || '/';

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
      toast.success(`Espace entreprise "${data.companyName.trim()}" initialisé avec succès !`);
      navigate(from, { replace: true });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Erreur lors de la création de l'espace");
    }
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

        {/* PIED DE CARTE ÉPURÉ */}
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
          <InstallAppButton variant="banner" />
        </div>
      </div>
    </div>
  );
}
