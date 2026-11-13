import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { PasswordRules } from '../components/PasswordRules';
import { validatePassword, ACCOUNT_RULES_TEXT } from '../../../shared/passwordPolicy';

type InvitationInfo = {
  email: string;
  companyName: string;
  roleLabel: string;
  invitedByName: string | null;
  expiresAt: string;
};

/**
 * Page publique d'acceptation d'une invitation : /invitation?token=...
 * L'adresse e-mail et l'entreprise viennent de l'invitation (non modifiables).
 */
export function AcceptInvitationPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setInvalid('Lien d’invitation incomplet.');
      setLoading(false);
      return;
    }
    authApi
      .getInvitation(token)
      .then((res) => {
        if (!cancelled) setInfo(res.data);
      })
      .catch((err) => {
        if (!cancelled) setInvalid(err.response?.data?.error || 'Invitation invalide, expirée ou déjà utilisée.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const passwordsMatch = password === confirm;
  const canSubmit = Boolean(info) && name.trim().length > 0 && validatePassword(password, { email: info?.email, name, companyName: info?.companyName }).length === 0 && passwordsMatch && acceptTerms && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await authApi.acceptInvitation({ token, name: name.trim(), password, acceptTerms: true });
      useAuthStore.setState({
        user: res.data.user,
        accessToken: res.data.accessToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      toast.success(res.data.message);
      navigate('/', { replace: true });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Impossible de finaliser l’invitation');
    } finally {
      setSubmitting(false);
    }
  };

  const card: React.CSSProperties = {
    width: '100%',
    maxWidth: 460,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-default)',
    borderRadius: 16,
    padding: 28,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-app)',
        color: 'var(--text-primary)',
        padding: 16,
      }}
    >
      <div style={card} data-testid="accept-invitation">
        {loading && <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Vérification de l’invitation…</p>}

        {!loading && invalid && (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Invitation indisponible</h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{invalid}</p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              Demandez à l’administrateur de votre entreprise de vous renvoyer une invitation.
            </p>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/login', { replace: true })}>
              Aller à la connexion
            </button>
          </>
        )}

        {!loading && info && (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Invitation
              </span>
              <h1 style={{ fontSize: 19, fontWeight: 800, margin: '4px 0 6px 0' }}>Rejoindre {info.companyName}</h1>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {info.invitedByName ? <><strong>{info.invitedByName}</strong> vous invite</> : 'Vous êtes invité(e)'} avec le profil{' '}
                <strong>{info.roleLabel}</strong>. Choisissez votre mot de passe pour créer votre accès.
              </p>
            </div>

            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700 }}>Adresse e-mail (imposée par l’invitation)</label>
              <input className="input" type="email" value={info.email} readOnly disabled />
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700 }}>Votre nom</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={100} required />
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700 }}>Mot de passe (12 caractères minimum)</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" maxLength={128} required />
              <PasswordRules password={password} context={{ email: info.email, name, companyName: info.companyName }} />
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700 }}>Confirmer le mot de passe</label>
              <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
              {confirm.length > 0 && !passwordsMatch && (
                <span style={{ fontSize: 11, color: '#dc2626' }}>Les deux mots de passe ne correspondent pas.</span>
              )}
            </div>
            <div style={{ padding: '10px 12px', border: '1px solid var(--border-default, #e2e8f0)', borderRadius: 10, background: 'var(--bg-card, #f8fafc)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>Règles d’utilisation et de sécurité du compte</div>
              <ul data-testid="account-rules" style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                {ACCOUNT_RULES_TEXT.map((r) => (
                  <li key={r} style={{ marginBottom: 3 }}>{r}</li>
                ))}
              </ul>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} style={{ marginTop: 2 }} />
              <span>
                J’ai lu et j’accepte les règles ci-dessus, les Conditions Générales d’Utilisation et la politique de protection des données de {info.companyName}.
              </span>
            </label>
            <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
              {submitting ? 'Création de l’accès…' : 'Créer mon accès'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
