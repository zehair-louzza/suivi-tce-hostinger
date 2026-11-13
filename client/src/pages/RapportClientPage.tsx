import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

type Contenu = {
  reference: string;
  client: string;
  chantier: string | null;
  site: string | null;
  objet: string | null;
  corpsEtat: string | null;
  typeIntervention: string | null;
  datePlanifiee: string | null;
  dateReelle: string | null;
  actionsRealisees: string[];
  rapport: string | null;
  photos: Array<{ id: string; caption?: string | null; category?: string | null }>;
};
type RapportPublic = {
  etat: 'actif' | 'repondu';
  societe: string;
  contenu: Contenu;
  expireLe: string;
  document: { nomFichier: string; taille: number } | null;
  reponse: 'VALIDE' | 'RESERVES' | null;
  reponduLe: string | null;
};
type Choix = 'VALIDE' | 'RESERVES';

const dateFr = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : null);

const LIBELLE: Record<Choix, string> = {
  VALIDE: 'Vous avez validé ce rapport.',
  RESERVES: 'Vous avez formulé des réserves sur ce rapport.',
};

/**
 * Page PUBLIQUE du rapport d'intervention (sans compte) : /rapport-client/:jeton
 * Le client lit le rapport (et les photos choisies), puis valide ou formule des réserves (texte obligatoire).
 * Le silence n'est jamais une validation.
 */
