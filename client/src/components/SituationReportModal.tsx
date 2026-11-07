import { useState, useMemo } from 'react';
import {
  Devis,
  Intervention,
  formatDateFR,
  formatCurrency,
  getTodayParisISO,
} from '../lib/api';
import {
  exportSituationCompleteExcel,
  exportSituationInterventionsExcel,
  exportSituationDevisExcel,
  SituationExportOptions,
} from '../lib/exportSituationExcel';
import toast from 'react-hot-toast';

interface SituationReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  interventions: Intervention[];
  devis: Devis[];
  clientsList?: string[];
  defaultMode?: 'complete' | 'interventions' | 'devis';
}

/**
 * Calcule les dates de début et fin selon un preset
 */
function getPresetDates(preset: 'ALL' | 'TODAY' | '7J' | '30J' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR'): { start: string; end: string } {
  const todayISO = getTodayParisISO();
  const [curYear, curMonth] = todayISO.split('-').map(Number);

  if (preset === 'ALL') {
    return { start: '', end: '' };
  }
  if (preset === 'TODAY') {
    return { start: todayISO, end: todayISO };
  }
  if (preset === '7J') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return { start: d.toISOString().slice(0, 10), end: todayISO };
  }
  if (preset === '30J') {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return { start: d.toISOString().slice(0, 10), end: todayISO };
  }
  if (preset === 'THIS_MONTH') {
    const start = `${curYear}-${String(curMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(curYear, curMonth, 0).getDate();
    const end = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start, end };
  }
  if (preset === 'LAST_MONTH') {
    const prevMonthDate = new Date(curYear, curMonth - 2, 1);
    const pYear = prevMonthDate.getFullYear();
    const pMonth = prevMonthDate.getMonth() + 1;
    const pLastDay = new Date(pYear, pMonth, 0).getDate();
    const start = `${pYear}-${String(pMonth).padStart(2, '0')}-01`;
    const end = `${pYear}-${String(pMonth).padStart(2, '0')}-${String(pLastDay).padStart(2, '0')}`;
    return { start, end };
  }
  if (preset === 'THIS_YEAR') {
    return { start: `${curYear}-01-01`, end: `${curYear}-12-31` };
  }

  return { start: '', end: '' };
}

export function SituationReportModal({
  isOpen,
  onClose,
  interventions,
  devis,
  clientsList = [],
}: SituationReportModalProps) {
  // Dates d'extraction demandées par l'utilisateur (Jour / Mois / Année)
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedFilterClient, setSelectedFilterClient] = useState<string>('ALL');
  const [activePreset, setActivePreset] = useState<string>('ALL');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Application d'un preset rapide
  const applyPreset = (preset: 'ALL' | 'TODAY' | '7J' | '30J' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR') => {
    setActivePreset(preset);
    const { start, end } = getPresetDates(preset);
    setStartDate(start);
    setEndDate(end);
  };

  // Filtrage précis des données selon les dates (JJ/MM/AAAA) et client
  const filteredData = useMemo(() => {
    // 1. Filtrer interventions
    const intvs = interventions.filter((intv) => {
      // Filtre Client
      if (selectedFilterClient !== 'ALL' && intv.client !== selectedFilterClient) {
        return false;
      }
      // Filtre Date
      const dStr = (intv.datePlanifiee || intv.dateReelle || intv.dateDebut || '').slice(0, 10);
      if (startDate && dStr && dStr < startDate) {
        return false;
      }
      if (endDate && dStr && dStr > endDate) {
        return false;
      }
      // Si une date de filtre est demandée mais que l'intervention n'a aucune date
      if ((startDate || endDate) && !dStr) {
        return false;
      }
      return true;
    });

    // 2. Filtrer devis
    const dev = devis.filter((devisItem) => {
      // Filtre Client
      if (selectedFilterClient !== 'ALL' && devisItem.client !== selectedFilterClient) {
        return false;
      }
      // Filtre Date
      const dStr = (devisItem.dateEnvoi || devisItem.dateCreated || '').slice(0, 10);
      if (startDate && dStr && dStr < startDate) {
        return false;
      }
      if (endDate && dStr && dStr > endDate) {
        return false;
      }
      // Si une date de filtre est demandée mais que le devis n'a aucune date
      if ((startDate || endDate) && !dStr) {
        return false;
      }
      return true;
    });

    // Calcul montants correspondants
    const totalIntvMontant = intvs.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const totalDevisMontant = dev.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    return {
      filteredIntvs: intvs,
      filteredDevis: dev,
      totalIntvMontant,
      totalDevisMontant,
    };
  }, [interventions, devis, selectedFilterClient, startDate, endDate]);

  // Libellé clair de la période active
  const periodeLibelle = useMemo(() => {
    if (startDate && endDate) {
      if (startDate === endDate) {
        return `Le ${formatDateFR(startDate)}`;
      }
      return `Du ${formatDateFR(startDate)} au ${formatDateFR(endDate)}`;
    }
    if (startDate) {
      return `À partir du ${formatDateFR(startDate)}`;
    }
    if (endDate) {
      return `Jusqu'au ${formatDateFR(endDate)}`;
    }
    return 'Historique complet (Toutes les dates)';
  }, [startDate, endDate]);

  if (!isOpen) return null;

  const handleExport = (mode: 'complete' | 'interventions' | 'devis') => {
    try {
      setIsExporting(true);
      const options: SituationExportOptions = {
        startDate: startDate || null,
        endDate: endDate || null,
        client: selectedFilterClient !== 'ALL' ? selectedFilterClient : null,
      };

      if (mode === 'complete') {
        exportSituationCompleteExcel(filteredData.filteredIntvs, filteredData.filteredDevis, options);
        toast.success(`Situation complète téléchargée (${filteredData.filteredIntvs.length} chantiers, ${filteredData.filteredDevis.length} devis) pour la période : ${periodeLibelle}`);
      } else if (mode === 'interventions') {
        exportSituationInterventionsExcel(filteredData.filteredIntvs, options);
        toast.success(`Rapport interventions téléchargé (${filteredData.filteredIntvs.length} chantiers) pour la période : ${periodeLibelle}`);
      } else if (mode === 'devis') {
        exportSituationDevisExcel(filteredData.filteredDevis, options);
        toast.success(`Rapport devis téléchargé (${filteredData.filteredDevis.length} devis) pour la période : ${periodeLibelle}`);
      }
      onClose();
    } catch (err: any) {
      console.error('Erreur export situation Excel:', err);
      toast.error('Erreur lors de la génération du fichier Excel');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="modal-content card"
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '92vh',
          overflowY: 'auto',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.25)',
          padding: '24px',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* EN-TÊTE MODAL */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '24px',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                flexShrink: 0,
              }}
            >
              📊
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Rapports de Situation & Avancement en 1 Clic (Excel)
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Générez instantanément l’état d’avancement précis de chaque intervention et devis avec filtre de dates au jour, mois et année.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              fontWeight: 'bold',
            }}
          >
            ✕
          </button>
        </div>

        {/* CADRE EXTRACTION : DATE DÉBUT (JJ/MM/AAAA) ET DATE FIN (JJ/MM/AAAA) */}
        <div
          style={{
            background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
            border: '1px solid #cbd5e1',
            borderRadius: '14px',
            padding: '16px',
            marginBottom: '18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🗓️</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                Période d'extraction du rapport (Jour / Mois / Année)
              </span>
            </div>
            {(startDate || endDate || selectedFilterClient !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  applyPreset('ALL');
                  setSelectedFilterClient('ALL');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0284c7',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                ↺ Réinitialiser tous les filtres
              </button>
            )}
          </div>

          {/* Saisie directe des dates Début et Fin */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              alignItems: 'end',
            }}
          >
            {/* DATE DE DÉBUT */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                Date de début (jj/mm/aaaa) :
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActivePreset('CUSTOM');
                }}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: '1px solid #94a3b8',
                  backgroundColor: '#ffffff',
                  fontSize: '13px',
                  color: '#0f172a',
                  fontWeight: 500,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* DATE DE FIN */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                Date de fin (jj/mm/aaaa) :
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActivePreset('CUSTOM');
                }}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: '1px solid #94a3b8',
                  backgroundColor: '#ffffff',
                  fontSize: '13px',
                  color: '#0f172a',
                  fontWeight: 500,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* DONNEUR D'ORDRE (CLIENT) */}
            {clientsList.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Donneur d'ordre :
                </label>
                <select
                  value={selectedFilterClient}
                  onChange={(e) => setSelectedFilterClient(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    border: '1px solid #94a3b8',
                    backgroundColor: '#ffffff',
                    fontSize: '13px',
                    color: '#0f172a',
                    fontWeight: 500,
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="ALL">Tous les donneurs d'ordre</option>
                  {clientsList.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Raccourcis de période rapides */}
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginRight: '4px' }}>
              Raccourcis :
            </span>
            {[
              { id: 'ALL', label: 'Toute la base' },
              { id: 'TODAY', label: "Aujourd'hui" },
              { id: '7J', label: '7 derniers jours' },
              { id: '30J', label: '30 derniers jours' },
              { id: 'THIS_MONTH', label: 'Ce mois-ci' },
              { id: 'LAST_MONTH', label: 'Mois dernier' },
              { id: 'THIS_YEAR', label: 'Année en cours' },
            ].map((p) => {
              const isSelected = activePreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id as any)}
                  style={{
                    fontSize: '11px',
                    padding: '3px 9px',
                    borderRadius: '6px',
                    border: isSelected ? '1px solid #0284c7' : '1px solid #cbd5e1',
                    background: isSelected ? '#0284c7' : '#ffffff',
                    color: isSelected ? '#ffffff' : '#475569',
                    cursor: 'pointer',
                    fontWeight: isSelected ? 600 : 500,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* BANDEAU RÉCAPITULATIF DES LIGNES RETENUES */}
          <div
            style={{
              marginTop: '12px',
              padding: '8px 12px',
              background: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              fontSize: '12px',
            }}
          >
            <div>
              <span style={{ color: '#64748b' }}>Période active : </span>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>{periodeLibelle}</span>
              {selectedFilterClient !== 'ALL' && (
                <span style={{ marginLeft: '6px', color: '#0284c7', fontWeight: 600 }}>
                  · Client : {selectedFilterClient}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '14px', color: '#475569', fontWeight: 600 }}>
              <span style={{ color: '#0284c7' }}>
                🛠️ {filteredData.filteredIntvs.length} chantiers ({formatCurrency(filteredData.totalIntvMontant)})
              </span>
              <span style={{ color: '#7c3aed' }}>
                💼 {filteredData.filteredDevis.length} devis ({formatCurrency(filteredData.totalDevisMontant)})
              </span>
            </div>
          </div>
        </div>

        {/* LES 3 CHOIX DE RAPPORTS EN UN CLIC */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* OPTION 1 : SITUATION COMPLÈTE (DEUX EN UN) */}
          <div
            style={{
              border: '2px solid #10b981',
              borderRadius: '12px',
              padding: '16px 20px',
              background: '#f0fdf4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.08)',
            }}
          >
            <div style={{ flex: '1 1 340px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '20px' }}>📑</span>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#065f46', margin: 0 }}>
                  Situation Complète (Interventions + Devis)
                </h3>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    background: '#10b981',
                    color: '#ffffff',
                    padding: '2px 8px',
                    borderRadius: '999px',
                  }}
                >
                  3 Onglets Excel
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#047857', margin: 0, lineHeight: 1.5 }}>
                Un seul classeur Excel complet comprenant : <b>1. Synthèse Globale & KPI</b> (avec la période d'extraction indiquée), <b>2. Suivi Interventions</b> ({filteredData.filteredIntvs.length} chantiers avec étape d'avancement), <b>3. Suivi Devis</b> ({filteredData.filteredDevis.length} devis avec avancement & relances).
              </p>
            </div>

            <button
              type="button"
              className="btn"
              disabled={isExporting}
              onClick={() => handleExport('complete')}
              style={{
                backgroundColor: '#059669',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '11px 18px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(5, 150, 105, 0.3)',
                whiteSpace: 'nowrap',
              }}
            >
              <span>📥 Télécharger Situation Complète (.xlsx)</span>
            </button>
          </div>

          {/* SÉPARATION EN 2 CARTES DISTINCTES */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
            {/* OPTION 2 : INTERVENTIONS SEULES */}
            <div
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '16px',
                background: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '18px' }}>🛠️</span>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                    Situation Interventions Seules
                  </h3>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      background: '#e0f2fe',
                      color: '#0369a1',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    Chantiers terrain
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                  Vue d'ensemble opérationnelle des chantiers avec l'étape d'avancement de chaque mission (planifiée, en cours, terminée sur site, clôturée, facturée ou bloquée), intervenant, horaires et montants.
                </p>
                <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600, marginTop: '6px' }}>
                  {filteredData.filteredIntvs.length} chantiers dans la sélection
                </div>
              </div>

              <button
                type="button"
                className="btn"
                disabled={isExporting}
                onClick={() => handleExport('interventions')}
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '9px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <span>📥 Télécharger Interventions (.xlsx)</span>
              </button>
            </div>

            {/* OPTION 3 : DEVIS SEULS */}
            <div
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '16px',
                background: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '18px' }}>💼</span>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                    Situation Devis Seuls
                  </h3>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      background: '#ede9fe',
                      color: '#6d28d9',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    Bureau d'études
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                  Suivi du cycle de chiffrage commercial : demandes reçues à préparer, visites préalables requises, devis envoyés aux clients, relances et devis acceptés/signés.
                </p>
                <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 600, marginTop: '6px' }}>
                  {filteredData.filteredDevis.length} devis dans la sélection
                </div>
              </div>

              <button
                type="button"
                className="btn"
                disabled={isExporting}
                onClick={() => handleExport('devis')}
                style={{
                  backgroundColor: '#7c3aed',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '9px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <span>📥 Télécharger Devis (.xlsx)</span>
              </button>
            </div>
          </div>
        </div>

        {/* NOTICE EXPLICATIVE & SPÉCIFICITÉS EXCEL */}
        <div
          style={{
            marginTop: '18px',
            padding: '12px 14px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            fontSize: '11px',
            color: '#64748b',
            lineHeight: 1.5,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            <span>💡</span>
            <span>Spécificités du fichier Excel généré :</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px' }}>
            <li>
              <b>Période d'extraction inscrite en en-tête</b> : la plage de dates sélectionnée (ex: <i>Du JJ/MM/AAAA au JJ/MM/AAAA</i>) est explicitement imprimée dans le tableau de bord et dans le nom du fichier.
            </li>
            <li>
              <b>Colonne B « Étape Actuelle d’Avancement »</b> : catégorise précisément chaque ligne (ex: <i>« 5. Terminée sur site — Rapport transmis »</i>, <i>« 4. Travaux en cours »</i>, <i>« 6. Clôturée — Prête facturation »</i>, <i>« 7. Facturée »</i>, etc.).
            </li>
            <li>
              <b>Auto-filtres Excel & largeurs de colonnes ajustées</b> : filtres actifs par technicien, corps d’état ou client, sans colonnes tronquées.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
