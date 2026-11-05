import React, { useState, useMemo, useEffect } from 'react';
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

type MobileStepTab = 'missions' | 'pointage' | 'compte_rendu' | 'tout';

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

import { compressAndOptimizeImage, MAX_PHOTOS_PER_MISSION } from '../lib/imageOptimizer';

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

  // Détection automatique de la taille d'écran pour offrir une navigation par onglets sur tous les téléphones
  const [activeTab, setActiveTab] = useState<MobileStepTab>(() =>
    typeof window !== 'undefined' && window.innerWidth > 960 ? 'tout' : 'missions'
  );

  // Mission ouverte pour compte rendu / photos / chiffrage
  const [activeMissionId, setActiveMissionId] = useState<number | null>(null);
  const [customActionInput, setCustomActionInput] = useState<string>('');
  const [photoCategory, setPhotoCategory] = useState<'AVANT' | 'APRES' | 'RELEVE_CHIFFRAGE' | 'CONSTAT'>('AVANT');
  const [photoCaption, setPhotoCaption] = useState<string>('');

  // Horloge en direct au fuseau officiel Paris
  const [liveParisTime, setLiveParisTime] = useState<string>(() => {
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date());
    } catch {
      return '';
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
            second: '2-digit',
            hour12: false,
          }).format(new Date())
        );
      } catch {
        // ignore
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // États contrôlés pour sauvegarde explicite ou automatique sur téléphone
  const [chiffrageDraft, setChiffrageDraft] = useState<string>('');
  const [compteRenduDraft, setCompteRenduDraft] = useState<string>('');

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

  // Missions du technicien (individuelles + missions affectées à son équipe journalière)
  const techMissions = useMemo(() => {
    const targetLower = (currentTechnicien || '').trim().toLowerCase();
    const allForTech = interventionsList.filter((i) => {
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
    });
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

  // Synchroniser les brouillons texte quand la mission sélectionnée change
  useEffect(() => {
    setChiffrageDraft(activeMission?.elementsChiffrage || '');
    setCompteRenduDraft(activeMission?.compteRendu || '');
  }, [activeMission?.id, activeMission?.elementsChiffrage, activeMission?.compteRendu]);

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
        elementsChiffrage: activeMission?.id === mission.id ? chiffrageDraft : mission.elementsChiffrage,
        compteRendu: activeMission?.id === mission.id ? compteRenduDraft : mission.compteRendu,
        statutRapport: 'Déclaré par technicien',
      },
    });
    toast.success(`⏹️ Mission ${mission.reference} terminée à ${nowHHMM}`);
  };

  const handleSaveReportAndChiffrage = async (mission: Intervention) => {
    await updateMissionMut.mutateAsync({
      id: mission.id,
      data: {
        elementsChiffrage: chiffrageDraft,
        compteRendu: compteRenduDraft,
        statutRapport: 'Déclaré par technicien',
      },
    });
    toast.success('💾 Compte rendu & éléments de chiffrage enregistrés');
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
    const existingPhotos = Array.isArray(mission.photos) ? mission.photos : [];

    if (existingPhotos.length >= MAX_PHOTOS_PER_MISSION) {
      toast.error(`Limite de ${MAX_PHOTOS_PER_MISSION} photos atteinte pour préserver le stockage`);
      e.target.value = '';
      return;
    }

    try {
      const remainingSlots = MAX_PHOTOS_PER_MISSION - existingPhotos.length;
      const countToProcess = Math.min(files.length, remainingSlots);
      const newPhotos: TerrainPhoto[] = [];
      let lastKo = 0;
      let lastReduction = 0;

      for (let i = 0; i < countToProcess; i++) {
        const optimized = await compressAndOptimizeImage(files[i]);
        lastKo = optimized.compressedSizeKo;
        lastReduction = optimized.reductionPercent;
        newPhotos.push({
          id: `ph-${Date.now()}-${i}`,
          url: optimized.dataUrl,
          category: photoCategory,
          caption: photoCaption.trim() || `${photoCategory} — ${mission.reference}`,
          takenAt: new Date().toISOString(),
          auteur: currentTechnicien,
        });
      }

      await updateMissionMut.mutateAsync({
        id: mission.id,
        data: {
          photos: [...existingPhotos, ...newPhotos],
          statutRapport: 'Déclaré par technicien',
        },
      });
      setPhotoCaption('');
      toast.success(
        `📷 ${newPhotos.length} photo(s) optimisée(s) et enregistrée(s) (~${lastKo} Ko, -${lastReduction}%)`
      );
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

  const showPointage = activeTab === 'pointage' || activeTab === 'tout';
  const showMissions = activeTab === 'missions' || activeTab === 'tout';
  const showCompteRendu = activeTab === 'compte_rendu' || activeTab === 'tout';

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1040px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        paddingBottom: '24px',
      }}
    >
      {/* =====================================================================
          EN-TÊTE MOBILE COMPACT ADAPTÉ À TOUS LES TÉLÉPHONES (320px -> 430px+)
         ===================================================================== */}
      <div
        className="pro-table-container"
        style={{
          padding: '12px',
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(16, 185, 129, 0.08))',
          borderLeft: '4px solid var(--accent-primary)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '9px',
                background: 'var(--accent-primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '13px',
                flexShrink: 0,
              }}
            >
              {(currentTechnicien || 'TE').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentTechnicien || 'Technicien'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                App Mobile Terrain • {formatDateFR(selectedDate)}
              </div>
            </div>
          </div>

          {/* Badge d'état du pointage en direct (cliquable pour ouvrir l'onglet Pointage) */}
          <button
            type="button"
            onClick={() => setActiveTab('pointage')}
            className={`badge ${
              currentPointage?.statutJournee === 'EN_SERVICE'
                ? 'badge-success'
                : currentPointage?.statutJournee === 'TERMINEE'
                ? 'badge-info'
                : 'badge-warning'
            }`}
            style={{
              fontSize: '11.5px',
              padding: '5px 10px',
              cursor: 'pointer',
              border: 'none',
              fontWeight: 700,
            }}
          >
            {currentPointage?.statutJournee === 'EN_SERVICE'
              ? `🟢 En service (${currentPointage.heureArriveeBureau})`
              : currentPointage?.statutJournee === 'TERMINEE'
              ? `🔵 Fin (${currentPointage.heureArriveeBureau}→${currentPointage.heureFinJournee})`
              : '🟠 Pointage matin à activer'}
          </button>
        </div>

        {/* Identification du Technicien & Date */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: canSwitchTechnicien ? 'repeat(auto-fit, minmax(160px, 1fr))' : '1fr auto',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          {canSwitchTechnicien ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                Mode Superviseur :
              </span>
              <select
                className="select"
                style={{ width: '100%', fontWeight: 700 }}
                value={currentTechnicien}
                aria-label="Choisir le technicien"
                onChange={(e) => {
                  onSelectTechnicien(e.target.value);
                  setActiveMissionId(null);
                }}
              >
                {techniciens.map((t) => (
                  <option key={t} value={t}>
                    👷 {t}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                fontSize: '12.5px',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>🔒 Compte personnel :</span>
              <strong style={{ color: 'var(--text-primary)', fontSize: '13.5px' }}>{currentTechnicien}</strong>
              <span className="badge badge-success" style={{ fontSize: '10.5px', padding: '2px 8px' }}>
                Droits Certifiés
              </span>
            </div>
          )}

          <input
            type="date"
            className="input"
            style={{ width: canSwitchTechnicien ? '100%' : '140px', fontWeight: 600 }}
            value={selectedDate}
            aria-label="Date des missions"
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        {/* Barre d'onglets tactile adaptée à tous les téléphones */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '6px',
            background: 'var(--bg-surface)',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid var(--border-default)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('pointage')}
            style={{
              padding: '8px 4px',
              borderRadius: '7px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              background: activeTab === 'pointage' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'pointage' ? '#ffffff' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
          >
            <span>⏱️</span>
            <span>Pointage</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('missions')}
            style={{
              padding: '8px 4px',
              borderRadius: '7px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              background: activeTab === 'missions' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'missions' ? '#ffffff' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
          >
            <span>📋</span>
            <span>Missions ({techMissions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('compte_rendu')}
            style={{
              padding: '8px 4px',
              borderRadius: '7px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              background: activeTab === 'compte_rendu' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'compte_rendu' ? '#ffffff' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
          >
            <span>📝</span>
            <span>Rapport & 📷</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          BANNIÈRE RAPIDE MATIN (SI NON POINTÉ ET SUR L'ONGLET MISSIONS)
         ===================================================================== */}
      {activeTab === 'missions' && !currentPointage?.heureArriveeBureau && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1.5px solid rgba(245, 158, 11, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
              ⚠️ Arrivée au bureau non activée ce matin
            </span>
            {liveParisTime && (
              <span className="badge badge-warning font-mono" style={{ fontWeight: 800 }}>
                {liveParisTime}
              </span>
            )}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              borderColor: '#059669',
              fontWeight: 800,
              minHeight: '44px',
              fontSize: '13.5px',
            }}
            disabled={clockInMut.isPending}
            onClick={() => {
              clockInMut.mutate({
                technicien: currentTechnicien,
                dateJour: selectedDate,
              });
            }}
          >
            {clockInMut.isPending ? '⏳ Enregistrement...' : `☀️ Pointer mon arrivée au bureau maintenant (${liveParisTime || getNowHHMM()})`}
          </button>
        </div>
      )}

      {/* =====================================================================
          BLOC 1 : BADGEUSE MATIN (ARRIVÉE BUREAU) & SOIR (FIN DERNIÈRE INTV.)
          HORODATAGE INVIOLABLE NON MODIFIABLE À LA MAIN
         ===================================================================== */}
      {showPointage && (
        <div
          className="pro-table-container"
          style={{
            padding: '16px',
            borderTop:
              currentPointage?.statutJournee === 'EN_SERVICE'
                ? '4px solid #10b981'
                : currentPointage?.statutJournee === 'TERMINEE'
                ? '4px solid #2563eb'
                : '4px solid #f59e0b',
          }}
        >
          {/* Horloge numérique en direct */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '14px',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 800 }}>
                ⏱️ Pointage Quotidien Certifié ({formatDateFR(selectedDate)})
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                L'heure est certifiée automatiquement à la pression du bouton. Aucune saisie manuelle.
              </div>
            </div>

            <div
              className="font-mono"
              style={{
                fontSize: '14.5px',
                fontWeight: 800,
                color: 'var(--accent-primary)',
                background: 'var(--bg-surface)',
                padding: '5px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                letterSpacing: '0.04em',
              }}
            >
              🕒 {liveParisTime || getNowHHMM()}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '12px',
            }}
          >
            {/* Carte Matin : Arrivée au bureau */}
            <div
              style={{
                padding: '16px',
                borderRadius: '14px',
                background: currentPointage?.heureArriveeBureau
                  ? 'rgba(16, 185, 129, 0.08)'
                  : 'var(--bg-elevated)',
                border: currentPointage?.heureArriveeBureau
                  ? '1.5px solid rgba(16, 185, 129, 0.5)'
                  : '1.5px solid var(--border-default)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 800, fontSize: '13.5px', color: '#059669' }}>
                  ☀️ 1. MATIN — Arrivée au Bureau
                </span>
                {currentPointage?.heureArriveeBureau ? (
                  <span className="badge badge-success font-mono" style={{ fontSize: '14px', fontWeight: 800 }}>
                    ✓ {currentPointage.heureArriveeBureau}
                  </span>
                ) : (
                  <span className="badge badge-warning">À pointer</span>
                )}
              </div>

              {!currentPointage?.heureArriveeBureau ? (
                <>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Appuyez dès votre arrivée au bureau. L'heure officielle du clic sera certifiée.
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={clockInMut.isPending}
                    style={{
                      width: '100%',
                      minHeight: '48px',
                      background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                      borderColor: '#059669',
                      fontWeight: 800,
                      fontSize: '13.5px',
                      boxShadow: '0 4px 14px rgba(5, 150, 105, 0.25)',
                    }}
                    onClick={() => {
                      clockInMut.mutate({
                        technicien: currentTechnicien,
                        dateJour: selectedDate,
                      });
                    }}
                  >
                    {clockInMut.isPending ? '⏳ Enregistrement...' : `☀️ Pointer mon arrivée au bureau`}
                  </button>
                </>
              ) : (
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.12)',
                    fontSize: '12px',
                    color: '#059669',
                    fontWeight: 700,
                  }}
                >
                  🔒 Horodatage officiel certifié à {currentPointage.heureArriveeBureau}. Heure verrouillée.
                </div>
              )}
            </div>

            {/* Carte Soir : Fin de dernière intervention */}
            <div
              style={{
                padding: '16px',
                borderRadius: '14px',
                background: currentPointage?.heureFinJournee
                  ? 'rgba(37, 99, 235, 0.08)'
                  : 'var(--bg-elevated)',
                border: currentPointage?.heureFinJournee
                  ? '1.5px solid rgba(37, 99, 235, 0.5)'
                  : '1.5px solid var(--border-default)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 800, fontSize: '13.5px', color: '#2563eb' }}>
                  🌙 2. SOIR — Fin Dernière Intervention
                </span>
                {currentPointage?.heureFinJournee ? (
                  <span className="badge badge-info font-mono" style={{ fontSize: '14px', fontWeight: 800 }}>
                    ✓ {currentPointage.heureFinJournee}
                  </span>
                ) : currentPointage?.heureArriveeBureau ? (
                  <span className="badge badge-info">En service</span>
                ) : (
                  <span className="badge badge-neutral">En attente</span>
                )}
              </div>

              {!currentPointage?.heureArriveeBureau ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Activez d'abord votre arrivée au bureau le matin pour pouvoir pointer la fin de journée le soir.
                </div>
              ) : !currentPointage?.heureFinJournee ? (
                <>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Appuyez à la fin de votre dernière intervention. L'heure officielle du clic sera certifiée.
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={clockOutMut.isPending}
                    style={{
                      width: '100%',
                      minHeight: '48px',
                      background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                      borderColor: '#2563eb',
                      fontWeight: 800,
                      fontSize: '13.5px',
                      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
                    }}
                    onClick={() => {
                      clockOutMut.mutate({
                        technicien: currentTechnicien,
                        dateJour: selectedDate,
                        derniereInterventionRef: lastMissionRef,
                      });
                    }}
                  >
                    {clockOutMut.isPending ? '⏳ Enregistrement...' : `🌙 Pointer ma fin de journée`}
                  </button>
                </>
              ) : (
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: 'rgba(37, 99, 235, 0.12)',
                    fontSize: '12px',
                    color: '#2563eb',
                    fontWeight: 700,
                  }}
                >
                  🔒 Fin de journée certifiée à {currentPointage.heureFinJournee}.
                  {currentPointage.dureeMinutes ? ` Amplitude : ${Math.floor(currentPointage.dureeMinutes / 60)}h${String(currentPointage.dureeMinutes % 60).padStart(2, '0')}.` : ''}
                </div>
              )}
            </div>
          </div>

          {activeTab === 'pointage' && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: '12px', minHeight: '44px', fontWeight: 700 }}
              onClick={() => setActiveTab('missions')}
            >
              📋 Aller à mes missions ({techMissions.length}) →
            </button>
          )}
        </div>
      )}

      {/* =====================================================================
          BLOC 2 & 3 : MISSIONS ET COMPTE-RENDU / PHOTOS
         ===================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            activeTab === 'tout' ? 'repeat(auto-fit, minmax(310px, 1fr))' : '1fr',
          gap: '12px',
        }}
      >
        {/* LISTE DES INTERVENTIONS & VISITES DEVIS */}
        {showMissions && (
          <div
            className="pro-table-container"
            style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontWeight: 800, fontSize: '14px' }}>
                📋 Mes Missions ({techMissions.length})
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
                  padding: '28px 14px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                  background: 'var(--bg-elevated)',
                  borderRadius: '10px',
                }}
              >
                Aucune mission planifiée pour <strong>{currentTechnicien}</strong> le {formatDateFR(selectedDate)}.
                <div style={{ marginTop: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ width: '100%', maxWidth: '280px' }}
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
                  const nbActions = (m.actionsRealisees || []).length;
                  const nbPhotos = (m.photos || []).length;

                  return (
                    <div
                      key={m.id}
                      onClick={() => setActiveMissionId(m.id)}
                      style={{
                        padding: '12px',
                        borderRadius: '12px',
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span className={`badge ${m.isVisiteDevis ? 'badge-purple' : 'badge-info'}`}>
                            {m.isVisiteDevis ? '📐 VISITE DEVIS' : '🔧 TRAVAUX'}
                          </span>
                          <span className="font-mono" style={{ fontWeight: 800, fontSize: '12px' }}>
                            {m.reference}
                          </span>
                        </div>

                        <span
                          className={`badge ${
                            isRunning ? 'badge-warning' : isDone ? 'badge-success' : 'badge-neutral'
                          }`}
                        >
                          {isRunning
                            ? `🟢 EN COURS (${m.heureDebutReelle || ''})`
                            : isDone
                            ? `✓ TERMINÉE (${m.heureDebutReelle || ''}→${m.heureFinReelle || ''})`
                            : m.statutOperationnel}
                        </span>
                      </div>

                      <div>
                        <div style={{ fontWeight: 800, fontSize: '14.5px', color: 'var(--text-primary)' }}>
                          {m.client || 'Client ANELEC'}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px', wordBreak: 'break-word' }}>
                          📍 {m.chantier}
                        </div>
                        {m.objet && (
                          <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', marginTop: '4px', fontWeight: 600 }}>
                            Objet : {m.objet}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-secondary)', flexWrap: 'wrap', gap: '6px' }}>
                        <span className="font-mono" style={{ fontWeight: 700 }}>
                          🗓️ {formatDateFR(m.datePlanifiee)} • 🕒 {m.heureDebut || '08:30'}-{m.heureFin || '10:30'}
                        </span>
                        <span className="badge badge-neutral">{m.corpsEtat || 'Tous corps d’état'}</span>
                      </div>

                      {/* Boutons Tactiles Pleine Largeur adaptés à tous les téléphones */}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          marginTop: '4px',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Ligne 1 : Activer / Démarrer ou Désactiver / Terminer */}
                        {!isRunning && !isDone && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{
                              width: '100%',
                              minHeight: '44px',
                              background: '#059669',
                              borderColor: '#059669',
                              fontWeight: 800,
                              fontSize: '13px',
                            }}
                            onClick={() => handleActivateMission(m)}
                          >
                            ▶️ Activer / Démarrer ({m.isVisiteDevis ? 'Visite Devis' : 'Intervention'})
                          </button>
                        )}

                        {isRunning && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{
                              width: '100%',
                              minHeight: '44px',
                              background: '#dc2626',
                              borderColor: '#dc2626',
                              fontWeight: 800,
                              fontSize: '13px',
                            }}
                            onClick={() => handleDeactivateMission(m)}
                          >
                            ⏹️ Désactiver / Terminer la mission
                          </button>
                        )}

                        {/* Ligne 2 : Ouvrir Compte Rendu & Photos + GPS */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{
                              minHeight: '42px',
                              fontWeight: 800,
                              fontSize: '12.5px',
                              borderColor: 'var(--accent-primary)',
                              color: 'var(--accent-primary)',
                            }}
                            onClick={() => {
                              setActiveMissionId(m.id);
                              setActiveTab('compte_rendu');
                            }}
                          >
                            📝 Compte-Rendu & 📷 ({nbActions} act. • {nbPhotos} ph.)
                          </button>

                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                              m.chantier || m.client || ''
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary"
                            style={{
                              minHeight: '42px',
                              padding: '0 12px',
                              textDecoration: 'none',
                              fontWeight: 700,
                            }}
                          >
                            🗺️ GPS
                          </a>
                        </div>

                        {isDone && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ width: '100%' }}
                            onClick={() => handleActivateMission(m)}
                          >
                            🔄 Ré-activer cette mission si besoin
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            BLOC 3 : COMPTE RENDU PRÉ-REMPLI, ÉLÉMENTS DE CHIFFRAGE & PHOTOS
           =================================================================== */}
        {showCompteRendu && (
          <div
            className="pro-table-container"
            style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            {/* Barre supérieure de retour rapide sur téléphone */}
            {activeTab === 'compte_rendu' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveTab('missions')}
                  style={{ fontWeight: 700 }}
                >
                  ← Retour aux missions ({techMissions.length})
                </button>

                {techMissions.length > 1 && (
                  <select
                    className="select"
                    style={{ flex: 1, minWidth: '150px', fontWeight: 700 }}
                    value={activeMission?.id || ''}
                    onChange={(e) => setActiveMissionId(Number(e.target.value))}
                  >
                    {techMissions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.reference} — {m.client}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {!activeMission ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Sélectionnez d’abord une mission dans l’onglet <strong>📋 Missions</strong> pour remplir son compte rendu et ajouter des photos.
                <div style={{ marginTop: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setActiveTab('missions')}
                  >
                    📋 Choisir une mission
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                    <span className="font-mono" style={{ fontWeight: 800, fontSize: '13px', color: 'var(--accent-primary)' }}>
                      {activeMission.reference} • {activeMission.corpsEtat}
                    </span>
                    <span className="badge badge-info">
                      {activeMission.isVisiteDevis ? '📐 Infos Chiffrage Devis' : '🔧 Déclaration Intervention'}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, marginTop: '4px', wordBreak: 'break-word' }}>
                    {activeMission.client} — {activeMission.chantier}
                  </h3>

                  {/* Bouton rapide Activer / Terminer directement depuis la fiche Compte Rendu */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {activeMission.statutOperationnel !== 'En cours' ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ flex: 1, background: '#059669', borderColor: '#059669', minHeight: '40px', fontWeight: 800 }}
                        onClick={() => handleActivateMission(activeMission)}
                      >
                        ▶️ Activer le début de mission
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ flex: 1, background: '#dc2626', borderColor: '#dc2626', minHeight: '40px', fontWeight: 800 }}
                        onClick={() => handleDeactivateMission(activeMission)}
                      >
                        ⏹️ Terminer & Clôturer la mission
                      </button>
                    )}
                  </div>

                  {activeMission.notes && (
                    <div
                      style={{
                        marginTop: '8px',
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
                        marginTop: '8px',
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
                  <div style={{ fontSize: '13px', fontWeight: 800, marginBottom: '8px' }}>
                    1. Actions Pré-remplies (Touchez pour cocher / décocher) :
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {Object.entries(ACTIONS_PREREMPLIES_TERRAIN).map(([catName, actions]) => (
                      <div
                        key={catName}
                        style={{
                          padding: '10px',
                          borderRadius: '10px',
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                          {catName}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {actions.map((act) => {
                            const checked = (activeMission.actionsRealisees || []).includes(act);
                            return (
                              <button
                                key={act}
                                type="button"
                                onClick={() => handleTogglePreFilledAction(activeMission, act)}
                                style={{
                                  padding: '8px 10px',
                                  minHeight: '38px',
                                  borderRadius: '8px',
                                  fontSize: '12px',
                                  fontWeight: checked ? 800 : 500,
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  border: checked
                                    ? '1.5px solid #059669'
                                    : '1px solid var(--border-default)',
                                  background: checked
                                    ? 'rgba(16, 185, 129, 0.15)'
                                    : 'var(--bg-surface)',
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
                      style={{ flex: 1 }}
                      placeholder="+ Ajouter une autre action..."
                      value={customActionInput}
                      onChange={(e) => setCustomActionInput(e.target.value)}
                    />
                    <button type="submit" className="btn btn-secondary" style={{ fontWeight: 700 }}>
                      Ajouter
                    </button>
                  </form>
                </div>

                {/* 2. Informations importantes pour le Chiffrage du Devis */}
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 800, display: 'block', marginBottom: '6px', color: '#7c3aed' }}>
                    2. Éléments pour Chiffrage Devis (Métrés, Matériel à prévoir, Durée estimée) :
                  </label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Ex: Prévoir 15m câble 3G2.5, 1 disjoncteur diff 30mA, hauteur 3m20, durée estimée 4h..."
                    value={chiffrageDraft}
                    onChange={(e) => setChiffrageDraft(e.target.value)}
                  />
                </div>

                {/* 3. Petit Compte Rendu & Observations Terrain */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 800 }}>
                      3. Petit Compte Rendu & Observations :
                    </label>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11.5px', fontWeight: 700 }}
                      onClick={() => {
                        const acts = activeMission.actionsRealisees || [];
                        if (acts.length === 0) {
                          toast.error('Cochez d’abord des actions pré-remplies ci-dessus');
                          return;
                        }
                        const merged = [
                          compteRenduDraft,
                          `Actions effectuées : ${acts.join(' ; ')}.`,
                        ]
                          .filter(Boolean)
                          .join('\n');
                        setCompteRenduDraft(merged);
                        updateMissionMut.mutate({
                          id: activeMission.id,
                          data: {
                            compteRendu: merged,
                            elementsChiffrage: chiffrageDraft,
                            statutRapport: 'Déclaré par technicien',
                          },
                        });
                        toast.success('Actions insérées dans le compte rendu');
                      }}
                    >
                      + Insérer actions cochées
                    </button>
                  </div>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Observations terrain, état des lieux, validation client/gardien..."
                    value={compteRenduDraft}
                    onChange={(e) => setCompteRenduDraft(e.target.value)}
                  />

                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: '8px', minHeight: '44px', fontWeight: 800 }}
                    onClick={() => handleSaveReportAndChiffrage(activeMission)}
                  >
                    💾 Enregistrer le Compte Rendu & Chiffrage
                  </button>
                </div>

                {/* 4. Prise de Photos (Caméra Mobile + Galerie) */}
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 800 }}>
                    4. 📷 Photos Terrain & Relevés ({(activeMission.photos || []).length}) :
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                    <select
                      className="select"
                      style={{ width: '100%', fontWeight: 700 }}
                      value={photoCategory}
                      onChange={(e) => setPhotoCategory(e.target.value as any)}
                    >
                      <option value="AVANT">📷 Photo AVANT travaux</option>
                      <option value="APRES">✅ Photo APRÈS travaux</option>
                      <option value="RELEVE_CHIFFRAGE">📐 Relevé / Chiffrage Devis</option>
                      <option value="CONSTAT">⚠️ Constat / Anomalie</option>
                    </select>

                    <input
                      type="text"
                      className="input"
                      style={{ width: '100%' }}
                      placeholder="Légende photo (optionnel)..."
                      value={photoCaption}
                      onChange={(e) => setPhotoCaption(e.target.value)}
                    />
                  </div>

                  {/* Deux boutons grands formats adaptés iOS et Android : Appareil Photo direct + Galerie */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                    <label
                      className="btn btn-primary"
                      style={{
                        cursor: 'pointer',
                        minHeight: '46px',
                        fontWeight: 800,
                        justifyContent: 'center',
                      }}
                    >
                      <span>📷 Prendre Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        style={{ display: 'none' }}
                        onChange={(e) => handlePhotoUpload(e, activeMission)}
                      />
                    </label>

                    <label
                      className="btn btn-secondary"
                      style={{
                        cursor: 'pointer',
                        minHeight: '46px',
                        fontWeight: 800,
                        justifyContent: 'center',
                      }}
                    >
                      <span>🖼️ Choisir Galerie</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: 'none' }}
                        onChange={(e) => handlePhotoUpload(e, activeMission)}
                      />
                    </label>
                  </div>

                  {(activeMission.photos || []).length > 0 && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                        gap: '8px',
                        marginTop: '4px',
                      }}
                    >
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
                            style={{ width: '100%', height: '95px', objectFit: 'cover' }}
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
                              top: '5px',
                              right: '5px',
                              background: 'rgba(220, 38, 38, 0.9)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '999px',
                              width: '26px',
                              height: '26px',
                              fontSize: '12px',
                              fontWeight: 800,
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
        )}
      </div>
    </div>
  );
}
