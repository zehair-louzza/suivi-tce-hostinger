// Poste de Pilotage Opérationnel ANELEC — Aujourd'hui, Devis (22 col), Interventions (23 col), Planning Techniciens, Référentiels
import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  devisApi,
  interventionApi,
  referentielsApi,
  ReferentielsMap,
  DEFAULT_REFERENTIELS,
  formatCurrency,
  formatDateFR,
  parseTimeIntervalInput,
  STATUTS_COMMERCIAUX_DEVIS,
  TRAITEMENTS_ADMIN,
  PROCHAINES_ACTIONS_DEVIS,
  PRIORITES,
  TYPES_INTERVENTION,
  MODES_PLANIFICATION,
  STATUTS_OPERATIONNELS_INTERVENTION,
  STATUTS_FACTURE,
} from '../lib/api';
import { PlanningBoard } from '../components/PlanningBoard';

// ============================================================================
// BADGES SÉMANTIQUES MÉTIER (Distincts des couleurs de marque ANELEC)
// ============================================================================

function AlerteBadge({ alerte, explication }: { alerte?: string; explication?: string }) {
  if (!alerte) return null;
  let cls = 'alerte-suivre';
  if (alerte === 'Relance en retard' || alerte === 'Réponse en retard' || alerte === 'En retard') {
    cls = 'alerte-retard';
  } else if (alerte === 'Aujourd’hui') {
    cls = 'alerte-aujourdhui';
  } else if (alerte === 'Traité') {
    cls = 'alerte-traite';
  }
  return (
    <span className={`badge-alerte ${cls}`} title={explication || alerte}>
      {alerte === 'Traité' ? '✓ ' : alerte.includes('retard') ? '⚠️ ' : alerte === 'Aujourd’hui' ? '📅 ' : '• '}
      {alerte}
    </span>
  );
}

function PrioriteBadge({ priorite }: { priorite?: string | null }) {
  const p = priorite || 'Normale';
  const cls =
    p === 'Urgente'
      ? 'prio-urgente'
      : p === 'Haute'
      ? 'prio-haute'
      : p === 'Basse'
      ? 'prio-basse'
      : 'prio-normale';
  return <span className={`badge-priorite ${cls}`}>{p}</span>;
}

function StatutCommercialBadge({ statut }: { statut?: string | null }) {
  const s = statut || 'À préparer';
  let cls = 'sc-prepare';
  if (s === 'Accepté') cls = 'sc-accepte';
  else if (s === 'Envoyé au client' || s === 'En négociation') cls = 'sc-envoye';
  else if (s === 'Refusé' || s === 'Annulé' || s === 'Expiré') cls = 'sc-refuse';
  return <span className={`badge-statut-comm ${cls}`}>{s}</span>;
}

function TraitementBadge({ traitement }: { traitement?: string | null }) {
  const t = traitement || 'À traiter';
  let cls = 'tr-a-traiter';
  if (t === 'Bloqué') cls = 'tr-bloque';
  else if (t.startsWith('En attente')) cls = 'tr-attente';
  else if (t === 'En cours de traitement') cls = 'tr-encours';
  else if (t === 'Traité' || t === 'Classé sans suite') cls = 'tr-traite';
  return <span className={`badge-traitement ${cls}`}>{t}</span>;
}

function StatutOpBadge({ statut }: { statut?: string | null }) {
  const s = statut || 'À planifier';
  let cls = 'sop-planifier';
  if (s === 'Clôturée') cls = 'sop-cloturee';
  else if (s === 'Terminée - à valider') cls = 'sop-valider';
  else if (s === 'Suspendue' || s === 'Annulée') cls = 'sop-suspendue';
  else if (['En cours', 'Sur site', 'En route'].includes(s)) cls = 'sop-encours';
  else if (['Planifiée', 'Affectée'].includes(s)) cls = 'sop-planifiee';
  return <span className={`badge-statut-op ${cls}`}>{s}</span>;
}

// ============================================================================
// COMPOSANT PRINCIPAL : DASHBOARD / POSTE DE PILOTAGE ANELEC
// ============================================================================

