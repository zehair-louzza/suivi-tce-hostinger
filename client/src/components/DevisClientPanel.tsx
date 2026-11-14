// Devis client : génération PDF automatique par défaut (+ rapport/photos de visite technique),
// ou PDF externe facultatif préparé hors de l'application, envoi par lien sécurisé et suivi des relances.
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Send, Upload, Eye, Mail, Clock, CheckCircle2, XCircle, MessageSquareWarning, X, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { devisApi, Devis } from '../lib/api';
import { formatDateHeurePdfFr, formatDatePdfFr, formatTaillePdf, lireFichierBase64, ouvrirPdfBlob } from '../lib/pdfClientHelpers';
import { Btn, Pill } from './ui';

function MiniatureVisite({ devisId, photoId, legende }: { devisId: number; photoId: string; legende?: string | null }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let actif = true;
    devisApi
      .miniatureVisite(devisId, photoId)
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
  }, [devisId, photoId]);
  return src ? (
    <img src={src} alt={legende || 'Photo visite'} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flex: 'none' }} />
  ) : (
    <div aria-hidden style={{ width: 56, height: 56, borderRadius: 8, background: '#e2e8f0', flex: 'none', display: 'grid', placeItems: 'center' }}>
      <ImageIcon size={16} />
    </div>
  );
}

type Props = {
  devisId: number;
  statutCommercial?: string | null;
  /** false : profil sans droit de chiffrage (suivi en lecture seule) */
  canManage: boolean;
  /** Ouvre la fenêtre d'envoi (le bouton du pied de tiroir la déclenche) */
  envoiOuvert: boolean;
  onEnvoiOuvert: (ouvert: boolean) => void;
  onDevisUpdated?: (devis: Partial<Devis>) => void;
  onBeforeAction?: () => Promise<void>;
};

