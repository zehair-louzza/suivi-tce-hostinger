import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { PasswordRules } from '../components/PasswordRules';
import { validatePassword, passwordErrorMessage, generateStrongPassword } from '../../../shared/passwordPolicy';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth, useAuthStore } from '../stores/authStore';
import { authApi, type EntrepriseChoix } from '../lib/api';
import toast from 'react-hot-toast';
import { BubbleBackdrop } from '../components/BubbleBackdrop';
import { InstallAppButton } from '../components/InstallAppButton';
import { LegalTermsModal } from '../components/LegalTermsModal';
import { ProCheckIcon, ProExternalIcon, ProGlyph, ProLockIcon, ProMailIcon, ProRefreshIcon } from '../components/ProIcons';

/**
 * Composant OTP à 6 cases inspiré de GitHub / Stripe — chaque chiffre dans sa propre case,
 * navigation automatique, collage supporté, backspace intelligent.
 */
function OtpInput({ length = 6, onComplete, disabled }: { length?: number; onComplete: (code: string) => void; disabled?: boolean }) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const focusInput = useCallback((idx: number) => {
    const el = inputsRef.current[idx];
    if (el) { el.focus(); el.select(); }
  }, []);

  const handleChange = useCallback((idx: number, val: string) => {
    // Gestion du collage d'un code complet
    const digits = val.replace(/\D/g, '');
    if (digits.length >= length) {
      const filled = digits.slice(0, length).split('');
      setValues(filled);
      onComplete(filled.join(''));
      focusInput(length - 1);
      return;
    }
    if (digits.length > 1) {
      // Collage partiel
      const newVals = [...values];
      for (let i = 0; i < digits.length && idx + i < length; i++) {
        newVals[idx + i] = digits[i];
      }
      setValues(newVals);
      const nextIdx = Math.min(idx + digits.length, length - 1);
      focusInput(nextIdx);
      if (newVals.every(v => v !== '')) onComplete(newVals.join(''));
      return;
    }
    const digit = digits[0] || '';
    const newVals = [...values];
    newVals[idx] = digit;
    setValues(newVals);
    if (digit && idx < length - 1) focusInput(idx + 1);
    if (newVals.every(v => v !== '')) onComplete(newVals.join(''));
  }, [values, length, onComplete, focusInput]);

  const handleKeyDown = useCallback((idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (values[idx]) {
        const newVals = [...values];
        newVals[idx] = '';
        setValues(newVals);
      } else if (idx > 0) {
        focusInput(idx - 1);
        const newVals = [...values];
        newVals[idx - 1] = '';
        setValues(newVals);
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      focusInput(idx - 1);
      e.preventDefault();
    } else if (e.key === 'ArrowRight' && idx < length - 1) {
      focusInput(idx + 1);
      e.preventDefault();
    }
  }, [values, length, focusInput]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '');
    if (pasted.length > 0) {
      const filled = pasted.slice(0, length).split('');
      const newVals = Array(length).fill('');
      filled.forEach((d, i) => { newVals[i] = d; });
      setValues(newVals);
      focusInput(Math.min(filled.length, length - 1));
      if (newVals.every(v => v !== '')) onComplete(newVals.join(''));
    }
  }, [length, onComplete, focusInput]);

  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }} onPaste={handlePaste}>
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={el => { inputsRef.current[i] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={length}
          value={values[i]}
          disabled={disabled}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onFocus={e => e.target.select()}
          style={{
            width: '46px',
            height: '56px',
            fontSize: '24px',
            fontWeight: 800,
            textAlign: 'center',
            border: values[i] ? '2px solid #00bf63' : '2px solid var(--border-subtle, #e2e8f0)',
            borderRadius: '10px',
            background: values[i] ? 'rgba(0, 191, 99, 0.06)' : 'var(--bg-card, #fff)',
            color: 'var(--text-primary, #0f172a)',
            outline: 'none',
            transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
            caretColor: '#00bf63',
            boxShadow: 'none',
            fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
          }}
          onFocusCapture={e => {
            (e.target as HTMLInputElement).style.borderColor = '#00bf63';
            (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(0, 191, 99, 0.15)';
          }}
          onBlurCapture={e => {
            (e.target as HTMLInputElement).style.borderColor = values[i] ? '#00bf63' : 'var(--border-subtle, #e2e8f0)';
            (e.target as HTMLInputElement).style.boxShadow = 'none';
          }}
        />
      ))}
    </div>
  );
}

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe trop court (min 6 caractères)'),
});

