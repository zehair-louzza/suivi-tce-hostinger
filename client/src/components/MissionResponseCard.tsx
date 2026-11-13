// Carte « mission à confirmer » : le technicien accepte, ou refuse en indiquant un motif.
// N'apparaît que lorsque la mission attend sa réponse (reponseTechnicien = EN_ATTENTE).
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { interventionApi } from '../lib/api';
import type { Intervention } from '../../../shared/types';

export function MissionResponseCard({ mission }: { mission: Pick<Intervention, 'id' | 'reponseTechnicien' | 'affecteLe'> }) {
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

  return (
    <div
      role="region"
      aria-label="Mission à confirmer"
      data-testid="mission-response-card"
      style={{
        border: '1.5px solid #f59e0b',
        background: 'rgba(245, 158, 11, 0.10)',
        borderRadius: '14px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div>
        <strong style={{ fontSize: '15px' }}>Mission à confirmer</strong>
        <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.85 }}>
          Cette mission vous a été affectée. Acceptez-la, ou refusez-la en indiquant pourquoi : le planificateur sera prévenu tout de suite.
        </p>
      </div>
      {!refus ? (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 1, minHeight: '46px' }}
            disabled={mut.isPending}
            data-testid="mission-accepter"
            onClick={() => mut.mutate({ reponse: 'ACCEPTEE' })}
          >
            Accepter
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ flex: 1, minHeight: '46px' }}
            disabled={mut.isPending}
            data-testid="mission-refuser"
            onClick={() => setRefus(true)}
          >
            Refuser…
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