export function RapportClientPage() {
  const { jeton = '' } = useParams();
  const api = `/api/public/rapport/${encodeURIComponent(jeton)}`;

  const [rapport, setRapport] = useState<RapportPublic | null>(null);
  const [chargement, setChargement] = useState(true);
  const [invalide, setInvalide] = useState(false);
  const [choix, setChoix] = useState<Choix | null>(null);
  const [nom, setNom] = useState('');
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [termine, setTermine] = useState<Choix | null>(null);
  const [agrandie, setAgrandie] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Votre rapport d’intervention';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    fetch(api, { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error('invalide');
        setRapport((await r.json()).data);
      })
      .catch(() => setInvalide(true))
      .finally(() => setChargement(false));
    return () => {
      document.head.removeChild(meta);
    };
  }, [api]);

  const motifRequis = choix === 'RESERVES';
  const peutEnvoyer = !!choix && nom.trim().length >= 2 && (!motifRequis || motif.trim().length >= 3) && !envoi;

  const envoyer = async () => {
    if (!choix) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await fetch(`${api}/reponse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reponse: choix, nom: nom.trim(), motif: motif.trim() }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErreur(body?.error || 'Votre réponse n’a pas pu être enregistrée. Réessayez.');
        if (r.status === 404 || r.status === 409) setInvalide(true);
        return;
      }
      setTermine(choix);
    } catch {
      setErreur('Connexion impossible. Réessayez dans un instant.');
    } finally {
      setEnvoi(false);
    }
  };

  const carte: React.CSSProperties = { maxWidth: 760, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24 };
  const bouton = (couleur: string, actif: boolean): React.CSSProperties => ({
    flex: '1 1 220px', minHeight: 52, borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer',
    border: `2px solid ${couleur}`, background: actif ? couleur : '#fff', color: actif ? '#fff' : couleur,
  });
  const c = rapport?.contenu;

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '24px 16px', color: '#0f172a', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <main style={carte} data-testid="rapport-client-page">
        {chargement && <p>Chargement du rapport…</p>}

        {!chargement && invalide && !termine && (
          <div data-testid="rapport-client-invalide">
            <h1 style={{ fontSize: 20, marginTop: 0 }}>Ce lien n’est plus valide</h1>
            <p>Il a expiré, a déjà reçu une réponse, ou le rapport a été mis à jour. Contactez votre interlocuteur pour recevoir un nouveau lien.</p>
          </div>
        )}

        {termine && (
          <div data-testid="rapport-client-merci" role="status">
            <h1 style={{ fontSize: 22, marginTop: 0 }}>Merci, votre réponse est enregistrée</h1>
            <p>{LIBELLE[termine]} {rapport?.societe} en a été informé{termine === 'RESERVES' ? ' et reviendra vers vous.' : '.'}</p>
          </div>
        )}

        {!chargement && rapport && c && !invalide && !termine && (
          <>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{rapport.societe}</p>
            <h1 style={{ fontSize: 22, margin: '4px 0 14px' }}>Rapport d’intervention {c.reference}</h1>

            <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, margin: 0, fontSize: 14 }}>
              <div><dt style={{ color: '#64748b', fontSize: 12 }}>Client</dt><dd style={{ margin: 0, fontWeight: 600 }}>{c.client}</dd></div>
              {c.chantier && <div><dt style={{ color: '#64748b', fontSize: 12 }}>Chantier</dt><dd style={{ margin: 0 }}>{c.chantier}</dd></div>}
              {c.site && <div><dt style={{ color: '#64748b', fontSize: 12 }}>Site</dt><dd style={{ margin: 0 }}>{c.site}</dd></div>}
              {c.corpsEtat && <div><dt style={{ color: '#64748b', fontSize: 12 }}>Corps d’état</dt><dd style={{ margin: 0 }}>{c.corpsEtat}</dd></div>}
              {c.typeIntervention && <div><dt style={{ color: '#64748b', fontSize: 12 }}>Type</dt><dd style={{ margin: 0 }}>{c.typeIntervention}</dd></div>}
              {(c.dateReelle || c.datePlanifiee) && <div><dt style={{ color: '#64748b', fontSize: 12 }}>Date d’intervention</dt><dd style={{ margin: 0 }}>{dateFr(c.dateReelle || c.datePlanifiee)}</dd></div>}
              <div><dt style={{ color: '#64748b', fontSize: 12 }}>Lien valable jusqu’au</dt><dd style={{ margin: 0 }}>{dateFr(rapport.expireLe)}</dd></div>
            </dl>
            {c.objet && <p style={{ margin: '14px 0 0', fontSize: 14 }}><strong>Objet :</strong> {c.objet}</p>}

            {c.actionsRealisees.length > 0 && (
              <section style={{ marginTop: 16 }}>
                <h2 style={{ fontSize: 16, margin: '0 0 6px' }}>Actions réalisées</h2>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.5 }}>
                  {c.actionsRealisees.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </section>
            )}
            {c.rapport && (
              <section style={{ marginTop: 16 }}>
                <h2 style={{ fontSize: 16, margin: '0 0 6px' }}>Compte rendu</h2>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap' }} data-testid="rapport-client-texte">{c.rapport}</p>
              </section>
            )}

            {c.photos.length > 0 && (
              <section style={{ marginTop: 16 }} aria-label="Photos">
                <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Photos ({c.photos.length})</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                  {c.photos.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setAgrandie(p.id)}
                      aria-label={`Agrandir la photo ${p.caption || ''}`}
                      data-testid="rapport-client-photo"
                      style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 0, background: '#fff', cursor: 'zoom-in', overflow: 'hidden', textAlign: 'left' }}
                    >
                      <img src={`${api}/photos/${encodeURIComponent(p.id)}`} alt={p.caption || 'Photo du chantier'} loading="lazy" style={{ display: 'block', width: '100%', height: 120, objectFit: 'cover' }} />
                      {(p.caption || p.category) && <span style={{ display: 'block', padding: '6px 8px', fontSize: 12, color: '#475569' }}>{p.caption || p.category}</span>}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {rapport.document && (
              <div style={{ marginTop: 16 }}>
                <a
                  href={`${api}/document`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="rapport-client-pdf"
                  style={{ display: 'inline-block', padding: '10px 16px', borderRadius: 10, border: '1.5px solid #0284c7', color: '#0284c7', fontWeight: 700, textDecoration: 'none' }}
                >
                  Ouvrir le rapport (PDF)
                </a>
                <iframe title="Rapport au format PDF" src={`${api}/document`} style={{ display: 'block', width: '100%', height: 480, marginTop: 12, border: '1px solid #e2e8f0', borderRadius: 10 }} />
              </div>
            )}

            {rapport.etat === 'repondu' ? (
              <p data-testid="rapport-client-deja" style={{ marginTop: 20, padding: 14, background: '#f0fdf4', borderRadius: 10 }}>
                {rapport.reponse ? LIBELLE[rapport.reponse] : 'Une réponse a déjà été enregistrée.'}
              </p>
            ) : (
              <section style={{ marginTop: 22 }} aria-label="Votre réponse">
                <h2 style={{ fontSize: 17, margin: '0 0 10px' }}>Votre réponse</h2>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button type="button" data-testid="rapport-client-valider" style={bouton('#16a34a', choix === 'VALIDE')} onClick={() => setChoix('VALIDE')}>
                    ✓ Je valide ce rapport
                  </button>
                  <button type="button" data-testid="rapport-client-reserves" style={bouton('#d97706', choix === 'RESERVES')} onClick={() => setChoix('RESERVES')}>
                    Formuler des réserves
                  </button>
                </div>

                {choix && (
                  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <label style={{ fontSize: 13, fontWeight: 600 }}>
                      Votre nom
                      <input
                        value={nom}
                        onChange={(e) => setNom(e.target.value)}
                        maxLength={120}
                        autoComplete="name"
                        data-testid="rapport-client-nom"
                        style={{ display: 'block', width: '100%', marginTop: 4, padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 15 }}
                      />
                    </label>
                    <label style={{ fontSize: 13, fontWeight: 600 }}>
                      {motifRequis ? 'Vos réserves (obligatoire)' : 'Commentaire (facultatif)'}
                      <textarea
                        value={motif}
                        onChange={(e) => setMotif(e.target.value)}
                        maxLength={1000}
                        rows={motifRequis ? 4 : 2}
                        data-testid="rapport-client-motif"
                        style={{ display: 'block', width: '100%', marginTop: 4, padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 15 }}
                      />
                    </label>
                    {erreur && <p role="alert" style={{ color: '#b91c1c', margin: 0, fontSize: 14 }}>{erreur}</p>}
                    <button
                      type="button"
                      disabled={!peutEnvoyer}
                      onClick={envoyer}
                      data-testid="rapport-client-envoyer"
                      style={{ minHeight: 52, borderRadius: 12, border: 0, background: peutEnvoyer ? '#0f172a' : '#94a3b8', color: '#fff', fontWeight: 800, fontSize: 16, cursor: peutEnvoyer ? 'pointer' : 'not-allowed' }}
                    >
                      {envoi ? 'Envoi…' : 'Confirmer ma réponse'}
                    </button>
                    <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Votre réponse est définitive pour ce lien. Elle sera transmise à {rapport.societe}.</p>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>

      {agrandie && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo agrandie"
          onClick={() => setAgrandie(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', display: 'grid', placeItems: 'center', padding: 16, zIndex: 50, cursor: 'zoom-out' }}
        >
          <img src={`${api}/photos/${encodeURIComponent(agrandie)}`} alt="Photo agrandie" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}
