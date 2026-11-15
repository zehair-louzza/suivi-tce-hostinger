import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { adminApi } from '../lib/api';

interface RemoteClockInExceptionBarProps {
  techniciens: string[];
}

/**
 * Barre rapide permettant aux responsables habilités (Direction ou Planificateur autorisé)
 * d'activer ou de retirer la dérogation de pointage matin hors bureau (> 30 m du siège) pour aujourd'hui.
 */
export function RemoteClockInExceptionBar({ techniciens }: RemoteClockInExceptionBarProps) {
  const queryClient = useQueryClient();
  const todayISO = useMemo(
    () =>
      new Intl.DateTimeFormat('fr-CA', {
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()),
    []
  );

  const { data: derogations = [] } = useQuery({
    queryKey: ['admin-pointage-derogations', todayISO],
    queryFn: async () => (await adminApi.listPointageDerogations({ dateJour: todayISO })).data.data,
  });

  const mut = useMutation({
    mutationFn: adminApi.setPointageDerogation,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-pointage-derogations'] });
      toast.success(res.data.message);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Modification impossible'),
  });

  if (techniciens.length === 0) return null;

  return (
    <div
      className="pro-table-container"
      style={{
        margin: '0 0 12px',
        padding: '10px 14px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
      }}
    >
      <div style={{ fontSize: '12px' }}>
        <strong>Dérogations pointage matin (hors rayon 30 m) — Aujourd’hui</strong>
        <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>
          Cliquez sur un technicien pour l’autoriser à démarrer sans passer par le bureau :
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {techniciens.map((tech) => {
          const active = derogations.find((d) => d.technicien === tech && d.dateJour === todayISO && d.active);
          return (
            <button
              key={tech}
              type="button"
              disabled={mut.isPending}
              className={`btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`}
              title={
                active
                  ? `Exception active (${active.accordeePar}${active.motif ? ` : ${active.motif}` : ''}) — cliquer pour retirer`
                  : `Autoriser ${tech} à pointer sans être dans le rayon de 30 m du bureau`
              }
              onClick={() => {
                if (active) {
                  mut.mutate({ technicien: tech, dateJour: todayISO, active: false });
                } else {
                  const motif = window.prompt(`Motif de l’exception hors bureau pour ${tech} (facultatif) :`, 'Départ direct chantier');
                  if (motif === null) return;
                  mut.mutate({ technicien: tech, dateJour: todayISO, active: true, motif: motif.trim() || null });
                }
              }}
            >
              {active ? `✓ ${tech} (hors bureau)` : tech}
            </button>
          );
        })}
      </div>
    </div>
  );
}
