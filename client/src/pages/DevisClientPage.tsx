import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

type DevisPublic = {
  etat: 'actif' | 'repondu';
  societe: string;
  reference: string;
  client: string;
  objet: string | null;
  site: string | null;
  corpsEtat: string | null;
  montantHt: number | null;
  tauxTVA: number | null;
  montantTtc: number | null;
  expireLe: string;
  document: { nomFichier: string; taille: number } | null;
  reponse: 'ACCEPTEE' | 'REFUSEE' | 'MODIFICATION' | null;
  reponduLe: string | null;
};

type Choix = 'ACCEPTEE' | 'REFUSEE' | 'MODIFICATION';

const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

const LIBELLE: Record<Choix, string> = {
  ACCEPTEE: 'Vous avez accepté ce devis.',
  REFUSEE: 'Vous avez refusé ce devis.',
  MODIFICATION: 'Vous avez demandé une modification de ce devis.',
};

/**
 * Page PUBLIQUE du devis (sans compte) : /devis-client/:jeton
 * Le client consulte le PDF puis accepte, refuse (motif) ou demande une modification (message).
 */
export function DevisClientPage() {
  const { jeton = '' } = useParams();
  const api = `/api/public/devis/${encodeURIComponent(jeton)}`;

  const [devis, setDevis] = useState<DevisPublic | null>(null);
  const [chargement, setChargement] = useState(true);
  const [invalide, setInvalide] = useState(false);
  const [choix, setChoix] = useState<Choix | null>(null);
  const [nom, setNom] = useState('');
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [termine, setTermine] = useState<Choix | null>(null);

  useEffect(() => {
    document.title = 'Votre devis';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    fetch(api, { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error('invalide');
        setDevis((await r.json()).data);
      })
      .catch(() => setInvalide(true))
      .finally(() => setChargement(false));
    return () => {
      document.head.removeChild(meta);
    };
  }, [api]);

  const motifRequis = choix === 'REFUSEE' || choix === 'MODIFICATION';
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

  const carte: React.CSSProperties = {
    maxWidth: 720, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24,
  };
  const bouton = (couleur: string, actif: boolean): React.CSSProperties => ({
    flex: '1 1 180px', minHeight: 52, borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer',
    border: `2px solid ${couleur}`, background: actif ? couleur : '#fff', color: actif ? '#fff' : couleur,
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '24px 16px', color: '#0f172a', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <main style={carte} data-testid="devis-client-page">
        {chargement && <p>Chargement du devis…</p>}

        {!chargement && invalide && !termine && (
          <div data-testid="devis-client-invalide">
            <h1 style={{ fontSize: 20, marginTop: 0 }}>Ce lien n’est plus valide</h1>
            <p>Il a expiré, a déjà reçu une réponse, ou le devis a été mis à jour. Contactez votre interlocuteur pour recevoir un nouveau lien.</p>
          </div>
        )}

        {termine && (
          <div data-testid="devis-client-merci" role="status">
            <h1 style={{ fontSize: 22, marginTop: 0 }}>Merci, votre réponse est enregistrée</h1>
            <p>{LIBELLE[termine]} {devis?.societe} en a été informé.</p>
          </div>
        )}

        {!chargement && devis && !invalide && !termine && (
          <>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{devis.societe}</p>
            <h1 style={{ fontSize: 22, margin: '4px 0 14px' }}>Devis {devis.reference}</h1>

            <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, margin: 0, fontSize: 14 }}>
              <div><dt style={{ color: '#64748b', fontSize: 12 }}>Client</dt><dd style={{ margin: 0, fontWeight: 600 }}>{devis.client}</dd></div>
              {devis.site && <div><dt style={{ color: '#64748b', fontSize: 12 }}>Site</dt><dd style={{ margin: 0 }}>{devis.site}</dd></div>}
              {devis.corpsEtat && <div><dt style={{ color: '#64748b', fontSize: 12 }}>Corps d’état</dt><dd style={{ margin: 0 }}>{devis.corpsEtat}</dd></div>}
              {devis.montantHt != null && <div><dt style={{ color: '#64748b', fontSize: 12 }}>Montant HT</dt><dd style={{ margin: 0, fontWeight: 800 }}>{eur(devis.montantHt)}</dd></div>}
              {devis.montantTtc != null && <div><dt style={{ color: '#64748b', fontSize: 12 }}>Montant TTC ({devis.tauxTVA} %)</dt><dd style={{ margin: 0, fontWeight: 800 }}>{eur(devis.montantTtc)}</dd></div>}
              <div><dt style={{ color: '#64748b', fontSize: 12 }}>Lien valable jusqu’au</dt><dd style={{ margin: 0 }}>{dateFr(devis.expireLe)}</dd></div>
            </dl>
            {devis.objet && <p style={{ margin: '14px 0 0', fontSize: 14 }}><strong>Objet :</strong> {devis.objet}</p>}

            {devis.document && (
              <div style={{ marginTop: 16 }}>
                <a
                  href={`${api}/document`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="devis-client-pdf"
                  style={{ display: 'inline-block', padding: '10px 16px', borderRadius: 10, border: '1.5px solid #0284c7', color: '#0284c7', fontWeight: 700, textDecoration: 'none' }}
                >
                  Ouvrir le devis (PDF)
                </a>
                <iframe
                  title="Devis au format PDF"
                  src={`${api}/document`}
                  style={{ display: 'block', width: '100%', height: 480, marginTop: 12, border: '1px solid #e2e8f0', borderRadius: 10 }}
                />
              </div>
            )}

            {devis.etat === 'repondu' ? (
              <p data-testid="devis-client-deja" style={{ marginTop: 20, padding: 14, background: '#f0fdf4', borderRadius: 10 }}>
                {devis.reponse ? LIBELLE[devis.reponse] : 'Une réponse a déjà été enregistrée.'}
              </p>
            ) : (
              <section style={{ marginTop: 22 }} aria-label="Votre réponse">
                <h2 style={{ fontSize: 17, margin: '0 0 10px' }}>Votre réponse</h2>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button type="button" data-testid="devis-client-accepter" style={bouton('#16a34a', choix === 'ACCEPTEE')} onClick={() => setChoix('ACCEPTEE')}>
                    ✓ Accepter le devis
                  </button>
                  <button type="button" data-testid="devis-client-modifier" style={bouton('#d97706', choix === 'MODIFICATION')} onClick={() => setChoix('MODIFICATION')}>
                    Demander une modification
                  </button>
                  <button type="button" data-testid="devis-client-refuser" style={bouton('#dc2626', choix === 'REFUSEE')} onClick={() => setChoix('REFUSEE')}>
                    Refuser le devis
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
                        data-testid="devis-client-nom"
                        style={{ display: 'block', width: '100%', marginTop: 4, padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 15 }}
                      />
                    </label>
                    {motifRequis && (
                      <label style={{ fontSize: 13, fontWeight: 600 }}>
                        {choix === 'REFUSEE' ? 'Motif du refus' : 'Modification souhaitée'}
                        <textarea
                          value={motif}
                          onChange={(e) => setMotif(e.target.value)}
                          maxLength={1000}
                          rows={4}
                          data-testid="devis-client-motif"
                          style={{ display: 'block', width: '100%', marginTop: 4, padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 15 }}
                        />
                      </label>
                    )}
                    {!motifRequis && (
                      <label style={{ fontSize: 13, fontWeight: 600 }}>
                        Commentaire (facultatif)
                        <textarea
                          value={motif}
                          onChange={(e) => setMotif(e.target.value)}
                          maxLength={1000}
                          rows={2}
                          style={{ display: 'block', width: '100%', marginTop: 4, padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 15 }}
                        />
                      </label>
                    )}
                    {erreur && <p role="alert" style={{ color: '#b91c1c', margin: 0, fontSize: 14 }}>{erreur}</p>}
                    <button
                      type="button"
                      disabled={!peutEnvoyer}
                      onClick={envoyer}
                      data-testid="devis-client-envoyer"
                      style={{ minHeight: 52, borderRadius: 12, border: 0, background: peutEnvoyer ? '#0f172a' : '#94a3b8', color: '#fff', fontWeight: 800, fontSize: 16, cursor: peutEnvoyer ? 'pointer' : 'not-allowed' }}
                    >
                      {envoi ? 'Envoi…' : 'Confirmer ma réponse'}
                    </button>
                    <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Votre réponse est définitive pour ce lien. Elle sera transmise à {devis.societe}.</p>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