export function DevisClientPanel({ devisId, statutCommercial, canManage, envoiOuvert, onEnvoiOuvert, onDevisUpdated, onBeforeAction }: Props) {
  const queryClient = useQueryClient();
  const fichierRef = useRef<HTMLInputElement>(null);
  // Toujours la conversion PDF automatique par défaut, sauf si l'utilisateur choisit ou dépose un PDF externe
  const [source, setSource] = useState<'GENERE' | 'DEPOSE'>('GENERE');
  const [inclureVisite, setInclureVisite] = useState(true);
  const [photosChoisies, setPhotosChoisies] = useState<string[]>([]);
  const [choix, setChoix] = useState<string[]>([]);
  const [confirme, setConfirme] = useState(false);

  const query = useQuery({
    queryKey: ['devis-envoi-client', devisId],
    queryFn: async () => (await devisApi.envoiClient(devisId)).data.data,
    staleTime: 10_000,
  });
  const info = query.data;
  const doc = info?.document || null;
  const lien = info?.lien || null;
  const adresses = info?.adresses || [];
  const photos = info?.photos || [];
  const hasVisite = Boolean(info?.hasVisiteRapport || photos.length > 0 || info?.visiteCompteRendu);
  const toutesCochees = photos.length > 0 && photosChoisies.length === photos.length;

  useEffect(() => {
    if (!envoiOuvert) return;
    setConfirme(false);
    setSource('GENERE');
    setInclureVisite(hasVisite);
    setPhotosChoisies(photos.map((p) => p.id));
    const suggerees = adresses.filter((a) => a.suggeree).map((a) => a.email);
    setChoix(adresses.length === 1 ? [adresses[0].email] : suggerees);
  }, [envoiOuvert]); // eslint-disable-line react-hooks/exhaustive-deps

  const rafraichir = () => {
    queryClient.invalidateQueries({ queryKey: ['devis-envoi-client', devisId] });
    queryClient.invalidateQueries({ queryKey: ['devis'] });
  };

  const deposer = useMutation({
    mutationFn: async (f: File) => {
      if (!/\.pdf$/i.test(f.name)) throw new Error('Choisissez un fichier PDF.');
      if (f.size > 8 * 1024 * 1024) throw new Error('Le PDF dépasse 8 Mo : compressez-le avant de le déposer.');
      return devisApi.uploadDocument(devisId, f.name, await lireFichierBase64(f));
    },
    onSuccess: (res) => {
      rafraichir();
      setSource('DEPOSE');
      if (res.data.lienRevoque) {
        toast.success('PDF externe remplacé : le lien précédent est révoqué, renvoyez le devis au client.');
      } else if (!lien && !['Accepté', 'Annulé'].includes(String(statutCommercial || '')) && adresses.length > 0) {
        toast.success('PDF externe enregistré — confirmez l’envoi au client');
        onEnvoiOuvert(true);
      } else {
        toast.success('PDF externe enregistré — prêt si vous souhaitez l’utiliser à la place du PDF généré.');
      }
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || err?.message || 'Dépôt impossible'),
  });

  const apercu = useMutation({
    mutationFn: async () => {
      if (onBeforeAction) await onBeforeAction();
      const ids = envoiOuvert ? photosChoisies : photos.map((p) => p.id);
      const all = photos.length > 0 && ids.length === photos.length;
      return devisApi.apercu(devisId, {
        inclureVisite: envoiOuvert ? inclureVisite : true,
        ...(all ? { toutesPhotos: true } : { photoIds: ids }),
      });
    },
    onSuccess: (res) => ouvrirPdfBlob(res.data),
    onError: () => toast.error('Impossible de préparer l’aperçu PDF du devis'),
  });

  const envoyer = useMutation({
    mutationFn: async () => {
      if (onBeforeAction) await onBeforeAction();
      return devisApi.envoyerClient(devisId, {
        confirme: true,
        source,
        inclureVisite,
        ...(toutesCochees ? { toutesPhotos: true } : { photoIds: photosChoisies }),
        emails: choix,
      });
    },
    onSuccess: (res) => {
      if (res.data?.data) {
        onDevisUpdated?.(res.data.data);
      }
      toast.success(res.data.message || 'Devis envoyé au client — date d’envoi et relance J+3 renseignées');
      onEnvoiOuvert(false);
      rafraichir();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Envoi impossible, réessayez.'),
  });

  const voirPdfDepose = async () => {
    try {
      const res = await devisApi.downloadDocument(devisId, 'DEPOSE');
      ouvrirPdfBlob(res.data);
    } catch {
      toast.error('Impossible d’ouvrir le PDF');
    }
  };

  const ouvrirEnvoi = async () => {
    if (onBeforeAction) await onBeforeAction();
    onEnvoiOuvert(true);
  };

  const dejaTraite = ['Accepté', 'Annulé'].includes(String(statutCommercial || ''));
  const peutEnvoyer = canManage && !dejaTraite;
  const unique = adresses.length === 1;
  const choixValide = unique || choix.length > 0;
  const sourceOk = source === 'GENERE' || !!doc;

  return (
    <section data-testid="devis-client-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 18 }}>
      <h4 className="m-h4" style={{ margin: 0 }}>
        <Mail size={15} /> Envoi au client
      </h4>

      {/* PDF généré automatiquement par défaut depuis le devis (et son éventuel rapport de visite) */}
      {canManage && (
        <div style={{ border: '1px solid #bfdbfe', background: 'rgba(37, 99, 235, 0.05)', borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 13 }}>PDF généré automatiquement depuis le devis</strong>
              <Pill tone="blue">Choix par défaut</Pill>
            </div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
              Conversion automatique du devis (chiffrage, objet{hasVisite ? ', rapport & photos de visite' : ''}) en PDF prêt pour le client.
            </div>
          </div>
          <Btn size="sm" icon={Eye} disabled={apercu.isPending} onClick={() => apercu.mutate()} data-testid="devis-apercu-direct">
            {apercu.isPending ? 'Génération…' : 'Voir le PDF généré'}
          </Btn>
        </div>
      )}

      {/* PDF externe facultatif préparé hors de l'application */}
      <div style={{ border: '1px dashed var(--border-subtle, #cbd5e1)', borderRadius: 12, padding: 12 }}>
        {doc ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <FileText size={20} aria-hidden />
            <div style={{ flex: 1, minWidth: 160 }}>
              <strong data-testid="devis-doc-nom" style={{ fontSize: 13 }}>{doc.nomFichier}</strong>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                PDF externe · {formatTaillePdf(doc.taille)} · déposé le {formatDateHeurePdfFr(doc.deposeLe)}
                {doc.deposePar ? ` par ${doc.deposePar}` : ''}
              </div>
            </div>
            <Btn size="sm" icon={Eye} onClick={voirPdfDepose}>Voir</Btn>
            {canManage && (
              <Btn size="sm" icon={Upload} disabled={deposer.isPending} onClick={() => fichierRef.current?.click()}>
                Remplacer
              </Btn>
            )}
          </div>
        ) : canManage ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <p style={{ margin: 0, fontSize: 12.5, opacity: 0.85, flex: 1, minWidth: 200 }}>
              Vous avez préparé un devis ou un rapport PDF séparé à l’extérieur du SaaS ? (Optionnel, 8 Mo max)
            </p>
            <Btn size="sm" icon={Upload} disabled={deposer.isPending} onClick={() => fichierRef.current?.click()} data-testid="devis-doc-deposer">
              {deposer.isPending ? 'Envoi du fichier…' : 'Insérer un PDF externe'}
            </Btn>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>Aucun PDF externe déposé pour ce devis.</p>
        )}
        <input
          ref={fichierRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          data-testid="devis-doc-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) deposer.mutate(f);
          }}
        />
      </div>

      {canManage && (
        <div>
          <Btn
            variant="primary"
            icon={Send}
            disabled={!peutEnvoyer}
            onClick={ouvrirEnvoi}
            data-testid="devis-envoyer-client"
          >
            {lien ? 'Renvoyer au client' : 'Envoyer au client'}
          </Btn>
          {dejaTraite && <p style={{ margin: '6px 0 0', fontSize: 12, opacity: 0.75 }}>Un devis « {statutCommercial} » ne peut plus être envoyé.</p>}
        </div>
      )}

      {/* Suivi du dernier envoi */}
      {lien && (
        <div data-testid="devis-suivi-client" style={{ background: 'var(--surface-2, #f8fafc)', borderRadius: 12, padding: 12, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {lien.etat === 'actif' && <Pill tone="blue">En attente de réponse</Pill>}
            {lien.etat === 'repondu' && lien.reponse === 'ACCEPTEE' && <Pill tone="green">Accepté par le client</Pill>}
            {lien.etat === 'repondu' && lien.reponse === 'REFUSEE' && <Pill tone="red">Refusé par le client</Pill>}
            {lien.etat === 'repondu' && lien.reponse === 'MODIFICATION' && <Pill tone="amber">Modification demandée</Pill>}
            {lien.etat === 'revoque' && <Pill tone="slate">Lien révoqué</Pill>}
            {lien.etat === 'expire' && <Pill tone="slate">Lien expiré</Pill>}
          </div>
          <div><Mail size={13} aria-hidden /> Envoyé le {formatDateHeurePdfFr(lien.creeLe)} à {lien.destinataires.join(', ')}</div>
          {lien.etat === 'actif' && (
            <>
              <div><Clock size={13} aria-hidden /> Lien valable jusqu’au {formatDatePdfFr(lien.expireLe)}</div>
              <div style={{ opacity: 0.85 }}>
                Relance J+3 : {lien.relanceJ3Le ? `faite le ${formatDatePdfFr(lien.relanceJ3Le)}` : 'prévue'} · Relance J+7 :{' '}
                {lien.relanceJ7Le ? `faite le ${formatDatePdfFr(lien.relanceJ7Le)}` : 'prévue'}
              </div>
            </>
          )}
          {lien.etat === 'repondu' && (
            <div>
              {lien.reponse === 'ACCEPTEE' && <CheckCircle2 size={13} aria-hidden />}
              {lien.reponse === 'REFUSEE' && <XCircle size={13} aria-hidden />}
              {lien.reponse === 'MODIFICATION' && <MessageSquareWarning size={13} aria-hidden />} {lien.repondantNom} le {formatDateHeurePdfFr(lien.reponduLe)}
              {lien.motif ? <blockquote style={{ margin: '6px 0 0', paddingLeft: 10, borderLeft: '3px solid #cbd5e1' }}>{lien.motif}</blockquote> : null}
            </div>
          )}
          {lien.etat === 'revoque' && lien.revoqueRaison && (
            <div style={{ opacity: 0.85 }}>Raison : {lien.revoqueRaison}. Renvoyez le devis pour que le client réponde sur la bonne version.</div>
          )}
        </div>
      )}

      {/* Fenêtre d'envoi : choix du PDF (auto par défaut) + destinataires */}
      {envoiOuvert && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Envoyer le devis au client"
          data-testid="devis-envoi-dialog"
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16 }}
          onClick={(e) => e.target === e.currentTarget && onEnvoiOuvert(false)}
        >
          <div style={{ background: 'var(--surface, #fff)', color: 'var(--text-primary, #0f172a)', borderRadius: 16, padding: 20, width: 'min(540px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 16 }}>Envoyer le devis {info?.reference || ''} au client</strong>
              <button type="button" aria-label="Fermer" onClick={() => onEnvoiOuvert(false)} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'inherit' }}>
                <X size={18} />
              </button>
            </div>

            <fieldset style={{ border: 0, padding: 0, margin: '14px 0 0' }}>
              <legend style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>1. Document vu par le client</legend>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, padding: '4px 0' }}>
                <input type="radio" name="devis-source" checked={source === 'GENERE'} onChange={() => setSource('GENERE')} data-testid="devis-source-genere" />
                <span><strong>Générer automatiquement le PDF</strong> à partir du devis saisi dans l’application</span>
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, padding: '4px 0', opacity: doc ? 1 : 0.55 }}>
                <input type="radio" name="devis-source" checked={source === 'DEPOSE'} disabled={!doc} onChange={() => setSource('DEPOSE')} data-testid="devis-source-depose" />
                <span><strong>Utiliser mon PDF externe déposé</strong>{doc ? ` : ${doc.nomFichier}` : ' (aucun PDF externe déposé)'}</span>
              </label>
            </fieldset>

            {source === 'GENERE' && hasVisite && (
              <fieldset style={{ border: 0, padding: 0, margin: '12px 0 0' }}>
                <legend style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Visite technique préalable</legend>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 6 }}>
                  <input
                    type="checkbox"
                    checked={inclureVisite}
                    onChange={(e) => setInclureVisite(e.target.checked)}
                    data-testid="devis-inclure-visite"
                  />
                  <span>Inclure le compte-rendu et les photos de visite technique dans le PDF</span>
                </label>
                {inclureVisite && photos.length > 0 && (
                  <>
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, padding: '4px 0', fontWeight: 700 }}>
                      <input
                        type="checkbox"
                        checked={toutesCochees}
                        onChange={(e) => setPhotosChoisies(e.target.checked ? photos.map((p) => p.id) : [])}
                      />
                      Tout cocher ({photos.length} photo{photos.length > 1 ? 's' : ''})
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                      {photos.map((p) => (
                        <label key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
                          <input
                            type="checkbox"
                            checked={photosChoisies.includes(p.id)}
                            onChange={(e) => setPhotosChoisies((c) => (e.target.checked ? [...c, p.id] : c.filter((x) => x !== p.id)))}
                          />
                          <MiniatureVisite devisId={devisId} photoId={p.id} legende={p.caption} />
                          <span>{p.caption || 'Photo visite'}{p.category ? <small style={{ opacity: 0.7 }}> · {p.category}</small> : null}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </fieldset>
            )}

            {source === 'GENERE' && (
              <div style={{ marginTop: 10 }}>
                <Btn size="sm" icon={Eye} disabled={apercu.isPending} onClick={() => apercu.mutate()} data-testid="devis-apercu">
                  {apercu.isPending ? 'Préparation…' : 'Voir l’aperçu du PDF'}
                </Btn>
              </div>
            )}

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>2. Destinataire</div>
              {adresses.length === 0 ? (
                <p data-testid="devis-aucune-adresse" style={{ fontSize: 13, color: '#b91c1c', margin: 0 }}>
                  {info?.ficheTrouvee
                    ? 'La fiche de ce client ne contient aucune adresse e-mail valide.'
                    : 'Aucune fiche client ne correspond à ce nom.'}{' '}
                  Complétez la fiche dans « Profils & donneurs d’ordre », puis revenez ici.
                </p>
              ) : unique ? (
                <p data-testid="devis-adresse-unique" style={{ fontSize: 13, margin: 0 }}>
                  Le devis sera envoyé à <strong>{adresses[0].email}</strong> ({adresses[0].libelle}), seule adresse de la fiche client. Les relances partiront à la même adresse.
                </p>
              ) : (
                <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend style={{ fontSize: 13, marginBottom: 6 }}>
                    Ce client a plusieurs adresses. <strong>Confirmez celle (ou celles) à laquelle envoyer le devis</strong> — les relances partiront aux mêmes adresses.
                  </legend>
                  {adresses.map((a) => (
                    <label key={a.email} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={choix.includes(a.email)}
                        onChange={(e) => setChoix((c) => (e.target.checked ? [...c, a.email] : c.filter((x) => x !== a.email)))}
                        data-testid="devis-adresse-choix"
                      />
                      <span>
                        <strong>{a.email}</strong>
                        <br />
                        <small style={{ opacity: 0.75 }}>{a.libelle}{a.suggeree ? ' · reçoit les devis' : ''}</small>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
            </div>

            {adresses.length > 0 && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, margin: '10px 0' }}>
                <input type="checkbox" checked={confirme} onChange={(e) => setConfirme(e.target.checked)} data-testid="devis-confirmer-envoi" />
                <span>J’ai vérifié le devis (montant, objet, PDF) et je confirme son envoi au client.</span>
              </label>
            )}
            <p style={{ fontSize: 12, opacity: 0.75, margin: '0 0 12px' }}>
              Le client reçoit un lien personnel valable 30 jours. Sans réponse, il est relancé à J+3 et J+7, puis le devis passe à « Expiré ».
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Btn onClick={() => onEnvoiOuvert(false)}>Annuler</Btn>
              <Btn
                variant="primary"
                icon={Send}
                disabled={adresses.length === 0 || !confirme || !choixValide || !sourceOk || envoyer.isPending}
                onClick={() => envoyer.mutate()}
                data-testid="devis-envoi-valider"
              >
                {envoyer.isPending ? 'Envoi…' : 'Envoyer le devis'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
