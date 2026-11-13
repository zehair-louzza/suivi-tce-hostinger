// Carte « mission à confirmer » : le technicien accepte, ou refuse en indiquant un motif.
// N'apparaît que lorsque la mission attend sa réponse (reponseTechnicien = EN_ATTENTE).
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { interventionApi } from '../lib/api';
import type { Intervention } from '../../../shared/types';

type Props = {
  mission: Pick<Intervention, 'id' | 'reponseTechnicien' | 'affecteLe'>;
  /** 'banner' : simple bandeau d'information en haut de la fiche ; 'actions' : boutons Accepter / Refuser (barre du bas). */
  variant?: 'banner' | 'actions';
};

export function MissionResponseCard({ mission, variant = 'actions' }: Props) {
  const queryClient = useQueryClient();
  const [refus, setRefus] = useState(false);
  const [motif, setMotif] = useState('');

  const mut = useMutation({
    mutationFn: (p: { reponse: 'ACCEPTEE' | 'REFUSEE'; motif?: string }) => interventionApi.respond(mission.id, p),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Réponse enregistrée');
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Réponse non enregistrée, réessayez.'),
  });

  if (mission.reponseTechnicien !== 'EN_ATTENTE') return null;
  const motifValide = motif.trim().length >= 3;

  if (variant === 'banner') {
    return (
      <div
        role="status"
        data-testid="mission-response-card"
        style={{ border: '1.5px solid #f59e0b', background: 'rgba(245, 158, 11, 0.12)', borderRadius: '14px', padding: '12px 14px' }}
      >
        <strong style={{ fontSize: '15px' }}>Mission à confirmer</strong>
        <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.9 }}>
          Cette mission vous a été affectée. Utilisez le bouton « Accepter la mission » en bas de l’écran, ou refusez-la en indiquant le motif.
        </p>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Mission à confirmer"
      data-testid="mission-response-actions"
      style={{
        maxHeight: '70vh',
        overflowY: 'auto',
        width: '100%',
        border: '1.5px solid #f59e0b',
        background: 'rgba(245, 158, 11, 0.10)',
        borderRadius: '14px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <strong style={{ fontSize: '15px' }}>Mission à confirmer</strong>
      {!refus ? (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: '2 1 160px', minHeight: '54px', fontSize: '16px', fontWeight: 800 }}
            disabled={mut.isPending}
            data-testid="mission-accepter"
            onClick={() => mut.mutate({ reponse: 'ACCEPTEE' })}
          >
            ✓ Accepter la mission
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ flex: 1, minHeight: '46px' }}
            disabled={mut.isPending}
            data-testid="mission-refuser"
            onClick={() => setRefus(true)}
          >
            Refuser
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ minHeight: '54px', fontSize: '16px', fontWeight: 800 }}
            disabled={mut.isPending}
            data-testid="mission-accepter"
            onClick={() => mut.mutate({ reponse: 'ACCEPTEE' })}
          >
            ✓ Accepter la mission
          </button>
          <label htmlFor={`motif-${mission.id}`} style={{ fontSize: '13px', fontWeight: 600 }}>
            Motif du refus
          </label>
          <textarea
            id={`motif-${mission.id}`}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="Ex. : en congés ce jour-là, déjà sur un autre chantier…"
            style={{ width: '100%', borderRadius: '10px', padding: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }}
            data-testid="mission-motif"
          />
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1, minHeight: '44px' }} onClick={() => setRefus(false)}>
              Annuler
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1, minHeight: '44px' }}
              disabled={!motifValide || mut.isPending}
              data-testid="mission-confirmer-refus"
              onClick={() => mut.mutate({ reponse: 'REFUSEE', motif: motif.trim() })}
            >
              Confirmer le refus
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
