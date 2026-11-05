import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  devisApi,
  interventionApi,
  referentielsApi,
  Devis,
  Intervention,
  ReferentielsMap,
  DEFAULT_REFERENTIELS,
  STATUTS_COMMERCIAUX_DEVIS,
  TRAITEMENTS_ADMIN,
  PROCHAINES_ACTIONS_DEVIS,
  PRIORITES,
  TYPES_INTERVENTION,
  MODES_PLANIFICATION,
  STATUTS_OPERATIONNELS_INTERVENTION,
  STATUTS_FACTURE,
  formatCurrency,
  formatDateFR,
} from '../lib/api';
import { Layout, AppSection } from '../components/Layout';
import { PlanningBoard } from '../components/PlanningBoard';
import toast from 'react-hot-toast';

export function DashboardPage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const sectionFromPath = (pathname: string): AppSection => {
    if (pathname.startsWith('/planning')) return 'planning';
    if (pathname.startsWith('/devis')) return 'devis';
    if (pathname.startsWith('/interventions')) return 'interventions';
    if (pathname.startsWith('/referentiels')) return 'referentiels';
    return 'aujourdhui';
  };

  const [activeSection, setActiveSection] = useState<AppSection>(() =>
    sectionFromPath(location.pathname)
  );

  useEffect(() => {
    setActiveSection(sectionFromPath(location.pathname));
  }, [location.pathname]);

  const handleSectionChange = (sec: AppSection) => {
    setActiveSection(sec);
    const pathMap: Record<AppSection, string> = {
      aujourdhui: '/',
      planning: '/planning',
      devis: '/devis',
      interventions: '/interventions',
      referentiels: '/referentiels',
    };
    navigate(pathMap[sec]);
  };

  // Table vs Kanban view modes for Devis & Interventions (Jobber / Linear style)
  const [devisViewStyle, setDevisViewStyle] = useState<'table' | 'kanban'>('table');
  const [intvViewStyle, setIntvViewStyle] = useState<'table' | 'kanban'>('table');

  // Filters
  const [devisSearch, setDevisSearch] = useState('');
  const [devisStatutFilter, setDevisStatutFilter] = useState('ALL');
  const [devisResponsableFilter, setDevisResponsableFilter] = useState('ALL');

  const [intvSearch, setIntvSearch] = useState('');
  const [intvStatutFilter, setIntvStatutFilter] = useState('ALL');
  const [intvTechFilter, setIntvTechFilter] = useState('ALL');

  // Slide-over Inspector Drawers (22-col Devis / 23-col Intervention)
  const [selectedDevis, setSelectedDevis] = useState<Partial<Devis> | null>(null);
  const [isCreatingDevis, setIsCreatingDevis] = useState(false);
  const [devisTab, setDevisTab] = useState<'qualif' | 'chiffrage' | 'relances' | 'historique'>('qualif');

  const [selectedIntv, setSelectedIntv] = useState<Partial<Intervention> | null>(null);
  const [isCreatingIntv, setIsCreatingIntv] = useState(false);
  const [intvTab, setIntvTab] = useState<'planif' | 'terrain' | 'facturation' | 'historique'>('planif');

  // Global Ctrl+K Command Palette
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');

  // Referentiels state
  const [newRefCategory, setNewRefCategory] = useState<keyof ReferentielsMap>('techniciens');
  const [newRefValue, setNewRefValue] = useState('');

  // Global keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setCmdOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Fetch Data
  const { data: devisRes } = useQuery({
    queryKey: ['devis'],
    queryFn: async () => {
      const r = await devisApi.list({ limit: 500 });
      return r.data;
    },
  });

  const { data: intvRes } = useQuery({
    queryKey: ['interventions'],
    queryFn: async () => {
      const r = await interventionApi.list({ limit: 500 });
      return r.data;
    },
  });

  const { data: refRes } = useQuery({
    queryKey: ['referentiels'],
    queryFn: async () => {
      const r = await referentielsApi.getAll();
      return r.data;
    },
  });

  const devisList: Devis[] = devisRes?.data || [];
  const interventionsList: Intervention[] = intvRes?.data || [];
  const refs: ReferentielsMap = refRes?.data || DEFAULT_REFERENTIELS;

  const techniciensList = refs.techniciens?.length ? refs.techniciens : DEFAULT_REFERENTIELS.techniciens;
  const responsablesList = refs.responsables?.length ? refs.responsables : DEFAULT_REFERENTIELS.responsables;
  const corpsEtatList = refs.corps_etat?.length ? refs.corps_etat : DEFAULT_REFERENTIELS.corps_etat;
  const originesList = refs.origines?.length ? refs.origines : DEFAULT_REFERENTIELS.origines;

  // Mutations
  const createDevisMut = useMutation({
    mutationFn: (payload: Partial<Devis>) => devisApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      toast.success('Devis créé avec succès');
      setIsCreatingDevis(false);
      setSelectedDevis(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erreur création devis'),
  });

  const updateDevisMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Devis> }) => devisApi.update(id, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      if (selectedDevis && selectedDevis.id === res.data.data.id) {
        setSelectedDevis(res.data.data);
      }
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erreur mise à jour devis'),
  });

  const convertDevisMut = useMutation({
    mutationFn: (id: number) => devisApi.convert(id, { mode: 'travaux' }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      toast.success(res.data.message || `Intervention créée — Devis conservé !`);
      if (selectedDevis && res.data.devis) {
        setSelectedDevis(res.data.devis);
      }
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erreur lors de la conversion'),
  });

  const createIntvMut = useMutation({
    mutationFn: (payload: Partial<Intervention>) => interventionApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      toast.success('Intervention créée avec succès');
      setIsCreatingIntv(false);
      setSelectedIntv(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erreur création intervention'),
  });

  const updateIntvMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Intervention> }) =>
      interventionApi.update(id, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      if (selectedIntv && selectedIntv.id === res.data.data.id) {
        setSelectedIntv(res.data.data);
      }
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erreur mise à jour intervention'),
  });

  // =========================================================================
  // BUSINESS QUEUES & KPI CALCULATIONS (ANELEC SPEC)
  // =========================================================================
  const queues = useMemo(() => {
    const devisARelancer = devisList.filter(
      (d) =>
        d.prochaineAction === 'Relancer le client' ||
        d.computed?.alerte === 'Relance en retard'
    );

    const devisProchesEcheance = devisList.filter(
      (d) =>
        d.computed?.alerte === 'Réponse en retard' ||
        (d.echeance && !['Accepté', 'Refusé', 'Annulé'].includes(d.statutCommercial))
    );

    const devisAcceptesSansIntv = devisList.filter(
      (d) =>
        d.statutCommercial === 'Accepté' &&
        (!d.interventionsCount || d.interventionsCount === 0)
    );

    const visitesDevisAPlanifier = devisList.filter(
      (d) =>
        (d.visiteNecessaire || d.traitement === 'En attente technicien') &&
        (!d.visiteDate || !d.visiteTechnicien)
    );

    const intvAPlanifier = interventionsList.filter(
      (i) =>
        i.statutOperationnel === 'À planifier' ||
        (!i.entreprise && !['Clôturée', 'Annulée'].includes(i.statutOperationnel))
    );

    const intvEnRetard = interventionsList.filter(
      (i) => i.computed?.alerteDelai === 'En retard'
    );

    const intvAFacturer = interventionsList.filter(
      (i) =>
        (i.statutOperationnel === 'Clôturée' || i.statutOperationnel === 'Terminée - à valider') &&
        i.statutFacture !== 'Facturée'
    );

    const anomaliesQualite: { type: 'DEVIS' | 'INTERVENTION'; ref: string; message: string; item: any }[] = [];
    for (const d of devisList) {
      for (const a of d.computed?.qualiteAlertes || []) {
        anomaliesQualite.push({ type: 'DEVIS', ref: d.reference || `DEV-${d.id}`, message: a, item: d });
      }
    }
    for (const i of interventionsList) {
      for (const a of i.computed?.qualiteAlertes || []) {
        anomaliesQualite.push({ type: 'INTERVENTION', ref: i.reference || `INT-${i.id}`, message: a, item: i });
      }
    }

    return {
      devisARelancer,
      devisProchesEcheance,
      devisAcceptesSansIntv,
      visitesDevisAPlanifier,
      intvAPlanifier,
      intvEnRetard,
      intvAFacturer,
      anomaliesQualite,
    };
  }, [devisList, interventionsList]);

  // Filtered Devis & Interventions
  const filteredDevis = useMemo(() => {
    return devisList.filter((d) => {
      if (devisStatutFilter !== 'ALL' && d.statutCommercial !== devisStatutFilter) return false;
      if (devisResponsableFilter !== 'ALL' && d.responsable !== devisResponsableFilter) return false;
      if (devisSearch.trim()) {
        const q = devisSearch.toLowerCase();
        const hay = `${d.reference} ${d.client} ${d.site} ${d.objet} ${d.responsable} ${d.corpsEtat}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [devisList, devisStatutFilter, devisResponsableFilter, devisSearch]);

  const filteredInterventions = useMemo(() => {
    return interventionsList.filter((i) => {
      if (intvStatutFilter !== 'ALL' && i.statutOperationnel !== intvStatutFilter) return false;
      if (intvTechFilter !== 'ALL' && i.entreprise !== intvTechFilter) return false;
      if (intvSearch.trim()) {
        const q = intvSearch.toLowerCase();
        const hay = `${i.reference} ${i.client} ${i.chantier} ${i.objet} ${i.entreprise} ${i.corpsEtat}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [interventionsList, intvStatutFilter, intvTechFilter, intvSearch]);

  const openNewDevisDrawer = () => {
    setIsCreatingDevis(true);
    setDevisTab('qualif');
    setSelectedDevis({
      reference: '',
      statutCommercial: 'À préparer',
      traitement: 'À traiter',
      priorite: 'Normale',
      client: '',
      site: '',
      corpsEtat: 'Électricité',
      objet: '',
      origine: 'Client',
      responsable: 'Anouar',
      prochaineAction: 'Chiffrer',
      amount: 0,
      validiteJours: 30,
      visiteNecessaire: false,
      visiteTechnicien: '',
      visiteHeureDebut: '08:30',
      visiteHeureFin: '10:30',
      visiteStatut: 'À planifier',
    });
  };

  const openNewIntvDrawer = () => {
    setIsCreatingIntv(true);
    setIntvTab('planif');
    setSelectedIntv({
      reference: '',
      statutOperationnel: 'À planifier',
      traitement: 'À traiter',
      priorite: 'Normale',
      client: '',
      chantier: '',
      corpsEtat: 'Électricité',
      typeIntervention: 'Corrective',
      objet: '',
      entreprise: '',
      heureDebut: '08:00',
      heureFin: '12:00',
      modePlanification: 'Planifiée',
      statutFacture: 'Non facturée',
    });
  };

  return (
    <Layout
      activeSection={activeSection}
      onSectionChange={handleSectionChange}
      badges={{
        aujourdhui:
          queues.devisARelancer.length +
          queues.devisAcceptesSansIntv.length +
          queues.intvEnRetard.length,
        planning: queues.visitesDevisAPlanifier.length + queues.intvAPlanifier.length,
        devis: devisList.length,
        interventions: interventionsList.length,
      }}
      onOpenCommandPalette={() => setCmdOpen(true)}
      onQuickNewDevis={openNewDevisDrawer}
      onQuickNewIntervention={openNewIntvDrawer}
    >
      {/* =====================================================================
          SECTION 1 : CENTRE DE PILOTAGE ("AUJOURD'HUI")
         ===================================================================== */}
      {activeSection === 'aujourdhui' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div className="kpi-strip">
            {[
              {
                title: 'Devis à relancer',
                count: queues.devisARelancer.length,
                subtitle: 'Relance prévue ou dépassée',
                accent: '#f59e0b',
                onClick: () => {
                  setDevisStatutFilter('ALL');
                  handleSectionChange('devis');
                },
              },
              {
                title: 'Échéances / Réponses en retard',
                count: queues.devisProchesEcheance.length,
                subtitle: 'Suivi date limite client',
                accent: '#ef4444',
                onClick: () => handleSectionChange('devis'),
              },
              {
                title: 'Devis acceptés à convertir',
                count: queues.devisAcceptesSansIntv.length,
                subtitle: 'Sans intervention liée',
                accent: '#10b981',
                onClick: () => {
                  setDevisStatutFilter('Accepté');
                  handleSectionChange('devis');
                },
              },
              {
                title: 'Missions à planifier',
                count: queues.visitesDevisAPlanifier.length + queues.intvAPlanifier.length,
                subtitle: `${queues.visitesDevisAPlanifier.length} visite(s) • ${queues.intvAPlanifier.length} travaux`,
                accent: '#a855f7',
                onClick: () => handleSectionChange('planning'),
              },
              {
                title: 'Interventions en retard',
                count: queues.intvEnRetard.length,
                subtitle: 'Échéance dépassée',
                accent: '#ef4444',
                onClick: () => handleSectionChange('interventions'),
              },
              {
                title: 'Terminées à facturer',
                count: queues.intvAFacturer.length,
                subtitle: 'Prêtes pour facturation',
                accent: '#3b82f6',
                onClick: () => {
                  setIntvStatutFilter('Clôturée');
                  handleSectionChange('interventions');
                },
              },
            ].map((kpi) => (
              <div
                key={kpi.title}
                className="kpi-card"
                onClick={kpi.onClick}
                style={{ borderTop: `3px solid ${kpi.accent}` }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {kpi.title}
                  </span>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: kpi.accent,
                      boxShadow: `0 0 8px ${kpi.accent}`,
                    }}
                  />
                </div>
                <div className="font-mono" style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {kpi.count}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{kpi.subtitle}</div>
              </div>
            ))}
          </div>

          {/* Live Technician Roster & Capacity Strip */}
          <div className="pro-table-container" style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h2 style={{ fontSize: '13.5px', fontWeight: 700 }}>
                  Capacité & Affectation Équipes Terrain (Temps Réel)
                </h2>
                <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  Cliquez sur un technicien pour ouvrir directement sa piste sur la Timeline Gantt
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => handleSectionChange('planning')}
              >
                Ouvrir Console Dispatch & Gantt →
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '10px' }}>
              {techniciensList.map((tech) => {
                const techIntvs = interventionsList.filter(
                  (i) => i.entreprise === tech && i.statutOperationnel !== 'Clôturée'
                );
                const techVisites = devisList.filter(
                  (d) => d.visiteTechnicien === tech && d.statutCommercial !== 'Refusé'
                );
                const totalMissions = techIntvs.length + techVisites.length;

                return (
                  <div
                    key={tech}
                    onClick={() => handleSectionChange('planning')}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '9px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '12.5px' }}>{tech}</span>
                      <span
                        className="font-mono"
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: totalMissions > 0 ? '#60a5fa' : 'var(--text-muted)',
                        }}
                      >
                        {totalMissions} mission(s)
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <span style={{ color: '#d8b4fe' }}>{techVisites.length} visite(s)</span>
                      <span>•</span>
                      <span style={{ color: '#93c5fd' }}>{techIntvs.length} travaux</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4 Action Queues Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '14px' }}>
            <ActionQueueCard
              title="Devis acceptés à convertir en Intervention"
              badge={queues.devisAcceptesSansIntv.length}
              accent="#10b981"
              emptyText="Tous les devis acceptés ont une intervention liée."
            >
              {queues.devisAcceptesSansIntv.slice(0, 6).map((d) => (
                <div
                  key={d.id}
                  style={{
                    padding: '9px 11px',
                    borderRadius: '8px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{ cursor: 'pointer', minWidth: 0 }}
                    onClick={() => {
                      setIsCreatingDevis(false);
                      setSelectedDevis(d);
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '12.5px' }}>
                      <span className="font-mono" style={{ color: '#10b981' }}>{d.reference || `DEV-${d.id}`}</span> — {d.client}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {d.objet || d.site || 'Prestation TCE'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => convertDevisMut.mutate(d.id)}
                  >
                    Créer Intervention
                  </button>
                </div>
              ))}
            </ActionQueueCard>

            <ActionQueueCard
              title="Visites Devis & Travaux à planifier"
              badge={queues.visitesDevisAPlanifier.length + queues.intvAPlanifier.length}
              accent="#a855f7"
              emptyText="Aucune visite ou intervention en attente de créneau."
            >
              {queues.visitesDevisAPlanifier.slice(0, 3).map((d) => (
                <div
                  key={`v-${d.id}`}
                  style={{
                    padding: '9px 11px',
                    borderRadius: '8px',
                    background: 'var(--bg-elevated)',
                    borderLeft: '3px solid #a855f7',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '12px' }}>
                      <span className="font-mono" style={{ color: '#d8b4fe' }}>[VISITE DEVIS] {d.reference || `DEV-${d.id}`}</span> • {d.client}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{d.site || d.objet}</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSectionChange('planning')}
                  >
                    Dispatcher →
                  </button>
                </div>
              ))}
              {queues.intvAPlanifier.slice(0, 3).map((i) => (
                <div
                  key={`i-${i.id}`}
                  style={{
                    padding: '9px 11px',
                    borderRadius: '8px',
                    background: 'var(--bg-elevated)',
                    borderLeft: '3px solid #3b82f6',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '12px' }}>
                      <span className="font-mono" style={{ color: '#93c5fd' }}>[TRAVAUX] {i.reference || `INT-${i.id}`}</span> • {i.client}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{i.objet || i.chantier}</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSectionChange('planning')}
                  >
                    Dispatcher →
                  </button>
                </div>
              ))}
            </ActionQueueCard>

            <ActionQueueCard
              title="Devis à relancer aujourd'hui"
              badge={queues.devisARelancer.length}
              accent="#f59e0b"
              emptyText="Aucune relance commerciale en attente."
            >
              {queues.devisARelancer.slice(0, 5).map((d) => (
                <div
                  key={d.id}
                  style={{
                    padding: '9px 11px',
                    borderRadius: '8px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setIsCreatingDevis(false);
                      setSelectedDevis(d);
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '12px' }}>
                      <span className="font-mono" style={{ color: '#fbbf24' }}>{d.reference || `DEV-${d.id}`}</span> — {d.client}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Relance prévue : {formatDateFR(d.dateRelance)} • Resp: {d.responsable || '—'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      updateDevisMut.mutate({
                        id: d.id,
                        data: {
                          dateRelance: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
                          prochaineAction: 'Relancer le client',
                        },
                      })
                    }
                  >
                    Relancé (J+3)
                  </button>
                </div>
              ))}
            </ActionQueueCard>

            <ActionQueueCard
              title="Interventions terminées à facturer"
              badge={queues.intvAFacturer.length}
              accent="#3b82f6"
              emptyText="Aucune intervention en attente de facturation."
            >
              {queues.intvAFacturer.slice(0, 5).map((i) => (
                <div
                  key={i.id}
                  style={{
                    padding: '9px 11px',
                    borderRadius: '8px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setIsCreatingIntv(false);
                      setSelectedIntv(i);
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '12px' }}>
                      <span className="font-mono" style={{ color: '#60a5fa' }}>{i.reference || `INT-${i.id}`}</span> — {i.client}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Tech: {i.entreprise || '—'} • Résultat: {i.resultatTechnique || 'Non renseigné'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() =>
                      updateIntvMut.mutate({
                        id: i.id,
                        data: { statutFacture: 'Facturée' },
                      })
                    }
                  >
                    Marquer Facturée
                  </button>
                </div>
              ))}
            </ActionQueueCard>
          </div>

          {queues.anomaliesQualite.length > 0 && (
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderLeft: '4px solid #64748b',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Contrôle Qualité des Données (Séparé des urgences métier) • {queues.anomaliesQualite.length} fiche(s) à compléter
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Exemples : {queues.anomaliesQualite.slice(0, 3).map((a) => `${a.ref} (${a.message})`).join(' • ')}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const first = queues.anomaliesQualite[0];
                  if (first.type === 'DEVIS') {
                    setIsCreatingDevis(false);
                    setSelectedDevis(first.item);
                  } else {
                    setIsCreatingIntv(false);
                    setSelectedIntv(first.item);
                  }
                }}
              >
                Compléter la 1ère fiche
              </button>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SECTION 2 : CONSOLE DISPATCH & PLANNING TECHNICIENS
         ===================================================================== */}
      {activeSection === 'planning' && (
        <PlanningBoard
          devisList={devisList}
          interventionsList={interventionsList}
          techniciens={techniciensList}
          onUpdateDevisPlanning={async (devisId, payload) => {
            await updateDevisMut.mutateAsync({ id: devisId, data: payload });
          }}
          onUpdateInterventionPlanning={async (intvId, payload) => {
            await updateIntvMut.mutateAsync({ id: intvId, data: payload });
          }}
          onOpenDevisDrawer={(d) => {
            setIsCreatingDevis(false);
            setSelectedDevis(d);
          }}
          onOpenInterventionDrawer={(i) => {
            setIsCreatingIntv(false);
            setSelectedIntv(i);
          }}
          onCreateQuickIntervention={async (payload) => {
            await createIntvMut.mutateAsync(payload);
          }}
        />
      )}

      {/* =====================================================================
          SECTION 3 : PIPELINE DEVIS (TABLEAU 8 COLONNES + KANBAN + DRAWER 22 COL)
         ===================================================================== */}
      {activeSection === 'devis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="fsm-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div className="segmented-control">
                <button
                  type="button"
                  className={`segmented-btn ${devisViewStyle === 'table' ? 'active' : ''}`}
                  onClick={() => setDevisViewStyle('table')}
                >
                  Tableau Synthétique (8 col)
                </button>
                <button
                  type="button"
                  className={`segmented-btn ${devisViewStyle === 'kanban' ? 'active' : ''}`}
                  onClick={() => setDevisViewStyle('kanban')}
                >
                  Pipeline Kanban (Drag & Drop)
                </button>
              </div>

              <input
                type="text"
                className="input"
                style={{ width: '240px' }}
                placeholder="Rechercher réf, client, site, objet..."
                value={devisSearch}
                onChange={(e) => setDevisSearch(e.target.value)}
              />

              <select
                className="select"
                style={{ width: '185px' }}
                value={devisStatutFilter}
                onChange={(e) => setDevisStatutFilter(e.target.value)}
              >
                <option value="ALL">Tous statuts commerciaux</option>
                {STATUTS_COMMERCIAUX_DEVIS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                className="select"
                style={{ width: '165px' }}
                value={devisResponsableFilter}
                onChange={(e) => setDevisResponsableFilter(e.target.value)}
              >
                <option value="ALL">Tous responsables</option>
                {responsablesList.map((r) => (
                  <option key={r} value={r}>
                    Resp: {r}
                  </option>
                ))}
              </select>
            </div>

            <button type="button" className="btn btn-primary" onClick={openNewDevisDrawer}>
              + Nouveau Devis
            </button>
          </div>

          {devisViewStyle === 'table' ? (
            <div className="pro-table-container">
              <table className="pro-table">
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Client & Site</th>
                    <th>Corps d'état & Objet</th>
                    <th>Responsable</th>
                    <th>Montant HT</th>
                    <th>Statut & Visite</th>
                    <th>Échéance / Alerte</th>
                    <th style={{ textAlign: 'right' }}>Actions 1-Clic</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDevis.map((d) => (
                    <tr
                      key={d.id}
                      onClick={() => {
                        setIsCreatingDevis(false);
                        setSelectedDevis(d);
                      }}
                    >
                      <td className="font-mono" style={{ fontWeight: 700, color: '#60a5fa' }}>
                        {d.reference || `DEV-${d.id}`}
                        {(d.interventionsCount || 0) > 0 && (
                          <span
                            style={{
                              marginLeft: '6px',
                              padding: '1px 5px',
                              fontSize: '10px',
                              borderRadius: '4px',
                              background: 'rgba(16, 185, 129, 0.16)',
                              color: '#34d399',
                            }}
                          >
                            INT liée
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{d.client || '—'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{d.site || '—'}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{d.corpsEtat || '—'}</div>
                        <div
                          style={{
                            fontSize: '11.5px',
                            color: 'var(--text-secondary)',
                            maxWidth: '250px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {d.objet || '—'}
                        </div>
                      </td>
                      <td>{d.responsable || '—'}</td>
                      <td className="font-mono" style={{ fontWeight: 700 }}>
                        {formatCurrency(d.amount)}
                      </td>
                      <td>
                        <StatusPill statut={d.statutCommercial} />
                        {(d.visiteNecessaire || d.visiteTechnicien) && (
                          <div style={{ fontSize: '10.5px', color: '#d8b4fe', marginTop: '3px' }}>
                            Visite : {d.visiteTechnicien || 'À affecter'}
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 600,
                            color:
                              d.computed?.alerte === 'Réponse en retard'
                                ? '#ef4444'
                                : d.computed?.alerte === 'Relance en retard'
                                ? '#f59e0b'
                                : 'var(--text-secondary)',
                          }}
                        >
                          {d.computed?.alerte || 'À suivre'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              updateDevisMut.mutate({
                                id: d.id,
                                data: {
                                  visiteNecessaire: true,
                                  traitement: 'En attente technicien',
                                  visiteStatut: 'À planifier',
                                },
                              });
                              handleSectionChange('planning');
                            }}
                          >
                            Planifier Visite
                          </button>
                          {(!d.interventionsCount || d.interventionsCount === 0) && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => convertDevisMut.mutate(d.id)}
                            >
                              → Intervention
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="kanban-grid">
              {['À préparer', 'En préparation', 'À valider en interne', 'Envoyé au client', 'En négociation', 'Accepté'].map(
                (colStatut) => {
                  const colItems = filteredDevis.filter((d) => d.statutCommercial === colStatut);
                  return (
                    <div
                      key={colStatut}
                      className="kanban-column"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        const rawId = e.dataTransfer.getData('text/devis-id');
                        if (!rawId) return;
                        updateDevisMut.mutate({
                          id: Number(rawId),
                          data: { statutCommercial: colStatut },
                        });
                        toast.success(`Devis déplacé vers « ${colStatut} »`);
                      }}
                    >
                      <div className="kanban-col-header">
                        <span>{colStatut}</span>
                        <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {colItems.length}
                        </span>
                      </div>
                      <div className="kanban-col-body">
                        {colItems.map((d) => (
                          <div
                            key={d.id}
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData('text/devis-id', String(d.id))}
                            onClick={() => {
                              setIsCreatingDevis(false);
                              setSelectedDevis(d);
                            }}
                            className="kanban-card"
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className="font-mono" style={{ fontWeight: 700, fontSize: '11px', color: '#60a5fa' }}>
                                {d.reference || `DEV-${d.id}`}
                              </span>
                              <span className="font-mono" style={{ fontSize: '11px', fontWeight: 700 }}>
                                {formatCurrency(d.amount)}
                              </span>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '12.5px' }}>{d.client}</div>
                            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                              {d.objet || d.site || '—'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SECTION 4 : INTERVENTIONS TCE (TABLEAU 8 COL + KANBAN + DRAWER 23 COL)
         ===================================================================== */}
      {activeSection === 'interventions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="fsm-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div className="segmented-control">
                <button
                  type="button"
                  className={`segmented-btn ${intvViewStyle === 'table' ? 'active' : ''}`}
                  onClick={() => setIntvViewStyle('table')}
                >
                  Tableau Synthétique (8 col)
                </button>
                <button
                  type="button"
                  className={`segmented-btn ${intvViewStyle === 'kanban' ? 'active' : ''}`}
                  onClick={() => setIntvViewStyle('kanban')}
                >
                  Kanban Opérationnel
                </button>
              </div>

              <input
                type="text"
                className="input"
                style={{ width: '240px' }}
                placeholder="Rechercher réf, client, site, technicien..."
                value={intvSearch}
                onChange={(e) => setIntvSearch(e.target.value)}
              />

              <select
                className="select"
                style={{ width: '175px' }}
                value={intvStatutFilter}
                onChange={(e) => setIntvStatutFilter(e.target.value)}
              >
                <option value="ALL">Tous statuts</option>
                {STATUTS_OPERATIONNELS_INTERVENTION.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                className="select"
                style={{ width: '165px' }}
                value={intvTechFilter}
                onChange={(e) => setIntvTechFilter(e.target.value)}
              >
                <option value="ALL">Tous techniciens</option>
                {techniciensList.map((t) => (
                  <option key={t} value={t}>
                    Tech: {t}
                  </option>
                ))}
              </select>
            </div>

            <button type="button" className="btn btn-primary" onClick={openNewIntvDrawer}>
              + Nouvelle Intervention
            </button>
          </div>

          {intvViewStyle === 'table' ? (
            <div className="pro-table-container">
              <table className="pro-table">
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Client & Chantier</th>
                    <th>Corps d'état & Objet</th>
                    <th>Technicien Terrain</th>
                    <th>Créneau Planifié</th>
                    <th>Statut Opérationnel</th>
                    <th>Facturation</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInterventions.map((i) => (
                    <tr
                      key={i.id}
                      onClick={() => {
                        setIsCreatingIntv(false);
                        setSelectedIntv(i);
                      }}
                    >
                      <td className="font-mono" style={{ fontWeight: 700, color: '#60a5fa' }}>
                        {i.reference || `INT-${i.id}`}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{i.client || '—'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{i.chantier || '—'}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{i.corpsEtat || i.typeIntervention || '—'}</div>
                        <div
                          style={{
                            fontSize: '11.5px',
                            color: 'var(--text-secondary)',
                            maxWidth: '240px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {i.objet || '—'}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{i.entreprise || 'À affecter'}</td>
                      <td className="font-mono" style={{ fontSize: '11.5px' }}>
                        {formatDateFR(i.datePlanifiee)}
                        {i.heureDebut && (
                          <div style={{ color: '#60a5fa' }}>
                            {i.heureDebut}–{i.heureFin || '12:00'}
                          </div>
                        )}
                      </td>
                      <td>
                        <StatusPill statut={i.statutOperationnel} />
                      </td>
                      <td>
                        <span
                          className="font-mono"
                          style={{
                            fontSize: '11px',
                            color: i.statutFacture === 'Facturée' ? '#10b981' : 'var(--text-secondary)',
                          }}
                        >
                          {i.statutFacture || 'Non facturée'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleSectionChange('planning')}
                        >
                          Voir sur Gantt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="kanban-grid">
              {['À planifier', 'Planifiée', 'En cours', 'Suspendue', 'Terminée - à valider', 'Clôturée'].map(
                (colStatut) => {
                  const colItems = filteredInterventions.filter((i) => i.statutOperationnel === colStatut);
                  return (
                    <div
                      key={colStatut}
                      className="kanban-column"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        const rawId = e.dataTransfer.getData('text/intv-id');
                        if (!rawId) return;
                        updateIntvMut.mutate({
                          id: Number(rawId),
                          data: { statutOperationnel: colStatut },
                        });
                        toast.success(`Intervention passée en « ${colStatut} »`);
                      }}
                    >
                      <div className="kanban-col-header">
                        <span>{colStatut}</span>
                        <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {colItems.length}
                        </span>
                      </div>
                      <div className="kanban-col-body">
                        {colItems.map((i) => (
                          <div
                            key={i.id}
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData('text/intv-id', String(i.id))}
                            onClick={() => {
                              setIsCreatingIntv(false);
                              setSelectedIntv(i);
                            }}
                            className="kanban-card"
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span className="font-mono" style={{ fontWeight: 700, fontSize: '11px', color: '#60a5fa' }}>
                                {i.reference || `INT-${i.id}`}
                              </span>
                              <span className="font-mono" style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                                {i.entreprise || 'Non affecté'}
                              </span>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '12.5px' }}>{i.client}</div>
                            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{i.objet || i.chantier}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SECTION 5 : RÉFÉRENTIELS MÉTIER ANELEC
         ===================================================================== */}
      {activeSection === 'referentiels' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="fsm-toolbar">
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 700 }}>Administration des Référentiels ANELEC</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Ajoutez des techniciens, responsables, clients et corps d'état sans redéploiement.
              </p>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newRefValue.trim()) return;
                const currentVals = refs[newRefCategory] || [];
                if (!currentVals.includes(newRefValue.trim())) {
                  await referentielsApi.updateCategory(newRefCategory, [
                    ...currentVals,
                    newRefValue.trim(),
                  ]);
                  queryClient.invalidateQueries({ queryKey: ['referentiels'] });
                  toast.success('Entrée ajoutée au référentiel');
                }
                setNewRefValue('');
              }}
              style={{ display: 'flex', gap: '8px' }}
            >
              <select
                className="select"
                style={{ width: '190px' }}
                value={newRefCategory}
                onChange={(e) => setNewRefCategory(e.target.value as keyof ReferentielsMap)}
              >
                <option value="techniciens">Techniciens terrain</option>
                <option value="responsables">Responsables internes</option>
                <option value="corps_etat">Corps d'état TCE</option>
                <option value="clients">Clients récurrents</option>
                <option value="origines">Origines / Provenances</option>
              </select>
              <input
                type="text"
                className="input"
                style={{ width: '210px' }}
                placeholder="Nouvelle valeur..."
                value={newRefValue}
                onChange={(e) => setNewRefValue(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                Ajouter
              </button>
            </form>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
            {[
              { key: 'techniciens', label: 'Techniciens Terrain', items: techniciensList },
              { key: 'responsables', label: 'Responsables Internes', items: responsablesList },
              { key: 'corps_etat', label: "Corps d'État TCE", items: corpsEtatList },
              { key: 'origines', label: 'Origines de demande', items: originesList },
              { key: 'statuts_devis', label: 'Statuts Commerciaux Devis', items: [...STATUTS_COMMERCIAUX_DEVIS] },
              { key: 'statuts_intv', label: 'Statuts Opérationnels Interventions', items: [...STATUTS_OPERATIONNELS_INTERVENTION] },
            ].map((group) => (
              <div key={group.key} className="pro-table-container" style={{ padding: '14px' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px', color: '#60a5fa' }}>
                  {group.label} ({group.items.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {group.items.map((val) => (
                    <span
                      key={val}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                        fontSize: '12px',
                        fontWeight: 500,
                      }}
                    >
                      {val}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          SLIDE-OVER INSPECTOR DRAWER : DEVIS (22 COLONNES ANELEC)
         ===================================================================== */}
      {selectedDevis && (
        <div className="inspector-backdrop" onClick={() => setSelectedDevis(null)}>
          <div className="inspector-drawer" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-default)',
                background: 'var(--bg-elevated)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="font-mono" style={{ fontWeight: 800, fontSize: '14px', color: '#60a5fa' }}>
                    {isCreatingDevis ? 'NOUVEAU DEVIS' : selectedDevis.reference || `DEV-${selectedDevis.id}`}
                  </span>
                  <StatusPill statut={selectedDevis.statutCommercial || 'À préparer'} />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Fiche complète 22 colonnes ANELEC • Calculs automatiques Europe/Paris
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {!isCreatingDevis && selectedDevis.id && (
                  <button
                    type="button"
                    className="btn btn-ai-dispatch btn-sm"
                    onClick={() => convertDevisMut.mutate(selectedDevis.id!)}
                  >
                    Convertir → Intervention
                  </button>
                )}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedDevis(null)}>
                  ✕
                </button>
              </div>
            </div>

            <div
              style={{
                padding: '10px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                gap: '6px',
              }}
            >
              {[
                { id: 'qualif', label: '1. Qualification & Visite' },
                { id: 'chiffrage', label: '2. Chiffrage & Échéances' },
                { id: 'relances', label: '3. Suivi & Relances' },
                { id: 'historique', label: '4. Calculs & Historique' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`segmented-btn ${devisTab === t.id ? 'active' : ''}`}
                  onClick={() => setDevisTab(t.id as any)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {devisTab === 'qualif' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Client / Donneur d'ordre *</label>
                    <input
                      className="input"
                      value={selectedDevis.client || ''}
                      onChange={(e) => setSelectedDevis({ ...selectedDevis, client: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Site / Immeuble / Adresse</label>
                    <input
                      className="input"
                      value={selectedDevis.site || ''}
                      onChange={(e) => setSelectedDevis({ ...selectedDevis, site: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Corps d'état TCE</label>
                    <select
                      className="select"
                      value={selectedDevis.corpsEtat || ''}
                      onChange={(e) => setSelectedDevis({ ...selectedDevis, corpsEtat: e.target.value })}
                    >
                      {corpsEtatList.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Responsable interne (Chargé d'affaires)</label>
                    <select
                      className="select"
                      value={selectedDevis.responsable || ''}
                      onChange={(e) => setSelectedDevis({ ...selectedDevis, responsable: e.target.value })}
                    >
                      {responsablesList.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Statut Commercial</label>
                    <select
                      className="select"
                      value={selectedDevis.statutCommercial || 'À préparer'}
                      onChange={(e) => setSelectedDevis({ ...selectedDevis, statutCommercial: e.target.value })}
                    >
                      {STATUTS_COMMERCIAUX_DEVIS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Traitement Administratif</label>
                    <select
                      className="select"
                      value={selectedDevis.traitement || 'À traiter'}
                      onChange={(e) => setSelectedDevis({ ...selectedDevis, traitement: e.target.value })}
                    >
                      {TRAITEMENTS_ADMIN.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Objet / Description des travaux</label>
                    <textarea
                      className="textarea"
                      rows={3}
                      value={selectedDevis.objet || ''}
                      onChange={(e) => setSelectedDevis({ ...selectedDevis, objet: e.target.value })}
                    />
                  </div>

                  {/* VISITE TECHNIQUE BLOCK */}
                  <div
                    style={{
                      gridColumn: '1 / -1',
                      padding: '14px',
                      borderRadius: '10px',
                      background: 'rgba(168, 85, 247, 0.1)',
                      border: '1px solid rgba(168, 85, 247, 0.35)',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '10px',
                    }}
                  >
                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: '#d8b4fe', fontSize: '12.5px' }}>
                        Visite Technique Préalable (Synchronisée avec le Planning Techniciens)
                      </span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(selectedDevis.visiteNecessaire)}
                          onChange={(e) =>
                            setSelectedDevis({
                              ...selectedDevis,
                              visiteNecessaire: e.target.checked,
                              visiteStatut: e.target.checked ? 'À planifier' : 'Non requise',
                            })
                          }
                        />
                        Visite requise
                      </label>
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Technicien Visite</label>
                      <select
                        className="select"
                        value={selectedDevis.visiteTechnicien || ''}
                        onChange={(e) =>
                          setSelectedDevis({
                            ...selectedDevis,
                            visiteNecessaire: true,
                            visiteTechnicien: e.target.value,
                          })
                        }
                      >
                        <option value="">À affecter</option>
                        {techniciensList.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Date Visite</label>
                      <input
                        type="date"
                        className="input"
                        value={selectedDevis.visiteDate ? selectedDevis.visiteDate.slice(0, 10) : ''}
                        onChange={(e) =>
                          setSelectedDevis({
                            ...selectedDevis,
                            visiteNecessaire: true,
                            visiteDate: e.target.value || null,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Heure début</label>
                      <input
                        type="time"
                        className="input"
                        value={selectedDevis.visiteHeureDebut || '08:30'}
                        onChange={(e) => setSelectedDevis({ ...selectedDevis, visiteHeureDebut: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Heure fin</label>
                      <input
                        type="time"
                        className="input"
                        value={selectedDevis.visiteHeureFin || '10:30'}
                        onChange={(e) => setSelectedDevis({ ...selectedDevis, visiteHeureFin: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {devisTab === 'chiffrage' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Montant HT (€)</label>
                    <input
                      type="number"
                      className="input font-mono"
                      value={selectedDevis.amount ?? ''}
                      onChange={(e) => setSelectedDevis({ ...selectedDevis, amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Origine / Provenance</label>
                    <select
                      className="select"
                      value={selectedDevis.origine || 'Client'}
                      onChange={(e) => setSelectedDevis({ ...selectedDevis, origine: e.target.value })}
                    >
                      {originesList.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Date demande</label>
                    <input
                      type="date"
                      className="input"
                      value={selectedDevis.dateCreated ? selectedDevis.dateCreated.slice(0, 10) : ''}
                      onChange={(e) =>
                        setSelectedDevis({
                          ...selectedDevis,
                          dateCreated: e.target.value || undefined,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Date limite (Échéance)</label>
                    <input
                      type="date"
                      className="input"
                      value={selectedDevis.echeance ? selectedDevis.echeance.slice(0, 10) : ''}
                      onChange={(e) =>
                        setSelectedDevis({
                          ...selectedDevis,
                          echeance: e.target.value || null,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Date envoi au client</label>
                    <input
                      type="date"
                      className="input"
                      value={selectedDevis.dateEnvoi ? selectedDevis.dateEnvoi.slice(0, 10) : ''}
                      onChange={(e) =>
                        setSelectedDevis({
                          ...selectedDevis,
                          dateEnvoi: e.target.value || null,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Validité (jours)</label>
                    <input
                      type="number"
                      className="input font-mono"
                      value={selectedDevis.validiteJours ?? 30}
                      onChange={(e) =>
                        setSelectedDevis({
                          ...selectedDevis,
                          validiteJours: parseInt(e.target.value, 10) || null,
                        })
                      }
                    />
                  </div>
                </div>
              )}

              {devisTab === 'relances' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Prochaine Action</label>
                    <select
                      className="select"
                      value={selectedDevis.prochaineAction || 'Chiffrer'}
                      onChange={(e) => setSelectedDevis({ ...selectedDevis, prochaineAction: e.target.value })}
                    >
                      {PROCHAINES_ACTIONS_DEVIS.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Date de relance prévue</label>
                    <input
                      type="date"
                      className="input"
                      value={selectedDevis.dateRelance ? selectedDevis.dateRelance.slice(0, 10) : ''}
                      onChange={(e) =>
                        setSelectedDevis({
                          ...selectedDevis,
                          dateRelance: e.target.value || null,
                        })
                      }
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Notes / Commentaires de suivi</label>
                    <textarea
                      className="textarea"
                      rows={4}
                      value={selectedDevis.notes || ''}
                      onChange={(e) => setSelectedDevis({ ...selectedDevis, notes: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {devisTab === 'historique' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: '6px' }}>Champs Calculés Automatiquement (Europe/Paris)</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <div>Jours ouverts : <strong>{selectedDevis.computed?.joursOuverts ?? '—'}</strong></div>
                      <div>Date expiration : <strong>{formatDateFR(selectedDevis.computed?.dateExpiration)}</strong></div>
                      <div>Alerte : <strong>{selectedDevis.computed?.alerte || 'À suivre'}</strong></div>
                      <div>Détail : <strong>{selectedDevis.computed?.alerteExplication || '—'}</strong></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid var(--border-default)',
                background: 'var(--bg-elevated)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedDevis(null)}>
                Fermer
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (isCreatingDevis || !selectedDevis.id) {
                    createDevisMut.mutate(selectedDevis);
                  } else {
                    updateDevisMut.mutate({ id: selectedDevis.id, data: selectedDevis });
                    toast.success('Devis enregistré');
                  }
                }}
              >
                {isCreatingDevis ? 'Créer le Devis' : 'Enregistrer les modifications'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SLIDE-OVER INSPECTOR DRAWER : INTERVENTION (23 COLONNES ANELEC)
         ===================================================================== */}
      {selectedIntv && (
        <div className="inspector-backdrop" onClick={() => setSelectedIntv(null)}>
          <div className="inspector-drawer" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-default)',
                background: 'var(--bg-elevated)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="font-mono" style={{ fontWeight: 800, fontSize: '14px', color: '#60a5fa' }}>
                    {isCreatingIntv ? 'NOUVELLE INTERVENTION' : selectedIntv.reference || `INT-${selectedIntv.id}`}
                  </span>
                  <StatusPill statut={selectedIntv.statutOperationnel || 'À planifier'} />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Fiche complète 23 colonnes ANELEC • Synchronisée avec la Timeline Gantt
                </div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedIntv(null)}>
                ✕
              </button>
            </div>

            <div
              style={{
                padding: '10px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                gap: '6px',
              }}
            >
              {[
                { id: 'planif', label: '1. Affectation & Créneau' },
                { id: 'terrain', label: '2. Exécution Terrain & Résultat' },
                { id: 'facturation', label: '3. Facturation' },
                { id: 'historique', label: '4. Alertes & Devis lié' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`segmented-btn ${intvTab === t.id ? 'active' : ''}`}
                  onClick={() => setIntvTab(t.id as any)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {intvTab === 'planif' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Client</label>
                    <input
                      className="input"
                      value={selectedIntv.client || ''}
                      onChange={(e) => setSelectedIntv({ ...selectedIntv, client: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Chantier / Site / Adresse *</label>
                    <input
                      className="input"
                      value={selectedIntv.chantier || ''}
                      onChange={(e) => setSelectedIntv({ ...selectedIntv, chantier: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Technicien Terrain (Intervenant)</label>
                    <select
                      className="select"
                      value={selectedIntv.entreprise || ''}
                      onChange={(e) => setSelectedIntv({ ...selectedIntv, entreprise: e.target.value })}
                    >
                      <option value="">À affecter</option>
                      {techniciensList.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Type d'intervention</label>
                    <select
                      className="select"
                      value={selectedIntv.typeIntervention || 'Corrective'}
                      onChange={(e) => setSelectedIntv({ ...selectedIntv, typeIntervention: e.target.value })}
                    >
                      {TYPES_INTERVENTION.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Date planifiée</label>
                    <input
                      type="date"
                      className="input"
                      value={selectedIntv.datePlanifiee ? selectedIntv.datePlanifiee.slice(0, 10) : ''}
                      onChange={(e) =>
                        setSelectedIntv({
                          ...selectedIntv,
                          datePlanifiee: e.target.value || null,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Statut Opérationnel</label>
                    <select
                      className="select"
                      value={selectedIntv.statutOperationnel || 'À planifier'}
                      onChange={(e) => setSelectedIntv({ ...selectedIntv, statutOperationnel: e.target.value })}
                    >
                      {STATUTS_OPERATIONNELS_INTERVENTION.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Heure début</label>
                    <input
                      type="time"
                      className="input"
                      value={selectedIntv.heureDebut || '08:00'}
                      onChange={(e) => setSelectedIntv({ ...selectedIntv, heureDebut: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Heure fin</label>
                    <input
                      type="time"
                      className="input"
                      value={selectedIntv.heureFin || '12:00'}
                      onChange={(e) => setSelectedIntv({ ...selectedIntv, heureFin: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Priorité</label>
                    <select
                      className="select"
                      value={selectedIntv.priorite || 'Normale'}
                      onChange={(e) => setSelectedIntv({ ...selectedIntv, priorite: e.target.value })}
                    >
                      {PRIORITES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Mode de planification</label>
                    <select
                      className="select"
                      value={selectedIntv.modePlanification || 'Planifiée'}
                      onChange={(e) => setSelectedIntv({ ...selectedIntv, modePlanification: e.target.value })}
                    >
                      {MODES_PLANIFICATION.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Objet / Description des travaux</label>
                    <textarea
                      className="textarea"
                      rows={3}
                      value={selectedIntv.objet || ''}
                      onChange={(e) => setSelectedIntv({ ...selectedIntv, objet: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {intvTab === 'terrain' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Résultat technique</label>
                    <input
                      className="input"
                      value={selectedIntv.resultatTechnique || ''}
                      onChange={(e) => setSelectedIntv({ ...selectedIntv, resultatTechnique: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Motif de blocage (si suspendue/bloquée)</label>
                    <input
                      className="input"
                      value={selectedIntv.motifBlocage || ''}
                      onChange={(e) => setSelectedIntv({ ...selectedIntv, motifBlocage: e.target.value })}
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Compte-rendu d'intervention terrain</label>
                    <textarea
                      className="textarea"
                      rows={4}
                      value={selectedIntv.compteRendu || ''}
                      onChange={(e) => setSelectedIntv({ ...selectedIntv, compteRendu: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {intvTab === 'facturation' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Statut Facturation</label>
                    <select
                      className="select"
                      value={selectedIntv.statutFacture || 'Non facturée'}
                      onChange={(e) => setSelectedIntv({ ...selectedIntv, statutFacture: e.target.value })}
                    >
                      {STATUTS_FACTURE.map((sf) => (
                        <option key={sf} value={sf}>{sf}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Numéro de Facture</label>
                    <input
                      className="input font-mono"
                      value={selectedIntv.numeroFacture || ''}
                      onChange={(e) => setSelectedIntv({ ...selectedIntv, numeroFacture: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {intvTab === 'historique' && (
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '6px' }}>Calculs & Alertes</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Alerte délai : <strong>{selectedIntv.computed?.alerteDelai || 'À suivre'}</strong> • Détail :{' '}
                    <strong>{selectedIntv.computed?.alerteExplication || '—'}</strong>
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid var(--border-default)',
                background: 'var(--bg-elevated)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedIntv(null)}>
                Fermer
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (isCreatingIntv || !selectedIntv.id) {
                    createIntvMut.mutate(selectedIntv);
                  } else {
                    updateIntvMut.mutate({ id: selectedIntv.id, data: selectedIntv });
                    toast.success('Intervention enregistrée');
                  }
                }}
              >
                {isCreatingIntv ? "Créer l'Intervention" : 'Enregistrer les modifications'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          GLOBAL CTRL+K COMMAND PALETTE
         ===================================================================== */}
      {cmdOpen && (
        <div className="cmd-palette-backdrop" onClick={() => setCmdOpen(false)}>
          <div className="cmd-palette-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                autoFocus
                type="text"
                className="input"
                style={{ border: 'none', background: 'transparent', fontSize: '13.5px', padding: '2px 0' }}
                placeholder="Tapez une référence (DEV-..., INT-...), un client, un technicien ou une commande..."
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
              />
              <span className="kbd-shortcut">ESC</span>
            </div>

            <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', padding: '4px 8px', textTransform: 'uppercase' }}>
                Commandes Rapides
              </div>
              {[
                { label: 'Ouvrir Console Dispatch & Timeline Gantt', action: () => handleSectionChange('planning') },
                { label: 'Créer un Nouveau Devis (22 colonnes)', action: openNewDevisDrawer },
                { label: 'Créer une Nouvelle Intervention (23 colonnes)', action: openNewIntvDrawer },
                { label: 'Aller au Centre de Pilotage (Aujourd’hui)', action: () => handleSectionChange('aujourdhui') },
              ].map((cmd) => (
                <button
                  key={cmd.label}
                  type="button"
                  onClick={() => {
                    cmd.action();
                    setCmdOpen(false);
                  }}
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: '7px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '12.5px',
                    fontWeight: 500,
                  }}
                >
                  → {cmd.label}
                </button>
              ))}

              {cmdQuery.trim() && (
                <>
                  <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', padding: '8px 8px 4px', textTransform: 'uppercase' }}>
                    Résultats Devis & Interventions
                  </div>
                  {devisList
                    .filter((d) =>
                      `${d.reference} ${d.client} ${d.site} ${d.objet}`
                        .toLowerCase()
                        .includes(cmdQuery.toLowerCase())
                    )
                    .slice(0, 5)
                    .map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          setIsCreatingDevis(false);
                          setSelectedDevis(d);
                          setCmdOpen(false);
                        }}
                        style={{
                          textAlign: 'left',
                          padding: '8px 10px',
                          borderRadius: '7px',
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>
                          <strong className="font-mono" style={{ color: '#a855f7' }}>[DEVIS] {d.reference || `DEV-${d.id}`}</strong> — {d.client}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{d.statutCommercial}</span>
                      </button>
                    ))}
                  {interventionsList
                    .filter((i) =>
                      `${i.reference} ${i.client} ${i.chantier} ${i.objet} ${i.entreprise}`
                        .toLowerCase()
                        .includes(cmdQuery.toLowerCase())
                    )
                    .slice(0, 5)
                    .map((i) => (
                      <button
                        key={i.id}
                        type="button"
                        onClick={() => {
                          setIsCreatingIntv(false);
                          setSelectedIntv(i);
                          setCmdOpen(false);
                        }}
                        style={{
                          textAlign: 'left',
                          padding: '8px 10px',
                          borderRadius: '7px',
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>
                          <strong className="font-mono" style={{ color: '#3b82f6' }}>[INTERVENTION] {i.reference || `INT-${i.id}`}</strong> — {i.client}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{i.entreprise || i.statutOperationnel}</span>
                      </button>
                    ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function ActionQueueCard({
  title,
  badge,
  accent,
  emptyText,
  children,
}: {
  title: string;
  badge: number;
  accent: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  const hasItems = React.Children.count(children) > 0;
  return (
    <div className="pro-table-container" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: accent }} />
          <h3 style={{ fontSize: '13px', fontWeight: 700 }}>{title}</h3>
        </div>
        <span
          className="font-mono"
          style={{
            padding: '1px 8px',
            borderRadius: '999px',
            fontSize: '11px',
            fontWeight: 700,
            background: `${accent}22`,
            color: accent,
          }}
        >
          {badge}
        </span>
      </div>
      {hasItems ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>{children}</div>
      ) : (
        <div style={{ padding: '16px 8px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
          {emptyText}
        </div>
      )}
    </div>
  );
}

function StatusPill({ statut }: { statut: string }) {
  const colorMap: Record<string, { bg: string; fg: string }> = {
    Accepté: { bg: 'rgba(16, 185, 129, 0.16)', fg: '#34d399' },
    Clôturée: { bg: 'rgba(16, 185, 129, 0.16)', fg: '#34d399' },
    'Terminée - à valider': { bg: 'rgba(16, 185, 129, 0.16)', fg: '#34d399' },
    Planifiée: { bg: 'rgba(59, 130, 246, 0.16)', fg: '#60a5fa' },
    Affectée: { bg: 'rgba(59, 130, 246, 0.16)', fg: '#60a5fa' },
    'En cours': { bg: 'rgba(59, 130, 246, 0.16)', fg: '#60a5fa' },
    'En attente technicien': { bg: 'rgba(168, 85, 247, 0.18)', fg: '#d8b4fe' },
    'Envoyé au client': { bg: 'rgba(168, 85, 247, 0.18)', fg: '#d8b4fe' },
    'En négociation': { bg: 'rgba(245, 158, 11, 0.18)', fg: '#fbbf24' },
    'À planifier': { bg: 'rgba(245, 158, 11, 0.18)', fg: '#fbbf24' },
    Suspendue: { bg: 'rgba(239, 68, 68, 0.18)', fg: '#f87171' },
    Refusé: { bg: 'rgba(239, 68, 68, 0.15)', fg: '#f87171' },
  };
  const st = colorMap[statut] || { bg: 'rgba(148, 163, 184, 0.15)', fg: '#94a3b8' };

  return (
    <span className="status-pill" style={{ background: st.bg, color: st.fg }}>
      <span className="status-dot" style={{ background: st.fg }} />
      {statut}
    </span>
  );
}
