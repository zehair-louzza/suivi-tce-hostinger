import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  adminApi,
  interventionApi,
  Intervention,
  Devis,
  TerrainPhoto,
  ACTIONS_PREREMPLIES_TERRAIN,
  formatDateFR,
} from '../lib/api';
import toast from 'react-hot-toast';

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

async function compressImageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossible de lire la photo'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format image invalide'));
      img.onload = () => {
        const maxDim = 960;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function TechnicianMobileView({
  techniciens,
  currentTechnicien,
  canSwitchTechnicien,
  onSelectTechnicien,
  interventionsList,
  devisList,
}: TechnicianMobileViewProps) {
  const queryClient = useQueryClient();
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayISO);
  const [filterMode, setFilterMode] = useState<'jour' | 'toutes'>('jour');

  // Mission ouverte pour compte rendu / photos / chiffrage
  const [activeMissionId, setActiveMissionId] = useState<number | null>(null);
  const [customActionInput, setCustomActionInput] = useState<string>('');
  const [photoCategory, setPhotoCategory] = useState<'AVANT' | 'APRES' | 'RELEVE_CHIFFRAGE' | 'CONSTAT'>('AVANT');
  const [photoCaption, setPhotoCaption] = useState<string>('');
  const [customStartHHMM, setCustomStartHHMM] = useState<string>(() => getNowHHMM());
  const [customEndHHMM, setCustomEndHHMM] = useState<string>(() => getNowHHMM());

  const pointagesQuery = useQuery({
    queryKey: ['admin-pointages', selectedDate, currentTechnicien],
    queryFn: async () => {
      const res = await adminApi.listPointages({
        dateJour: selectedDate,
        technicien: currentTechnicien,
      });
      return res.data.data;
    },
    enabled: Boolean(currentTechnicien),
  });

  const currentPointage = (pointagesQuery.data || [])[0] || null;

  const clockInMut = useMutation({
    mutationFn: adminApi.clockIn,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-pointages'] });
      toast.success(res.data.message || 'Arrivée bureau activée');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Erreur de pointage matin');
    },
  });

  const clockOutMut = useMutation({
    mutationFn: adminApi.clockOut,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-pointages'] });
      toast.success(res.data.message || 'Fin de journée désactivée');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Erreur de pointage soir');
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

  // Missions du technicien
  const techMissions = useMemo(() => {
    const allForTech = interventionsList.filter(
      (i) => (i.entreprise || '').toLowerCase() === (currentTechnicien || '').toLowerCase()
    );
    const filtered =
      filterMode === 'jour'
        ? allForTech.filter((i) => i.datePlanifiee === selectedDate)
        : allForTech;

    return [...filtered].sort((a, b) => {
      const da = a.datePlanifiee || '9999-99-99';
      const db = b.datePlanifiee || '9999-99-99';
      if (da !== db) return da.localeCompare(db);
      return (a.heureDebut || '08:00').localeCompare(b.heureDebut || '08:00');
    });
  }, [interventionsList, currentTechnicien, filterMode, selectedDate]);

  const activeMission = useMemo(
    () => techMissions.find((m) => m.id === activeMissionId) || techMissions[0] || null,
    [techMissions, activeMissionId]
  );

  // Dernière intervention effectuée pour la clôture du soir
  const lastMissionRef = useMemo(() => {
    const done = techMissions.filter((m) =>
      ['Terminée - à valider', 'Clôturée', 'En cours'].includes(m.statutOperationnel)
    );
    return (
      done[done.length - 1]?.reference ||
      techMissions[techMissions.length - 1]?.reference ||
      undefined
    );
  }, [techMissions]);

  const handleActivateMission = async (mission: Intervention) => {
    const nowHHMM = getNowHHMM();
    await updateMissionMut.mutateAsync({
      id: mission.id,
      data: {
        statutOperationnel: 'En cours',
        traitement: 'En cours de traitement',
        heureDebutReelle: mission.heureDebutReelle || nowHHMM,
        dateDebut: mission.dateDebut || selectedDate,
        statutRapport: 'Déclaré par technicien',
      },
    });
    setActiveMissionId(mission.id);
    toast.success(`▶️ Mission ${mission.reference} activée à ${nowHHMM}`);
  };

  const handleDeactivateMission = async (mission: Intervention) => {
    const nowHHMM = getNowHHMM();
    await updateMissionMut.mutateAsync({
      id: mission.id,
      data: {
        statutOperationnel: 'Terminée - à valider',
        heureFinReelle: nowHHMM,
        dateReelle: selectedDate,
        statutRapport: 'Déclaré par technicien',
      },
    });
    toast.success(`⏹️ Mission ${mission.reference} terminée à ${nowHHMM} (Prête pour rapport/chiffrage)`);
  };

  const handleTogglePreFilledAction = async (mission: Intervention, actionLabel: string) => {
    const current = Array.isArray(mission.actionsRealisees) ? mission.actionsRealisees : [];
    const exists = current.includes(actionLabel);
    const nextActions = exists
      ? current.filter((a) => a !== actionLabel)
      : [...current, actionLabel];

    await updateMissionMut.mutateAsync({
      id: mission.id,
      data: {
        actionsRealisees: nextActions,
        statutRapport: 'Déclaré par technicien',
      },
    });
    toast.success(exists ? 'Action retirée' : `✓ Action ajoutée au compte rendu`);
  };

  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    mission: Intervention
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      const newPhotos: TerrainPhoto[] = [];
      for (let i = 0; i < files.length; i++) {
        const dataUrl = await compressImageFileToDataUrl(files[i]);
        newPhotos.push({
          id: `ph-${Date.now()}-${i}`,
          url: dataUrl,
          category: photoCategory,
          caption: photoCaption.trim() || `${photoCategory} — ${mission.reference}`,
          takenAt: new Date().toISOString(),
          auteur: currentTechnicien,
        });
      }
      const existingPhotos = Array.isArray(mission.photos) ? mission.photos : [];
      await updateMissionMut.mutateAsync({
        id: mission.id,
        data: {
          photos: [...existingPhotos, ...newPhotos],
          statutRapport: 'Déclaré par technicien',
        },
      });
      setPhotoCaption('');
      toast.success(`📷 ${newPhotos.length} photo(s) enregistrée(s) sur la fiche`);
    } catch {
      toast.error('Impossible de traiter la photo');
    } finally {
      e.target.value = '';
    }
  };

  const handleDeletePhoto = async (mission: Intervention, photoId: string) => {
    const existingPhotos = Array.isArray(mission.photos) ? mission.photos : [];
    await updateMissionMut.mutateAsync({
      id: mission.id,
      data: {
        photos: existingPhotos.filter((p: any) => p.id !== photoId),
      },
    });
    toast.success('Photo supprimée');
  };

  const linkedDevis = activeMission?.devisId
    ? devisList.find((d) => d.id === activeMission.devisId)
    : null;

  return (
    <div
      style={{
        maxWidth: '980px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      {/* En-tête App Mobile Technicien */}
      <div
        className="pro-table-container"
        style={{
          padding: '14px 18px',
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(16, 185, 129, 0.08))',
          borderLeft: '4px solid var(--accent-primary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-info">📱 VERSION MOBILE TECHNICIEN</span>
            <h2 style={{ fontSize: '15px', fontWeight: 800 }}>
              Espace Terrain — {currentTechnicien}
            </h2>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Pointage arrivée bureau / fin de soirée, activation des interventions & visites devis, actions pré-remplies et photos.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {canSwitchTechnicien && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Technicien affiché :
              </span>
              <select
                className="select"
                style={{ width: '165px', fontWeight: 700 }}
                value={currentTechnicien}
                onChange={(e) => {
                  onSelectTechnicien(e.target.value);
                  setActiveMissionId(null);
                }}
              >
                {techniciens.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}

          <input
            type="date"
            className="input"
            style={{ width: '148px' }}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {/* =====================================================================
          BLOC 1 : BADGEUSE MATIN (ARRIVÉE BUREAU) & SOIR (FIN DERNIÈRE INTV.)
         ===================================================================== */}
      <div
        className="pro-table-container"
        style={{
          padding: '16px 18px',
          borderTop:
            currentPointage?.statutJournee === 'EN_SERVICE'
              ? '4px solid #10b981'
              : currentPointage?.statutJournee === 'TERMINEE'
              ? '4px solid #2563eb'
              : '4px solid #f59e0b',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 800 }}>
              ⏱️ Pointage Journalier Obligatoire ({formatDateFR(selectedDate)})
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              Activez chaque matin en arrivant au bureau et désactivez chaque soir à la fin de votre dernière intervention.
            </div>
          </div>

          <span
            className={`badge ${
              currentPointage?.statutJournee === 'EN_SERVICE'
                ? 'badge-success'
                : currentPointage?.statutJournee === 'TERMINEE'
                ? 'badge-info'
                : 'badge-warning'
            }`}
            style={{ fontSize: '12px', padding: '4px 12px' }}
          >
            {currentPointage?.statutJournee === 'EN_SERVICE'
              ? `🟢 En service depuis ${currentPointage.heureArriveeBureau}`
              : currentPointage?.statutJournee === 'TERMINEE'
              ? `🔵 Journée terminée (${currentPointage.heureArriveeBureau} → ${currentPointage.heureFinJournee})`
              : '🟠 Journée non activée ce matin'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          {/* Carte Matin : Arrivée au bureau */}
          <div
            style={{
              padding: '14px',
              borderRadius: '10px',
              background: currentPointage?.heureArriveeBureau
                ? 'rgba(16, 185, 129, 0.08)'
                : 'var(--bg-elevated)',
              border: currentPointage?.heureArriveeBureau
                ? '1px solid rgba(16, 185, 129, 0.35)'
                : '1px solid var(--border-default)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '13px', color: '#059669' }}>
                ☀️ 1. MATIN — Arrivée au Bureau
              </span>
              {currentPointage?.heureArriveeBureau && (
                <span className="font-mono" style={{ fontSize: '16px', fontWeight: 800, color: '#059669' }}>
                  {currentPointage.heureArriveeBureau}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="time"
                className="input font-mono"
                style={{ width: '115px', fontWeight: 700 }}
                value={customStartHHMM}
                onChange={(e) => setCustomStartHHMM(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  flex: 1,
                  background: '#059669',
                  borderColor: '#059669',
                  fontWeight: 700,
                  padding: '9px 12px',
                }}
                onClick={() => {
                  const hhmm = customStartHHMM || getNowHHMM();
                  clockInMut.mutate({
                    technicien: currentTechnicien,
                    dateJour: selectedDate,
                    heureArriveeBureau: hhmm,
                  });
                }}
              >
                {currentPointage?.heureArriveeBureau
                  ? 'Mettre à jour heure d’arrivée'
                  : '☀️ Activer mon arrivée au bureau'}
              </button>
            </div>
          </div>

          {/* Carte Soir : Fin de dernière intervention */}
          <div
            style={{
              padding: '14px',
              borderRadius: '10px',
              background: currentPointage?.heureFinJournee
                ? 'rgba(37, 99, 235, 0.08)'
                : 'var(--bg-elevated)',
              border: currentPointage?.heureFinJournee
                ? '1px solid rgba(37, 99, 235, 0.35)'
                : '1px solid var(--border-default)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '13px', color: '#2563eb' }}>
                🌙 2. SOIR — Fin Dernière Intervention
              </span>
              {currentPointage?.heureFinJournee && (
                <span className="font-mono" style={{ fontSize: '16px', fontWeight: 800, color: '#2563eb' }}>
                  {currentPointage.heureFinJournee}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="time"
                className="input font-mono"
                style={{ width: '115px', fontWeight: 700 }}
                value={customEndHHMM}
                onChange={(e) => setCustomEndHHMM(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  flex: 1,
                  background: '#2563eb',
                  borderColor: '#2563eb',
                  fontWeight: 700,
                  padding: '9px 12px',
                }}
                onClick={() => {
                  const hhmm = customEndHHMM || getNowHHMM();
                  clockOutMut.mutate({
                    technicien: currentTechnicien,
                    dateJour: selectedDate,
                    heureFinJournee: hhmm,
                    derniereInterventionRef: lastMissionRef,
                  });
                }}
              >
                {currentPointage?.heureFinJournee
                  ? 'Mettre à jour fin de journée'
                  : '🌙 Désactiver fin de journée'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          BLOC 2 : LISTE DES INTERVENTIONS & VISITES DEVIS DU TECHNICIEN
         ===================================================================== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
        {/* Colonne Gauche : Missions à activer / désactiver */}
        <div className="pro-table-container" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: '13.5px' }}>
              📋 Mes Interventions & Visites Devis ({techMissions.length})
            </div>
            <div className="segmented-control">
              <button
                type="button"
                className={`segmented-btn ${filterMode === 'jour' ? 'active' : ''}`}
                onClick={() => setFilterMode('jour')}
              >
                Du jour
              </button>
              <button
                type="button"
                className={`segmented-btn ${filterMode === 'toutes' ? 'active' : ''}`}
                onClick={() => setFilterMode('toutes')}
              >
                Toutes mes missions
              </button>
            </div>
          </div>

          {techMissions.length === 0 ? (
            <div
              style={{
                padding: '28px 16px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '12.5px',
                background: 'var(--bg-elevated)',
                borderRadius: '8px',
              }}
            >
              Aucune mission planifiée pour <strong>{currentTechnicien}</strong> à cette date.
              <div style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setFilterMode('toutes')}
                >
                  Voir toutes les missions de {currentTechnicien}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {techMissions.map((m) => {
                const isSelected = activeMission?.id === m.id;
                const isRunning = m.statutOperationnel === 'En cours';
                const isDone = ['Terminée - à valider', 'Clôturée'].includes(m.statutOperationnel);

                return (
                  <div
                    key={m.id}
                    onClick={() => setActiveMissionId(m.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--accent-glow)' : 'var(--bg-elevated)',
                      border: isSelected
                        ? '2px solid var(--accent-primary)'
                        : '1px solid var(--border-default)',
                      borderLeft: m.isVisiteDevis ? '5px solid #9333ea' : '5px solid #2563eb',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          className={`badge ${m.isVisiteDevis ? 'badge-purple' : 'badge-info'}`}
                        >
                          {m.isVisiteDevis ? '📐 VISITE DEVIS (CHIFFRAGE)' : '🔧 INTERVENTION TRAVAUX'}
                        </span>
                        <span className="font-mono" style={{ fontWeight: 800, fontSize: '12px' }}>
                          {m.reference}
                        </span>
                      </div>

                      <span
                        className={`badge ${
                          isRunning
                            ? 'badge-warning'
                            : isDone
                            ? 'badge-success'
                            : 'badge-neutral'
                        }`}
                      >
                        {isRunning
                          ? `🟢 ACTIVE (${m.heureDebutReelle || 'En cours'})`
                          : isDone
                          ? `✓ TERMINÉE (${m.heureDebutReelle || ''}→${m.heureFinReelle || ''})`
                          : m.statutOperationnel}
                      </span>
                    </div>

                    <div>
                      <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)' }}>
                        {m.client || 'Client ANELEC'}
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        📍 {m.chantier}
                      </div>
                      {m.objet && (
                        <div style={{ fontSize: '12px', color: 'var(--text-primary)', marginTop: '4px', fontWeight: 600 }}>
                          Objet : {m.objet}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: 'var(--text-secondary)', flexWrap: 'wrap', gap: '6px' }}>
                      <span className="font-mono">
                        🗓️ {formatDateFR(m.datePlanifiee)} • 🕒 {m.heureDebut || '08:30'} - {m.heureFin || '10:30'}
                      </span>
                      <span className="badge badge-neutral">{m.corpsEtat || 'Tous corps d’état'}</span>
                    </div>

                    {/* Boutons Tactiles Activation / Désactivation de l'intervention ou visite devis */}
                    <div
                      style={{ display: 'flex', gap: '8px', marginTop: '4px' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {!isRunning && !isDone && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ flex: 1, background: '#059669', borderColor: '#059669', fontWeight: 700 }}
                          onClick={() => handleActivateMission(m)}
                        >
                          ▶️ Activer / Démarrer ({m.isVisiteDevis ? 'Visite Devis' : 'Intervention'})
                        </button>
                      )}

                      {isRunning && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ flex: 1, background: '#dc2626', borderColor: '#dc2626', fontWeight: 700 }}
                          onClick={() => handleDeactivateMission(m)}
                        >
                          ⏹️ Désactiver / Terminer la mission
                        </button>
                      )}

                      {isDone && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleActivateMission(m)}
                        >
                          🔄 Ré-activer si besoin
                        </button>
                      )}

                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          m.chantier || m.client || ''
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ textDecoration: 'none' }}
                      >
                        🗺️ GPS
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ===================================================================
            BLOC 3 : COMPTE RENDU PRÉ-REMPLI, ÉLÉMENTS DE CHIFFRAGE & PHOTOS
           =================================================================== */}
        <div className="pro-table-container" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!activeMission ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Sélectionnez une intervention ou une visite de devis à gauche pour remplir son compte rendu et prendre des photos.
            </div>
          ) : (
            <>
              <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="font-mono" style={{ fontWeight: 800, fontSize: '13px', color: 'var(--accent-primary)' }}>
                    {activeMission.reference} • {activeMission.corpsEtat}
                  </span>
                  <span className="badge badge-info">
                    {activeMission.isVisiteDevis ? 'Infos pour Chiffrage Devis' : 'Déclaration Intervention'}
                  </span>
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, marginTop: '4px' }}>
                  {activeMission.client} — {activeMission.chantier}
                </h3>
                {activeMission.notes && (
                  <div
                    style={{
                      marginTop: '6px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: 'var(--bg-elevated)',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <strong>Consignes bureau :</strong> {activeMission.notes}
                  </div>
                )}
                {linkedDevis && (
                  <div
                    style={{
                      marginTop: '6px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: 'rgba(147, 51, 234, 0.08)',
                      border: '1px solid rgba(147, 51, 234, 0.25)',
                      fontSize: '12px',
                    }}
                  >
                    <strong>📐 Devis associé : {linkedDevis.reference}</strong> — Objet :{' '}
                    {linkedDevis.objet || 'Relevé technique pour chiffrage'}
                  </div>
                )}
              </div>

              {/* 1. Actions pré-remplies à cocher en 1 tap */}
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 800, marginBottom: '6px' }}>
                  1. Actions Pré-remplies (Touchez pour cocher / décocher) :
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '230px', overflowY: 'auto', paddingRight: '4px' }}>
                  {Object.entries(ACTIONS_PREREMPLIES_TERRAIN).map(([catName, actions]) => (
                    <div key={catName}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        {catName}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {actions.map((act) => {
                          const checked = (activeMission.actionsRealisees || []).includes(act);
                          return (
                            <button
                              key={act}
                              type="button"
                              onClick={() => handleTogglePreFilledAction(activeMission, act)}
                              style={{
                                padding: '5px 9px',
                                borderRadius: '7px',
                                fontSize: '11.5px',
                                fontWeight: checked ? 700 : 500,
                                textAlign: 'left',
                                cursor: 'pointer',
                                border: checked
                                  ? '1px solid #059669'
                                  : '1px solid var(--border-default)',
                                background: checked
                                  ? 'rgba(16, 185, 129, 0.14)'
                                  : 'var(--bg-elevated)',
                                color: checked ? '#059669' : 'var(--text-primary)',
                              }}
                            >
                              {checked ? '✓ ' : '+ '}
                              {act}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Ajout d'une action personnalisée */}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!customActionInput.trim()) return;
                    await handleTogglePreFilledAction(activeMission, customActionInput.trim());
                    setCustomActionInput('');
                  }}
                  style={{ display: 'flex', gap: '6px', marginTop: '8px' }}
                >
                  <input
                    type="text"
                    className="input"
                    placeholder="+ Ajouter une autre action réalisée..."
                    value={customActionInput}
                    onChange={(e) => setCustomActionInput(e.target.value)}
                  />
                  <button type="submit" className="btn btn-secondary btn-sm">
                    Ajouter
                  </button>
                </form>
              </div>

              {/* 2. Informations importantes pour le Chiffrage du Devis */}
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 800, display: 'block', marginBottom: '4px', color: '#7c3aed' }}>
                  2. Informations Importantes pour le Chiffrage du Devis (Métrés, Matériel à prévoir, Temps estimé) :
                </label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Ex: Prévoir 15m câble 3G2.5, 1 disjoncteur diff 30mA, hauteur sous plafond 3m20, durée travaux estimée 4h..."
                  defaultValue={activeMission.elementsChiffrage || ''}
                  key={`chiffrage-${activeMission.id}`}
                  onBlur={(e) => {
                    if (e.target.value !== (activeMission.elementsChiffrage || '')) {
                      updateMissionMut.mutate({
                        id: activeMission.id,
                        data: {
                          elementsChiffrage: e.target.value,
                          statutRapport: 'Déclaré par technicien',
                        },
                      });
                      toast.success('Éléments de chiffrage enregistrés');
                    }
                  }}
                />
              </div>

              {/* 3. Petit Compte Rendu & Observations Terrain */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 800 }}>
                    3. Petit Compte Rendu & Observations du Technicien :
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '2px 8px', fontSize: '10.5px' }}
                    onClick={() => {
                      const acts = activeMission.actionsRealisees || [];
                      if (acts.length === 0) {
                        toast.error('Cochez d’abord des actions pré-remplies ci-dessus');
                        return;
                      }
                      const merged = [
                        activeMission.compteRendu || '',
                        `Actions effectuées : ${acts.join(' ; ')}.`,
                      ]
                        .filter(Boolean)
                        .join('\n');
                      updateMissionMut.mutate({
                        id: activeMission.id,
                        data: {
                          compteRendu: merged,
                          statutRapport: 'Déclaré par technicien',
                        },
                      });
                      toast.success('Actions insérées dans le compte rendu');
                    }}
                  >
                    + Insérer les actions cochées
                  </button>
                </div>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Observations terrain, état des lieux, validation avec le client/gardien..."
                  defaultValue={activeMission.compteRendu || ''}
                  key={`cr-${activeMission.id}-${activeMission.compteRendu || ''}`}
                  onBlur={(e) => {
                    if (e.target.value !== (activeMission.compteRendu || '')) {
                      updateMissionMut.mutate({
                        id: activeMission.id,
                        data: {
                          compteRendu: e.target.value,
                          statutRapport: 'Déclaré par technicien',
                        },
                      });
                      toast.success('Compte rendu enregistré');
                    }
                  }}
                />
              </div>

              {/* 4. Prise de Photos (Caméra Mobile ou Galerie) */}
              <div
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                }}
              >
                <div style={{ fontSize: '12.5px', fontWeight: 800, marginBottom: '8px' }}>
                  4. 📷 Prise de Photos ou Ajout d'Images ({(activeMission.photos || []).length}) :
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  <select
                    className="select"
                    style={{ width: '165px' }}
                    value={photoCategory}
                    onChange={(e) => setPhotoCategory(e.target.value as any)}
                  >
                    <option value="AVANT">Photo AVANT travaux</option>
                    <option value="APRES">Photo APRÈS travaux</option>
                    <option value="RELEVE_CHIFFRAGE">Photo Relevé / Chiffrage Devis</option>
                    <option value="CONSTAT">Constat / Anomalie</option>
                  </select>

                  <input
                    type="text"
                    className="input"
                    style={{ flex: 1, minWidth: '150px' }}
                    placeholder="Légende photo (optionnel)..."
                    value={photoCaption}
                    onChange={(e) => setPhotoCaption(e.target.value)}
                  />

                  <label
                    className="btn btn-primary"
                    style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span>📷 Prendre / Choisir Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      style={{ display: 'none' }}
                      onChange={(e) => handlePhotoUpload(e, activeMission)}
                    />
                  </label>
                </div>

                {(activeMission.photos || []).length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(125px, 1fr))', gap: '8px' }}>
                    {(activeMission.photos || []).map((ph: any) => (
                      <div
                        key={ph.id}
                        style={{
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: '1px solid var(--border-default)',
                          background: 'var(--bg-surface)',
                          position: 'relative',
                        }}
                      >
                        <img
                          src={ph.url}
                          alt={ph.caption || 'Photo'}
                          style={{ width: '100%', height: '90px', objectFit: 'cover' }}
                        />
                        <div style={{ padding: '5px 7px', fontSize: '10.5px' }}>
                          <div style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>
                            {ph.category || 'PHOTO'}
                          </div>
                          <div style={{ color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
                            {ph.caption}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(activeMission, ph.id)}
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            background: 'rgba(220, 38, 38, 0.88)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '999px',
                            width: '22px',
                            height: '22px',
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                          title="Supprimer la photo"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