type LoginForm = z.infer<typeof loginSchema>;

/**
 * Mot de passe d'un compte créé via Google.
 *
 * Il était écrit en dur dans le code du navigateur, donc public : n'importe qui pouvait se
 * connecter à un compte Google de l'application avec son e-mail et cette constante. Chaque
 * inscription reçoit désormais une valeur aléatoire, qui n'est jamais réutilisée. La personne
 * se connecte avec Google ; pour un mot de passe à elle, elle passe par « mot de passe oublié ».
 */
function motDePasseAleatoire(): string {
  // Conforme à la politique de mots de passe (régénéré tant qu'une règle n'est pas respectée)
  return generateStrongPassword((n) => Array.from(crypto.getRandomValues(new Uint32Array(n))), 32);
}

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
    password: z.string(),
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({
        message: 'Vous devez accepter les CGU et la Politique RGPD pour initialiser votre espace',
      }),
    }),
  })
  .superRefine((data, ctx) => {
    const problems = validatePassword(data.password, {
      email: data.email,
      name: data.name,
      companyName: data.companyName,
    });
    if (problems.length > 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password'], message: `Mot de passe trop faible : ${problems.join(' ; ')}` });
    }
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmPassword'], message: 'Les mots de passe ne correspondent pas' });
    }
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

/** « 933108607 » → « 933 108 607 » ; SIRET : « 933 108 607 00021 » (lisible pour reconnaître son entreprise). */
function formaterNumero(n: string): string {
  const d = n.replace(/\D/g, '');
  return d.length === 14 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}` : d.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
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
  // activationLink kept for backward compat with link-based fallback
  const [_lastActivationLink, setLastActivationLink] = useState<string | null>(null);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

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

  // Même e-mail dans plusieurs entreprises : choix du compte à ouvrir (nom + SIREN), après identification
  const [choixEntreprise, setChoixEntreprise] = useState<{
    entreprises: EntrepriseChoix[];
    via: { type: 'password'; email: string; password: string } | { type: 'google'; credential: string };
  } | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleOnboardingError, setGoogleOnboardingError] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/';
  const isJustActivated = searchParams.get('activated') === '1';

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // Généré une fois par session d'inscription, jamais une constante partagée
  const motDePasseGoogle = useMemo(() => motDePasseAleatoire(), []);

  const registerForm = useForm<RegisterCompanyForm>({
    resolver: zodResolver(registerCompanySchema),
    defaultValues: {
      companyName: sessionStorage.getItem('pending_google_company_name') || '',
      siretOrSiren: sessionStorage.getItem('pending_google_siret') || '',
      name: pendingGoogleProfile?.name || '',
      email: pendingGoogleProfile?.email || '',
      password: pendingGoogleProfile ? motDePasseGoogle : '',
      confirmPassword: pendingGoogleProfile ? motDePasseGoogle : '',
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
      registerForm.setValue('password', motDePasseGoogle, { shouldValidate: false });
      registerForm.setValue('confirmPassword', motDePasseGoogle, { shouldValidate: false });
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
    extraCompanyInfo?: { name?: string; companyName: string; siretOrSiren: string; acceptTerms: boolean },
    companyIdChoisi?: number
  ) => {
    setIsGoogleLoading(true);
    setGoogleOnboardingError(null);
    try {
      const regValues = registerForm.getValues();
      const compName = extraCompanyInfo?.companyName ?? regValues.companyName ?? '';
      const siretVal = extraCompanyInfo?.siretOrSiren ?? regValues.siretOrSiren ?? '';
      const termsVal = extraCompanyInfo?.acceptTerms ?? Boolean(regValues.acceptTerms);
      const userName = extraCompanyInfo?.name || regValues.name || undefined;

      // Depuis l'onglet de connexion, on ne transmet JAMAIS d'infos entreprise : sinon une saisie restée dans le
      // formulaire de création ferait créer un espace au lieu de simplement ouvrir le compte existant.
      const creation = !!extraCompanyInfo || activeTab === 'register';
      const payload = {
        credential,
        name: userName,
        companyName: creation ? compName.trim() || undefined : undefined,
        siretOrSiren: creation ? siretVal.trim() || undefined : undefined,
        acceptTerms: creation ? termsVal : undefined,
        ...(companyIdChoisi ? { companyId: companyIdChoisi } : {}),
      };

      const res = await loginWithGoogle(payload);

      if (res.requiresCompanyInfo && res.googleProfile) {
        // Sauvegarde du compte Google sélectionné et bascule sur l'onglet Créer un Espace Entreprise
        // en pré-remplissant Nom + Email et en demandant UNIQUEMENT les cases non remplies !
        saveGoogleSelection(credential, res.googleProfile);
        setActiveTab('register');
        registerForm.setValue('name', res.googleProfile.name || '', { shouldValidate: true });
        registerForm.setValue('email', res.googleProfile.email || '', { shouldValidate: true });
        registerForm.setValue('password', motDePasseGoogle, { shouldValidate: false });
        registerForm.setValue('confirmPassword', motDePasseGoogle, { shouldValidate: false });
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
      if (err.response?.data?.code === 'COMPANY_CHOICE_REQUIRED') {
        setChoixEntreprise({ entreprises: err.response.data.details?.entreprises || [], via: { type: 'google', credential } });
        return;
      }
      const msg = err.response?.data?.error || 'Erreur lors de l’authentification Google';
      setGoogleOnboardingError(msg);
      toast.error(msg);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const onLoginSubmit = async (data: LoginForm, companyId?: number) => {
    try {
      await login(data.email, data.password, companyId);
      setChoixEntreprise(null);
      toast.success('Connexion réussie');
      navigate(from, { replace: true });
    } catch (err: any) {
      const code = err.response?.data?.code;
      if (code === 'COMPANY_CHOICE_REQUIRED') {
        setChoixEntreprise({
          entreprises: err.response.data.details?.entreprises || [],
          via: { type: 'password', email: data.email, password: data.password },
        });
        return;
      }
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

  const handleVerifyCode = useCallback(async (code: string) => {
    const emailToVerify = emailConfirmationSentTo || loginForm.getValues('email') || '';
    if (!emailToVerify || code.length !== 6) return;
    setIsVerifyingCode(true);
    try {
      const res = await authApi.verifyCode(emailToVerify, code);
      if (res.data.alreadyConfirmed) {
        toast.success(res.data.message || 'Compte déjà activé !');
        setEmailConfirmationSentTo(null);
        return;
      }
      if (res.data.success && res.data.user && res.data.accessToken) {
        toast.success(res.data.message || 'Espace entreprise activé avec succès !');
        setEmailConfirmationSentTo(null);
        // Set auth state directly — login() takes (email, password) and makes its own API call,
        // but we already have user + accessToken from verify-code response
        useAuthStore.setState({
          user: res.data.user,
          accessToken: res.data.accessToken,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        navigate('/');
      }
    } catch (err: any) {
      const errCode = err.response?.data?.code;
      if (errCode === 'CODE_EXPIRED') {
        toast.error('Code expiré. Cliquez sur « Renvoyer le code » pour en recevoir un nouveau.');
      } else if (errCode === 'INVALID_CODE') {
        toast.error('Code incorrect. Vérifiez le code reçu par e-mail.');
      } else {
        toast.error(err.response?.data?.error || 'Erreur de vérification');
      }
    } finally {
      setIsVerifyingCode(false);
    }
  }, [emailConfirmationSentTo, loginForm, navigate]);

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
      setShowForgotModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erreur lors de la demande de réinitialisation');
    } finally {
      setIsSendingForgot(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTokenFromUrl) return;
    const resetProblems = validatePassword(newResetPassword, { email: resetEmailFromUrl });
    if (resetProblems.length > 0) {
      toast.error(passwordErrorMessage(resetProblems));
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
              placeholder="Nouveau mot de passe (min. 12 caractères)"
              value={newResetPassword}
              onChange={(e) => setNewResetPassword(e.target.value)}
              maxLength={128}
              autoComplete="new-password"
              required
            />
            <PasswordRules password={newResetPassword} context={{ email: resetEmailFromUrl }} />
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

        {/* PANNEAU DE VÉRIFICATION PAR CODE 6 CHIFFRES */}
        {emailConfirmationSentTo && (
          <div
            style={{
              padding: '24px 20px',
              borderRadius: '16px',
              background: 'var(--bg-card, #fff)',
              border: '1px solid rgba(0, 191, 99, 0.3)',
              marginBottom: '20px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(0, 191, 99, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              <ProMailIcon size={24} color="#00bf63" />
            </div>

            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Vérifiez votre e-mail
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
              Un code à 6 chiffres a été envoyé à <strong>{emailConfirmationSentTo}</strong>
              <br />depuis <strong>zehair@anelecgroupe.com</strong>
            </div>

            <OtpInput
              onComplete={handleVerifyCode}
              disabled={isVerifyingCode}
            />

            {isVerifyingCode && (
              <div style={{ fontSize: '12px', color: '#00bf63', marginTop: '12px', fontWeight: 600 }}>
                Vérification en cours…
              </div>
            )}

            <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleResendConfirmation(emailConfirmationSentTo)}
                disabled={isResendingEmail}
                style={{
                  fontSize: '12px',
                  padding: '8px 14px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'transparent',
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  borderRadius: '8px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <ProRefreshIcon size={13} />
                <span>{isResendingEmail ? 'Renvoi…' : 'Renvoyer le code'}</span>
              </button>

              {lastDeliveryPreviewUrl && (
                <a
                  href={lastDeliveryPreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: '12px',
                    padding: '8px 14px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    color: '#0284c7',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    border: '1px solid var(--border-subtle, #e2e8f0)',
                    borderRadius: '8px',
                    background: 'transparent',
                  }}
                >
                  <ProExternalIcon size={13} color="#0284c7" />
                  <span>Voir l'e-mail</span>
                </a>
              )}
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '14px', opacity: 0.7 }}>
              Le code expire dans 15 minutes
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
            onSubmit={loginForm.handleSubmit((d) => onLoginSubmit(d))}
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

            {choixEntreprise && (
              <div
                role="group"
                aria-label="Choisir l’entreprise"
                data-testid="choix-entreprise"
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--color-primary, #0284c7)',
                  background: 'var(--color-primary-soft, rgba(2,132,199,0.08))',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <strong style={{ fontSize: '13.5px' }}>Cette adresse a un compte dans plusieurs entreprises</strong>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Choisissez l’entreprise à ouvrir. Chaque entreprise est un compte distinct, avec ses propres données.
                </span>
                {choixEntreprise.entreprises.map((e) => (
                  <button
                    key={e.companyId ?? e.nom}
                    type="button"
                    className="btn"
                    data-testid={`choix-entreprise-${e.companyId}`}
                    disabled={loginForm.formState.isSubmitting || isGoogleLoading}
                    onClick={async () => {
                      const via = choixEntreprise.via;
                      if (via.type === 'password') {
                        await onLoginSubmit({ email: via.email, password: via.password }, e.companyId ?? undefined);
                      } else {
                        await handleGoogleCredential(via.credential, undefined, e.companyId ?? undefined);
                      }
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      minHeight: '48px',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: '13.5px' }}>{e.nom}</span>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                      {e.siret ? `SIRET ${formaterNumero(e.siret)}` : e.siren ? `SIREN ${formaterNumero(e.siren)}` : 'SIREN non renseigné'}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setChoixEntreprise(null)}
                  style={{ background: 'none', border: 'none', fontSize: '11.5px', textDecoration: 'underline', cursor: 'pointer', color: 'var(--text-secondary)' }}
                >
                  Annuler
                </button>
              </div>
            )}

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
                Vous n'avez pas reçu le code d'activation ? Renvoyer le code de confirmation
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
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Déjà inscrit dans une autre entreprise avec cette adresse ? Aucun souci : ce nouvel espace aura son propre compte et son propre mot de passe, séparés de l’autre.
              </p>
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
                    placeholder="Min. 12 car."
                    maxLength={128}
                    autoComplete="new-password"
                    {...registerForm.register('password')}
                  />
                  {!pendingGoogleProfile && (
                    <PasswordRules
                      password={registerForm.watch('password') || ''}
                      context={{
                        email: registerForm.watch('email'),
                        name: registerForm.watch('name'),
                        companyName: registerForm.watch('companyName'),
                      }}
                    />
                  )}
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
              <ProGlyph name="film" size={16} />
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
