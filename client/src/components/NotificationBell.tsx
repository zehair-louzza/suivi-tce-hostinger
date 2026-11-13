// Cloche de notifications : les messages automatiques adressés à CET utilisateur (affectation, refus, relance…).
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationApi, type AppNotification } from '../lib/api';

function ilYA(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

export function NotificationBell({
  onOpenIntervention,
  onOpenDevis,
}: {
  onOpenIntervention?: (interventionId: number) => void;
  onOpenDevis?: (devisId: number) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await notificationApi.list()).data,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
  const items: AppNotification[] = query.data?.data || [];
  const nonLues = query.data?.nonLues || 0;

  const readOne = useMutation({
    mutationFn: (id: number) => notificationApi.read(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const readAll = useMutation({
    mutationFn: () => notificationApi.readAll(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: 'relative' }} data-testid="notification-bell">
      <button
        type="button"
        className="btn btn-secondary"
        aria-label={nonLues > 0 ? `Notifications, ${nonLues} non lue${nonLues > 1 ? 's' : ''}` : 'Notifications'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ position: 'relative', minWidth: '40px', padding: '0 10px' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {nonLues > 0 && (
          <span
            data-testid="notification-count"
            style={{
              position: 'absolute', top: '-4px', right: '-4px', minWidth: '18px', height: '18px', borderRadius: '9px',
              background: '#dc2626', color: '#fff', fontSize: '11px', fontWeight: 700, display: 'flex',
              alignItems: 'center', justifyContent: 'center', padding: '0 4px',
            }}
          >
            {nonLues > 9 ? '9+' : nonLues}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 'min(360px, 92vw)', maxHeight: '70vh',
            overflowY: 'auto', background: 'var(--surface, #fff)', color: 'var(--text-primary, #0f172a)',
            border: '1px solid var(--border-subtle, #e2e8f0)', borderRadius: '14px', boxShadow: '0 12px 32px rgba(15,23,42,0.2)',
            zIndex: 1000,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--border-subtle, #e2e8f0)' }}>
            <strong style={{ fontSize: '14px' }}>Notifications</strong>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={nonLues === 0 || readAll.isPending}
              onClick={() => readAll.mutate()}
            >
              Tout marquer comme lu
            </button>
          </div>
          {items.length === 0 ? (
            <p style={{ padding: '18px', margin: 0, fontSize: '13px', opacity: 0.7 }}>Aucune notification pour le moment.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.lu) readOne.mutate(n.id);
                      if (n.interventionId && onOpenIntervention) {
                        setOpen(false);
                        onOpenIntervention(n.interventionId);
                      } else if (n.devisId && onOpenDevis) {
                        setOpen(false);
                        onOpenDevis(n.devisId);
                      }
                    }}
                    style={{
                      width: '100%', textAlign: 'left', background: n.lu ? 'transparent' : 'rgba(37, 99, 235, 0.07)',
                      border: 0, borderBottom: '1px solid var(--border-subtle, #e2e8f0)', padding: '12px 14px', cursor: 'pointer', color: 'inherit',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <strong style={{ fontSize: '13px', fontWeight: n.lu ? 600 : 800 }}>{n.titre}</strong>
                      <span style={{ fontSize: '11px', opacity: 0.6, whiteSpace: 'nowrap' }}>{ilYA(n.createdAt)}</span>
                    </div>
                    {n.message && <p style={{ margin: '4px 0 0', fontSize: '12.5px', opacity: 0.85 }}>{n.message}</p>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
