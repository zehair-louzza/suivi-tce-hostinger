// Devis client : dépôt du PDF importé, envoi par lien sécurisé (adresse confirmée), suivi des réponses et relances.
// L'envoi est toujours un geste humain : rien ne part sans cocher la confirmation.
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Send, Upload, Eye, Mail, Clock, CheckCircle2, XCircle, MessageSquareWarning, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { devisApi, Devis } from '../lib/api';
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

type Props = {
  devisId: number;
  statutCommercial?: string | null;
  /** false : profil sans droit de chiffrage (suivi en lecture seule) */
  canManage: boolean;
  /** Ouvre la fenêtre d'envoi (le bouton du pied de tiroir la déclenche) */
  envoiOuvert: boolean;
  onEnvoiOuvert: (ouvert: boolean) => void;
  onDevisUpdated?: (devis: Partial<Devis>) => void;
};

export function DevisClientPanel({ devisId, statutCommercial, canManage, envoiOuvert, onEnvoiOuvert, onDevisUpdated }: Props) {
  const queryClient = useQueryClient();
  const fichierRef = useRef<HTMLInputElement>(null);
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

  // À l'ouverture de la fenêtre : les services « reçoivent les devis » sont présélectionnés, mais il faut confirmer
  useEffect(() => {
    if (!envoiOuvert) return;
    setConfirme(false);
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
      return devisApi.uploadDocument(devisId, f.name, await lireFichier(f));
    },
    onSuccess: (res) => {
      rafraichir();
      if (res.data.lienRevoque) {
        toast.success('PDF remplacé : le lien précédent est révoqué, renvoyez le devis au client.');
      } else if (!lien && !['Accepté', 'Annulé'].includes(String(statutCommercial || '')) && adresses.length > 0) {
        toast.success('PDF enregistré — confirmez l’envoi au client');
        onEnvoiOuvert(true);
      } else {
        toast.success('PDF enregistré — cliquez sur « Envoyer au client » pour passer automatiquement le statut à Envoyé et calculer la relance.');
      }
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || err?.message || 'Dépôt impossible'),
  });

  const envoyer = useMutation({
    mutationFn: () => devisApi.envoyerClient(devisId, { confirme: true, emails: choix }),
    onSuccess: (res) => {
      if (res.data?.data) {
        onDevisUpdated?.(res.data.data);
      }
      toast.success(res.data.message || 'Devis envoyé au client — date d’envoi et relance J+3 renseignées');
      onEnvoiOuvert(false);
      rafraichir();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || "Envoi impossible, réessayez."),
  });

  const voirPdf = async () => {
    try {
      const res = await devisApi.downloadDocument(devisId);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error('Impossible d’ouvrir le PDF');
    }
  };

  const dejaTraite = ['Accepté', 'Annulé'].includes(String(statutCommercial || ''));
  const peutEnvoyer = canManage && !!doc && !dejaTraite;
  const unique = adresses.length === 1;
  const choixValide = unique || choix.length > 0;

  return (
    <section data-testid="devis-client-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 18 }}>
      <h4 className="m-h4" style={{ margin: 0 }}>
        <Mail size={15} /> Envoi au client
      </h4>

      {/* PDF importé */}
      <div style={{ border: '1px dashed var(--border-subtle, #cbd5e1)', borderRadius: 12, padding: 12 }}>
        {doc ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <FileText size={20} aria-hidden />
            <div style={{ flex: 1, minWidth: 160 }}>
              <strong data-testid="devis-doc-nom" style={{ fontSize: 13 }}>{doc.nomFichier}</strong>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {taille(doc.taille)} · déposé le {dateHeureFr(doc.deposeLe)}
                {doc.deposePar ? ` par ${doc.deposePar}` : ''}
              </div>
            </div>
            <Btn size="sm" icon={Eye} onClick={voirPdf}>Voir</Btn>
            {canManage && (
              <Btn size="sm" icon={Upload} disabled={deposer.isPending} onClick={() => fichierRef.current?.click()}>
                Remplacer
              </Btn>
            )}
          </div>
        ) : canManage ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 8px', fontSize: 13 }}>
              Déposez ici le devis importé (PDF, 8 Mo maximum) : c’est ce document que le client verra.
            </p>
            <Btn icon={Upload} disabled={deposer.isPending} onClick={() => fichierRef.current?.click()} data-testid="devis-doc-deposer">
              {deposer.isPending ? 'Envoi du fichier…' : 'Déposer le PDF du devis'}
            </Btn>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>Aucun PDF déposé pour ce devis.</p>
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
            onClick={() => onEnvoiOuvert(true)}
            data-testid="devis-envoyer-client"
          >
            {lien ? 'Renvoyer au client' : 'Envoyer au client'}
          </Btn>
          {!doc && <p style={{ margin: '6px 0 0', fontSize: 12, opacity: 0.75 }}>Déposez d’abord le PDF du devis.</p>}
          {doc && dejaTraite && <p style={{ margin: '6px 0 0', fontSize: 12, opacity: 0.75 }}>Un devis « {statutCommercial} » ne peut plus être envoyé.</p>}
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
          <div><Mail size={13} aria-hidden /> Envoyé le {dateHeureFr(lien.creeLe)} à {lien.destinataires.join(', ')}</div>
          {lien.etat === 'actif' && (
            <>
              <div><Clock size={13} aria-hidden /> Lien valable jusqu’au {dateFr(lien.expireLe)}</div>
              <div style={{ opacity: 0.85 }}>
                Relance J+3 : {lien.relanceJ3Le ? `faite le ${dateFr(lien.relanceJ3Le)}` : 'prévue'} · Relance J+7 :{' '}
                {lien.relanceJ7Le ? `faite le ${dateFr(lien.relanceJ7Le)}` : 'prévue'}
              </div>
            </>
          )}
          {lien.etat === 'repondu' && (
            <div>
              {lien.reponse === 'ACCEPTEE' && <CheckCircle2 size={13} aria-hidden />}
              {lien.reponse === 'REFUSEE' && <XCircle size={13} aria-hidden />}
              {lien.reponse === 'MODIFICATION' && <MessageSquareWarning size={13} aria-hidden />} {lien.repondantNom} le {dateHeureFr(lien.reponduLe)}
              {lien.motif ? <blockquote style={{ margin: '6px 0 0', paddingLeft: 10, borderLeft: '3px solid #cbd5e1' }}>{lien.motif}</blockquote> : null}
            </div>
          )}
          {lien.etat === 'revoque' && lien.revoqueRaison && (
            <div style={{ opacity: 0.85 }}>Raison : {lien.revoqueRaison}. Renvoyez le devis pour que le client réponde sur la bonne version.</div>
          )}
        </div>
      )}

      {/* Fenêtre d'envoi : adresse confirmée avant tout envoi */}
      {envoiOuvert && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Envoyer le devis au client"
          data-testid="devis-envoi-dialog"
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16 }}
          onClick={(e) => e.target === e.currentTarget && onEnvoiOuvert(false)}
        >
          <div style={{ background: 'var(--surface, #fff)', color: 'var(--text-primary, #0f172a)', borderRadius: 16, padding: 20, width: 'min(480px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 16 }}>Envoyer le devis {info?.reference || ''} au client</strong>
              <button type="button" aria-label="Fermer" onClick={() => onEnvoiOuvert(false)} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'inherit' }}>
                <X size={18} />
              </button>
            </div>

            {adresses.length === 0 ? (
              <p data-testid="devis-aucune-adresse" style={{ fontSize: 13, color: '#b91c1c' }}>
                {info?.ficheTrouvee
                  ? 'La fiche de ce client ne contient aucune adresse e-mail valide.'
                  : 'Aucune fiche client ne correspond à ce nom.'}{' '}
                Complétez la fiche dans « Profils & donneurs d’ordre », puis revenez ici.
              </p>
            ) : unique ? (
              <p data-testid="devis-adresse-unique" style={{ fontSize: 13 }}>
                Le devis sera envoyé à <strong>{adresses[0].email}</strong> ({adresses[0].libelle}), seule adresse de la fiche client. Les relances partiront à la même adresse.
              </p>
            ) : (
              <fieldset style={{ border: 0, padding: 0, margin: '12px 0' }}>
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
                disabled={adresses.length === 0 || !confirme || !choixValide || envoyer.isPending}
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