export function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const activeSpace: 'aujourdhui' | 'devis' | 'interventions' | 'planning' | 'referentiels' =
    location.pathname === '/devis'
      ? 'devis'
      : location.pathname === '/interventions'
      ? 'interventions'
      : location.pathname === '/planning'
      ? 'planning'
      : location.pathname === '/referentiels'
      ? 'referentiels'
      : 'aujourdhui';

  // Filtres Devis
  const [devisSearch, setDevisSearch] = useState('');
  const [devisSavedFilter, setDevisSavedFilter] = useState<
    'ALL' | 'A_CHIFFRER' | 'RELANCES_RETARD' | 'VISITES' | 'BLOQUES' | 'ACCEPTES'
  >('ALL');
  const [devisResponsableFilter, setDevisResponsableFilter] = useState('ALL');
  const [devisCorpsEtatFilter, setDevisCorpsEtatFilter] = useState('ALL');

  // Filtres Interventions
  const [intervSearch, setIntervSearch] = useState('');
  const [intervSavedFilter, setIntervSavedFilter] = useState<
    'ALL' | 'A_PLANIFIER' | 'VISITES_DEVIS' | 'BLOQUEES' | 'A_VALIDER' | 'NON_FACTUREES'
  >('ALL');
  const [intervTechFilter, setIntervTechFilter] = useState('ALL');
  const [intervCorpsEtatFilter, setIntervCorpsEtatFilter] = useState('ALL');

  // Fiches latérales (Drawers) & Modales de création
  const [selectedDevisId, setSelectedDevisId] = useState<number | null>(null);
  const [selectedIntervId, setSelectedIntervId] = useState<number | null>(null);
  const [isCreatingDevis, setIsCreatingDevis] = useState(false);
  const [isCreatingInterv, setIsCreatingInterv] = useState(false);

  // Exception de clôture tracée (règle de validation progressive ANELEC)
  const [clotureExceptionConfirmed, setClotureExceptionConfirmed] = useState(false);

  // Référentiels : ajout d'entrée
  const [newRefValue, setNewRefValue] = useState<Record<string, string>>({});

  // Queries
  const { data: devisList = [], isLoading: devisLoading } = useQuery({
    queryKey: ['devis', 'list'],
    queryFn: () => devisApi.list({ limit: 250 }).then((r) => r.data.data),
  });

  const { data: intervList = [], isLoading: intervLoading } = useQuery({
    queryKey: ['interventions', 'list'],
    queryFn: () => interventionApi.list({ limit: 300 }).then((r) => r.data.data),
  });

  const { data: referentiels = DEFAULT_REFERENTIELS } = useQuery({
    queryKey: ['referentiels'],
    queryFn: () => referentielsApi.getAll().then((r) => r.data.data),
  });

  const selectedDevis = useMemo(
    () => devisList.find((d) => d.id === selectedDevisId) || null,
    [devisList, selectedDevisId]
  );

  const selectedInterv = useMemo(
    () => intervList.find((i) => i.id === selectedIntervId) || null,
    [intervList, selectedIntervId]
  );

  // Mutations
  const createDevisMutation = useMutation({
    mutationFn: (payload: any) => devisApi.create(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      toast.success('Devis créé avec succès');
      setIsCreatingDevis(false);
      setSelectedDevisId(res.data.data.id);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur lors de la création du devis'),
  });

  const updateDevisMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => devisApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      toast.success('Fiche Devis enregistrée');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur lors de la mise à jour'),
  });

  const deleteDevisMutation = useMutation({
    mutationFn: (id: number) => devisApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      toast.success('Devis supprimé');
      setSelectedDevisId(null);
    },
  });

  const convertDevisMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => devisApi.convert(id, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      toast.success(res.data.message || 'Mission créée et liée au devis !');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur lors de la création liée'),
  });

  const createIntervMutation = useMutation({
    mutationFn: (payload: any) => interventionApi.create(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      toast.success('Intervention créée avec succès');
      setIsCreatingInterv(false);
      setSelectedIntervId(res.data.data.id);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur lors de la création'),
  });

  const updateIntervMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => interventionApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      queryClient.invalidateQueries({ queryKey: ['devis'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur lors de la mise à jour'),
  });

  const deleteIntervMutation = useMutation({
    mutationFn: (id: number) => interventionApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      toast.success('Intervention supprimée');
      setSelectedIntervId(null);
    },
  });

  const updateRefMutation = useMutation({
    mutationFn: ({ categorie, valeurs }: { categorie: keyof ReferentielsMap; valeurs: string[] }) =>
      referentielsApi.updateCategory(categorie, valeurs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referentiels'] });
      toast.success('Liste métier ANELEC mise à jour');
    },
  });

  // ============================================================================
  // VUES CALCULÉES POUR L'ESPACE « AUJOURD'HUI » (6 COMPTEURS + FILES D'ACTIONS)
  // ============================================================================

  const sixCounters = useMemo(() => {
    const devisATraiter = devisList.filter(
      (d) =>
        d.traitement === 'À traiter' ||
        d.statutCommercial === 'À préparer' ||
        d.statutCommercial === 'En préparation'
    ).length;
    const devisBloques = devisList.filter((d) => d.traitement === 'Bloqué').length;
    const devisAcceptes = devisList.filter((d) => d.statutCommercial === 'Accepté').length;

    const intervATraiter = intervList.filter(
      (i) =>
        i.traitement === 'À traiter' ||
        ['Nouvelle demande', 'À planifier'].includes(i.statutOperationnel)
    ).length;
    const intervBloquees = intervList.filter(
      (i) => i.traitement === 'Bloqué' || i.statutOperationnel === 'Suspendue' || Boolean(i.motifBlocage)
    ).length;
    const intervCloturees = intervList.filter((i) => i.statutOperationnel === 'Clôturée').length;

    return {
      devisATraiter,
      devisBloques,
      devisAcceptes,
      intervATraiter,
      intervBloquees,
      intervCloturees,
    };
  }, [devisList, intervList]);

  const todayActionQueues = useMemo(() => {
    // 1. Relances arrivées à échéance & réponses en retard
    const relancesEchues = devisList.filter(
      (d) =>
        d.computed?.alerte === 'Relance en retard' ||
        d.computed?.alerte === 'Réponse en retard' ||
        d.prochaineAction === 'Relancer le client'
    );

    // 2. Devis à chiffrer ou à valider
    const devisAChiffrer = devisList.filter(
      (d) =>
        ['À préparer', 'En préparation', 'À valider en interne'].includes(d.statutCommercial) ||
        ['Chiffrer', 'Faire valider'].includes(d.prochaineAction || '')
    );

    // 3. Interventions & Visites Devis à affecter ou à planifier
    const aPlanifier = intervList.filter(
      (i) =>
        (!i.datePlanifiee || !i.entreprise || i.statutOperationnel === 'À planifier') &&
        !['Clôturée', 'Annulée'].includes(i.statutOperationnel)
    );

    // 4. Dossiers bloqués (Devis + Interventions)
    const dossiersBloques = [
      ...devisList
        .filter((d) => d.traitement === 'Bloqué')
        .map((d) => ({ kind: 'devis' as const, item: d })),
      ...intervList
        .filter((i) => i.traitement === 'Bloqué' || i.statutOperationnel === 'Suspendue' || Boolean(i.motifBlocage))
        .map((i) => ({ kind: 'intervention' as const, item: i })),
    ];

    // 5. Travaux terminés à valider
    const travauxAValider = intervList.filter((i) => i.statutOperationnel === 'Terminée - à valider');

    // 6. Interventions clôturées mais non facturées
    const clotureesNonFacturees = intervList.filter(
      (i) => i.statutOperationnel === 'Clôturée' && !i.isVisiteDevis && i.statutFacture !== 'Facturée'
    );

    // 7. Alertes de qualité des données (séparées des retards !)
    const qualiteAlerts: Array<{ ref: string; client: string; message: string; onClick: () => void }> = [];
    for (const d of devisList) {
      for (const msg of d.computed?.qualiteAlertes || []) {
        qualiteAlerts.push({
          ref: d.reference || `DEV-${d.id}`,
          client: d.client,
          message: msg,
          onClick: () => setSelectedDevisId(d.id),
        });
      }
    }
    for (const i of intervList) {
      for (const msg of i.computed?.qualiteAlertes || []) {
        qualiteAlerts.push({
          ref: i.reference || `INT-${i.id}`,
          client: i.client || i.chantier,
          message: msg,
          onClick: () => setSelectedIntervId(i.id),
        });
      }
    }

    return {
      relancesEchues,
      devisAChiffrer,
      aPlanifier,
      dossiersBloques,
      travauxAValider,
      clotureesNonFacturees,
      qualiteAlerts,
    };
  }, [devisList, intervList]);

  // ============================================================================
  // FILTRAGE DES TABLES DE SYNTHÈSE (DEVIS & INTERVENTIONS)
  // ============================================================================

  const filteredDevis = useMemo(() => {
    return devisList.filter((d) => {
      if (devisSavedFilter === 'A_CHIFFRER') {
        if (!['À préparer', 'En préparation', 'À valider en interne'].includes(d.statutCommercial)) return false;
      } else if (devisSavedFilter === 'RELANCES_RETARD') {
        if (d.computed?.alerte !== 'Relance en retard' && d.computed?.alerte !== 'Réponse en retard') return false;
      } else if (devisSavedFilter === 'VISITES') {
        if (!d.visiteNecessaire && d.traitement !== 'En attente technicien') return false;
      } else if (devisSavedFilter === 'BLOQUES') {
        if (d.traitement !== 'Bloqué') return false;
      } else if (devisSavedFilter === 'ACCEPTES') {
        if (d.statutCommercial !== 'Accepté') return false;
      }

      if (devisResponsableFilter !== 'ALL' && d.responsable !== devisResponsableFilter) return false;
      if (devisCorpsEtatFilter !== 'ALL' && d.corpsEtat !== devisCorpsEtatFilter) return false;

      if (devisSearch.trim()) {
        const q = devisSearch.toLowerCase();
        const hay = `${d.reference || ''} ${d.client} ${d.site || ''} ${d.objet || ''} ${d.corpsEtat || ''} ${
          d.responsable || ''
        } ${d.statutCommercial} ${d.traitement || ''} ${d.notes || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [devisList, devisSavedFilter, devisResponsableFilter, devisCorpsEtatFilter, devisSearch]);

  const filteredInterventions = useMemo(() => {
    return intervList.filter((i) => {
      if (intervSavedFilter === 'A_PLANIFIER') {
        if (i.datePlanifiee && i.entreprise && i.statutOperationnel !== 'À planifier') return false;
      } else if (intervSavedFilter === 'VISITES_DEVIS') {
        if (!i.isVisiteDevis) return false;
      } else if (intervSavedFilter === 'BLOQUEES') {
        if (i.traitement !== 'Bloqué' && i.statutOperationnel !== 'Suspendue' && !i.motifBlocage) return false;
      } else if (intervSavedFilter === 'A_VALIDER') {
        if (i.statutOperationnel !== 'Terminée - à valider') return false;
      } else if (intervSavedFilter === 'NON_FACTUREES') {
        if (i.statutOperationnel !== 'Clôturée' || i.statutFacture === 'Facturée' || i.isVisiteDevis) return false;
      }

      if (intervTechFilter !== 'ALL' && i.entreprise !== intervTechFilter) return false;
      if (intervCorpsEtatFilter !== 'ALL' && i.corpsEtat !== intervCorpsEtatFilter) return false;

      if (intervSearch.trim()) {
        const q = intervSearch.toLowerCase();
        const hay = `${i.reference || ''} ${i.client || ''} ${i.chantier} ${i.objet || ''} ${i.entreprise || ''} ${
          i.corpsEtat || ''
        } ${i.statutOperationnel} ${i.motifBlocage || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [intervList, intervSavedFilter, intervTechFilter, intervCorpsEtatFilter, intervSearch]);

  // ============================================================================
  // SOUMISSION DES FICHES DEVIS (22 COLONNES) & INTERVENTIONS (23 COLONNES)
  // ============================================================================

  const handleSaveDevisDrawer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDevis) return;
    const fd = new FormData(e.currentTarget);
    const data: Record<string, any> = Object.fromEntries(fd.entries());
    data.visiteNecessaire = fd.get('visiteNecessaire') === 'on';

    // Validation progressive avant envoi au client
    if (
      ['Envoyé au client', 'Accepté'].includes(String(data.statutCommercial)) &&
      (!data.amount || String(data.amount).trim() === '')
    ) {
      toast('Attention : Ce devis est marqué envoyé/accepté sans montant HT renseigné.', { icon: '⚠️' });
    }

    await updateDevisMutation.mutateAsync({ id: selectedDevis.id, data });
  };

  const handleSaveIntervDrawer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedInterv) return;
    const fd = new FormData(e.currentTarget);
    const data: Record<string, any> = Object.fromEntries(fd.entries());
    data.isVisiteDevis = fd.get('isVisiteDevis') === 'on';

    // Validation progressive avant clôture : exiger résultat technique + compte rendu sauf exception tracée
    if (
      data.statutOperationnel === 'Clôturée' &&
      (!String(data.resultatTechnique || '').trim() || !String(data.compteRendu || '').trim())
    ) {
      if (!clotureExceptionConfirmed) {
        toast.error(
          'Avant clôture, veuillez renseigner le Résultat technique et le Compte rendu (ou cochez « Exception de clôture tracée »).'
        );
        return;
      }
    }

    await updateIntervMutation.mutateAsync({ id: selectedInterv.id, data });
    toast.success('Fiche Intervention enregistrée');
    setClotureExceptionConfirmed(false);
  };

  return (
    <div className="anelec-cockpit">
      {/* ======================================================================
          BARRE DES 6 COMPTEURS OFFICIELS DU CLASSEUR ANELEC (TOUJOURS VISIBLE)
          ====================================================================== */}
      <section className="six-counters-strip" aria-label="Les 6 compteurs métier ANELEC">
        <div
          className="kpi-card kpi-devis-traiter"
          onClick={() => {
            setDevisSavedFilter('A_CHIFFRER');
            navigate('/devis');
          }}
        >
          <span className="kpi-label">Devis à traiter</span>
          <strong className="kpi-value">{sixCounters.devisATraiter}</strong>
          <span className="kpi-sub">À chiffrer / préparer</span>
        </div>

        <div
          className="kpi-card kpi-devis-bloques"
          onClick={() => {
            setDevisSavedFilter('BLOQUES');
            navigate('/devis');
          }}
        >
          <span className="kpi-label">Devis bloqués</span>
          <strong className="kpi-value">{sixCounters.devisBloques}</strong>
          <span className="kpi-sub">Action requise</span>
        </div>

        <div
          className="kpi-card kpi-devis-acceptes"
          onClick={() => {
            setDevisSavedFilter('ACCEPTES');
            navigate('/devis');
          }}
        >
          <span className="kpi-label">Devis acceptés</span>
          <strong className="kpi-value">{sixCounters.devisAcceptes}</strong>
          <span className="kpi-sub">Accords clients</span>
        </div>

        <div
          className="kpi-card kpi-interv-traiter"
          onClick={() => {
            setIntervSavedFilter('A_PLANIFIER');
            navigate('/interventions');
          }}
        >
          <span className="kpi-label">Interventions à traiter</span>
          <strong className="kpi-value">{sixCounters.intervATraiter}</strong>
          <span className="kpi-sub">À affecter / planifier</span>
        </div>

        <div
          className="kpi-card kpi-interv-bloquees"
          onClick={() => {
            setIntervSavedFilter('BLOQUEES');
            navigate('/interventions');
          }}
        >
          <span className="kpi-label">Interventions bloquées</span>
          <strong className="kpi-value">{sixCounters.intervBloquees}</strong>
          <span className="kpi-sub">Matériel / accès / attente</span>
        </div>

        <div
          className="kpi-card kpi-interv-cloturees"
          onClick={() => {
            setIntervSavedFilter('ALL');
            navigate('/interventions');
          }}
        >
          <span className="kpi-label">Interventions clôturées</span>
          <strong className="kpi-value">{sixCounters.intervCloturees}</strong>
          <span className="kpi-sub">Dossiers terminés</span>
        </div>
      </section>

      {/* ======================================================================
          ESPACE 1 : « AUJOURD'HUI » (POSTE DE PILOTAGE QUOTIDIEN)
          ====================================================================== */}
      {activeSpace === 'aujourdhui' && (
        <div className="today-workspace">
          <div className="today-top-cta">
            <div>
              <h2 className="section-heading">File d’actions prioritaires — « À faire aujourd’hui »</h2>
              <p className="section-subheading">
                Où en est chaque dossier ? Qu’est-ce qui le bloque ? Qui doit faire quoi, et pour quand ?
              </p>
            </div>
            <div className="today-quick-buttons">
              <button type="button" className="btn btn-primary" onClick={() => setIsCreatingDevis(true)}>
                + Nouveau Devis
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setIsCreatingInterv(true)}>
                + Nouvelle Intervention directe
              </button>
              <button type="button" className="btn btn-anelec-green" onClick={() => navigate('/planning')}>
                🗓️ Ouvrir le Planning Techniciens
              </button>
            </div>
          </div>

          <div className="today-queues-grid">
            {/* File 1 : Relances arrivées à échéance */}
            <div className="action-queue-card urgent-border">
              <div className="queue-header">
                <h3>🔔 Relances & réponses arrivées à échéance</h3>
                <span className="queue-badge danger">{todayActionQueues.relancesEchues.length}</span>
              </div>
              <div className="queue-items">
                {todayActionQueues.relancesEchues.length === 0 ? (
                  <p className="queue-empty">Aucune relance en retard aujourd’hui.</p>
                ) : (
                  todayActionQueues.relancesEchues.map((d) => (
                    <div key={d.id} className="action-line-item" onClick={() => setSelectedDevisId(d.id)}>
                      <div className="action-line-main">
                        <strong>{d.prochaineAction || 'Relancer le client'}</strong> — dossier{' '}
                        <span className="mono-ref">{d.reference}</span> ({d.client}) — responsable :{' '}
                        <strong>{d.responsable || 'Non assigné'}</strong>
                      </div>
                      <div className="action-line-meta">
                        <span className="text-danger">{d.computed?.alerteExplication}</span>
                        <span>Montant : {formatCurrency(d.amount)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* File 2 : Interventions & Visites Devis à affecter ou planifier */}
            <div className="action-queue-card">
              <div className="queue-header">
                <h3>🗓️ Interventions & Visites Devis à planifier</h3>
                <span className="queue-badge warning">{todayActionQueues.aPlanifier.length}</span>
              </div>
              <div className="queue-items">
                {todayActionQueues.aPlanifier.length === 0 ? (
                  <p className="queue-empty">Toutes les missions sont planifiées.</p>
                ) : (
                  todayActionQueues.aPlanifier.map((i) => (
                    <div key={i.id} className="action-line-item" onClick={() => setSelectedIntervId(i.id)}>
                      <div className="action-line-main">
                        <strong>{i.isVisiteDevis ? '🟣 Planifier visite devis' : '🔧 Affecter / planifier'}</strong> —{' '}
                        <span className="mono-ref">{i.reference}</span> ({i.client || i.chantier})
                      </div>
                      <div className="action-line-meta">
                        <span>Technicien : {i.entreprise || 'À affecter'}</span>
                        <button
                          type="button"
                          className="btn-link-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/planning');
                          }}
                        >
                          Placer au planning →
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* File 3 : Devis à chiffrer ou valider */}
            <div className="action-queue-card">
              <div className="queue-header">
                <h3>📐 Devis à chiffrer ou à valider en interne</h3>
                <span className="queue-badge info">{todayActionQueues.devisAChiffrer.length}</span>
              </div>
              <div className="queue-items">
                {todayActionQueues.devisAChiffrer.map((d) => (
                  <div key={d.id} className="action-line-item" onClick={() => setSelectedDevisId(d.id)}>
                    <div className="action-line-main">
                      <strong>{d.prochaineAction || 'Chiffrer'}</strong> —{' '}
                      <span className="mono-ref">{d.reference}</span> ({d.client} • {d.site || 'Site'}) — responsable :{' '}
                      <strong>{d.responsable || 'À assigner'}</strong>
                    </div>
                    <div className="action-line-meta">
                      <span>Statut : {d.statutCommercial}</span>
                      <span>{d.visiteNecessaire ? `🟣 Visite : ${d.visiteStatut}` : formatCurrency(d.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* File 4 : Dossiers bloqués */}
            <div className="action-queue-card urgent-border">
              <div className="queue-header">
                <h3>⛔ Dossiers bloqués (Devis & Interventions)</h3>
                <span className="queue-badge danger">{todayActionQueues.dossiersBloques.length}</span>
              </div>
              <div className="queue-items">
                {todayActionQueues.dossiersBloques.map((entry, idx) =>
                  entry.kind === 'devis' ? (
                    <div
                      key={`b-d-${idx}`}
                      className="action-line-item"
                      onClick={() => setSelectedDevisId(entry.item.id)}
                    >
                      <div className="action-line-main">
                        <strong>Débloquer devis</strong> — <span className="mono-ref">{entry.item.reference}</span> (
                        {entry.item.client}) — responsable : <strong>{entry.item.responsable || '—'}</strong>
                      </div>
                      <div className="action-line-meta">
                        <span className="text-danger">{entry.item.notes || 'En attente de déblocage'}</span>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={`b-i-${idx}`}
                      className="action-line-item"
                      onClick={() => setSelectedIntervId(entry.item.id)}
                    >
                      <div className="action-line-main">
                        <strong>Intervention bloquée</strong> — <span className="mono-ref">{entry.item.reference}</span>{' '}
                        ({entry.item.chantier}) — technicien : <strong>{entry.item.entreprise || '—'}</strong>
                      </div>
                      <div className="action-line-meta">
                        <span className="text-danger">
                          Motif : {entry.item.motifBlocage || 'Motif à préciser'}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* File 5 : Travaux terminés à valider */}
            <div className="action-queue-card">
              <div className="queue-header">
                <h3>✅ Travaux terminés — Validation technique</h3>
                <span className="queue-badge success">{todayActionQueues.travauxAValider.length}</span>
              </div>
              <div className="queue-items">
                {todayActionQueues.travauxAValider.length === 0 ? (
                  <p className="queue-empty">Aucune intervention en attente de validation technique.</p>
                ) : (
                  todayActionQueues.travauxAValider.map((i) => (
                    <div key={i.id} className="action-line-item" onClick={() => setSelectedIntervId(i.id)}>
                      <div className="action-line-main">
                        <strong>Valider le compte rendu</strong> — <span className="mono-ref">{i.reference}</span> (
                        {i.client} • {i.chantier}) — réalisé par <strong>{i.entreprise || '—'}</strong>
                      </div>
                      <div className="action-line-meta">
                        <span>Résultat : {i.resultatTechnique || 'À renseigner'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* File 6 : Interventions clôturées mais non facturées */}
            <div className="action-queue-card">
              <div className="queue-header">
                <h3>💶 Interventions clôturées mais non facturées</h3>
                <span className="queue-badge warning">{todayActionQueues.clotureesNonFacturees.length}</span>
              </div>
              <div className="queue-items">
                {todayActionQueues.clotureesNonFacturees.length === 0 ? (
                  <p className="queue-empty">Toutes les interventions clôturées sont facturées.</p>
                ) : (
                  todayActionQueues.clotureesNonFacturees.map((i) => (
                    <div key={i.id} className="action-line-item" onClick={() => setSelectedIntervId(i.id)}>
                      <div className="action-line-main">
                        <strong>Émettre la facture</strong> — <span className="mono-ref">{i.reference}</span> (
                        {i.client} • {i.chantier})
                      </div>
                      <div className="action-line-meta">
                        <span>Montant : {formatCurrency(i.amount)}</span>
                        <span className="text-warning">Statut : Non facturée</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Section séparée : Contrôle Qualité des Données (séparé des retards !) */}
          {todayActionQueues.qualiteAlerts.length > 0 && (
            <div className="quality-alerts-box">
              <div className="quality-header">
                <h4>🔎 Contrôle qualité des dossiers (affiché séparément des retards opérationnels)</h4>
                <span>{todayActionQueues.qualiteAlerts.length} point(s) d’attention</span>
              </div>
              <div className="quality-Chips">
                {todayActionQueues.qualiteAlerts.map((qa, idx) => (
                  <button key={idx} type="button" className="quality-chip" onClick={qa.onClick}>
                    <strong>{qa.ref}</strong> ({qa.client}) : {qa.message}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================================
          ESPACE 2 : « DEVIS » (TABLE DE SYNTHÈSE 8 COLONNES + FICHE 22 COLONNES)
          ====================================================================== */}
      {activeSpace === 'devis' && (
        <section className="panel">
          <div className="panel-header-modern">
            <div>
              <h2 className="panel-title">DEVIS — Pilotage commercial & relances</h2>
              <p className="panel-subtitle">
                Cliquez sur une ligne pour ouvrir la fiche complète (22 colonnes ANELEC, visites techniques & interventions liées).
              </p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setIsCreatingDevis(true)}>
              + Nouveau Devis
            </button>
          </div>

          {/* Filtres enregistrés + Recherche */}
          <div className="saved-filters-bar">
            <div className="saved-pills">
              {[
                { id: 'ALL', label: `Tous (${devisList.length})` },
                { id: 'A_CHIFFRER', label: '📐 À chiffrer / valider' },
                { id: 'RELANCES_RETARD', label: '🔔 Relances en retard' },
                { id: 'VISITES', label: '🟣 Avec visite technique' },
                { id: 'BLOQUES', label: '⛔ Bloqués' },
                { id: 'ACCEPTES', label: '✅ Acceptés' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`filter-pill-btn ${devisSavedFilter === f.id ? 'active' : ''}`}
                  onClick={() => setDevisSavedFilter(f.id as any)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="filter-inputs-right">
              <select
                className="select select-sm"
                value={devisResponsableFilter}
                onChange={(e) => setDevisResponsableFilter(e.target.value)}
              >
                <option value="ALL">👤 Tous responsables</option>
                {referentiels.responsables.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <select
                className="select select-sm"
                value={devisCorpsEtatFilter}
                onChange={(e) => setDevisCorpsEtatFilter(e.target.value)}
              >
                <option value="ALL">🛠️ Tous corps d’état</option>
                {referentiels.corps_etat.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <input
                type="text"
                className="input input-sm"
                placeholder="Rechercher réf, client, site, objet..."
                value={devisSearch}
                onChange={(e) => setDevisSearch(e.target.value)}
                style={{ width: '240px' }}
              />
            </div>
          </div>

          {/* Table de synthèse (8 colonnes clés du document ANELEC) */}
          <div className="table-wrapper">
            <table className="data-table modern-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Client / Site</th>
                  <th>Objet & Corps d’état</th>
                  <th>Montant HT</th>
                  <th>Statut commercial</th>
                  <th>Traitement</th>
                  <th>Prochaine action / Resp.</th>
                  <th>Échéance / Alerte</th>
                </tr>
              </thead>
              <tbody>
                {devisLoading ? (
                  <tr>
                    <td colSpan={8} className="empty-cell">
                      Chargement des devis...
                    </td>
                  </tr>
                ) : filteredDevis.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-cell">
                      Aucun devis ne correspond à ces critères.
                    </td>
                  </tr>
                ) : (
                  filteredDevis.map((d) => (
                    <tr
                      key={d.id}
                      className={`clickable-row ${selectedDevisId === d.id ? 'selected-row' : ''}`}
                      onClick={() => setSelectedDevisId(d.id)}
                    >
                      <td>
                        <div className="mono-ref">{d.reference}</div>
                        <PrioriteBadge priorite={d.priorite} />
                      </td>
                      <td>
                        <div className="cell-primary-text">{d.client}</div>
                        <div className="cell-secondary-text">📍 {d.site || 'Site à préciser'}</div>
                      </td>
                      <td>
                        <div className="cell-primary-text">{d.objet || '—'}</div>
                        <div className="cell-tags-row">
                          <span className="metier-chip">{d.corpsEtat || 'TCE'}</span>
                          {d.visiteNecessaire && (
                            <span className="visite-chip">
                              🟣 Visite : {d.visiteTechnicien || 'À affecter'} ({d.visiteStatut || 'À planifier'})
                            </span>
                          )}
                          {(d.interventionsCount || 0) > 0 && (
                            <span className="linked-chip">🔗 {d.interventionsCount} interv.</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <strong className={d.amount === null ? 'text-muted' : ''}>
                          {formatCurrency(d.amount)}
                        </strong>
                        {d.computed?.joursOuverts !== null && d.computed?.joursOuverts !== undefined && (
                          <div className="cell-secondary-text">{d.computed.joursOuverts} j. ouverts</div>
                        )}
                      </td>
                      <td>
                        <StatutCommercialBadge statut={d.statutCommercial} />
                      </td>
                      <td>
                        <TraitementBadge traitement={d.traitement} />
                      </td>
                      <td>
                        <div className="cell-primary-text">{d.prochaineAction || 'Aucune'}</div>
                        <div className="cell-secondary-text">👤 {d.responsable || 'Non assigné'}</div>
                      </td>
                      <td>
                        <AlerteBadge
                          alerte={d.computed?.alerte}
                          explication={d.computed?.alerteExplication}
                        />
                        <div className="cell-secondary-text">
                          {d.dateRelance
                            ? `Relance : ${formatDateFR(d.dateRelance)}`
                            : d.echeance
                            ? `Limite : ${formatDateFR(d.echeance)}`
                            : '—'}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ======================================================================
          ESPACE 3 : « INTERVENTIONS » (TABLE 8 COLONNES + FICHE 23 COLONNES)
          ====================================================================== */}
      {activeSpace === 'interventions' && (
        <section className="panel">
          <div className="panel-header-modern">
            <div>
              <h2 className="panel-title">INTERVENTIONS — Préparation, exécution & facturation</h2>
              <p className="panel-subtitle">
                Création directe sans devis autorisée. Une intervention « À planifier » n’impose pas d’inventer une date.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-anelec-green" onClick={() => navigate('/planning')}>
                🗓️ Vue Planning Interactif
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setIsCreatingInterv(true)}>
                + Nouvelle Intervention
              </button>
            </div>
          </div>

          <div className="saved-filters-bar">
            <div className="saved-pills">
              {[
                { id: 'ALL', label: `Toutes (${intervList.length})` },
                { id: 'A_PLANIFIER', label: '🗓️ À planifier / affecter' },
                { id: 'VISITES_DEVIS', label: '🟣 Visites techniques Devis' },
                { id: 'BLOQUEES', label: '⛔ Bloquées / Suspendues' },
                { id: 'A_VALIDER', label: '✅ Terminées - à valider' },
                { id: 'NON_FACTUREES', label: '💶 Clôturées non facturées' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`filter-pill-btn ${intervSavedFilter === f.id ? 'active' : ''}`}
                  onClick={() => setIntervSavedFilter(f.id as any)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="filter-inputs-right">
              <select
                className="select select-sm"
                value={intervTechFilter}
                onChange={(e) => setIntervTechFilter(e.target.value)}
              >
                <option value="ALL">👷 Tous techniciens</option>
                {referentiels.techniciens.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <select
                className="select select-sm"
                value={intervCorpsEtatFilter}
                onChange={(e) => setIntervCorpsEtatFilter(e.target.value)}
              >
                <option value="ALL">🛠️ Tous corps d’état</option>
                {referentiels.corps_etat.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <input
                type="text"
                className="input input-sm"
                placeholder="Rechercher réf, site, client, panne..."
                value={intervSearch}
                onChange={(e) => setIntervSearch(e.target.value)}
                style={{ width: '240px' }}
              />
            </div>
          </div>

          <div className="table-wrapper">
            <table className="data-table modern-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Client / Site</th>
                  <th>Objet & Nature</th>
                  <th>Technicien</th>
                  <th>Date planifiée & Créneau</th>
                  <th>Statut opérationnel</th>
                  <th>Blocage / Résultat</th>
                  <th>Alerte & Facturation</th>
                </tr>
              </thead>
              <tbody>
                {intervLoading ? (
                  <tr>
                    <td colSpan={8} className="empty-cell">
                      Chargement des interventions...
                    </td>
                  </tr>
                ) : filteredInterventions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-cell">
                      Aucune intervention ne correspond à ces critères.
                    </td>
                  </tr>
                ) : (
                  filteredInterventions.map((i) => (
                    <tr
                      key={i.id}
                      className={`clickable-row ${selectedIntervId === i.id ? 'selected-row' : ''}`}
                      onClick={() => setSelectedIntervId(i.id)}
                    >
                      <td>
                        <div className="mono-ref">{i.reference}</div>
                        <PrioriteBadge priorite={i.priorite} />
                      </td>
                      <td>
                        <div className="cell-primary-text">{i.client || 'Intervention directe'}</div>
                        <div className="cell-secondary-text">📍 {i.chantier}</div>
                      </td>
                      <td>
                        <div className="cell-primary-text">{i.objet || i.chantier}</div>
                        <div className="cell-tags-row">
                          <span className="metier-chip">{i.corpsEtat || 'TCE'}</span>
                          <span className={i.isVisiteDevis ? 'visite-chip' : 'type-chip'}>
                            {i.isVisiteDevis ? '🟣 Visite Devis' : i.typeIntervention || 'Corrective'}
                          </span>
                          {i.refDevisTexte && <span className="linked-chip">🔗 {i.refDevisTexte}</span>}
                        </div>
                      </td>
                      <td>
                        {i.entreprise ? (
                          <span className="tech-pill">👷 {i.entreprise}</span>
                        ) : (
                          <span className="text-warning">À affecter</span>
                        )}
                      </td>
                      <td>
                        <div className="cell-primary-text">
                          {i.datePlanifiee ? formatDateFR(i.datePlanifiee) : 'Non planifiée'}
                        </div>
                        <div className="cell-secondary-text">
                          {i.heureDebut && i.heureFin
                            ? `🕒 ${i.heureDebut} – ${i.heureFin} (${i.computed?.dureeHeures || ''}h)`
                            : 'Créneau à définir'}
                        </div>
                      </td>
                      <td>
                        <StatutOpBadge statut={i.statutOperationnel} />
                        <div style={{ marginTop: '4px' }}>
                          <TraitementBadge traitement={i.traitement} />
                        </div>
                      </td>
                      <td>
                        {i.motifBlocage ? (
                          <span className="blocage-pill">⛔ {i.motifBlocage}</span>
                        ) : i.resultatTechnique ? (
                          <span className="resultat-pill">✓ {i.resultatTechnique}</span>
                        ) : (
                          <span className="cell-secondary-text">—</span>
                        )}
                      </td>
                      <td>
                        <AlerteBadge
                          alerte={i.computed?.alerteDelai}
                          explication={i.computed?.alerteExplication}
                        />
                        {!i.isVisiteDevis && (
                          <div className="cell-secondary-text">
                            {i.statutFacture === 'Facturée'
                              ? `💶 Facturée (${i.numeroFacture || 'Réf.'})`
                              : 'Non facturée'}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ======================================================================
          ESPACE 4 : « PLANNING TECHNICIENS » (SOURIS + CLAVIER)
          ====================================================================== */}
      {activeSpace === 'planning' && (
        <PlanningBoard
          interventions={intervList}
          devis={devisList}
          techniciens={referentiels.techniciens}
          corpsEtatList={referentiels.corps_etat}
          onUpdateIntervention={(id, data) => updateIntervMutation.mutateAsync({ id, data })}
          onCreateIntervention={(data) => createIntervMutation.mutateAsync(data)}
          onConvertDevis={(id, data) => convertDevisMutation.mutateAsync({ id, data })}
          onSelectIntervention={(i) => setSelectedIntervId(i.id)}
          onSelectDevis={(d) => setSelectedDevisId(d.id)}
        />
      )}

      {/* ======================================================================
          ESPACE 5 : « RÉFÉRENTIELS » (L'ONGLET LISTES ADMINISTRABLE)
          ====================================================================== */}
      {activeSpace === 'referentiels' && (
        <section className="panel">
          <div className="panel-header-modern">
            <div>
              <h2 className="panel-title">RÉFÉRENTIELS MÉTIER ANELEC (Listes de choix administrables)</h2>
              <p className="panel-subtitle">
                Personnalisez les listes de Techniciens, Responsables, Clients, Corps d’état, Motifs de blocage et Résultats techniques.
              </p>
            </div>
          </div>

          <div className="referentiels-grid">
            {(
              [
                { key: 'techniciens', title: '👷 Techniciens & Sous-traitants (Planning)' },
                { key: 'responsables', title: '👤 Responsables administratifs & commerciaux' },
                { key: 'clients', title: '🏢 Clients / Donneurs d’ordre' },
                { key: 'corps_etat', title: '🛠️ Corps d’état TCE' },
                { key: 'origines', title: '📥 Origines des demandes' },
                { key: 'motifs_blocage', title: '⛔ Motifs de blocage terrain' },
                { key: 'resultats_techniques', title: '✅ Résultats techniques (Clôture)' },
              ] as Array<{ key: keyof ReferentielsMap; title: string }>
            ).map(({ key, title }) => {
              const items = referentiels[key] || [];
              return (
                <div key={key} className="ref-card">
                  <div className="ref-card-header">
                    <h3>{title}</h3>
                    <span className="badge-count">{items.length}</span>
                  </div>
                  <div className="ref-tags-list">
                    {items.map((val) => (
                      <span key={val} className="ref-editable-tag">
                        {val}
                        <button
                          type="button"
                          title="Retirer de la liste"
                          onClick={() => {
                            const updated = items.filter((x) => x !== val);
                            updateRefMutation.mutate({ categorie: key, valeurs: updated });
                          }}
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                  <form
                    className="ref-add-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const v = (newRefValue[key] || '').trim();
                      if (!v || items.includes(v)) return;
                      updateRefMutation.mutate({ categorie: key, valeurs: [...items, v] });
                      setNewRefValue({ ...newRefValue, [key]: '' });
                    }}
                  >
                    <input
                      type="text"
                      className="input input-sm"
                      placeholder="Ajouter une valeur..."
                      value={newRefValue[key] || ''}
                      onChange={(e) => setNewRefValue({ ...newRefValue, [key]: e.target.value })}
                    />
                    <button type="submit" className="btn btn-primary btn-sm">
                      Ajouter
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ======================================================================
          TIROIR LATÉRAL (DRAWER) : FICHE COMPLÈTE DEVIS (22 COLONNES + DOSSIER)
          ====================================================================== */}
      {selectedDevis && (
        <div className="drawer-overlay" onClick={() => setSelectedDevisId(null)}>
          <aside className="dossier-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <div className="drawer-badges-top">
                  <span className="mono-ref">{selectedDevis.reference}</span>
                  <StatutCommercialBadge statut={selectedDevis.statutCommercial} />
                  <TraitementBadge traitement={selectedDevis.traitement} />
                  <AlerteBadge
                    alerte={selectedDevis.computed?.alerte}
                    explication={selectedDevis.computed?.alerteExplication}
                  />
                </div>
                <h2 className="drawer-title">
                  {selectedDevis.client} — {selectedDevis.site || 'Site à préciser'}
                </h2>
              </div>
              <button className="drawer-close" onClick={() => setSelectedDevisId(null)}>
                &times;
              </button>
            </div>

            {/* Explication de l'alerte calculée */}
            <div className="drawer-alert-banner">
              <div>
                <strong>Diagnostic automatique :</strong> {selectedDevis.computed?.alerteExplication}
                {selectedDevis.computed?.joursOuverts !== null && (
                  <span> • Ouvert depuis {selectedDevis.computed?.joursOuverts} jour(s)</span>
                )}
                {selectedDevis.computed?.dateExpiration && (
                  <span> • Expire le {formatDateFR(selectedDevis.computed.dateExpiration)}</span>
                )}
              </div>
              <div className="drawer-quick-links">
                <button
                  type="button"
                  className="btn btn-xs btn-visite"
                  onClick={() =>
                    convertDevisMutation.mutate({
                      id: selectedDevis.id,
                      data: {
                        mode: 'visite',
                        isVisiteDevis: true,
                        entreprise: selectedDevis.visiteTechnicien || referentiels.techniciens[0],
                        datePlanifiee: selectedDevis.visiteDate || undefined,
                        heureDebut: selectedDevis.visiteHeureDebut || '09:00',
                        heureFin: selectedDevis.visiteHeureFin || '10:30',
                      },
                    })
                  }
                >
                  🟣 + Créer Visite Technique au Planning
                </button>
                <button
                  type="button"
                  className="btn btn-xs btn-primary"
                  onClick={() =>
                    convertDevisMutation.mutate({
                      id: selectedDevis.id,
                      data: {
                        mode: 'travaux',
                        isVisiteDevis: false,
                        entreprise: referentiels.techniciens[0],
                      },
                    })
                  }
                >
                  🔧 + Créer Intervention Travaux liée
                </button>
              </div>
            </div>

            <form key={selectedDevis.id} className="drawer-body-form" onSubmit={handleSaveDevisDrawer}>
              {/* 1. Identification (Colonnes A, B, C, D, E, F) */}
              <fieldset className="drawer-section">
                <legend>1. Identification de la demande (Colonnes A à F)</legend>
                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">A. Réf. devis</label>
                    <input name="reference" className="input" defaultValue={selectedDevis.reference || ''} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">B. Client (Donneur d’ordre)</label>
                    <input
                      name="client"
                      list="list-clients"
                      className="input"
                      defaultValue={selectedDevis.client}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">F. Origine</label>
                    <select name="origine" className="select" defaultValue={selectedDevis.origine || "Donneur d'ordre"}>
                      {referentiels.origines.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">C. Site / Adresse d’exécution</label>
                    <input
                      name="site"
                      className="input"
                      placeholder="Ex: Agence Orléans, Supermarché Saran..."
                      defaultValue={selectedDevis.site || ''}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">E. Corps d’état</label>
                    <select
                      name="corpsEtat"
                      className="select"
                      defaultValue={selectedDevis.corpsEtat || 'Tous corps d’état'}
                    >
                      {referentiels.corps_etat.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">D. Objet / Travaux demandés</label>
                  <input name="objet" className="input" defaultValue={selectedDevis.objet || ''} />
                </div>
              </fieldset>

              {/* 2. Décision, Statut commercial, Traitement & Prochaine action (Colonnes J, K, O, Q, R) */}
              <fieldset className="drawer-section">
                <legend>2. Décision commerciale & Suivi administratif (Colonnes J, K, O, Q, R)</legend>
                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">J. Statut commercial du devis</label>
                    <select
                      name="statutCommercial"
                      className="select"
                      defaultValue={selectedDevis.statutCommercial}
                    >
                      {STATUTS_COMMERCIAUX_DEVIS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">K. Traitement administratif</label>
                    <select name="traitement" className="select" defaultValue={selectedDevis.traitement || 'À traiter'}>
                      {TRAITEMENTS_ADMIN.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">R. Priorité</label>
                    <select name="priorite" className="select" defaultValue={selectedDevis.priorite || 'Normale'}>
                      {PRIORITES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">O. Prochaine action attendue</label>
                    <select
                      name="prochaineAction"
                      className="select"
                      defaultValue={selectedDevis.prochaineAction || 'Chiffrer'}
                    >
                      {PROCHAINES_ACTIONS_DEVIS.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Q. Responsable du dossier</label>
                    <select name="responsable" className="select" defaultValue={selectedDevis.responsable || ''}>
                      <option value="">— Non assigné —</option>
                      {referentiels.responsables.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">P. Date de relance prévue</label>
                    <input type="date" name="dateRelance" className="input" defaultValue={selectedDevis.dateRelance || ''} />
                  </div>
                </div>
              </fieldset>

              {/* 3. Chiffrage & Calendrier commercial (Colonnes G, H, I, L, M, N, U) */}
              <fieldset className="drawer-section">
                <legend>3. Chiffrage & Calendrier commercial (Colonnes G, H, I, L, M, N, U)</legend>
                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">L. Montant HT (€) (vide = inconnu)</label>
                    <input
                      type="number"
                      step="0.01"
                      name="amount"
                      className="input"
                      placeholder="Non chiffré"
                      defaultValue={selectedDevis.amount ?? ''}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">M. Validité (jours)</label>
                    <input
                      type="number"
                      name="validiteJours"
                      className="input"
                      placeholder="Ex: 30"
                      defaultValue={selectedDevis.validiteJours ?? ''}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">N. Expiration calculée</label>
                    <input
                      className="input"
                      disabled
                      value={
                        selectedDevis.computed?.dateExpiration
                          ? formatDateFR(selectedDevis.computed.dateExpiration)
                          : 'Non applicable'
                      }
                    />
                  </div>
                </div>

                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">G. Date demande</label>
                    <input type="date" name="dateCreated" className="input" defaultValue={selectedDevis.dateCreated || ''} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">H. Date limite de réponse</label>
                    <input type="date" name="echeance" className="input" defaultValue={selectedDevis.echeance || ''} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">I. Date d’envoi au client</label>
                    <input type="date" name="dateEnvoi" className="input" defaultValue={selectedDevis.dateEnvoi || ''} />
                  </div>
                </div>
              </fieldset>

              {/* 4. Visite technique pour faire le devis (Synchronisée avec le Planning Techniciens !) */}
              <fieldset className="drawer-section highlight-visite-section">
                <legend>🟣 4. Visite technique sur site pour établir le devis (Auto-Planning)</legend>
                <label className="checkbox-inline-label">
                  <input
                    type="checkbox"
                    name="visiteNecessaire"
                    defaultChecked={Boolean(selectedDevis.visiteNecessaire)}
                  />
                  <span>
                    Ce devis nécessite le passage d’un technicien sur site (crée/met à jour automatiquement le créneau dans le Planning)
                  </span>
                </label>

                <div className="form-row-4" style={{ marginTop: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">Technicien visite</label>
                    <select
                      name="visiteTechnicien"
                      className="select"
                      defaultValue={selectedDevis.visiteTechnicien || ''}
                    >
                      <option value="">— À affecter —</option>
                      {referentiels.techniciens.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date visite</label>
                    <input type="date" name="visiteDate" className="input" defaultValue={selectedDevis.visiteDate || ''} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Heure début</label>
                    <input
                      type="time"
                      name="visiteHeureDebut"
                      className="input"
                      defaultValue={selectedDevis.visiteHeureDebut || '09:00'}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Heure fin</label>
                    <input
                      type="time"
                      name="visiteHeureFin"
                      className="input"
                      defaultValue={selectedDevis.visiteHeureFin || '10:30'}
                    />
                  </div>
                </div>
              </fieldset>

              {/* 5. Interventions liées & Commentaires (Colonnes S, T) */}
              <fieldset className="drawer-section">
                <legend>5. Interventions liées & Commentaires (Colonnes S et T)</legend>
                <div className="form-group">
                  <label className="form-label">S. Réf. intervention(s) liée(s)</label>
                  <input
                    name="refInterventionTexte"
                    className="input"
                    defaultValue={selectedDevis.refInterventionTexte || ''}
                  />
                </div>
                {(selectedDevis as any).interventions?.length > 0 && (
                  <div className="linked-items-box">
                    {(selectedDevis as any).interventions.map((li: any) => (
                      <button
                        key={li.id}
                        type="button"
                        className="linked-item-pill"
                        onClick={() => {
                          setSelectedDevisId(null);
                          setSelectedIntervId(li.id);
                        }}
                      >
                        🔗 {li.reference} • {li.isVisiteDevis ? '🟣 Visite Devis' : '🔧 Travaux'} •{' '}
                        {li.entreprise || 'À affecter'} ({formatDateFR(li.datePlanifiee)}) • {li.statutOperationnel}
                      </button>
                    ))}
                  </div>
                )}

                <div className="form-group" style={{ marginTop: '8px' }}>
                  <label className="form-label">T. Commentaires / Notes dossier</label>
                  <textarea name="notes" className="textarea" rows={3} defaultValue={selectedDevis.notes || ''} />
                </div>
              </fieldset>

              {/* 6. Historique horodaté du dossier */}
              <fieldset className="drawer-section">
                <legend>6. Historique & Traçabilité du dossier</legend>
                <div className="history-timeline">
                  {(selectedDevis.historique || []).length === 0 ? (
                    <p className="text-muted">Aucun événement enregistré.</p>
                  ) : (
                    (selectedDevis.historique || []).map((ev: any) => (
                      <div key={ev.id} className="history-event-row">
                        <span className="history-dot" />
                        <div>
                          <div className="history-action">
                            <strong>{ev.action}</strong> <span className="history-author">par {ev.auteur}</span>
                          </div>
                          {ev.details && <div className="history-details">{ev.details}</div>}
                          <div className="history-date">
                            {new Date(ev.date).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </fieldset>

              <div className="drawer-footer">
                <button
                  type="button"
                  className="btn btn-destructive"
                  onClick={() => {
                    if (confirm('Supprimer définitivement ce devis ?')) {
                      deleteDevisMutation.mutate(selectedDevis.id);
                    }
                  }}
                >
                  Supprimer
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setSelectedDevisId(null)}>
                    Fermer
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={updateDevisMutation.isPending}>
                    {updateDevisMutation.isPending ? 'Enregistrement...' : 'Enregistrer la fiche Devis'}
                  </button>
                </div>
              </div>
            </form>
          </aside>
        </div>
      )}

      {/* ======================================================================
          TIROIR LATÉRAL (DRAWER) : FICHE COMPLÈTE INTERVENTION (23 COLONNES)
          ====================================================================== */}
      {selectedInterv && (
        <div className="drawer-overlay" onClick={() => setSelectedIntervId(null)}>
          <aside className="dossier-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <div className="drawer-badges-top">
                  <span className="mono-ref">{selectedInterv.reference}</span>
                  <StatutOpBadge statut={selectedInterv.statutOperationnel} />
                  <TraitementBadge traitement={selectedInterv.traitement} />
                  <AlerteBadge
                    alerte={selectedInterv.computed?.alerteDelai}
                    explication={selectedInterv.computed?.alerteExplication}
                  />
                </div>
                <h2 className="drawer-title">
                  {selectedInterv.client || 'Client'} — {selectedInterv.chantier}
                </h2>
              </div>
              <button className="drawer-close" onClick={() => setSelectedIntervId(null)}>
                &times;
              </button>
            </div>

            <div className="drawer-alert-banner">
              <div>
                <strong>Suivi délai :</strong> {selectedInterv.computed?.alerteExplication}
                {selectedInterv.devisId && (
                  <button
                    type="button"
                    className="btn-link-sm"
                    style={{ marginLeft: '12px' }}
                    onClick={() => {
                      const dId = selectedInterv.devisId!;
                      setSelectedIntervId(null);
                      setSelectedDevisId(dId);
                    }}
                  >
                    🔗 Voir le Devis d’origine ({selectedInterv.refDevisTexte || `#${selectedInterv.devisId}`})
                  </button>
                )}
              </div>
              <button
                type="button"
                className="btn btn-xs btn-anelec-green"
                onClick={() => {
                  setSelectedIntervId(null);
                  navigate('/planning');
                }}
              >
                🗓️ Voir sur le Planning
              </button>
            </div>

            <form key={selectedInterv.id} className="drawer-body-form" onSubmit={handleSaveIntervDrawer}>
              {/* 1. Identification (Colonnes A, B, C, D, E, F, H) */}
              <fieldset className="drawer-section">
                <legend>1. Identification & Devis lié éventuel (Colonnes A à F, H)</legend>
                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">A. Réf. intervention</label>
                    <input name="reference" className="input" defaultValue={selectedInterv.reference || ''} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">B. Réf. devis lié (optionnel)</label>
                    <input name="refDevisTexte" className="input" defaultValue={selectedInterv.refDevisTexte || ''} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">F. Origine</label>
                    <select name="origine" className="select" defaultValue={selectedInterv.origine || "Donneur d'ordre"}>
                      {referentiels.origines.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">C. Client (Donneur d’ordre)</label>
                    <input
                      name="client"
                      list="list-clients"
                      className="input"
                      defaultValue={selectedInterv.client || ''}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">D. Site / Adresse d’intervention</label>
                    <input name="chantier" className="input" defaultValue={selectedInterv.chantier} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">H. Corps d’état</label>
                    <select
                      name="corpsEtat"
                      className="select"
                      defaultValue={selectedInterv.corpsEtat || 'Tous corps d’état'}
                    >
                      {referentiels.corps_etat.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">E. Objet / Panne / Travaux</label>
                  <input name="objet" className="input" defaultValue={selectedInterv.objet || ''} />
                </div>
              </fieldset>

              {/* 2. Nature, Mode de planification & Priorité séparés (Colonnes G, I) */}
              <fieldset className="drawer-section">
                <legend>2. Nature, Mode de planification & Priorité (Colonnes G et I séparées)</legend>
                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">G. Nature / Type d’intervention</label>
                    <select
                      name="typeIntervention"
                      className="select"
                      defaultValue={selectedInterv.typeIntervention || 'Corrective'}
                    >
                      {TYPES_INTERVENTION.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Mode de planification</label>
                    <select
                      name="modePlanification"
                      className="select"
                      defaultValue={selectedInterv.modePlanification || 'Planifiée'}
                    >
                      {MODES_PLANIFICATION.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">I. Priorité</label>
                    <select name="priorite" className="select" defaultValue={selectedInterv.priorite || 'Normale'}>
                      {PRIORITES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <label className="checkbox-inline-label" style={{ marginTop: '6px' }}>
                  <input
                    type="checkbox"
                    name="isVisiteDevis"
                    defaultChecked={Boolean(selectedInterv.isVisiteDevis)}
                  />
                  <span>🟣 Il s’agit d’une visite technique pour préparer un devis</span>
                </label>
              </fieldset>

              {/* 3. Affectation Technicien & Créneau Horaire Planning (Colonnes J, K, N, O, P, Q) */}
              <fieldset className="drawer-section">
                <legend>3. Affectation Technicien & Planning Horaire (Colonnes J, K, N, O, P, Q)</legend>
                <div className="form-row-4">
                  <div className="form-group">
                    <label className="form-label">N. Technicien / Sous-traitant</label>
                    <select name="entreprise" className="select" defaultValue={selectedInterv.entreprise || ''}>
                      <option value="">— À affecter —</option>
                      {referentiels.techniciens.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">K. Date planifiée (optionnelle)</label>
                    <input
                      type="date"
                      name="datePlanifiee"
                      className="input"
                      defaultValue={selectedInterv.datePlanifiee || ''}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Heure début</label>
                    <input
                      id="drawer-heure-debut"
                      type="time"
                      name="heureDebut"
                      className="input"
                      defaultValue={selectedInterv.heureDebut || ''}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Heure fin</label>
                    <input
                      id="drawer-heure-fin"
                      type="time"
                      name="heureFin"
                      className="input"
                      defaultValue={selectedInterv.heureFin || ''}
                    />
                  </div>
                </div>

                {/* Saisie rapide d'intervalle au clavier */}
                <div className="form-group">
                  <label className="form-label">
                    ⌨️ Saisie rapide d’intervalle au clavier (ex: <code>08:30-11:30</code>, <code>14h-17h</code>,{' '}
                    <code>matin</code>, <code>aprem</code>)
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Tapez un intervalle horaire puis Entrée..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const parsed = parseTimeIntervalInput(e.currentTarget.value);
                        if (parsed) {
                          const hd = document.getElementById('drawer-heure-debut') as HTMLInputElement | null;
                          const hf = document.getElementById('drawer-heure-fin') as HTMLInputElement | null;
                          if (hd) hd.value = parsed.heureDebut;
                          if (hf) hf.value = parsed.heureFin;
                          toast.success(`Créneau appliqué : ${parsed.heureDebut} - ${parsed.heureFin}`);
                        } else {
                          toast.error('Format invalide. Ex: 08:30-11:30 ou 14h-17h');
                        }
                      }
                    }}
                  />
                </div>

                <div className="form-row-4">
                  <div className="form-group">
                    <label className="form-label">J. Date demande</label>
                    <input
                      type="date"
                      name="dateDemande"
                      className="input"
                      defaultValue={selectedInterv.dateDemande || ''}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">O. Date début réelle</label>
                    <input
                      type="date"
                      name="dateDebut"
                      className="input"
                      defaultValue={selectedInterv.dateDebut || ''}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">P. Date fin réelle</label>
                    <input
                      type="date"
                      name="dateReelle"
                      className="input"
                      defaultValue={selectedInterv.dateReelle || ''}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Q. Échéance</label>
                    <input type="date" name="echeance" className="input" defaultValue={selectedInterv.echeance || ''} />
                  </div>
                </div>
              </fieldset>

              {/* 4. Avancement terrain, Blocage & Résultat technique (Colonnes L, M, S, T, W) */}
              <fieldset className="drawer-section">
                <legend>4. Avancement, Blocage & Compte rendu (Colonnes L, M, S, T, W)</legend>
                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">L. Statut opérationnel</label>
                    <select
                      name="statutOperationnel"
                      className="select"
                      defaultValue={selectedInterv.statutOperationnel}
                    >
                      {STATUTS_OPERATIONNELS_INTERVENTION.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">M. Traitement administratif</label>
                    <select
                      name="traitement"
                      className="select"
                      defaultValue={selectedInterv.traitement || 'À traiter'}
                    >
                      {TRAITEMENTS_ADMIN.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">T. Motif de blocage</label>
                    <select name="motifBlocage" className="select" defaultValue={selectedInterv.motifBlocage || ''}>
                      <option value="">— Aucun blocage —</option>
                      {referentiels.motifs_blocage.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">S. Résultat technique</label>
                  <input
                    name="resultatTechnique"
                    list="list-resultats"
                    className="input"
                    placeholder="Sélectionner ou saisir le résultat technique..."
                    defaultValue={selectedInterv.resultatTechnique || ''}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">W. Compte rendu / Actions restantes</label>
                  <textarea
                    name="compteRendu"
                    className="textarea"
                    rows={3}
                    placeholder="Travaux réalisés, réserves éventuelles, suite à donner..."
                    defaultValue={selectedInterv.compteRendu || ''}
                  />
                </div>

                <label className="checkbox-inline-label">
                  <input
                    type="checkbox"
                    checked={clotureExceptionConfirmed}
                    onChange={(e) => setClotureExceptionConfirmed(e.target.checked)}
                  />
                  <span>
                    Autoriser une procédure d’exception tracée si clôture sans compte rendu complet
                  </span>
                </label>
              </fieldset>

              {/* 5. Facturation (Colonnes U, V) — La facture n'indique pas un paiement ! */}
              <fieldset className="drawer-section">
                <legend>5. Suivi de facturation (Colonnes U et V — hors suivi d’encaissement)</legend>
                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">U. Numéro de facture (réf. externe)</label>
                    <input
                      name="numeroFacture"
                      className="input"
                      placeholder="Ex: FAC-2026-089"
                      defaultValue={selectedInterv.numeroFacture || ''}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">V. Statut facture</label>
                    <select
                      name="statutFacture"
                      className="select"
                      defaultValue={selectedInterv.statutFacture || 'Non facturée'}
                    >
                      {STATUTS_FACTURE.map((sf) => (
                        <option key={sf} value={sf}>
                          {sf}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Montant HT (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      name="amount"
                      className="input"
                      defaultValue={selectedInterv.amount ?? ''}
                    />
                  </div>
                </div>
              </fieldset>

              {/* 6. Historique */}
              <fieldset className="drawer-section">
                <legend>6. Historique & Traçabilité</legend>
                <div className="history-timeline">
                  {(selectedInterv.historique || []).map((ev: any) => (
                    <div key={ev.id} className="history-event-row">
                      <span className="history-dot" />
                      <div>
                        <div className="history-action">
                          <strong>{ev.action}</strong> <span className="history-author">par {ev.auteur}</span>
                        </div>
                        {ev.details && <div className="history-details">{ev.details}</div>}
                        <div className="history-date">
                          {new Date(ev.date).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </fieldset>

              <div className="drawer-footer">
                <button
                  type="button"
                  className="btn btn-destructive"
                  onClick={() => {
                    if (confirm('Supprimer définitivement cette intervention ?')) {
                      deleteIntervMutation.mutate(selectedInterv.id);
                    }
                  }}
                >
                  Supprimer
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setSelectedIntervId(null)}>
                    Fermer
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={updateIntervMutation.isPending}>
                    {updateIntervMutation.isPending ? 'Enregistrement...' : 'Enregistrer la fiche Intervention'}
                  </button>
                </div>
              </div>
            </form>
          </aside>
        </div>
      )}

      {/* ======================================================================
          MODALE CRÉATION PROGRESSIVE DEVIS (NE DEMANDE QUE CE QUI EST DISPONIBLE)
          ====================================================================== */}
      {isCreatingDevis && (
        <div className="modal-overlay" onClick={() => setIsCreatingDevis(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nouveau Devis (Saisie progressive ANELEC)</h2>
              <button className="modal-close" onClick={() => setIsCreatingDevis(false)}>
                &times;
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const payload: Record<string, any> = Object.fromEntries(fd.entries());
                payload.visiteNecessaire = fd.get('visiteNecessaire') === 'on';
                createDevisMutation.mutate(payload);
              }}
            >
              <div className="modal-body">
                <p className="progressive-hint">
                  💡 Saisie progressive : seuls les éléments connus à la réception sont nécessaires. Un montant vide reste « Non chiffré ».
                </p>
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Client / Donneur d’ordre</label>
                    <input
                      name="client"
                      list="list-clients"
                      className="input"
                      placeholder="Ex: EMALEC, GMS, C-Multi-Serv (ou laisser vide pour boîte de réception)"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Site / Adresse</label>
                    <input name="site" className="input" placeholder="Ex: Agence Orléans Centre" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Objet / Travaux demandés *</label>
                  <input
                    name="objet"
                    className="input"
                    placeholder="Ex: Remplacement armoire électrique / reprise CVC"
                    required
                  />
                </div>
                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">Corps d’état</label>
                    <select name="corpsEtat" className="select" defaultValue="Tous corps d’état">
                      {referentiels.corps_etat.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Origine</label>
                    <select name="origine" className="select" defaultValue="Donneur d'ordre">
                      {referentiels.origines.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Responsable</label>
                    <select name="responsable" className="select" defaultValue="Zehair">
                      <option value="">— Non assigné —</option>
                      {referentiels.responsables.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">Montant HT (€) (optionnel)</label>
                    <input type="number" step="0.01" name="amount" className="input" placeholder="Inconnu" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date limite réponse</label>
                    <input type="date" name="echeance" className="input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priorité</label>
                    <select name="priorite" className="select" defaultValue="Normale">
                      {PRIORITES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="highlight-visite-box">
                  <label className="checkbox-inline-label">
                    <input type="checkbox" name="visiteNecessaire" />
                    <span>
                      🟣 Programmer une visite technique d’un technicien pour faire ce devis (ajoute au Planning)
                    </span>
                  </label>
                  <div className="form-row-3" style={{ marginTop: '8px' }}>
                    <div className="form-group">
                      <label className="form-label">Technicien</label>
                      <select name="visiteTechnicien" className="select">
                        <option value="">— À affecter —</option>
                        {referentiels.techniciens.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Date visite (optionnelle)</label>
                      <input type="date" name="visiteDate" className="input" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Créneau horaire</label>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input type="time" name="visiteHeureDebut" className="input" defaultValue="09:00" />
                        <input type="time" name="visiteHeureFin" className="input" defaultValue="10:30" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setIsCreatingDevis(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={createDevisMutation.isPending}>
                  Créer le devis
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================
          MODALE CRÉATION INTERVENTION DIRECTE (SANS DEVIS OBLIGATOIRE)
          ====================================================================== */}
      {isCreatingInterv && (
        <div className="modal-overlay" onClick={() => setIsCreatingInterv(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nouvelle Intervention (Directe ou Planifiée)</h2>
              <button className="modal-close" onClick={() => setIsCreatingInterv(false)}>
                &times;
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const payload: Record<string, any> = Object.fromEntries(fd.entries());
                payload.isVisiteDevis = fd.get('isVisiteDevis') === 'on';
                createIntervMutation.mutate(payload);
              }}
            >
              <div className="modal-body">
                <p className="progressive-hint">
                  💡 Une demande « À planifier » peut être enregistrée sans date planifiée ni devis préalable.
                </p>
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Client (Donneur d’ordre)</label>
                    <input name="client" list="list-clients" className="input" placeholder="Ex: EMALEC, IPC..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Site / Adresse *</label>
                    <input
                      name="chantier"
                      className="input"
                      placeholder="Ex: Clinique de l'Archette — Olivet"
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Objet / Panne / Travaux *</label>
                  <input name="objet" className="input" placeholder="Ex: Fuite réseau ECS / Dépannage TGBT" required />
                </div>
                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">Nature d’intervention</label>
                    <select name="typeIntervention" className="select" defaultValue="Corrective">
                      {TYPES_INTERVENTION.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Corps d’état</label>
                    <select name="corpsEtat" className="select" defaultValue="Électricité">
                      {referentiels.corps_etat.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priorité</label>
                    <select name="priorite" className="select" defaultValue="Normale">
                      {PRIORITES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row-4">
                  <div className="form-group">
                    <label className="form-label">Technicien (optionnel)</label>
                    <select name="entreprise" className="select">
                      <option value="">— À affecter —</option>
                      {referentiels.techniciens.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date planifiée (optionnelle)</label>
                    <input type="date" name="datePlanifiee" className="input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Heure début</label>
                    <input type="time" name="heureDebut" className="input" defaultValue="08:30" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Heure fin</label>
                    <input type="time" name="heureFin" className="input" defaultValue="11:30" />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setIsCreatingInterv(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={createIntervMutation.isPending}>
                  Enregistrer l’intervention
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Datalists pour saisie libre + choix issus des référentiels */}
      <datalist id="list-clients">
        {referentiels.clients.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="list-resultats">
        {referentiels.resultats_techniques.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
    </div>
  );
}
