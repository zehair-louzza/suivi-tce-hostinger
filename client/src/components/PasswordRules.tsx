import { validatePassword, PASSWORD_RULES_TEXT, type PasswordContext } from '../../../shared/passwordPolicy';

/**
 * Aide à la saisie : liste des règles tant que rien n'est tapé, puis uniquement ce qu'il reste à corriger.
 * (Le serveur applique la même politique et reste seul juge.)
 */
export function PasswordRules({ password, context }: { password: string; context?: PasswordContext }) {
  const problems = password ? validatePassword(password, context) : [];
  const ok = password.length > 0 && problems.length === 0;
  return (
    <div
      data-testid="password-rules"
      style={{ fontSize: 11.5, lineHeight: 1.5, color: ok ? '#059669' : 'var(--text-secondary)', marginTop: 4 }}
    >
      {ok ? (
        <span style={{ fontWeight: 700 }}>✓ Mot de passe conforme</span>
      ) : (
        <>
          <span style={{ fontWeight: 700 }}>
            {password ? 'À corriger :' : 'Règles du mot de passe :'}
          </span>
          <ul style={{ margin: '2px 0 0 0', paddingLeft: 16, color: password ? '#dc2626' : undefined }}>
            {(password ? problems : PASSWORD_RULES_TEXT).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
