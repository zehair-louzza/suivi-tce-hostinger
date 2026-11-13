// Rapport client : PDF généré (avec photos choisies) ou déposé à la main, envoi par lien sécurisé
// (adresse confirmée), suivi de la réponse (validation / réserves) et des relances.
// L'envoi est toujours un geste humain : rien ne part sans cocher la confirmation.
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Send, Upload, Eye, Mail, Clock, CheckCircle2, MessageSquareWarning, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { rapportClientApi } from '../lib/api';
import { Btn, Pill } from './ui';

function lireFichier(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || '').split(',')[1] || '');
    r.onerror = () => reject(new Error('Fichier illisible'));
    r.readAsDataURL(f);
  });
}

const dateFr = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
const dateHeureFr = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const taille = (o: number) => (o > 1024 * 1024 ? `${(o / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(o / 1024))} Ko`);

/** Miniature d'une photo : chargée avec le jeton de session (jamais d'URL publique). */
function Miniature({ interventionId, photoId, legende }: { interventionId: number; photoId: string; legende?: string | null }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let actif = true;
    rapportClientApi
      .miniature(interventionId, photoId)
      .then((r) => {
        if (!actif) return;
        url = URL.createObjectURL(r.data);
        setSrc(url);
      })
      .catch(() => undefined);
    return () => {
      actif = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [interventionId, photoId]);
  return src ? (
    <img src={src} alt={legende || 'Photo du chantier'} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, flex: 'none' }} />
  ) : (
    <div aria-hidden style={{ width: 64, height: 64, borderRadius: 8, background: '#e2e8f0', flex: 'none', display: 'grid', placeItems: 'center' }}>
      <ImageIcon size={18} />
    </div>
  );
}

type Props = {
  interventionId: number;
  referenceMetier?: string | null;
  /** Profil autorisé à déposer / envoyer (Direction, Planificateur, Rapports et facturation) */
  canManage: boolean;
};

