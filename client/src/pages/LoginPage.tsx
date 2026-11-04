// Login Page
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
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

const registerSchema = loginSchema.extend({
  name: z.string().min(1, 'Nom requis').max(100),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
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

  // Login form
  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onLoginSubmit = async (data: LoginForm) => {
    try {
      await login(data.email, data.password);
      toast.success('Connexion réussie !');
      navigate(from, { replace: true });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erreur de connexion');
    }
  };

  // Register form
  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const onRegisterSubmit = async (data: RegisterForm) => {
    try {
      await register(data.name, data.email, data.password);
      toast.success('Inscription réussie !');
      navigate(from, { replace: true });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erreur d\'inscription');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <BrandIcon />
          <h1>Suivi TCE</h1>
          <p>{isRegister ? 'Créer un compte' : 'Se connecter'}</p>
        </div>

        <form onSubmit={isRegister ? registerForm.handleSubmit(onRegisterSubmit) : loginForm.handleSubmit(onLoginSubmit)} className="auth-form" noValidate>
          {isRegister && (
            <div className="form-group">
              <label htmlFor="name" className="form-label">
                Nom <span className="form-required">*</span>
              </label>
              <input
                id="name"
                type="text"
                className="input"
                placeholder="Votre nom"
                {...registerForm.register('name')}
                autoComplete="name"
              />
              {registerForm.formState.errors.name && (
                <p className="form-error">{registerForm.formState.errors.name.message}</p>
              )}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email <span className="form-required">*</span>
            </label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="vous@exemple.fr"
              {...(isRegister ? registerForm.register('email') : loginForm.register('email'))}
              autoComplete="email"
            />
            {(isRegister ? registerForm.formState.errors.email : loginForm.formState.errors.email) && (
              <p className="form-error">
                {(isRegister ? registerForm.formState.errors.email : loginForm.formState.errors.email).message}
              </p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Mot de passe <span className="form-required">*</span>
            </label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="••••••••"
              {...(isRegister ? registerForm.register('password') : loginForm.register('password'))}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
            {(isRegister ? registerForm.formState.errors.password : loginForm.formState.errors.password) && (
              <p className="form-error">
                {(isRegister ? registerForm.formState.errors.password : loginForm.formState.errors.password).message}
              </p>
            )}
          </div>

          {isRegister && (
            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                Confirmer le mot de passe <span className="form-required">*</span>
              </label>
              <input
                id="confirmPassword"
                type="password"
                className="input"
                placeholder="••••••••"
                {...registerForm.register('confirmPassword')}
                autoComplete="new-password"
              />
              {registerForm.formState.errors.confirmPassword && (
                <p className="form-error">{registerForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-primary auth-submit"
            disabled={isRegister ? registerForm.formState.isSubmitting : loginForm.formState.isSubmitting}
          >
            {isRegister ? 'Créer mon compte' : 'Se connecter'}
          </button>
        </form>

        <p className="auth-switch">
          {isRegister ? 'Déjà un compte ?' : 'Pas encore de compte ?'} 
          <button 
            type="button" 
            className="btn btn-ghost btn-pill auth-switch-btn"
            onClick={() => { setIsRegister(!isRegister); loginForm.reset(); registerForm.reset(); }}
          >
            {isRegister ? 'Se connecter' : 'S\'inscrire'}
          </button>
        </p>

        <div className="auth-demo">
          <p className="auth-demo-title">Compte de démo</p>
          <p className="auth-demo-credentials">
            Email: <code>demo@suivi-tce.fr</code><br />
            Mot de passe: <code>demo1234</code>
          </p>
          <button 
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              if (isRegister) {
                registerForm.setValue('email', 'demo@suivi-tce.fr');
                registerForm.setValue('password', 'demo1234');
                registerForm.setValue('confirmPassword', 'demo1234');
                registerForm.setValue('name', 'Utilisateur Demo');
              } else {
                loginForm.setValue('email', 'demo@suivi-tce.fr');
                loginForm.setValue('password', 'demo1234');
              }
            }}
          >
            Remplir avec le compte démo
          </button>
        </div>
      </div>
    </div>
  );
}

function BrandIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 12h6" strokeWidth="2" />
      <path d="M12 9v6" strokeWidth="2" />
    </svg>
  );
}