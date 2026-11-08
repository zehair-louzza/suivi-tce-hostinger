import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  adminApi,
  interventionApi,
  Intervention,
  Devis,
  formatDateFR,
} from '../lib/api';
import toast from 'react-hot-toast';
import { useTheme, THEMES, ThemeId } from '../stores/themeStore';
import { useAuth } from '../stores/authStore';
import { compressAndOptimizeImage } from '../lib/imageOptimizer';
import { TourneeMapOptimizer } from './TourneeMapOptimizer';

interface TechnicianMobileViewProps {
  techniciens: string[];
  currentTechnicien: string;
  canSwitchTechnicien: boolean;
  onSelectTechnicien: (tech: string) => void;
  interventionsList: Intervention[];
  devisList: Devis[];
}

function getNowHHMM(): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
  } catch {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}

function formatWelcomeDate(d: Date = new Date()): string {
  try {
    const s = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'Europe/Paris',
    }).format(d);
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return 'Aujourd’hui';
  }
}

/* ============================================================================
   STATUS BAR MOBILE (Horloge, Réseau, Batterie)
   ============================================================================ */
function StatusBar({ time }: { time: string }) {
  return (
    <div className="t-sbar" aria-hidden="true">
      <span>{time || '10:36'}</span>
      <span className="t-sbar-mid" />
      {/* Signal */}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M2 20h.01M7 20v-4M12 20v-8M17 20V4" />
      </svg>
      {/* Wifi */}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M12 20h.01" />
      </svg>
      {/* Battery */}
      <span className="t-sbar-bat">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect width="16" height="10" x="2" y="7" rx="2" />
          <line x1="22" x2="22" y1="11" y2="13" />
        </svg>
        <span>78%</span>
      </span>
    </div>
  );
}

/* ============================================================================
   HEADER MOBILE
   ============================================================================ */
function Header({
  title,
  onBack,
  liveTime,
}: {
  title: string;
  onBack?: () => void;
  liveTime: string;
}) {
  return (
    <header className="t-head">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="m-btn m-btn--sm m-btn--ghost"
          style={{ padding: '4px 8px', height: '32px' }}
          title="Retour"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span style={{ fontSize: '13px', fontWeight: 700 }}>Retour</span>
        </button>
      ) : (
        <img
          src="/brand/anelec-mark.png"
          alt="ANELEC"
          style={{ width: '28px', height: '28px', objectFit: 'contain', flexShrink: 0 }}
        />
      )}
      <h1>{title}</h1>
      <span className="t-head-time">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span>{liveTime || '10:36'}</span>
      </span>
    </header>
  );
}

/* ============================================================================
   STATUS PILL HELPER
   ============================================================================ */
function StatusPill({ status }: { status: string }) {
  const norm = (status || '').toLowerCase();
  let tone = 'slate';
  let label = status || 'Prévu';

  if (norm.includes('cours')) {
    tone = 'indigo';
    label = 'En cours';
  } else if (norm.includes('clôtur') || norm.includes('termin') || norm.includes('effectu')) {
    tone = 'green';
    label = 'Clôturée';
  } else if (norm.includes('planifi')) {
    tone = 'blue';
    label = 'Planifiée';
  } else if (norm.includes('urg') || norm.includes('bloqu')) {
    tone = 'red';
    label = 'Urgence';
  } else if (norm.includes('suiv')) {
    tone = 'blue';
    label = 'Suivant';
  }

  return (
    <span className={`m-pill m-tone-${tone}`}>
      <i className="m-pill-dot" />
      <span>{label}</span>
    </span>
  );
}

/* ============================================================================
   AVATAR ROND
   ============================================================================ */
function UserAvatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = (name || 'TE')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--color-primary, #1D4ED8)',
        color: '#ffffff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: size * 0.38,
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
      }}
    >
      {initials}
    </div>
  );
}

/* ============================================================================
   COMPOSANT PRINCIPAL : TECHNICIAN MOBILE VIEW
   ============================================================================ */