export function RapportClientPanel({ interventionId, referenceMetier, canManage }: Props) {
  const queryClient = useQueryClient();
  const fichierRef = useRef<HTMLInputElement>(null);
  const [ouvert, setOuvert] = useState(false);
  const [source, setSource] = useState<'GENERE' | 'DEPOSE'>('GENERE');
  const [photosChoisies, setPhotosChoisies] = useState<string[]>([]);
  const [choix, setChoix] = useState<string[]>([]);
  const [confirme, setConfirme] = useState(false);

  const query = useQuery({
    queryKey: ['rapport-envoi-client', interventionId],
    queryFn: async () => (await rapportClientApi.suivi(interventionId)).data.data,
    staleTime: 10_000,
    enabled: canManage,
  });
  const info = query.data;
  const depose = info?.documentDepose || null;
  const lien = info?.lien || null;
  const adresses = info?.adresses || [];
  const photos = info?.photos || [];
  const toutesCochees = photos.length > 0 && photosChoisies.length === photos.length;

  useEffect(() => {
    if (!ouvert) return;
    setConfirme(false);
    setSource(depose ? 'DEPOSE' : 'GENERE');
    setPhotosChoisies([]);
    const suggerees = adresses.filter((a) => a.suggeree).map((a) => a.email);
    setChoix(adresses.length === 1 ? [adresses[0].email] : suggerees);
  }, [ouvert]); // eslint-disable-line react-hooks/exhaustive-deps

  const rafraichir = () => {
    queryClient.invalidateQueries({ queryKey: ['rapport-envoi-client', interventionId] });
    queryClient.invalidateQueries({ queryKey: ['interventions'] });
  };

  const deposer = useMutation({
    mutationFn: async (f: File) => {
      if (!/\.pdf$/i.test(f.name)) throw new Error('Choisissez un fichier PDF.');
      if (f.size > 8 * 1024 * 1024) throw new Error('Le PDF dépasse 8 Mo : compressez-le avant de le déposer.');
      return rapportClientApi.deposer(interventionId, f.name, await lireFichier(f));
    },
    onSuccess: (res) => {
      toast.success(res.data.lienRevoque ? 'PDF remplacé : le lien déjà envoyé est révoqué, renvoyez le rapport.' : 'PDF du rapport enregistré');
      rafraichir();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || err?.message || 'Dépôt impossible'),
  });

  const ouvrirBlob = (blob: Blob) => {
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const apercu = useMutation({
    mutationFn: () =>
      rapportClientApi.apercu(interventionId, toutesCochees ? { toutesPhotos: true } : { photoIds: photosChoisies }),
    onSuccess: (res) => ouvrirBlob(res.data),
    onError: () => toast.error('Impossible de préparer l’aperçu du PDF'),
  });

  const voirDepose = async () => {
    try {
      ouvrirBlob((await rapportClientApi.telecharger(interventionId, 'DEPOSE')).data);
    } catch {
      toast.error('Impossible d’ouvrir le PDF');
    }
  };

  const envoyer = useMutation({
    mutationFn: () =>
      rapportClientApi.envoyer(interventionId, {
        confirme: true,
        source,
        emails: choix,
        ...(toutesCochees ? { toutesPhotos: true } : { photoIds: photosChoisies }),
      }),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Rapport envoyé au client');
      setOuvert(false);
      rafraichir();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Envoi impossible, réessayez.'),
  });

  if (!canManage) return null;

  const unique = adresses.length === 1;
  const choixValide = unique || choix.length > 0;
  const sourceOk = source === 'GENERE' || !!depose;
  const peutOuvrir = !!info?.envoiPossible;

  return (
    <section data-testid="rapport-client-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
      <h4 className="m-h4" style={{ margin: 0, display: 'flex', gap: 6, alignItems: 'center' }}>
        <Mail size={15} /> Rapport client — lien sécurisé
      </h4>

      {/* PDF déposé à la main */}
      <div style={{ border: '1px dashed var(--border-subtle, #cbd5e1)', borderRadius: 12, padding: 12 }}>
        {depose ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <FileText size={20} aria-hidden />
            <div style={{ flex: 1, minWidth: 160 }}>
              <strong data-testid="rapport-doc-nom" style={{ fontSize: 13 }}>{depose.nomFichier}</strong>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {taille(depose.taille)} · déposé le {dateHeureFr(depose.deposeLe)}{depose.deposePar ? ` par ${depose.deposePar}` : ''}
              </div>
            </div>
            <Btn size="sm" icon={Eye} onClick={voirDepose}>Voir</Btn>
            <Btn size="sm" icon={Upload} disabled={deposer.isPending} onClick={() => fichierRef.current?.click()}>Remplacer</Btn>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 8px', fontSize: 13 }}>
              Vous avez déjà le PDF du rapport ? Déposez-le ici (8 Mo maximum). Sinon, il sera généré à partir du rapport validé.
            </p>
            <Btn icon={Upload} disabled={deposer.isPending} onClick={() => fichierRef.current?.click()} data-testid="rapport-doc-deposer">
              {deposer.isPending ? 'Envoi du fichier…' : 'Déposer le PDF du rapport'}
            </Btn>
          </div>
        )}
        <input
          ref={fichierRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          data-testid="rapport-doc-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) deposer.mutate(f);
          }}
        />
      </div>

      <div>
        <Btn variant="primary" icon={Send} disabled={!peutOuvrir} onClick={() => setOuvert(true)} data-testid="rapport-envoyer-client">
          {lien ? 'Renvoyer au client' : 'Envoyer au client'}
        </Btn>
        {info && !info.envoiPossible && info.envoiRefus && (
          <p data-testid="rapport-envoi-refus" style={{ margin: '6px 0 0', fontSize: 12, opacity: 0.8 }}>{info.envoiRefus}</p>
        )}
      </div>

      {/* Suivi du dernier envoi */}
      {lien && (
        <div data-testid="rapport-suivi-client" style={{ background: 'var(--surface-2, #f8fafc)', borderRadius: 12, padding: 12, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {lien.etat === 'actif' && <Pill tone="blue">En attente de réponse</Pill>}
            {lien.etat === 'repondu' && lien.reponse === 'VALIDE' && <Pill tone="green">Validé par le client</Pill>}
            {lien.etat === 'repondu' && lien.reponse === 'RESERVES' && <Pill tone="amber">Réserves du client</Pill>}
            {lien.etat === 'revoque' && <Pill tone="slate">Lien révoqué</Pill>}
            {lien.etat === 'expire' && <Pill tone="red">Lien expiré sans réponse</Pill>}
          </div>
          <div><Mail size={13} aria-hidden /> Envoyé le {dateHeureFr(lien.creeLe)} à {lien.destinataires.join(', ')} · {lien.nbPhotos} photo{lien.nbPhotos > 1 ? 's' : ''}</div>
          {lien.etat === 'actif' && (
            <>
              <div><Clock size={13} aria-hidden /> Lien valable jusqu’au {dateFr(lien.expireLe)}</div>
              <div style={{ opacity: 0.85 }}>
                Relance J+3 : {lien.relanceJ3Le ? `faite le ${dateFr(lien.relanceJ3Le)}` : 'prévue'} · Relance J+7 : {lien.relanceJ7Le ? `faite le ${dateFr(lien.relanceJ7Le)}` : 'prévue'}
              </div>
            </>
          )}
          {lien.etat === 'repondu' && (
            <div>
              {lien.reponse === 'VALIDE' ? <CheckCircle2 size={13} aria-hidden /> : <MessageSquareWarning size={13} aria-hidden />} {lien.repondantNom} le {dateHeureFr(lien.reponduLe)}
              {lien.motif ? <blockquote style={{ margin: '6px 0 0', paddingLeft: 10, borderLeft: '3px solid #cbd5e1' }}>{lien.motif}</blockquote> : null}
              {lien.reponse === 'RESERVES' && <div style={{ marginTop: 6, opacity: 0.85 }}>Traitez les réserves, puis renvoyez le rapport corrigé.</div>}
            </div>
          )}
          {lien.etat === 'revoque' && lien.revoqueRaison && (
            <div style={{ opacity: 0.85 }}>Raison : {lien.revoqueRaison}. Renvoyez le rapport pour que le client réponde sur la bonne version.</div>
          )}
          {lien.etat === 'expire' && (
            <div style={{ opacity: 0.85 }}>Sans réponse sous 30 jours, le rapport reste « Envoyé au client » : il n’est jamais validé à la place du client. Relancez-le ou renvoyez le lien.</div>
          )}
        </div>
      )}

      {ouvert && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Envoyer le rapport au client"
          data-testid="rapport-envoi-dialog"
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16 }}
          onClick={(e) => e.target === e.currentTarget && setOuvert(false)}
        >
          <div style={{ background: 'var(--surface, #fff)', color: 'var(--text-primary, #0f172a)', borderRadius: 16, padding: 20, width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
            <strong style={{ fontSize: 16 }}>Envoyer le rapport {referenceMetier || ''} au client</strong>

            {/* 1. Document */}
            <fieldset style={{ border: 0, padding: 0, margin: '14px 0 0' }}>
              <legend style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>1. Document vu par le client</legend>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, padding: '4px 0' }}>
                <input type="radio" name="rapport-source" checked={source === 'GENERE'} onChange={() => setSource('GENERE')} data-testid="rapport-source-genere" />
                <span><strong>Générer le PDF</strong> à partir du rapport validé (avec les photos cochées ci-dessous)</span>
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, padding: '4px 0', opacity: depose ? 1 : 0.55 }}>
                <input type="radio" name="rapport-source" checked={source === 'DEPOSE'} disabled={!depose} onChange={() => setSource('DEPOSE')} data-testid="rapport-source-depose" />
                <span><strong>Mon PDF déposé</strong>{depose ? ` : ${depose.nomFichier}` : ' (aucun PDF déposé)'}</span>
              </label>
            </fieldset>

            {/* 2. Photos */}
            <fieldset style={{ border: 0, padding: 0, margin: '14px 0 0' }}>
              <legend style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>2. Photos affichées sur la page du client</legend>
              {photos.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>
                  Aucune photo transmissible{info && info.nbPhotosTotal > 0 ? ` (${info.nbPhotosTotal} photo(s) liée(s) à un lien externe ne sont pas envoyées)` : ''}.
                </p>
              ) : (
                <>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, padding: '4px 0', fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={toutesCochees}
                      onChange={(e) => setPhotosChoisies(e.target.checked ? photos.map((p) => p.id) : [])}
                      data-testid="rapport-photos-toutes"
                    />
                    Tout cocher ({photos.length} photo{photos.length > 1 ? 's' : ''})
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                    {photos.map((p) => (
                      <label key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={photosChoisies.includes(p.id)}
                          onChange={(e) => setPhotosChoisies((c) => (e.target.checked ? [...c, p.id] : c.filter((x) => x !== p.id)))}
                          data-testid="rapport-photo-choix"
                        />
                        <Miniature interventionId={interventionId} photoId={p.id} legende={p.caption} />
                        <span>{p.caption || 'Photo'}{p.category ? <small style={{ opacity: 0.7 }}> · {p.category}</small> : null}</span>
                      </label>
                    ))}
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 12, opacity: 0.75 }}>
                    {photosChoisies.length === 0 ? 'Aucune photo ne sera montrée au client.' : `${photosChoisies.length} photo(s) seront montrées au client.`}
                    {source === 'DEPOSE' ? ' Elles s’affichent sur la page, à côté de votre PDF.' : ''}
                  </p>
                </>
              )}
            </fieldset>

            {source === 'GENERE' && (
              <div style={{ marginTop: 10 }}>
                <Btn size="sm" icon={Eye} disabled={apercu.isPending} onClick={() => apercu.mutate()} data-testid="rapport-apercu">
                  {apercu.isPending ? 'Préparation…' : 'Voir l’aperçu du PDF'}
                </Btn>
              </div>
            )}

            {/* 3. Destinataires */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>3. Destinataire</div>
              {adresses.length === 0 ? (
                <p data-testid="rapport-aucune-adresse" style={{ fontSize: 13, color: '#b91c1c', margin: 0 }}>
                  {info?.ficheTrouvee ? 'La fiche de ce client ne contient aucune adresse e-mail valide.' : 'Aucune fiche client ne correspond à ce nom.'}{' '}
                  Complétez la fiche dans « Profils & donneurs d’ordre », puis revenez ici.
                </p>
              ) : unique ? (
                <p data-testid="rapport-adresse-unique" style={{ fontSize: 13, margin: 0 }}>
                  Le rapport sera envoyé à <strong>{adresses[0].email}</strong> ({adresses[0].libelle}), seule adresse de la fiche client. Les relances partiront à la même adresse.
                </p>
              ) : (
                <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend style={{ fontSize: 13, marginBottom: 6 }}>
                    Ce client a plusieurs adresses. <strong>Confirmez celle (ou celles) à laquelle envoyer le rapport.</strong>
                  </legend>
                  {adresses.map((a) => (
                    <label key={a.email} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={choix.includes(a.email)}
                        onChange={(e) => setChoix((c) => (e.target.checked ? [...c, a.email] : c.filter((x) => x !== a.email)))}
                        data-testid="rapport-adresse-choix"
                      />
                      <span>
                        <strong>{a.email}</strong>
                        <br />
                        <small style={{ opacity: 0.75 }}>{a.libelle}{a.suggeree ? ' · reçoit les rapports' : ''}</small>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
            </div>

            {adresses.length > 0 && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, margin: '14px 0 10px' }}>
                <input type="checkbox" checked={confirme} onChange={(e) => setConfirme(e.target.checked)} data-testid="rapport-confirmer-envoi" />
                <span>J’ai relu le rapport (texte, actions, photos choisies) et je confirme son envoi au client.</span>
              </label>
            )}
            <p style={{ fontSize: 12, opacity: 0.75, margin: '0 0 12px' }}>
              Le client reçoit un lien personnel valable 30 jours : il valide le rapport ou formule des réserves (texte obligatoire). Sans réponse, il est relancé à J+3 et J+7 ; passé 30 jours le rapport reste « Envoyé au client » et vous êtes alerté — jamais de validation automatique.
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Btn onClick={() => setOuvert(false)}>Annuler</Btn>
              <Btn
                variant="primary"
                icon={Send}
                disabled={adresses.length === 0 || !confirme || !choixValide || !sourceOk || envoyer.isPending}
                onClick={() => envoyer.mutate()}
                data-testid="rapport-envoi-valider"
              >
                {envoyer.isPending ? 'Envoi…' : 'Envoyer le rapport'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
