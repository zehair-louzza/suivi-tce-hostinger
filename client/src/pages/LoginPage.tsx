import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../stores/authStore';
import { authApi } from '../lib/api';
import toast from 'react-hot-toast';
import { BubbleBackdrop } from '../components/BubbleBackdrop';
import { InstallAppButton } from '../components/InstallAppButton';
import { LegalTermsModal } from '../components/LegalTermsModal';
import {
  ProCheckIcon,
  ProMailIcon,
  ProRefreshIcon,
  ProExternalIcon,
  ProShieldIcon,
  ProLockIcon,
} from '../components/ProIcons';

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe trop court (min 6 caractères)'),
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

function decodeJwtPayload(token: string): { email?: string; name?: string; picture?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function LoginPage() {
  const { login, register, loginWithGoogle, confirmSupabaseToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Restauration immédiate d'un compte Google sélectionné en sessionStorage pour ne JAMAIS revenir à la 1ère page
  const [pendingGoogleCredential, setPendingGoogleCredential] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('anelec_google_credential');
    } catch {
      return null;
    }
  });
  const [pendingGoogleProfile, setPendingGoogleProfile] = useState<{
    email: string;
    name: string;
    picture?: string;
  } | null>(() => {
    try {
      const raw = sessionStorage.getItem('anelec_google_profile');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<'login' | 'register'>(() => {
    try {
      if (sessionStorage.getItem('anelec_google_profile')) return 'register';
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('tab') === 'register') return 'register';
      const hash = window.location.hash || sessionStorage.getItem('anelec_oauth_hash') || '';
      if (hash.includes('state=register')) return 'register';
    } catch {
      // ignore
    }
    return 'login';
  });

  const [emailConfirmationSentTo, setEmailConfirmationSentTo] = useState<string | null>(null);
  const [lastDeliveryPreviewUrl, setLastDeliveryPreviewUrl] = useState<string | null>(null);
  const [lastActivationLink, setLastActivationLink] = useState<string | null>(null);
  const [isResendingEmail, setIsResendingEmail] = useState(false);

  // Mot de passe oublié / Réinitialisation
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingForgot, setIsSendingForgot] = useState(false);
  const [forgotPreviewUrl, setForgotPreviewUrl] = useState<string | null>(null);

  const searchParams = new URLSearchParams(location.search);
  const resetTokenFromUrl = searchParams.get('resetToken');
  const resetEmailFromUrl = searchParams.get('email') || '';
  const [newResetPassword, setNewResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<'cgu' | 'rgpd' | 'mentions'>('cgu');

  // Google OAuth State
  const googleClientId = '116679717813-chmnnnkeghjf6qs78qrts9m2o7dl4p20.apps.googleusercontent.com';

  const getGoogleAuthUrl = (tab: 'login' | 'register') => {
    const origin =
      typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : 'https://suivi.anelecgroupe.com';
    const redirectUri = `${origin}/login`;
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
      googleClientId
    )}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=token%20id_token&scope=openid%20email%20profile&nonce=${Date.now()}&prompt=select_account&state=${tab}`;
  };

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleOnboardingError, setGoogleOnboardingError] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/';
  const isJustActivated = searchParams.get('activated') === '1';

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const registerForm = useForm<RegisterCompanyForm>({
    resolver: zodResolver(registerCompanySchema),
    defaultValues: {
      companyName: sessionStorage.getItem('pending_google_company_name') || '',
      siretOrSiren: sessionStorage.getItem('pending_google_siret') || '',
      name: pendingGoogleProfile?.name || '',
      email: pendingGoogleProfile?.email || '',
      password: pendingGoogleProfile ? 'GoogleAuth!2026Valid' : '',
      confirmPassword: pendingGoogleProfile ? 'GoogleAuth!2026Valid' : '',
      acceptTerms: (sessionStorage.getItem('pending_google_terms') === 'true') as any,
    },
  });

  // Synchronise les champs du formulaire d'inscription dès qu'un profil Google est sélectionné
  useEffect(() => {
    if (pendingGoogleProfile) {
      setActiveTab('register');
      if (pendingGoogleProfile.name) {
        registerForm.setValue('name', pendingGoogleProfile.name, { shouldValidate: true });
      }
      if (pendingGoogleProfile.email) {
        registerForm.setValue('email', pendingGoogleProfile.email, { shouldValidate: true });
      }
      registerForm.setValue('password', 'GoogleAuth!2026Valid', { shouldValidate: false });
      registerForm.setValue('confirmPassword', 'GoogleAuth!2026Valid', { shouldValidate: false });
    }
  }, [pendingGoogleProfile, registerForm]);

  const saveGoogleSelection = (
    credential: string,
    profile: { email: string; name: string; picture?: string }
  ) => {
    setPendingGoogleCredential(credential);
    setPendingGoogleProfile(profile);
    try {
      sessionStorage.setItem('anelec_google_credential', credential);
      sessionStorage.setItem('anelec_google_profile', JSON.stringify(profile));
    } catch {
      // ignore
    }
  };

  const clearGoogleSelection = () => {
    setPendingGoogleCredential(null);
    setPendingGoogleProfile(null);
    try {
      sessionStorage.removeItem('anelec_google_credential');
      sessionStorage.removeItem('anelec_google_profile');
      sessionStorage.removeItem('pending_google_company_name');
      sessionStorage.removeItem('pending_google_siret');
      sessionStorage.removeItem('pending_google_terms');
    } catch {
      // ignore
    }
  };

  // Traitement du retour Google OAuth 2.0 ou confirmation Supabase Auth (Hash fragment)
  useEffect(() => {
    const rawHash =
      (window.location.hash ? window.location.hash.replace(/^#/, '') : '') ||
      sessionStorage.getItem('anelec_oauth_hash') ||
      '';

    if (!rawHash) return;

    sessionStorage.removeItem('anelec_oauth_hash');
    const params = new URLSearchParams(rawHash);
    const idToken = params.get('id_token');
    const accessToken = params.get('access_token');
    const tokenType = params.get('type');
    const state = params.get('state');

    // Nettoyer le hash de l'URL
    window.history.replaceState(null, '', window.location.pathname + window.location.search);

    // Cas 1 : Lien de confirmation d'e-mail Supabase Auth (#access_token=...&type=signup)
    if (accessToken && (tokenType === 'signup' || tokenType === 'recovery' || tokenType === 'magiclink')) {
      confirmSupabaseToken(accessToken)
        .then((res) => {
          toast.success(res.message || 'Votre adresse e-mail a été confirmée et votre compte est activé !');
          navigate(from, { replace: true });
        })
        .catch((err) => {
          toast.error(err.response?.data?.error || 'Lien de confirmation expiré ou déjà utilisé');
        });
      return;
    }

    // Cas 2 : Retour Google OAuth 2.0
    const googleToken = idToken || accessToken;
    if (googleToken) {
      if (state === 'register') {
        setActiveTab('register');
      }

      // Décodage immédiat du profil Google depuis l'id_token s'il est présent pour pré-remplir instantanément les champs
      if (idToken) {
        const decoded = decodeJwtPayload(idToken);
        if (decoded?.email) {
          saveGoogleSelection(googleToken, {
            email: decoded.email,
            name: decoded.name || decoded.email.split('@')[0],
            picture: decoded.picture,
          });
        }
      }

      const pendingName = sessionStorage.getItem('pending_google_company_name') || '';
      const pendingSiret = sessionStorage.getItem('pending_google_siret') || '';
      const pendingTerms = sessionStorage.getItem('pending_google_terms') === 'true';

      if (pendingName) registerForm.setValue('companyName', pendingName);
      if (pendingSiret) registerForm.setValue('siretOrSiren', pendingSiret);
      if (pendingTerms) registerForm.setValue('acceptTerms', true as any);

      handleGoogleCredential(googleToken, {
        companyName: pendingName,
        siretOrSiren: pendingSiret,
        acceptTerms: pendingTerms,
      });
    }
  }, []);

  const handleGoogleCredential = async (
    credential: string,
    extraCompanyInfo?: { name?: string; companyName: string; siretOrSiren: string; acceptTerms: boolean }
  ) => {
    setIsGoogleLoading(true);
    setGoogleOnboardingError(null);
    try {
      const regValues = registerForm.getValues();
      const compName = extraCompanyInfo?.companyName ?? regValues.companyName ?? '';
      const siretVal = extraCompanyInfo?.siretOrSiren ?? regValues.siretOrSiren ?? '';
      const termsVal = extraCompanyInfo?.acceptTerms ?? Boolean(regValues.acceptTerms);
      const userName = extraCompanyInfo?.name || regValues.name || undefined;

      const payload = {
        credential,
        name: userName,
        companyName: compName.trim() || undefined,
        siretOrSiren: siretVal.trim() || undefined,
        acceptTerms: termsVal,
      };

      const res = await loginWithGoogle(payload);

      if (res.requiresCompanyInfo && res.googleProfile) {
        // Sauvegarde du compte Google sélectionné et bascule sur l'onglet Créer un Espace Entreprise
        // en pré-remplissant Nom + Email et en demandant UNIQUEMENT les cases non remplies !
        saveGoogleSelection(credential, res.googleProfile);
        setActiveTab('register');
        registerForm.setValue('name', res.googleProfile.name || '', { shouldValidate: true });
        registerForm.setValue('email', res.googleProfile.email || '', { shouldValidate: true });
        registerForm.setValue('password', 'GoogleAuth!2026Valid', { shouldValidate: false });
        registerForm.setValue('confirmPassword', 'GoogleAuth!2026Valid', { shouldValidate: false });
        if (compName) registerForm.setValue('companyName', compName);
        if (siretVal) registerForm.setValue('siretOrSiren', siretVal);

        toast.success(
          `Compte Google sélectionné (${res.googleProfile.email}). Complétez uniquement les champs restants de votre entreprise.`,
          { duration: 5000 }
        );

        // Focus automatique sur le premier champ non rempli
        setTimeout(() => {
          if (!compName.trim()) {
            registerForm.setFocus('companyName');
          } else if (!siretVal.trim()) {
            registerForm.setFocus('siretOrSiren');
          }
        }, 120);
      } else {
        clearGoogleSelection();
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

  const onLoginSubmit = async (data: LoginForm) => {
    try {
      await login(data.email, data.password);
      toast.success('Connexion réussie');
      navigate(from, { replace: true });
    } catch (err: any) {
      const code = err.response?.data?.code;
      const errMsg = err.response?.data?.error || 'Erreur de connexion';
      if (code === 'EMAIL_NOT_CONFIRMED') {
        setEmailConfirmationSentTo(data.email.trim());
      }
      toast.error(errMsg);
    }
  };

  const onRegisterSubmit = async (data: RegisterCompanyForm) => {
    const cleanedSiret = data.siretOrSiren.replace(/\s+/g, '');

    // Si un compte Google a été sélectionné pour l'inscription rapide, on finalise directement avec Google
    if (pendingGoogleCredential && pendingGoogleProfile) {
      await handleGoogleCredential(pendingGoogleCredential, {
        name: data.name.trim(),
        companyName: data.companyName.trim(),
        siretOrSiren: cleanedSiret,
        acceptTerms: Boolean(data.acceptTerms),
      });
      return;
    }

    try {
      const resData = await register(
        data.name.trim(),
        data.email.trim(),
        data.password,
        data.companyName.trim(),
        cleanedSiret
      );
      setEmailConfirmationSentTo(data.email.trim());
      setLastDeliveryPreviewUrl(resData?.previewUrl || null);
      setLastActivationLink(resData?.activationLink || null);
      loginForm.setValue('email', data.email.trim());
      registerForm.reset();
      setActiveTab('login');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast.success('E-mail de confirmation envoyé pour activer votre espace entreprise !');
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Erreur lors de la création de l'espace");
    }
  };

  const handleResendConfirmation = async (targetEmail?: string) => {
    const emailToUse = (targetEmail || emailConfirmationSentTo || loginForm.getValues('email') || '').trim();
    if (!emailToUse) {
      toast.error('Veuillez saisir votre adresse e-mail');
      return;
    }
    setIsResendingEmail(true);
    try {
      const res = await authApi.resendConfirmation(emailToUse);
      if (res.data.alreadyConfirmed) {
        toast.success(res.data.message);
        setEmailConfirmationSentTo(null);
        return;
      }
      setEmailConfirmationSentTo(emailToUse);
      if (res.data.previewUrl) setLastDeliveryPreviewUrl(res.data.previewUrl);
      if (res.data.activationLink) setLastActivationLink(res.data.activationLink);
      toast.success(res.data.message || `E-mail de confirmation renvoyé à ${emailToUse}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Erreur lors du renvoi de l'e-mail");
    } finally {
      setIsResendingEmail(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error('Veuillez saisir votre adresse e-mail');
      return;
    }
    setIsSendingForgot(true);
    setForgotPreviewUrl(null);
    try {
      const res = await authApi.forgotPassword(forgotEmail.trim());
      toast.success(res.data.message);
      if (res.data.previewUrl) {
        setForgotPreviewUrl(res.data.previewUrl);
      } else {
        setShowForgotModal(false);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erreur lors de la demande de réinitialisation');
    } finally {
      setIsSendingForgot(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTokenFromUrl) return;
    if (newResetPassword.length < 8) {
      toast.error('Le nouveau mot de passe doit contenir au moins 8 caractères');
      return;
    }
    if (newResetPassword !== confirmResetPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    setIsResettingPassword(true);
    try {
      const res = await authApi.resetPassword(resetTokenFromUrl, newResetPassword);
      toast.success(res.data.message || 'Mot de passe réinitialisé avec succès !');
      window.location.href = '/';
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Lien de réinitialisation invalide ou expiré');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const openLegal = (tabName: 'cgu' | 'rgpd' | 'mentions') => {
    setLegalModalTab(tabName);
    setShowLegalModal(true);
  };

  const watchedCompanyName = registerForm.watch('companyName');
  const watchedSiret = registerForm.watch('siretOrSiren');

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
          maxWidth: '540px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: '20px',
          padding: '34px 30px',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.08)',
          position: 'relative',
          zIndex: 2,
          backdropFilter: 'blur(10px)',
        }}
      >
        {/* LOGO & EN-TÊTE SOBRE */}
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
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

        {/* FORMULAIRE DE RÉINITIALISATION SI ?resetToken=... DANS L'URL */}
        {resetTokenFromUrl && (
          <form
            onSubmit={handleResetPasswordSubmit}
            style={{
              padding: '18px',
              borderRadius: '14px',
              background: 'rgba(2, 132, 199, 0.08)',
              border: '1px solid rgba(2, 132, 199, 0.35)',
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ProLockIcon size={16} color="#0284c7" />
              <span>Définir votre nouveau mot de passe {resetEmailFromUrl ? `(${resetEmailFromUrl})` : ''}</span>
            </div>
            <input
              type="password"
              className="input"
              placeholder="Nouveau mot de passe (min. 8 caractères)"
              value={newResetPassword}
              onChange={(e) => setNewResetPassword(e.target.value)}
              required
            />
            <input
              type="password"
              className="input"
              placeholder="Confirmer le nouveau mot de passe"
              value={confirmResetPassword}
              onChange={(e) => setConfirmResetPassword(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary" disabled={isResettingPassword}>
              {isResettingPassword ? 'Enregistrement...' : 'Valider mon nouveau mot de passe'}
            </button>
          </form>
        )}

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
            <ProCheckIcon size={20} color="#00bf63" />
            <div>
              <strong>Votre espace entreprise est validé et activé !</strong>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Vous pouvez maintenant vous connecter avec votre email et mot de passe.
              </div>
            </div>
          </div>
        )}

        {/* BANNIÈRE D'ATTENTE DE CONFIRMATION EMAIL + BOUTON RENVOYER */}
        {emailConfirmationSentTo && (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              background: 'rgba(0, 191, 99, 0.08)',
              border: '1px solid rgba(0, 191, 99, 0.3)',
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              fontSize: '12.5px',
              color: 'var(--text-primary)',
              lineHeight: 1.5,
            }}
          >
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: 'rgba(0, 191, 99, 0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ProMailIcon size={18} color="#00bf63" />
              </div>
              <div style={{ flex: 1 }}>
                <strong>E-mail de confirmation envoyé à {emailConfirmationSentTo}</strong>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Un e-mail d'activation expédié depuis <strong>zehair@anelecgroupe.com</strong> vous a été adressé.
                  Cliquez sur le lien reçu pour <strong>valider les conditions et activer votre espace entreprise</strong>.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingLeft: '46px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleResendConfirmation(emailConfirmationSentTo)}
                disabled={isResendingEmail}
                style={{
                  fontSize: '11.5px',
                  padding: '6px 12px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <ProRefreshIcon size={13} />
                <span>{isResendingEmail ? 'Renvoi en cours...' : "Renvoyer l'e-mail de confirmation"}</span>
              </button>

              {lastDeliveryPreviewUrl && (
                <a
                  href={lastDeliveryPreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                  style={{
                    fontSize: '11.5px',
                    padding: '6px 12px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    color: '#0284c7',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <ProExternalIcon size={13} color="#0284c7" />
                  <span>Visualiser l'e-mail envoyé</span>
                </a>
              )}

              {lastActivationLink && (
                <a
                  href={lastActivationLink}
                  className="btn btn-primary"
                  style={{
                    fontSize: '11.5px',
                    padding: '6px 12px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <ProShieldIcon size={14} color="#ffffff" />
                  <span>Activer directement mon espace</span>
                </a>
              )}
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
            marginBottom: '22px',
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
            <a
              href={getGoogleAuthUrl('login')}
              onClick={() => setIsGoogleLoading(true)}
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-default, #cbd5e1)',
                background: 'var(--bg-elevated, #ffffff)',
                color: 'var(--text-primary, #0f172a)',
                fontSize: '13.5px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                cursor: 'pointer',
                textDecoration: 'none',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                boxSizing: 'border-box',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Continuer avec Google</span>
            </a>

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
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(loginForm.getValues('email') || '');
                    setForgotPreviewUrl(null);
                    setShowForgotModal(true);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: 'var(--accent-primary, #00bf63)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Mot de passe oublié ?
                </button>
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

            <div style={{ textAlign: 'center', marginTop: '-4px' }}>
              <button
                type="button"
                onClick={() => {
                  const currentEmail = loginForm.getValues('email');
                  if (currentEmail) {
                    handleResendConfirmation(currentEmail);
                  } else {
                    toast('Saisissez votre adresse e-mail ci-dessus puis cliquez ici pour renvoyer le lien d’activation.');
                  }
                }}
                disabled={isResendingEmail}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '11.5px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Vous n'avez pas reçu l'e-mail d'activation ? Renvoyer le lien de confirmation
              </button>
            </div>
          </form>
        )}

        {/* ONGLET 2 : NOUVEL ESPACE ENTREPRISE (MULTI-TENANT ONBOARDING + GOOGLE RAPIDE) */}
        {activeTab === 'register' && (
          <form
            onSubmit={registerForm.handleSubmit(onRegisterSubmit)}
            style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            noValidate
          >
            {/* SI UN COMPTE GOOGLE EST SÉLECTIONNÉ : AFFICHER LA CARTE DU COMPTE ENREGISTRÉ ET DEMANDER UNIQUEMENT LES CHAMPS MANQUANTS */}
            {pendingGoogleProfile ? (
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  background: 'rgba(0, 191, 99, 0.1)',
                  border: '1.5px solid rgba(0, 191, 99, 0.45)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {pendingGoogleProfile.picture ? (
                      <img
                        src={pendingGoogleProfile.picture}
                        alt="Google"
                        style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px solid #00bf63' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: '#00bf63',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '15px',
                        }}
                      >
                        {pendingGoogleProfile.name?.charAt(0)?.toUpperCase() || 'G'}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ProCheckIcon size={15} color="#00bf63" />
                        <span>Compte Google sélectionné : {pendingGoogleProfile.name}</span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                        {pendingGoogleProfile.email} • Identité vérifiée par Google
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      clearGoogleSelection();
                      registerForm.setValue('password', '');
                      registerForm.setValue('confirmPassword', '');
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.8)',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '5px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      color: '#334155',
                    }}
                  >
                    Changer
                  </button>
                </div>
                <div
                  style={{
                    fontSize: '11.5px',
                    color: '#166534',
                    background: 'rgba(255,255,255,0.65)',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    fontWeight: 600,
                  }}
                >
                  → Vos informations Google ont été enregistrées. Veuillez simplement remplir les cases restantes ci-dessous (Nom de l'entreprise, N° SIRET/SIREN et acceptation des CGU).
                </div>
              </div>
            ) : (
              <>
                {/* BOUTON GOOGLE DIRECT INSCRIPTION RAPIDE */}
                <a
                  href={getGoogleAuthUrl('register')}
                  onClick={() => {
                    setIsGoogleLoading(true);
                    const regValues = registerForm.getValues();
                    if (regValues.companyName)
                      sessionStorage.setItem('pending_google_company_name', regValues.companyName);
                    if (regValues.siretOrSiren)
                      sessionStorage.setItem('pending_google_siret', regValues.siretOrSiren);
                    if (regValues.acceptTerms) sessionStorage.setItem('pending_google_terms', 'true');
                  }}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-default, #cbd5e1)',
                    background: 'var(--bg-elevated, #ffffff)',
                    color: 'var(--text-primary, #0f172a)',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    boxSizing: 'border-box',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Inscription directe avec Google</span>
                </a>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '-4px 0 -2px 0' }}>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle, #e2e8f0)' }} />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ou formulaire complet d'entreprise</span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle, #e2e8f0)' }} />
                </div>
              </>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '5px',
                  }}
                >
                  <span>Nom de l'entreprise *</span>
                  {pendingGoogleProfile && !watchedCompanyName?.trim() && (
                    <span
                      style={{
                        fontSize: '10px',
                        background: '#fef3c7',
                        color: '#b45309',
                        padding: '1px 6px',
                        borderRadius: '99px',
                        fontWeight: 700,
                      }}
                    >
                      À remplir
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ex: ANELEC GROUPE"
                  style={
                    pendingGoogleProfile && !watchedCompanyName?.trim()
                      ? { borderColor: '#f59e0b', boxShadow: '0 0 0 2px rgba(245, 158, 11, 0.15)' }
                      : undefined
                  }
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
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '5px',
                  }}
                >
                  <span>N° SIRET ou SIREN *</span>
                  {pendingGoogleProfile && !watchedSiret?.trim() && (
                    <span
                      style={{
                        fontSize: '10px',
                        background: '#fef3c7',
                        color: '#b45309',
                        padding: '1px 6px',
                        borderRadius: '99px',
                        fontWeight: 700,
                      }}
                    >
                      À remplir
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="14 ou 9 chiffres"
                  style={
                    pendingGoogleProfile && !watchedSiret?.trim()
                      ? { borderColor: '#f59e0b', boxShadow: '0 0 0 2px rgba(245, 158, 11, 0.15)' }
                      : undefined
                  }
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
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '5px',
                }}
              >
                <span>Nom et prénom du responsable *</span>
                {pendingGoogleProfile && (
                  <span style={{ fontSize: '10px', color: '#00bf63', fontWeight: 700 }}>
                    ✓ Pré-rempli via Google
                  </span>
                )}
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
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '5px',
                }}
              >
                <span>Email professionnel (identifiant) *</span>
                {pendingGoogleProfile && (
                  <span style={{ fontSize: '10px', color: '#00bf63', fontWeight: 700 }}>
                    ✓ Certifié par Google
                  </span>
                )}
              </label>
              <input
                type="email"
                className="input"
                placeholder="contact@entreprise.fr"
                readOnly={Boolean(pendingGoogleProfile)}
                style={
                  pendingGoogleProfile
                    ? { background: 'rgba(0, 191, 99, 0.06)', borderColor: 'rgba(0, 191, 99, 0.4)', fontWeight: 600 }
                    : undefined
                }
                {...registerForm.register('email')}
              />
              {registerForm.formState.errors.email && (
                <p style={{ color: '#dc2626', fontSize: '11px', marginTop: '3px' }}>
                  {registerForm.formState.errors.email.message}
                </p>
              )}
            </div>

            {/* Masquer les champs mot de passe si le compte est déjà authentifié par Google */}
            {!pendingGoogleProfile && (
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
            )}

            {/* CASE À COCHER D'ACCEPTATION DES CGU & RGPD */}
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

            {googleOnboardingError && (
              <p style={{ color: '#dc2626', fontSize: '12px', margin: 0 }}>{googleOnboardingError}</p>
            )}

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
              disabled={registerForm.formState.isSubmitting || isGoogleLoading}
            >
              {registerForm.formState.isSubmitting || isGoogleLoading
                ? 'Création en cours...'
                : pendingGoogleProfile
                ? `Finaliser et Accéder à mon Espace (${pendingGoogleProfile.email})`
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

          <div style={{ marginTop: '12px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => navigate('/showcase')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '20px',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                background: 'rgba(16, 185, 129, 0.08)',
                color: '#059669',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <span>🎬</span>
              <span>Découvrir la Démo Interactive & Vidéo Publicitaire</span>
            </button>
          </div>
        </div>
      </div>

      {/* MODALE MOT DE PASSE OUBLIÉ */}
      {showForgotModal && (
        <div className="inspector-backdrop" onClick={() => !isSendingForgot && setShowForgotModal(false)}>
          <div
            className="pro-table-container"
            style={{
              maxWidth: '460px',
              width: '92%',
              padding: '24px',
              background: 'var(--bg-elevated, #ffffff)',
              border: '1px solid var(--border-default)',
              borderRadius: '16px',
              boxShadow: '0 20px 45px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ProLockIcon size={17} color="#0284c7" />
              <span>Réinitialiser votre mot de passe</span>
            </h3>
            <p style={{ margin: '0 0 14px 0', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Saisissez l'adresse e-mail de votre compte pour recevoir un lien sécurisé de réinitialisation.
            </p>
            <form onSubmit={handleForgotPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="email"
                className="input"
                placeholder="votre.email@entreprise.fr"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                autoFocus
              />
              {forgotPreviewUrl && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'rgba(2, 132, 199, 0.08)',
                    border: '1px solid rgba(2, 132, 199, 0.3)',
                    fontSize: '12px',
                  }}
                >
                  ✓ E-mail de réinitialisation généré :{' '}
                  <a
                    href={forgotPreviewUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontWeight: 700, color: '#0284c7', textDecoration: 'underline' }}
                  >
                    Ouvrir l'e-mail reçu
                  </a>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowForgotModal(false)}
                  disabled={isSendingForgot}
                >
                  Fermer
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSendingForgot}>
                  {isSendingForgot ? 'Envoi en cours...' : 'Envoyer le lien par e-mail'}
                </button>
              </div>
            </form>
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