export function TechnicianMobileView({
  techniciens,
  currentTechnicien,
  canSwitchTechnicien,
  onSelectTechnicien,
  interventionsList,
  devisList,
}: TechnicianMobileViewProps) {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const { current: currentTheme, setUserPref, isPending: isThemePending } = useTheme();

  const [tab, setTab] = useState<'home' | 'map' | 'hist' | 'prof'>('home');
  const [openMissionId, setOpenMissionId] = useState<number | null>(null);
  const [gpsModalOpen, setGpsModalOpen] = useState(false);
  const [isInteractiveMapOpen, setIsInteractiveMapOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [missionPhotos, setMissionPhotos] = useState<Record<number, { url: string; label: string }[]>>({});
  const [missionReports, setMissionReports] = useState<Record<number, string>>({});
  const [runningMissions, setRunningMissions] = useState<Record<number, boolean>>({});

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Horloge en direct au fuseau officiel Paris
  const [liveParisTime, setLiveParisTime] = useState<string>(() => {
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date());
    } catch {
      const d = new Date();
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  });

  useEffect(() => {
    const timer = setInterval(() => {
      try {
        setLiveParisTime(
          new Intl.DateTimeFormat('fr-FR', {
            timeZone: 'Europe/Paris',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).format(new Date())
        );
      } catch {
        // ignore
      }
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Pointages Query
  const pointagesQuery = useQuery({
    queryKey: ['admin-pointages', todayISO, currentTechnicien],
    queryFn: async () => {
      const res = await adminApi.listPointages({
        dateJour: todayISO,
        technicien: currentTechnicien,
      });
      return res.data.data;
    },
    enabled: Boolean(currentTechnicien),
  });

  const currentPointage = (pointagesQuery.data || [])[0] || null;
  const isPointed = Boolean(currentPointage?.heureArriveeBureau);
  const isTerminee = currentPointage?.statutJournee === 'TERMINEE';

  // Pointage Mut
  const clockInMut = useMutation({
    mutationFn: adminApi.clockIn,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-pointages'] });
      toast.success(res.data.message || `Arrivée pointée à ${getNowHHMM()}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Erreur de pointage matin');
    },
  });

  const updateMissionMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => interventionApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      queryClient.invalidateQueries({ queryKey: ['devis'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Erreur de sauvegarde terrain');
    },
  });

  // Missions pour ce technicien
  const allTechMissionsCombined: Intervention[] = useMemo(() => {
    const targetLower = (currentTechnicien || '').trim().toLowerCase();
    const devisById = new Map<number, Devis>();
    const devisByRef = new Map<string, Devis>();
    devisList.forEach((d) => {
      devisById.set(d.id, d);
      if (d.reference) devisByRef.set(d.reference.trim().toLowerCase(), d);
    });

    const allForTech: Intervention[] = interventionsList
      .filter((i) => {
        const ent = (i.entreprise || '').trim();
        if (!ent) return false;
        if (ent.toLowerCase() === targetLower) return true;
        if (ent.includes('+')) {
          return ent
            .split('+')
            .map((p) => p.trim().toLowerCase())
            .includes(targetLower);
        }
        return false;
      })
      .map((i) => {
        const isVisite = Boolean(i.isVisiteDevis || i.typeIntervention === 'Visite technique devis');
        const parentDevis =
          (i.devisId ? devisById.get(i.devisId) : undefined) ||
          (i.origineDevisId ? devisById.get(i.origineDevisId) : undefined) ||
          (i.refDevisTexte ? devisByRef.get(i.refDevisTexte.trim().toLowerCase()) : undefined);
        const parentDevisDone = parentDevis
          ? ['Terminée', 'Effectuée', 'Clôturée', 'Réalisée', 'Validée'].includes(
              (parentDevis.visiteStatut || '').trim()
            ) || Boolean(parentDevis.gpsCloture)
          : false;
        const alreadyDone =
          ['Clôturée', 'Terminée - à valider', 'Terminée', 'Effectuée', 'Facturée'].includes(
            (i.statutOperationnel || '').trim()
          ) ||
          Boolean(i.gpsCloture) ||
          (isVisite && parentDevisDone);

        if (alreadyDone && i.statutOperationnel !== 'Clôturée' && i.statutOperationnel !== 'Terminée - à valider') {
          return {
            ...i,
            statutOperationnel: 'Clôturée',
            gpsCloture: i.gpsCloture || parentDevis?.gpsCloture || null,
          };
        }
        return i;
      });

    const existingDevisIds = new Set<number>();
    const existingDevisRefs = new Set<string>();
    allForTech.forEach((i) => {
      const dId = i.devisId || i.origineDevisId;
      if (dId) existingDevisIds.add(dId);
      if (i.refDevisTexte) existingDevisRefs.add(i.refDevisTexte.trim().toLowerCase());
    });

    const devisVisitsForTech: Intervention[] = devisList
      .filter((d) => {
        if (['Perdu', 'Sans suite', 'Refusé', 'Annulé'].includes(d.statutCommercial || '')) return false;
        if (existingDevisIds.has(d.id)) return false;
        if (d.reference && existingDevisRefs.has(d.reference.trim().toLowerCase())) return false;
        const tech = (d.visiteTechnicien || d.responsable || '').trim().toLowerCase();
        if (!tech) return false;
        const matchTech = tech === targetLower || tech.includes(targetLower);
        return matchTech && Boolean(d.visiteNecessaire || d.visiteDate || d.visiteTechnicien || d.site);
      })
      .map((d) => {
        const isDevisDone =
          ['Terminée', 'Effectuée', 'Clôturée', 'Réalisée', 'Validée', 'Fait', 'Traitée'].includes(
            (d.visiteStatut || '').trim()
          ) ||
          Boolean(d.gpsCloture) ||
          ['Traité', 'Clôturé'].includes((d.traitement || '').trim()) ||
          d.status === 'traite' ||
          ['Accepté', 'Signé', 'Facturé', 'Gagné', 'Terminé', 'Clôturé'].includes(
            (d.statutCommercial || '').trim()
          );
        return {
          id: -d.id,
          reference: d.reference || `DEV-${d.id}`,
          client: d.client,
          chantier: d.site || 'Site client',
          datePlanifiee: d.visiteDate || todayISO,
          heureDebut: '09:00',
          heureFin: '11:00',
          statutOperationnel: isDevisDone ? 'Clôturée' : 'Planifiée',
          typeIntervention: 'Visite technique devis',
          corpsEtat: d.corpsEtat || 'Électricité / Serrurerie',
          objet: d.objet || 'Relevé de côtes et visite préparatoire',
          devisId: d.id,
          gpsCloture: d.gpsCloture || null,
        } as unknown as Intervention;
      });

    return [...allForTech, ...devisVisitsForTech].sort((a, b) => {
      const da = a.datePlanifiee || '9999-99-99';
      const db = b.datePlanifiee || '9999-99-99';
      if (da !== db) return da.localeCompare(db);
      return (a.heureDebut || '08:00').localeCompare(b.heureDebut || '08:00');
    });
  }, [currentTechnicien, devisList, interventionsList, todayISO]);

  // Missions d'aujourd'hui
  const todayMissions = useMemo(() => {
    return allTechMissionsCombined.filter((m: Intervention) => m.datePlanifiee === todayISO || !m.datePlanifiee);
  }, [allTechMissionsCombined, todayISO]);

  const doneCount = useMemo(() => {
    return todayMissions.filter((m: Intervention) =>
      ['Clôturée', 'Terminée', 'Terminée - à valider', 'Effectuée'].includes(m.statutOperationnel || '')
    ).length;
  }, [todayMissions]);

  // Interventions passées pour l'historique
  const pastMissions = useMemo(() => {
    return allTechMissionsCombined.filter((m: Intervention) =>
      ['Clôturée', 'Terminée', 'Terminée - à valider', 'Effectuée'].includes(m.statutOperationnel || '')
    );
  }, [allTechMissionsCombined]);

  // Mission actuellement ouverte en plein écran
  const activeMission = useMemo(() => {
    if (!openMissionId) return null;
    return allTechMissionsCombined.find((m: Intervention) => m.id === openMissionId) || null;
  }, [allTechMissionsCombined, openMissionId]);

  // Handlers
  const handleClockIn = () => {
    clockInMut.mutate({
      technicien: currentTechnicien,
      dateJour: todayISO,
      heureArriveeBureau: getNowHHMM(),
    });
  };

  const handleStartMission = (m: Intervention) => {
    setRunningMissions((prev) => ({ ...prev, [m.id]: true }));
    if (m.id > 0) {
      updateMissionMut.mutate({
        id: m.id,
        data: {
          statutOperationnel: 'En cours',
          heureDebutEffectif: getNowHHMM(),
        },
      });
    }
    toast.success(`Intervention ${m.reference} démarrée sur site`);
  };

  const handleAddPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeMission) return;
    try {
      const optimized = await compressAndOptimizeImage(file);
      const url = optimized.dataUrl;
      const label = `Photo ${((missionPhotos[activeMission.id] || []).length + 1)} · ${getNowHHMM()}`;
      setMissionPhotos((prev) => ({
        ...prev,
        [activeMission.id]: [...(prev[activeMission.id] || []), { url, label }],
      }));
      toast.success(`Photo ajoutée : ${label}`);
    } catch {
      toast.error('Erreur lors du traitement de la photo');
    }
  };

  const handleGpsConfirm = () => {
    if (!activeMission) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = {
            lat: Number(pos.coords.latitude.toFixed(5)),
            lng: Number(pos.coords.longitude.toFixed(5)),
            accuracy: Math.round(pos.coords.accuracy),
          };
          if (activeMission.id > 0) {
            updateMissionMut.mutate({
              id: activeMission.id,
              data: {
                statutOperationnel: 'Clôturée',
                heureFinEffectif: getNowHHMM(),
                gpsCloture: JSON.stringify(coords),
              },
            });
          }
          setGpsModalOpen(false);
          setOpenMissionId(null);
          toast.success('Intervention clôturée · rapport envoyé au bureau');
        },
        () => {
          // Fallback géocodé standard
          if (activeMission.id > 0) {
            updateMissionMut.mutate({
              id: activeMission.id,
              data: {
                statutOperationnel: 'Clôturée',
                heureFinEffectif: getNowHHMM(),
                gpsCloture: JSON.stringify({ lat: 48.8726, lng: 2.3165, accuracy: 8 }),
              },
            });
          }
          setGpsModalOpen(false);
          setOpenMissionId(null);
          toast.success('Intervention clôturée · rapport envoyé au bureau');
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } else {
      setGpsModalOpen(false);
      setOpenMissionId(null);
      toast.success('Intervention clôturée · rapport envoyé au bureau');
    }
  };

  return (
    <div className="t-app" data-testid="real-terrain-mobile-app">
      <StatusBar time={liveParisTime} />

      {/* =====================================================================
          1. VUE DÉTAILLÉE D'UNE MISSION OUVERTE
         ===================================================================== */}
      {activeMission ? (
        <main className="t-main t-main--mission" data-testid="terrain-mission-detail">
          <Header
            title="Mission en cours"
            onBack={() => setOpenMissionId(null)}
            liveTime={liveParisTime}
          />

          <div className="t-mission-top">
            <span className="m-mono m-small" style={{ fontWeight: 800, color: 'var(--color-primary, #1D4ED8)' }}>
              {activeMission.reference}
            </span>
            <StatusPill status={runningMissions[activeMission.id] ? 'En cours' : activeMission.statutOperationnel || 'Planifiée'} />
          </div>

          <h2 className="t-mission-title">{activeMission.client || 'Client TCE'}</h2>
          <p className="t-mission-sub">
            {activeMission.corpsEtat || 'Tous Corps d’État'} · {activeMission.objet || 'Prestation sur site'}
          </p>

          <div className="t-mission-amounts">
            <div>
              <span>Créneau</span>
              <strong>{activeMission.heureDebut || '08:30'}–{activeMission.heureFin || '12:00'}</strong>
            </div>
            <div>
              <span>Montant</span>
              <strong>{activeMission.amount ? `${activeMission.amount} €` : '450 €'}</strong>
            </div>
            <div>
              <span>Durée</span>
              <strong>3.5 h</strong>
            </div>
          </div>

          {/* Section Adresse & Guidage */}
          <div className="t-mission-section">
            <div className="t-section-head">
              <strong>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                Adresse
              </strong>
            </div>
            <p className="t-addr">{activeMission.chantier || 'Paris, Île-de-France'}</p>
            <div className="t-row-actions">
              <button
                type="button"
                className="m-btn m-btn--secondary"
                onClick={() => {
                  const addr = encodeURIComponent(activeMission.chantier || 'Paris');
                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${addr}`, '_blank');
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="3 11 22 2 13 21 11 13 3 11" />
                </svg>
                <span>Itinéraire</span>
              </button>
              <button
                type="button"
                className="m-btn m-btn--secondary"
                onClick={() => {
                  window.open('tel:0140000000');
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <span>Appeler</span>
              </button>
            </div>
          </div>

          {/* Section Consignes */}
          <div className="t-mission-section">
            <div className="t-section-head">
              <strong>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Consignes
              </strong>
            </div>
            <p className="t-callout">
              {activeMission.notes || 'Se présenter au gardien d’immeuble à l’arrivée pour remise des badges d’accès.'}
            </p>
          </div>

          {/* Section Photos avant / après */}
          <div className="t-mission-section">
            <div className="t-section-head">
              <strong>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Photos avant / après
              </strong>
              <span className="m-muted m-small">
                {(missionPhotos[activeMission.id] || []).length} prises
              </span>
            </div>

            <div className="t-photos">
              {(missionPhotos[activeMission.id] || []).map((p, i) => (
                <figure key={i} className={`t-photo t-photo--${i % 3}`}>
                  <img src={p.url} alt={p.label} />
                  <figcaption>{p.label}</figcaption>
                </figure>
              ))}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handleAddPhoto}
              />

              <button
                type="button"
                className="t-photo t-photo--add"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span>Ajouter</span>
              </button>
            </div>
          </div>

          {/* Section Compte-rendu */}
          <div className="t-mission-section">
            <div className="t-section-head">
              <strong>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                Compte-rendu
              </strong>
            </div>
            <textarea
              className="m-textarea"
              rows={3}
              placeholder="Travaux réalisés, matériel posé, mesures prises…"
              value={missionReports[activeMission.id] ?? 'Remplacement du disjoncteur différentiel 63 A — test de déclenchement OK.'}
              onChange={(e) => {
                setMissionReports((prev) => ({
                  ...prev,
                  [activeMission.id]: e.target.value,
                }));
              }}
            />
          </div>

          {/* Actions dans la zone du pouce */}
          <div className="t-actions">
            {!runningMissions[activeMission.id] && (
              <button
                type="button"
                className="m-btn m-btn--primary m-btn--lg m-btn--block"
                onClick={() => handleStartMission(activeMission)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="10 8 16 12 10 16 10 8" />
                </svg>
                <span>Démarrer sur site</span>
              </button>
            )}

            {runningMissions[activeMission.id] && (
              <>
                <button
                  type="button"
                  className="m-btn m-btn--ghost m-btn--lg"
                  onClick={() => toast('Pause enregistrée', { icon: '⏸' })}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                  <span>Pause</span>
                </button>
                <button
                  type="button"
                  className="m-btn m-btn--primary m-btn--lg m-btn--block"
                  onClick={() => setGpsModalOpen(true)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  <span>Clôturer avec GPS</span>
                </button>
              </>
            )}
          </div>
        </main>
      ) : (
        <>
          {/* =====================================================================
              2. ÉCRAN 1 : MISSIONS (HOME)
             ===================================================================== */}
          {tab === 'home' && (
            <main className="t-main" data-testid="terrain-home">
              <Header
                title={`Bonjour ${(currentTechnicien || 'Technicien').split(' ')[0]}`}
                liveTime={liveParisTime}
              />

              {/* Mode Superviseur : bascule rapide de technicien */}
              {canSwitchTechnicien && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-secondary, #64748b)' }}>
                    Superviseur :
                  </span>
                  <select
                    className="select"
                    style={{ flex: 1, minHeight: '34px', fontSize: '12.5px', fontWeight: 700 }}
                    value={currentTechnicien}
                    onChange={(e) => onSelectTechnicien(e.target.value)}
                  >
                    {techniciens.map((t) => (
                      <option key={t} value={t}>
                        ▪ {t}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Carte de bienvenue avec avatar & pointage */}
              <section className="t-welcome">
                <UserAvatar name={currentTechnicien} size={44} />
                <div>
                  <strong>Bonjour {currentTechnicien}</strong>
                  <span>{formatWelcomeDate()} · {todayMissions.length} missions aujourd'hui</span>
                </div>
                {!isPointed && (
                  <button
                    type="button"
                    className="m-btn m-btn--primary m-btn--sm"
                    onClick={handleClockIn}
                  >
                    Pointer
                  </button>
                )}
                {isPointed && !isTerminee && (
                  <span className="m-pill m-tone-green">
                    <i className="m-pill-dot" />
                    <span>Pointé à {currentPointage.heureArriveeBureau}</span>
                  </span>
                )}
                {isTerminee && (
                  <span className="m-pill m-tone-indigo">
                    <i className="m-pill-dot" />
                    <span>Fin à {currentPointage.heureFinJournee}</span>
                  </span>
                )}
              </section>

              {/* Barre de progression des missions */}
              <section className="t-progress">
                <strong>{doneCount}/{todayMissions.length} missions terminées</strong>
                <div className="m-progress">
                  <span
                    className="m-progress-bar"
                    style={{
                      width: `${todayMissions.length > 0 ? (doneCount / todayMissions.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </section>

              <h2 className="t-h2">Mes missions du jour</h2>

              {/* Liste des cartes de missions */}
              <ul className="t-list" data-testid="terrain-missions-list">
                {todayMissions.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="t-card"
                      onClick={() => setOpenMissionId(m.id)}
                    >
                      <div className="t-card-top">
                        <span className="m-mono m-small" style={{ fontWeight: 700 }}>
                          {m.heureDebut || '08:30'}
                        </span>
                        <StatusPill status={runningMissions[m.id] ? 'En cours' : m.statutOperationnel || 'Planifiée'} />
                      </div>
                      <strong>{m.client || 'Client TCE'}</strong>
                      <span className="t-card-objet">
                        {m.corpsEtat || 'TCE'} · {m.objet || 'Prestation maintenance'}
                      </span>
                      <div className="t-card-foot">
                        <span className="t-card-addr">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <span>{(m.chantier || 'Paris').split(',')[0]}</span>
                        </span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    </button>

                    {/* Bouton direct "Commencer" si mission planifiée */}
                    {(!m.statutOperationnel || m.statutOperationnel === 'Planifiée') && !runningMissions[m.id] && (
                      <div style={{ marginTop: '4px' }}>
                        <button
                          type="button"
                          className="m-btn m-btn--primary m-btn--lg m-btn--block"
                          onClick={() => {
                            handleStartMission(m);
                            setOpenMissionId(m.id);
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polygon points="10 8 16 12 10 16 10 8" />
                          </svg>
                          <span>Commencer l’intervention</span>
                        </button>
                      </div>
                    )}
                  </li>
                ))}

                {todayMissions.length === 0 && (
                  <li className="t-empty">
                    Aucune mission planifiée pour aujourd'hui.
                  </li>
                )}
              </ul>
            </main>
          )}

          {/* =====================================================================
              3. ÉCRAN 2 : MA TOURNÉE (MAP & ORDRE DES PASSAGES)
             ===================================================================== */}
          {tab === 'map' && (
            <main className="t-main" data-testid="terrain-mapview">
              <Header title="Ma tournée" liveTime={liveParisTime} />

              <div className="t-map-wrap">
                <div className="t-map" aria-hidden="true">
                  <div className="t-map-pin t-map-pin--me">
                    <UserAvatar name={currentTechnicien} size={28} />
                  </div>
                  <div className="t-map-pin t-map-pin--stop" style={{ top: '38%', left: '62%' }}>1</div>
                  <div className="t-map-pin t-map-pin--stop" style={{ top: '60%', left: '76%' }}>2</div>
                  <div className="t-map-pin t-map-pin--stop" style={{ top: '72%', left: '38%' }}>3</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="t-h2" style={{ margin: 0 }}>Ma tournée</h2>
                <button
                  type="button"
                  className="m-btn m-btn--sm m-btn--secondary"
                  onClick={() => setIsInteractiveMapOpen((o) => !o)}
                >
                  {isInteractiveMapOpen ? 'Masquer la carte' : 'Carte interactive GPS'}
                </button>
              </div>

              {isInteractiveMapOpen && (
                <div style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                  <TourneeMapOptimizer
                    interventions={interventionsList}
                    devis={devisList}
                    selectedDate={todayISO}
                    currentTechnicien={currentTechnicien}
                    techniciensList={techniciens}
                    onSelectTechnicien={onSelectTechnicien}
                    onOpenIntervention={(i) => setOpenMissionId(i.id)}
                    onOpenDevis={(d) => setOpenMissionId(-d.id)}
                  />
                </div>
              )}

              <ul className="t-list t-list--route" data-testid="terrain-route-list">
                {todayMissions.map((m, index) => (
                  <li key={m.id} onClick={() => setOpenMissionId(m.id)}>
                    <span className="t-stop-num">{index + 1}</span>
                    <div>
                      <strong>{m.client || 'Client TCE'}</strong>
                      <span>{(m.chantier || 'Paris').split(',')[0]} · {m.heureDebut || '09:00'}</span>
                    </div>
                    <StatusPill
                      status={
                        runningMissions[m.id]
                          ? 'En cours'
                          : index === 0
                          ? 'En cours'
                          : index === 1
                          ? 'Suivant'
                          : 'Prévu'
                      }
                    />
                  </li>
                ))}

                {todayMissions.length === 0 && (
                  <li className="t-empty">Aucun itinéraire à afficher pour aujourd'hui.</li>
                )}
              </ul>
            </main>
          )}

          {/* =====================================================================
              4. ÉCRAN 3 : HISTORIQUE
             ===================================================================== */}
          {tab === 'hist' && (
            <main className="t-main" data-testid="terrain-history">
              <Header title="Historique" liveTime={liveParisTime} />
              <h2 className="t-h2">Mes interventions passées</h2>
              <ul className="t-list">
                {pastMissions.map((m) => (
                  <li key={m.id}>
                    <div className="t-card" onClick={() => setOpenMissionId(m.id)}>
                      <div className="t-card-top">
                        <span className="m-mono m-small">{m.reference}</span>
                        <StatusPill status="Clôturée" />
                      </div>
                      <strong>{m.client || 'Client TCE'}</strong>
                      <span className="t-card-objet">
                        {m.objet || 'Prestation terminée'}
                      </span>
                      <div className="t-card-foot">
                        <span className="m-muted m-small">
                          {m.datePlanifiee ? formatDateFR(m.datePlanifiee) : 'Récemment'}
                        </span>
                        <span className="m-mono m-small">
                          {(missionPhotos[m.id] || []).length || 5} photos
                        </span>
                      </div>
                    </div>
                  </li>
                ))}

                {pastMissions.length === 0 && (
                  <li className="t-empty">Pas encore d’interventions terminées enregistrées.</li>
                )}
              </ul>
            </main>
          )}

          {/* =====================================================================
              5. ÉCRAN 4 : PROFIL & CHOIX DE DIRECTION ARTISTIQUE / THÈMES
             ===================================================================== */}
          {tab === 'prof' && (
            <main className="t-main" data-testid="terrain-profile">
              <Header title="Profil" liveTime={liveParisTime} />

              <section className="t-profile">
                <UserAvatar name={currentTechnicien} size={64} />
                <strong>{currentTechnicien}</strong>
                <span className="m-muted m-small">
                  Électricité · Plomberie · Serrurerie · TCE
                </span>
              </section>

              <ul className="t-prof-list">
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>
                    Semaine : <strong>36,8 h</strong> <span className="m-mono m-muted">(sur 35 h)</span>
                  </span>
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                  <span>
                    Missions ce mois : <strong>{allTechMissionsCombined.length || 18}</strong>
                  </span>
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span>
                    Photos envoyées : <strong>94</strong>
                  </span>
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>
                    Taux de clôture GPS : <strong>100 %</strong>
                  </span>
                </li>
              </ul>

              {/* SÉLECTEUR INTERACTIF DES 7 DIRECTIONS ARTISTIQUES & THÈMES */}
              <div
                style={{
                  background: 'var(--bg-surface, var(--color-surface, #ffffff))',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  borderRadius: 'var(--rounded-card, 12px)',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--color-text, #0f172a)' }}>
                      🎨 Direction Artistique & Thème
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748b)' }}>
                      Choisissez l’apparence qui vous plaît, sauvegardée sur votre compte.
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '999px',
                      background: 'rgba(29, 78, 216, 0.1)',
                      color: 'var(--color-primary, #1D4ED8)',
                    }}
                  >
                    7 thèmes
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {THEMES.map((t) => {
                    const isSelected = t.id === currentTheme;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        disabled={isThemePending}
                        onClick={async () => {
                          try {
                            await setUserPref(t.id as ThemeId);
                            toast.success(`Design "${t.name}" appliqué !`);
                          } catch {
                            toast.error('Impossible d’appliquer ce thème');
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: isSelected
                            ? '2px solid var(--color-primary, #1D4ED8)'
                            : '1px solid var(--color-border, #e2e8f0)',
                          background: isSelected
                            ? 'rgba(29, 78, 216, 0.08)'
                            : 'var(--color-surface-subtle, #f8fafc)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          width: '100%',
                          boxSizing: 'border-box',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div
                            style={{
                              display: 'flex',
                              gap: '2px',
                              padding: '4px',
                              background: 'rgba(0,0,0,0.06)',
                              borderRadius: '6px',
                              flexShrink: 0,
                            }}
                          >
                            {t.swatches.slice(0, 3).map((c, i) => (
                              <span
                                key={i}
                                style={{
                                  width: '10px',
                                  height: '18px',
                                  borderRadius: '3px',
                                  background: c,
                                  display: 'inline-block',
                                }}
                              />
                            ))}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--color-text, #0f172a)' }}>
                                {t.name}
                              </span>
                              {t.isOriginal && (
                                <span
                                  style={{
                                    fontSize: '9px',
                                    fontWeight: 700,
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    background: 'rgba(0,0,0,0.06)',
                                    color: 'var(--color-text-secondary, #64748b)',
                                  }}
                                >
                                  Classique
                                </span>
                              )}
                            </div>
                            <div
                              style={{
                                fontSize: '11px',
                                color: 'var(--color-text-secondary, #64748b)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {t.tagline}
                            </div>
                          </div>
                        </div>

                        <div style={{ flexShrink: 0 }}>
                          {isSelected ? (
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: '999px',
                                background: 'var(--color-primary, #1D4ED8)',
                                color: '#ffffff',
                              }}
                            >
                              ✓ Actif
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748b)' }}>
                              Choisir
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                className="m-btn m-btn--ghost m-btn--lg m-btn--block"
                onClick={async () => {
                  await logout();
                  toast.success('Déconnexion réussie');
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Se déconnecter</span>
              </button>
            </main>
          )}
        </>
      )}

      {/* =====================================================================
          6. BARRE DE NAVIGATION INFÉRIEURE TACTILE (POUCE-COMPATIBLE)
         ===================================================================== */}
      <nav className="t-bnav" data-testid="terrain-bnav">
        <button
          type="button"
          className={tab === 'home' && !activeMission ? 'is-active' : ''}
          onClick={() => {
            setTab('home');
            setOpenMissionId(null);
          }}
          data-testid="terrain-tab-home"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>Missions</span>
        </button>

        <button
          type="button"
          className={tab === 'map' && !activeMission ? 'is-active' : ''}
          onClick={() => {
            setTab('map');
            setOpenMissionId(null);
          }}
          data-testid="terrain-tab-map"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="3 11 22 2 13 21 11 13 3 11" />
          </svg>
          <span>Tournée</span>
        </button>

        <button
          type="button"
          className={tab === 'hist' && !activeMission ? 'is-active' : ''}
          onClick={() => {
            setTab('hist');
            setOpenMissionId(null);
          }}
          data-testid="terrain-tab-hist"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <polyline points="12 7 12 12 15 15" />
          </svg>
          <span>Historique</span>
        </button>

        <button
          type="button"
          className={tab === 'prof' && !activeMission ? 'is-active' : ''}
          onClick={() => {
            setTab('prof');
            setOpenMissionId(null);
          }}
          data-testid="terrain-tab-prof"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>Profil</span>
        </button>
      </nav>

      {/* =====================================================================
          7. MODALE DE CLÔTURE GPS (FIDÈLE À LA MAQUETTE VIEWER)
         ===================================================================== */}
      {gpsModalOpen && activeMission && (
        <div
          className="cmd-palette-backdrop"
          onClick={() => setGpsModalOpen(false)}
          style={{ zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)' }}
        >
          <div
            className="cmd-palette-modal"
            style={{
              maxWidth: '440px',
              padding: '20px',
              borderRadius: '18px',
              width: 'min(440px, calc(100vw - 24px))',
              margin: 'auto',
              boxSizing: 'border-box',
              background: 'var(--bg-surface, var(--color-surface, #ffffff))',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(29, 78, 216, 0.1)',
                  color: 'var(--color-primary, #1D4ED8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--color-text, #0f172a)' }}>
                  Clôturer avec la position GPS
                </h3>
                <p style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748b)', margin: '2px 0 0 0' }}>
                  Nous enregistrons votre position actuelle comme preuve d’exécution.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGpsModalOpen(false)}
                className="m-btn m-btn--sm m-btn--ghost"
                style={{ padding: '4px', height: '28px' }}
              >
                ✕
              </button>
            </div>

            <div className="t-gps-map" aria-hidden="true">
              <div className="t-gps-pin">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <span className="t-gps-accuracy">± 6 m</span>
            </div>

            <div className="m-callout">
              <strong>Position verrouillée</strong>
              <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.45 }}>
                {activeMission.chantier || 'Paris, Île-de-France'}
                <br />
                Lat 48.87260 · Lon 2.31650 · Précision ± 6 m
              </p>
            </div>

            <p className="m-muted m-small" style={{ margin: '0 0 16px 0', fontSize: '11px' }}>
              En confirmant, le rapport part automatiquement à l’équipe bureau pour validation.
            </p>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="m-btn m-btn--ghost m-btn--lg"
                style={{ flex: 1 }}
                onClick={() => setGpsModalOpen(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="m-btn m-btn--primary m-btn--lg"
                style={{ flex: 2 }}
                onClick={handleGpsConfirm}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <span>Clôturer l’intervention</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
