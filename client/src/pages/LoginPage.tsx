import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../stores/authStore';
import toast from 'react-hot-toast';

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Mot de passe trop court (min 8 caractères)'),
});

type LoginForm = z.infer<typeof loginSchema>;

const registerSchema = loginSchema
  .extend({
    name: z.string().min(1, 'Nom requis').max(100),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isRegister, setIsRegister] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/';

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onLoginSubmit = async (data: LoginForm) => {
    try {
      await login(data.email, data.password);
      toast.success('Bienvenue sur ANELEC Dispatch Pro');
      navigate(from, { replace: true });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erreur de connexion');
    }
  };

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const onRegisterSubmit = async (data: RegisterForm) => {
    try {
      await register(data.name, data.email, data.password);
      toast.success('Compte créé avec succès');
      navigate(from, { replace: true });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Erreur d'inscription");
    }
  };

  const handleOneClickDemo = async () => {
    try {
      await login('demo@suivi-tce.fr', 'demo1234');
      toast.success('Session Démo ANELEC ouverte');
      navigate(from, { replace: true });
    } catch {
      loginForm.setValue('email', 'demo@suivi-tce.fr');
      loginForm.setValue('password', 'demo1234');
    }
  };

  return (
    <div className="auth-split-layout">
      {/* LEFT SHOWCASE PANE */}
      <div
        className="auth-showcase-pane"
        style={{
          padding: '48px 56px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background:
            'radial-gradient(circle at 18% 20%, rgba(59, 130, 246, 0.22) 0%, transparent 45%), radial-gradient(circle at 80% 80%, rgba(168, 85, 247, 0.18) 0%, transparent 50%), #080b11',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              border: '1px solid rgba(59, 130, 246, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 100 100" fill="none">
              <path d="M50 10 L14 88 H33 L42 67 H58 L50 47 L67 88 H86 L50 10 Z" fill="#ffffff" />
              <polygon points="47,54 57,54 51,69 61,69 44,92 49,73 41,73" fill="#3b82f6" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '0.08em' }}>ANELEC GROUPE</div>
            <div style={{ fontSize: '11px', color: '#60a5fa', fontWeight: 700, letterSpacing: '0.14em' }}>
              FIELD SERVICE & DISPATCH SUITE
            </div>
          </div>
        </div>

        <div style={{ maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '5px 12px',
              borderRadius: '999px',
              background: 'rgba(59, 130, 246, 0.14)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              color: '#93c5fd',
              fontSize: '11.5px',
              fontWeight: 600,
              width: 'fit-content',
            }}
          >
            Architecture inspirée de ServiceTitan, Jobber & Praxedo
          </div>
          <h1 style={{ fontSize: '34px', fontWeight: 800, lineHeight: 1.18, letterSpacing: '-0.02em' }}>
            Pilotage Devis, Interventions & Planning Techniciens Temps Réel.
          </h1>
          <p style={{ fontSize: '14.5px', color: '#94a3b8', lineHeight: 1.6 }}>
            Classification automatique des <strong>45 colonnes métier ANELEC</strong>, conversion Devis → Intervention sans perte d'historique, et console de planification multi-ressources maniable à la souris et au clavier.
          </p>

          {/* Mini Interactive Visual Preview */}
          <div
            style={{
              marginTop: '12px',
              background: 'rgba(18, 22, 32, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '14px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#94a3b8' }}>
              <span style={{ fontWeight: 700, color: '#e2e8f0' }}>CONSOLE DISPATCH • TIMELINE GANTT</span>
              <span className="font-mono" style={{ color: '#60a5fa' }}>07:00 ──────── 19:00</span>
            </div>
            {[
              { tech: 'Anouar', role: 'Élec / CFO-CFA', slot1: '08:00 - 11:30 • Visite Devis #2052', c1: '#a855f7', slot2: '13:30 - 17:00 • Travaux #INT-104', c2: '#3b82f6' },
              { tech: 'Mohamed', role: 'CVC / Plomberie', slot1: '08:30 - 12:30 • Urgence Dépannage', c1: '#ef4444', slot2: '14:00 - 17:30 • Maintenance TCE', c2: '#3b82f6' },
            ].map((row) => (
              <div
                key={row.tech}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '125px 1fr 1fr',
                  gap: '8px',
                  alignItems: 'center',
                  padding: '8px 10px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '8px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '12px' }}>{row.tech}</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>{row.role}</div>
                </div>
                <div
                  className="font-mono"
                  style={{
                    fontSize: '10.5px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: `${row.c1}22`,
                    borderLeft: `3px solid ${row.c1}`,
                    color: '#f8fafc',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {row.slot1}
                </div>
                <div
                  className="font-mono"
                  style={{
                    fontSize: '10.5px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: `${row.c2}22`,
                    borderLeft: `3px solid ${row.c2}`,
                    color: '#f8fafc',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {row.slot2}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
          <span>© ANELEC Groupe • Tous Corps d'État</span>
          <span>Fuseau métier : Europe/Paris</span>
        </div>
      </div>

      {/* RIGHT LOGIN FORM PANE */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
          background: '#0d1017',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '400px',
            display: 'flex',
            flexDirection: 'column',
            gap: '22px',
          }}
        >
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc' }}>
              {isRegister ? 'Créer un compte Dispatcher' : 'Connexion à votre espace'}
            </h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
              Accédez au centre de pilotage Devis, Interventions & Planning.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOneClickDemo}
            className="btn btn-ai-dispatch"
            style={{ width: '100%', padding: '10px 14px', fontSize: '13px' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Accès Instantané • Démo ANELEC (1-Clic)
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#64748b', fontSize: '11px' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
            <span>OU IDENTIFIANTS</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
          </div>

          <form
            onSubmit={isRegister ? registerForm.handleSubmit(onRegisterSubmit) : loginForm.handleSubmit(onLoginSubmit)}
            style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            noValidate
          >
            {isRegister && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '5px' }}>
                  Nom complet *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ex: Jean-Luc Responsable"
                  {...registerForm.register('name')}
                />
                {registerForm.formState.errors.name && (
                  <p style={{ color: '#f87171', fontSize: '11.5px', marginTop: '4px' }}>
                    {registerForm.formState.errors.name.message}
                  </p>
                )}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '5px' }}>
                Adresse email *
              </label>
              <input
                type="email"
                className="input"
                placeholder="demo@suivi-tce.fr"
                {...(isRegister ? registerForm.register('email') : loginForm.register('email'))}
              />
              {(isRegister ? registerForm.formState.errors.email : loginForm.formState.errors.email) && (
                <p style={{ color: '#f87171', fontSize: '11.5px', marginTop: '4px' }}>
                  {(isRegister ? registerForm.formState.errors.email : loginForm.formState.errors.email)?.message}
                </p>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '5px' }}>
                Mot de passe *
              </label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                {...(isRegister ? registerForm.register('password') : loginForm.register('password'))}
              />
              {(isRegister ? registerForm.formState.errors.password : loginForm.formState.errors.password) && (
                <p style={{ color: '#f87171', fontSize: '11.5px', marginTop: '4px' }}>
                  {(isRegister ? registerForm.formState.errors.password : loginForm.formState.errors.password)?.message}
                </p>
              )}
            </div>

            {isRegister && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '5px' }}>
                  Confirmer le mot de passe *
                </label>
                <input
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  {...registerForm.register('confirmPassword')}
                />
                {registerForm.formState.errors.confirmPassword && (
                  <p style={{ color: '#f87171', fontSize: '11.5px', marginTop: '4px' }}>
                    {registerForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '10px', marginTop: '4px', fontSize: '13px' }}
              disabled={isRegister ? registerForm.formState.isSubmitting : loginForm.formState.isSubmitting}
            >
              {isRegister ? 'Créer mon compte' : 'Se connecter'}
            </button>
          </form>

          <div style={{ textAlign: 'center', fontSize: '12.5px', color: '#94a3b8' }}>
            {isRegister ? 'Déjà inscrit ?' : 'Nouveau dispatcher ?'}{' '}
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                loginForm.reset();
                registerForm.reset();
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#60a5fa',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isRegister ? 'Se connecter' : 'Créer un compte'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
