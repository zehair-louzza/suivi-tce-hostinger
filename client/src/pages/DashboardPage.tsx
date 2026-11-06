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
  DEFAULT_TECHNICIEN_COMPETENCES,
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
import { FacturationStudio } from '../components/FacturationStudio';
import { RentabiliteKpiView } from '../components/RentabiliteKpiView';
import { AdminWorkstation } from '../components/AdminWorkstation';
import { TechnicianMobileView } from '../components/TechnicianMobileView';
import { PhotoLightbox, PhotoItem } from '../components/PhotoLightbox';
import { useDevisRealtime, useInterventionRealtime } from '../hooks/useSocket';
import { useAuth } from '../stores/authStore';
import toast from 'react-hot-toast';

export function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const isMobileTechUser =
    (user?.role || '').toUpperCase() === 'TECHNICIEN' ||
    (Boolean(user?.permissions?.mobileOnly) && user?.id !== 1 && (user?.role || '').toUpperCase() !== 'ADMIN');

  const sectionFromPath = (pathname: string): AppSection => {
    if (isMobileTechUser) return 'mobile_tech';
    if (pathname.startsWith('/planning')) return 'planning';
    if (pathname.startsWith('/devis')) return 'devis';
    if (pathname.startsWith('/interventions')) return 'interventions';
    if (pathname.startsWith('/facturation')) return 'facturation';
    if (pathname.startsWith('/rentabilite')) return 'rentabilite';
    if (pathname.startsWith('/referentiels')) return 'referentiels';
    if (pathname.startsWith('/admin')) return 'admin';
    if (pathname.startsWith('/mobile')) return 'mobile_tech';
    return 'aujourdhui';
  };

  const [activeSection, setActiveSection] = useState<AppSection>(() =>
    sectionFromPath(location.pathname)
  );
  const [selectedMobileTech, setSelectedMobileTech] = useState<string>(
    () => user?.technicienNom || 'Anouar'
  );

  useEffect(() => {
    if (user?.technicienNom) {
      setSelectedMobileTech(user.technicienNom);
    }
  }, [user?.technicienNom]);

  useEffect(() => {
    setActiveSection(sectionFromPath(location.pathname));
  }, [location.pathname, isMobileTechUser]);

  const handleSectionChange = (sec: AppSection) => {
    setActiveSection(sec);
    const pathMap: Record<AppSection, string> = {
      aujourdhui: '/',
      planning: '/planning',
      devis: '/devis',
      interventions: '/interventions',
      facturation: '/facturation',
      rentabilite: '/rentabilite',
      referentiels: '/referentiels',
      admin: '/admin',
      mobile_tech: '/mobile',
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

  // Sous-onglet actif pour Workstation Admin
  const [adminSubTab, setAdminSubTab] = useState<'users' | 'roles_guide' | 'pointages' | 'rapports'>('users');

  // Lightbox photos plein écran
  const [lightboxPhotos, setLightboxPhotos] = useState<PhotoItem[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Synchronisation temps réel via WebSockets
  useDevisRealtime();
  useInterventionRealtime();

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

  // Fetch Data (actualisation automatique via WebSockets + sécurité toutes les 25s)
  const { data: devisRes } = useQuery({
    queryKey: ['devis'],
    queryFn: async () => {
      const r = await devisApi.list({ limit: 500 });
      return r.data;
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const { data: intvRes } = useQuery({
    queryKey: ['interventions'],
    queryFn: async () => {
      const r = await interventionApi.list({ limit: 500 });
      return r.data;
    },
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
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

  const deleteDevisMut = useMutation({
    mutationFn: (id: number) => devisApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      toast.success('Devis supprimé avec succès');
      if (selectedDevis) setSelectedDevis(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erreur lors de la suppression du devis'),
  });

  const deleteIntvMut = useMutation({
    mutationFn: (id: number) => interventionApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      toast.success('Intervention supprimée avec succès');
      if (selectedIntv) setSelectedIntv(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erreur lors de la suppression de l\'intervention'),
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

    const rapportsEnAttente = interventionsList.filter(
      (i) =>
        i.statutRapport === 'Déclaré par technicien' ||
        (Boolean(i.photos && i.photos.length > 0) && i.statutRapport !== 'Validé & Clôturé') ||
        (Boolean(i.actionsRealisees && i.actionsRealisees.length > 0) && i.statutRapport !== 'Validé & Clôturé') ||
        i.statutOperationnel === 'Terminée - à valider'
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
      rapportsEnAttente,
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
          queues.intvEnRetard.length +
          queues.rapportsEnAttente.length,
        planning: queues.visitesDevisAPlanifier.length + queues.intvAPlanifier.length,
        devis: devisList.length,
        interventions: interventionsList.length,
        facturation: queues.intvAFacturer.length,
        admin: queues.rapportsEnAttente.length,
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
                title: 'Rapports & Photos reçus',
                count: queues.rapportsEnAttente.length,
                subtitle: `${queues.rapportsEnAttente.length} déclaration(s) à valider`,
                accent: '#06b6d4',
                onClick: () => {
                  setAdminSubTab('rapports');
                  handleSectionChange('admin');
                },
              },
              {
                title: 'Terminées à facturer',
                count: queues.intvAFacturer.length,
                subtitle: 'Espace Facturation B2B / B2C',
                accent: '#3b82f6',
                onClick: () => {
                  handleSectionChange('facturation');
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

          {/* =================================================================
              SLEEK GLASSMORPHISM ANALYTICS & SMOOTH CHARTS (BLUE & WHITE)
             ================================================================= */}
          {(() => {
            const totalDevisHT = devisList.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
            const acceptedDevisHT = devisList
              .filter((d) => d.statutCommercial === 'Accepté')
              .reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
            const conversionRate =
              devisList.length > 0
                ? Math.round(
                    (devisList.filter((d) => d.statutCommercial === 'Accepté').length /
                      devisList.length) *
                      100
                  )
                : 0;

            const plannedOrDoneIntvs = interventionsList.filter((i) =>
              ['Planifiée', 'En cours', 'Terminée - à valider', 'Clôturée'].includes(
                i.statutOperationnel
              )
            ).length;
            const executionRate =
              interventionsList.length > 0
                ? Math.round((plannedOrDoneIntvs / interventionsList.length) * 100)
                : 0;

            const closedIntvs = interventionsList.filter((i) =>
              ['Terminée - à valider', 'Clôturée'].includes(i.statutOperationnel)
            );
            const billedIntvs = closedIntvs.filter((i) => i.statutFacture === 'Facturée').length;
            const billingRate =
              closedIntvs.length > 0 ? Math.round((billedIntvs / closedIntvs.length) * 100) : 100;

            // Group activity across top 6 trades for smooth spline curves & bar analytics
            const topTrades = ['Électricité', 'Plomberie', 'Serrurerie', 'Peinture', 'CVC / Clim', 'Menuiserie'];
            const tradeSeries = topTrades.map((trade) => {
              const key = trade.split(' ')[0].toLowerCase();
              const intvCount = interventionsList.filter((i) =>
                (i.corpsEtat || '').toLowerCase().includes(key)
              ).length;
              const devCount = devisList.filter((d) =>
                (d.corpsEtat || '').toLowerCase().includes(key)
              ).length;
              return {
                label: trade.split(' ')[0],
                intv: intvCount,
                devis: devCount,
                total: intvCount + devCount,
              };
            });

            const maxVal = Math.max(6, ...tradeSeries.map((t) => Math.max(t.intv, t.devis, 1)));
            const chartW = 520;
            const chartH = 148;
            const padX = 28;
            const padY = 18;
            const usableW = chartW - padX * 2;
            const usableH = chartH - padY * 2;

            const buildSmoothPath = (values: number[]) => {
              const pts = values.map((v, idx) => ({
                x: padX + (idx / Math.max(1, values.length - 1)) * usableW,
                y: padY + usableH - (v / maxVal) * usableH,
              }));
              if (pts.length === 0) return { line: '', area: '', pts: [] };
              let d = `M ${pts[0].x} ${pts[0].y}`;
              for (let i = 0; i < pts.length - 1; i++) {
                const p0 = pts[i];
                const p1 = pts[i + 1];
                const cx = (p0.x + p1.x) / 2;
                d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
              }
              const area = `${d} L ${pts[pts.length - 1].x} ${padY + usableH} L ${pts[0].x} ${
                padY + usableH
              } Z`;
              return { line: d, area, pts };
            };

            const intvCurve = buildSmoothPath(tradeSeries.map((t) => t.intv));
            const devisCurve = buildSmoothPath(tradeSeries.map((t) => t.devis));

            const circumference = 2 * Math.PI * 44;
            const execDash = (executionRate / 100) * circumference;

            return (
              <div className="analytics-glass-grid">
                {/* CARD 1 : Smooth Spline Area Chart (Activité & Pipeline Financier) */}
                <div className="glass-analytics-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: '10px',
                            fontWeight: 800,
                            background: 'rgba(37, 99, 235, 0.12)',
                            color: '#2563eb',
                            letterSpacing: '0.04em',
                          }}
                        >
                          MODERN ANALYTICS
                        </span>
                        <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                          Dynamique des Interventions & Pipeline Devis
                        </h3>
                      </div>
                      <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Courbe analytique par pôle métier • Suivi temps réel ANELEC
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Pipeline Devis HT
                        </div>
                        <div className="font-mono" style={{ fontSize: '15px', fontWeight: 800, color: '#2563eb' }}>
                          {formatCurrency(totalDevisHT)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', paddingLeft: '12px', borderLeft: '1px solid var(--border-default)' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Signés / Acceptés
                        </div>
                        <div className="font-mono" style={{ fontSize: '15px', fontWeight: 800, color: '#0ea5e9' }}>
                          {formatCurrency(acceptedDevisHT)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <svg viewBox={`0 0 ${chartW} ${chartH}`} className="smooth-chart-svg">
                    <defs>
                      <linearGradient id="blueAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity="0.32" />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity="0.01" />
                      </linearGradient>
                      <linearGradient id="cyanAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.24" />
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.01" />
                      </linearGradient>
                    </defs>

                    {[0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                      const y = padY + usableH * ratio;
                      return (
                        <line
                          key={idx}
                          x1={padX}
                          y1={y}
                          x2={chartW - padX}
                          y2={y}
                          stroke="rgba(37, 99, 235, 0.08)"
                          strokeDasharray="4 4"
                        />
                      );
                    })}

                    <path d={devisCurve.area} fill="url(#cyanAreaGrad)" />
                    <path d={intvCurve.area} fill="url(#blueAreaGrad)" />

                    <path
                      d={devisCurve.line}
                      className="smooth-chart-line"
                      stroke="#0ea5e9"
                      strokeWidth="2.5"
                    />
                    <path
                      d={intvCurve.line}
                      className="smooth-chart-line"
                      stroke="#2563eb"
                      strokeWidth="3"
                    />

                    {intvCurve.pts.map((pt, i) => (
                      <g key={i}>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="4.5"
                          fill="#ffffff"
                          stroke="#2563eb"
                          strokeWidth="2.5"
                        />
                        <text
                          x={pt.x}
                          y={chartH - 2}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="600"
                          fill="#475569"
                        >
                          {tradeSeries[i].label}
                        </text>
                      </g>
                    ))}
                  </svg>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', gap: '14px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 700, color: '#2563eb' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2563eb' }} />
                        Interventions ({interventionsList.length})
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 700, color: '#0ea5e9' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0ea5e9' }} />
                        Devis ({devisList.length})
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '2px 10px', fontSize: '11px' }}
                      onClick={() => handleSectionChange('planning')}
                    >
                      Fluidifier le Planning →
                    </button>
                  </div>
                </div>

                {/* CARD 2 : Smooth Radial / Donut Performance Gauge */}
                <div className="glass-analytics-card">
                  <div>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '10px',
                        fontWeight: 800,
                        background: 'rgba(14, 165, 233, 0.12)',
                        color: '#0284c7',
                        letterSpacing: '0.04em',
                      }}
                    >
                      PERFORMANCE TCE
                    </span>
                    <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                      Indice de Planification & Transformation
                    </h3>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '4px 0' }}>
                    <div style={{ position: 'relative', width: '112px', height: '112px', flexShrink: 0 }}>
                      <svg width="112" height="112" viewBox="0 0 112 112">
                        <defs>
                          <linearGradient id="ringBlueGrad" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#1d4ed8" />
                            <stop offset="55%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#0ea5e9" />
                          </linearGradient>
                        </defs>
                        <circle
                          cx="56"
                          cy="56"
                          r="44"
                          fill="none"
                          stroke="rgba(37, 99, 235, 0.1)"
                          strokeWidth="10"
                        />
                        <circle
                          cx="56"
                          cy="56"
                          r="44"
                          fill="none"
                          stroke="url(#ringBlueGrad)"
                          strokeWidth="10"
                          strokeLinecap="round"
                          strokeDasharray={`${execDash} ${circumference}`}
                          transform="rotate(-90 56 56)"
                        />
                      </svg>
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span className="font-mono" style={{ fontSize: '21px', fontWeight: 800, color: '#1e40af' }}>
                          {executionRate}%
                        </span>
                        <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-muted)' }}>
                          PLANIFIÉ
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 700, marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Transformation Devis</span>
                          <span className="font-mono" style={{ color: '#2563eb' }}>{conversionRate}%</span>
                        </div>
                        <div className="smooth-bar-track">
                          <div className="smooth-bar-fill" style={{ width: `${Math.max(8, conversionRate)}%` }} />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 700, marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Exécution Terrain</span>
                          <span className="font-mono" style={{ color: '#0284c7' }}>{executionRate}%</span>
                        </div>
                        <div className="smooth-bar-track">
                          <div className="smooth-bar-fill" style={{ width: `${Math.max(8, executionRate)}%` }} />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 700, marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Facturation Clôturées</span>
                          <span className="font-mono" style={{ color: '#0ea5e9' }}>{billingRate}%</span>
                        </div>
                        <div className="smooth-bar-track">
                          <div className="smooth-bar-fill" style={{ width: `${Math.max(8, billingRate)}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{plannedOrDoneIntvs} / {interventionsList.length} missions actives</span>
                    <span className="font-mono" style={{ color: '#2563eb', fontWeight: 700 }}>Temps réel ●</span>
                  </div>
                </div>

                {/* CARD 3 : Smooth Trade & Capacity Breakdown */}
                <div className="glass-analytics-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '10px',
                          fontWeight: 800,
                          background: 'rgba(37, 99, 235, 0.12)',
                          color: '#2563eb',
                          letterSpacing: '0.04em',
                        }}
                      >
                        CORPS D'ÉTAT
                      </span>
                      <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                        Volume par Métier TCE
                      </h3>
                    </div>
                    <span className="font-mono" style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb' }}>
                      {interventionsList.length + devisList.length} dossiers
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {tradeSeries.slice(0, 5).map((tr) => {
                      const pct = Math.min(100, Math.round((tr.total / Math.max(1, maxVal * 1.4)) * 100));
                      return (
                        <div key={tr.label} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{tr.label}</span>
                            <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              <strong>{tr.intv}</strong> intv • <strong>{tr.devis}</strong> devis
                            </span>
                          </div>
                          <div className="smooth-bar-track">
                            <div
                              className="smooth-bar-fill"
                              style={{ width: `${Math.max(10, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '2px 10px', fontSize: '11px' }}
                      onClick={() => handleSectionChange('interventions')}
                    >
                      Voir toutes les missions →
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Bannière d'alerte Rapports & Photos reçus */}
          {queues.rapportsEnAttente.length > 0 && (
            <div
              className="pro-table-container"
              style={{
                padding: '14px 18px',
                borderLeft: '4px solid #06b6d4',
                background: 'rgba(6, 182, 212, 0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>📷</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-primary)' }}>
                    🔔 {queues.rapportsEnAttente.length} Rapport(s) terrain avec photos reçus des techniciens en attente de vérification !
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Dernières déclarations :{' '}
                    {queues.rapportsEnAttente
                      .slice(0, 4)
                      .map((r) => `${r.reference || `INT-${r.id}`} (${r.entreprise || 'Tech'})`)
                      .join(' • ')}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ background: '#0891b2', borderColor: '#0891b2' }}
                  onClick={() => {
                    setAdminSubTab('rapports');
                    handleSectionChange('admin');
                  }}
                >
                  📝 Vérifier & Valider dans le Centre des Rapports →
                </button>
              </div>
            </div>
          )}

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
          technicienCompetences={refs.technicien_competences || DEFAULT_TECHNICIEN_COMPETENCES}
          corpsEtatList={corpsEtatList}
          onUpdateCompetences={async (nextMap) => {
            await referentielsApi.updateCompetences(nextMap);
            queryClient.invalidateQueries({ queryKey: ['referentiels'] });
          }}
          equipesJournalieres={refs.equipes_journalieres || []}
          onUpdateEquipes={async (nextEquipes) => {
            await referentielsApi.updateEquipes(nextEquipes);
            queryClient.invalidateQueries({ queryKey: ['referentiels'] });
          }}
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
          onDeleteDevis={async (id) => {
            await deleteDevisMut.mutateAsync(id);
          }}
          onDeleteIntervention={async (id) => {
            await deleteIntvMut.mutateAsync(id);
          }}
          onNavigateToRentabilite={() => handleSectionChange('rentabilite')}
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
                    <th style={{ width: '105px' }}>Référence</th>
                    <th style={{ minWidth: '120px', maxWidth: '160px' }}>Client & Site</th>
                    <th style={{ minWidth: '130px', maxWidth: '180px' }}>Corps d'état & Objet</th>
                    <th style={{ width: '95px' }}>Responsable</th>
                    <th style={{ width: '90px' }}>Montant HT</th>
                    <th style={{ width: '105px' }}>Statut & Visite</th>
                    <th style={{ width: '100px' }}>Échéance</th>
                    <th style={{ textAlign: 'right', width: '150px' }}>Actions</th>
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
                      <td className="font-mono" style={{ fontWeight: 700, color: '#0f172a', fontSize: '11px', whiteSpace: 'nowrap' }}>
                        {d.reference || `DEV-${d.id}`}
                        {(d.interventionsCount || 0) > 0 && (
                          <span
                            style={{
                              marginLeft: '4px',
                              padding: '1px 5px',
                              fontSize: '9.5px',
                              borderRadius: '4px',
                              background: '#ecfdf5',
                              color: '#047857',
                              border: '1px solid #a7f3d0',
                              fontWeight: 700,
                            }}
                          >
                            INT liée
                          </span>
                        )}
                      </td>
                      <td style={{ maxWidth: '160px' }}>
                        <div style={{ fontWeight: 700, fontSize: '11.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.client || ''}>
                          {d.client || '—'}
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.site || ''}>
                          {d.site || '—'}
                        </div>
                      </td>
                      <td style={{ maxWidth: '180px' }}>
                        <div style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {d.corpsEtat || '—'}
                        </div>
                        <div
                          style={{
                            fontSize: '10.5px',
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={d.objet || ''}
                        >
                          {d.objet || '—'}
                        </div>
                      </td>
                      <td style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>{d.responsable || '—'}</td>
                      <td className="font-mono" style={{ fontWeight: 700, fontSize: '11.5px', whiteSpace: 'nowrap' }}>
                        {formatCurrency(d.amount)}
                      </td>
                      <td>
                        <StatusPill statut={d.statutCommercial} />
                        {(d.visiteNecessaire || d.visiteTechnicien) && (
                          <div style={{ fontSize: '10px', color: '#7c3aed', marginTop: '2px', whiteSpace: 'nowrap' }}>
                            Visite : {d.visiteTechnicien || 'À affecter'}
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
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
                        <div style={{ display: 'inline-flex', gap: '4px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 7px', fontSize: '10.5px' }}
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
                            Visite
                          </button>
                          {(!d.interventionsCount || d.interventionsCount === 0) && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{ padding: '2px 7px', fontSize: '10.5px' }}
                              onClick={() => convertDevisMut.mutate(d.id)}
                            >
                              → INT
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
                    <th style={{ width: '95px' }}>Réf.</th>
                    <th style={{ minWidth: '110px', maxWidth: '145px' }}>Client & Chantier</th>
                    <th style={{ minWidth: '130px', maxWidth: '175px' }}>Corps d'état & Objet</th>
                    <th style={{ width: '95px' }}>Technicien</th>
                    <th style={{ width: '105px' }}>Créneau</th>
                    <th style={{ width: '100px' }}>Statut</th>
                    <th style={{ width: '105px' }}>Photos / Rap.</th>
                    <th style={{ width: '85px' }}>Facture</th>
                    <th style={{ textAlign: 'right', width: '110px' }}>Actions</th>
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
                      <td className="font-mono" style={{ fontWeight: 700, color: '#0f172a', fontSize: '11px', whiteSpace: 'nowrap' }}>
                        {i.reference || `INT-${i.id}`}
                      </td>
                      <td style={{ maxWidth: '145px' }}>
                        <div style={{ fontWeight: 700, fontSize: '11.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={i.client || ''}>
                          {i.client || '—'}
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={i.chantier || ''}>
                          {i.chantier || '—'}
                        </div>
                      </td>
                      <td style={{ maxWidth: '175px' }}>
                        <div style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={i.corpsEtat || i.typeIntervention || ''}>
                          {i.corpsEtat || i.typeIntervention || '—'}
                        </div>
                        <div
                          style={{
                            fontSize: '10.5px',
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={i.objet || ''}
                        >
                          {i.objet || '—'}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600, fontSize: '11px', whiteSpace: 'nowrap' }}>
                        {i.entreprise || 'À affecter'}
                      </td>
                      <td className="font-mono" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{formatDateFR(i.datePlanifiee)}</div>
                        {i.heureDebut && (
                          <div style={{ color: '#047857', fontSize: '10px', fontWeight: 700 }}>
                            {i.heureDebut}–{i.heureFin || '12:00'}
                          </div>
                        )}
                      </td>
                      <td>
                        <StatusPill statut={i.statutOperationnel} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            {i.photos && i.photos.length > 0 ? (
                              <button
                                type="button"
                                className="badge badge-info"
                                style={{
                                  cursor: 'pointer',
                                  border: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                  padding: '1px 5px',
                                  fontSize: '10px',
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLightboxPhotos(i.photos as any);
                                  setLightboxIndex(0);
                                }}
                                title="Voir les photos en haute résolution"
                              >
                                📷 {i.photos.length}
                              </button>
                            ) : (
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Sans photo</span>
                            )}
                            {i.actionsRealisees && i.actionsRealisees.length > 0 && (
                              <span
                                className="badge badge-success"
                                style={{ fontSize: '9.5px', padding: '1px 4px' }}
                                title={`${i.actionsRealisees.length} actions déclarées`}
                              >
                                ✓ {i.actionsRealisees.length}
                              </span>
                            )}
                          </div>
                          <span
                            className={`badge ${
                              i.statutRapport === 'Validé & Clôturé'
                                ? 'badge-success'
                                : i.statutRapport === 'Déclaré par technicien' || (i.photos && i.photos.length > 0)
                                ? 'badge-warning'
                                : 'badge-neutral'
                            }`}
                            style={{ fontSize: '9.5px', padding: '1px 5px', whiteSpace: 'nowrap' }}
                          >
                            {i.statutRapport === 'Déclaré par technicien'
                              ? '🔔 Reçu'
                              : i.statutRapport || 'À rédiger'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          className="font-mono"
                          style={{
                            fontSize: '10.5px',
                            whiteSpace: 'nowrap',
                            color: i.statutFacture === 'Facturée' ? '#047857' : '#64748b',
                            fontWeight: 700,
                          }}
                        >
                          {i.statutFacture || 'Non facturée'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: '4px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ padding: '2px 7px', fontSize: '10.5px' }}
                            onClick={() => {
                              setIsCreatingIntv(false);
                              setSelectedIntv(i);
                              setIntvTab('terrain');
                            }}
                          >
                            📝 Fiche
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 7px', fontSize: '10.5px' }}
                            onClick={() => handleSectionChange('planning')}
                          >
                            Gantt
                          </button>
                        </div>
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
          SECTION 4B : ESPACE FACTURATION & RELATION CLIENT (B2B & B2C)
         ===================================================================== */}
      {activeSection === 'facturation' && (
        <FacturationStudio
          devisList={devisList}
          interventionsList={interventionsList}
          onUpdateIntervention={async (id, data) => {
            await updateIntvMut.mutateAsync({ id, data });
          }}
          onUpdateDevis={async (id, data) => {
            await updateDevisMut.mutateAsync({ id, data });
          }}
          onOpenInterventionDrawer={(intv) => {
            setIsCreatingIntv(false);
            setSelectedIntv(intv);
          }}
          onOpenDevisDrawer={(d) => {
            setIsCreatingDevis(false);
            setSelectedDevis(d);
          }}
          onNavigateToPlanning={() => handleSectionChange('planning')}
          onOpenPhotoLightbox={(photos, idx) => {
            setLightboxPhotos(photos);
            setLightboxIndex(idx);
          }}
        />
      )}

      {/* =====================================================================
          SECTION 4C : ANALYSE DE RENTABILITÉ TECHNICIENS & ÉQUIPES TCE
         ===================================================================== */}
      {activeSection === 'rentabilite' && (
        <RentabiliteKpiView
          interventionsList={interventionsList}
          devisList={devisList}
          techniciens={techniciensList}
          onNavigateToPlanning={() => handleSectionChange('planning')}
          onOpenInterventionDrawer={(intv) => {
            setIsCreatingIntv(false);
            setSelectedIntv(intv);
          }}
        />
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
                const rawVals = refs[newRefCategory];
                const currentVals: string[] = Array.isArray(rawVals) ? rawVals.map(String) : [];
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

          <div className="pro-table-container" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-primary)' }}>
                  Matrice des Compétences Techniciens par Métier (Auto-Planification au Moindre de Compétences)
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Cochez les corps d'état maîtrisés par chaque technicien. L'auto-planification affecte en priorité le technicien qualifié ayant le <strong>moindre nombre total de compétences</strong> afin de préserver vos techniciens polyvalents pour les autres métiers.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {techniciensList.map((tech) => {
                const currentCompMap = refs.technicien_competences || DEFAULT_TECHNICIEN_COMPETENCES;
                const techSkills = currentCompMap[tech] || [];
                const isSpecialist = techSkills.length === 1;

                const toggleSkill = async (skill: string) => {
                  const exists = techSkills.includes(skill);
                  const updatedSkills = exists
                    ? techSkills.filter((s) => s !== skill)
                    : [...techSkills, skill];
                  const nextMap = { ...currentCompMap, [tech]: updatedSkills };
                  await referentielsApi.updateCompetences(nextMap);
                  queryClient.invalidateQueries({ queryKey: ['referentiels'] });
                  toast.success(`Compétences mises à jour pour ${tech}`);
                };

                return (
                  <div
                    key={tech}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-primary)' }}>
                          {tech}
                        </span>
                        <span
                          className="font-mono"
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontWeight: 700,
                            background: isSpecialist ? 'rgba(16, 185, 129, 0.14)' : 'rgba(37, 99, 235, 0.12)',
                            color: isSpecialist ? '#059669' : 'var(--accent-primary)',
                            border: isSpecialist
                              ? '1px solid rgba(16, 185, 129, 0.35)'
                              : '1px solid rgba(37, 99, 235, 0.25)',
                          }}
                        >
                          {techSkills.length} compétence{techSkills.length > 1 ? 's' : ''}{' '}
                          {isSpecialist
                            ? '• Spécialiste Exclusif (Priorité #1)'
                            : techSkills.length > 1
                            ? `• Polyvalent (Rang #${techSkills.length})`
                            : '• Aucune compétence'}
                        </span>
                      </div>

                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const input = e.currentTarget.elements.namedItem('customSkill') as HTMLInputElement;
                          const val = input?.value?.trim();
                          if (!val) return;
                          if (!techSkills.includes(val)) {
                            const nextMap = { ...currentCompMap, [tech]: [...techSkills, val] };
                            await referentielsApi.updateCompetences(nextMap);
                            queryClient.invalidateQueries({ queryKey: ['referentiels'] });
                            toast.success(`Compétence « ${val} » ajoutée à ${tech}`);
                          }
                          input.value = '';
                        }}
                        style={{ display: 'flex', gap: '6px' }}
                      >
                        <input
                          name="customSkill"
                          type="text"
                          className="input"
                          placeholder="+ Ajouter une compétence métier..."
                          style={{ width: '215px', height: '28px', fontSize: '11.5px', padding: '2px 8px' }}
                        />
                        <button type="submit" className="btn btn-secondary btn-sm" style={{ padding: '2px 10px' }}>
                          Ajouter
                        </button>
                      </form>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {Array.from(new Set([...corpsEtatList, ...techSkills])).map((metier) => {
                        const checked = techSkills.includes(metier);
                        return (
                          <button
                            key={metier}
                            type="button"
                            onClick={() => toggleSkill(metier)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '7px',
                              fontSize: '11.5px',
                              fontWeight: checked ? 700 : 500,
                              cursor: 'pointer',
                              border: checked
                                ? '1px solid var(--accent-primary)'
                                : '1px solid var(--border-default)',
                              background: checked ? 'var(--accent-glow)' : 'var(--bg-surface)',
                              color: checked ? 'var(--accent-primary)' : 'var(--text-secondary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                            }}
                          >
                            <span>{checked ? '✓' : '+'}</span>
                            <span>{metier}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
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
          SECTION 6 : WORKSTATION ADMIN (UTILISATEURS, DROITS, POINTAGES & RAPPORTS)
         ===================================================================== */}
      {activeSection === 'admin' && (
        <AdminWorkstation
          techniciens={techniciensList}
          interventionsList={interventionsList}
          devisList={devisList}
          initialSubTab={adminSubTab}
          onOpenInterventionDrawer={(intv) => {
            setIsCreatingIntv(false);
            setSelectedIntv(intv);
          }}
          onOpenDevisDrawer={(devis) => {
            setIsCreatingDevis(false);
            setSelectedDevis(devis);
          }}
          onSwitchToMobilePreview={(techName) => {
            setSelectedMobileTech(techName);
            handleSectionChange('mobile_tech');
          }}
        />
      )}

      {/* =====================================================================
          SECTION 7 : APPLICATION MOBILE DÉDIÉE TECHNICIEN TERRAIN
         ===================================================================== */}
      {activeSection === 'mobile_tech' && (
        <TechnicianMobileView
          techniciens={isMobileTechUser ? [user?.technicienNom || user?.name || 'Technicien'] : techniciensList}
          currentTechnicien={
            isMobileTechUser
              ? (user?.technicienNom || user?.name || 'Technicien')
              : (selectedMobileTech || user?.technicienNom || techniciensList[0] || 'Anouar')
          }
          canSwitchTechnicien={!isMobileTechUser}
          onSelectTechnicien={(t) => {
            if (!isMobileTechUser) setSelectedMobileTech(t);
          }}
          interventionsList={interventionsList}
          devisList={devisList}
        />
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
                {
                  id: 'terrain',
                  label: `2. Dossier Terrain & Photos ${(selectedIntv?.photos || []).length > 0 ? `(${selectedIntv!.photos!.length}) 📷` : ''}`,
                },
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Bandeau de Statut et Pointage Réel */}
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        STATUT DU RAPPORT
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                        <span
                          className={`badge ${
                            selectedIntv.statutRapport === 'Validé & Clôturé'
                              ? 'badge-success'
                              : selectedIntv.statutRapport === 'Déclaré par technicien'
                              ? 'badge-warning'
                              : 'badge-neutral'
                          }`}
                          style={{ fontSize: '12px', fontWeight: 700 }}
                        >
                          {selectedIntv.statutRapport || 'À déclarer / rédiger'}
                        </span>
                        {selectedIntv.entreprise && (
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            • Intervenant : <strong>{selectedIntv.entreprise}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div
                        style={{
                          background: 'rgba(5, 150, 105, 0.1)',
                          border: '1px solid rgba(5, 150, 105, 0.25)',
                          borderRadius: '8px',
                          padding: '6px 12px',
                        }}
                      >
                        <div style={{ fontSize: '10px', color: '#059669', fontWeight: 700 }}>
                          ☀️ ARRIVÉE RÉELLE POINTÉE
                        </div>
                        <div className="font-mono" style={{ fontSize: '14px', fontWeight: 800, color: '#059669' }}>
                          {selectedIntv.heureDebutReelle || '— : —'}
                        </div>
                      </div>

                      <div
                        style={{
                          background: 'rgba(37, 99, 235, 0.1)',
                          border: '1px solid rgba(37, 99, 235, 0.25)',
                          borderRadius: '8px',
                          padding: '6px 12px',
                        }}
                      >
                        <div style={{ fontSize: '10px', color: '#2563eb', fontWeight: 700 }}>
                          🌙 DÉPART RÉEL POINTÉ
                        </div>
                        <div className="font-mono" style={{ fontSize: '14px', fontWeight: 800, color: '#2563eb' }}>
                          {selectedIntv.heureFinReelle || '— : —'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions pré-remplies / réalisées sur site */}
                  {selectedIntv.actionsRealisees && selectedIntv.actionsRealisees.length > 0 && (
                    <div
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                      }}
                    >
                      <div style={{ fontSize: '11.5px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                        ✓ Prestations & Actions réalisées sur site ({selectedIntv.actionsRealisees.length}) :
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {selectedIntv.actionsRealisees.map((act, idx) => (
                          <span key={idx} className="badge badge-success" style={{ fontSize: '11px', padding: '4px 8px' }}>
                            ✓ {act}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dossier photographique du technicien */}
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700 }}>
                        📷 Dossier Photos Terrain ({selectedIntv.photos?.length || 0})
                      </div>
                      <span style={{ fontSize: '10.5px', color: '#0284c7', fontWeight: 600 }}>
                        Stockage optimisé (~50 Ko / photo) • Cliquez pour agrandir
                      </span>
                    </div>

                    {selectedIntv.photos && selectedIntv.photos.length > 0 ? (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                          gap: '10px',
                        }}
                      >
                        {selectedIntv.photos.map((ph, idx) => (
                          <div
                            key={ph.id || idx}
                            onClick={() => {
                              setLightboxPhotos(selectedIntv.photos as any);
                              setLightboxIndex(idx);
                            }}
                            style={{
                              borderRadius: '8px',
                              overflow: 'hidden',
                              border: '1px solid var(--border-default)',
                              background: 'var(--bg-surface)',
                              cursor: 'pointer',
                              position: 'relative',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                              transition: 'transform 0.15s ease',
                            }}
                            title="Agrandir en haute résolution"
                          >
                            <img
                              src={ph.url}
                              alt={ph.caption || 'Photo'}
                              style={{ width: '100%', height: '90px', objectFit: 'cover' }}
                            />
                            <div style={{ padding: '4px 6px' }}>
                              <div
                                style={{
                                  fontSize: '9.5px',
                                  fontWeight: 800,
                                  color: '#0284c7',
                                  textTransform: 'uppercase',
                                }}
                              >
                                {ph.category || 'TERRAIN'}
                              </div>
                              <div
                                style={{
                                  fontSize: '10.5px',
                                  color: 'var(--text-secondary)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {ph.caption || 'Sans légende'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '10px 0' }}>
                        Aucune photo transmise pour le moment.
                      </div>
                    )}
                  </div>

                  {/* Relevé Chiffrage / Devis supplémentaire */}
                  {selectedIntv.elementsChiffrage && (
                    <div
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        background: 'rgba(124, 58, 237, 0.08)',
                        border: '1px solid rgba(124, 58, 237, 0.25)',
                      }}
                    >
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#7c3aed', marginBottom: '4px' }}>
                        📐 Éléments relevés par le technicien pour chiffrage / devis :
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                        {selectedIntv.elementsChiffrage}
                      </div>
                    </div>
                  )}

                  {/* Compte-rendu terrain */}
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Compte-rendu d'intervention terrain (relevé du technicien)
                    </label>
                    <textarea
                      className="textarea"
                      rows={4}
                      value={selectedIntv.compteRendu || ''}
                      onChange={(e) => setSelectedIntv({ ...selectedIntv, compteRendu: e.target.value })}
                      placeholder="Constatations et compte-rendu terrain..."
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Résultat technique
                      </label>
                      <input
                        className="input"
                        value={selectedIntv.resultatTechnique || ''}
                        onChange={(e) => setSelectedIntv({ ...selectedIntv, resultatTechnique: e.target.value })}
                        placeholder="Ex: Intervention réalisée sans réserve"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Motif de blocage (si suspendue/bloquée)
                      </label>
                      <input
                        className="input"
                        value={selectedIntv.motifBlocage || ''}
                        onChange={(e) => setSelectedIntv({ ...selectedIntv, motifBlocage: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Rapport Final Officiel consolidé */}
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700 }}>
                        Rapport Final Officiel ANELEC GROUPE
                      </label>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          const lines: string[] = [];
                          lines.push(`RAPPORT OFFICIEL D'INTERVENTION — ANELEC GROUPE`);
                          lines.push(`Référence : ${selectedIntv.reference || `INT-${selectedIntv.id}`}`);
                          lines.push(`Client : ${selectedIntv.client || '—'} • Site : ${selectedIntv.chantier || '—'}`);
                          lines.push(`Technicien : ${selectedIntv.entreprise || 'Non renseigné'}`);
                          lines.push(`Date : ${formatDateFR(selectedIntv.datePlanifiee)} • Horaires réels pointés : ${selectedIntv.heureDebutReelle || '—'} à ${selectedIntv.heureFinReelle || '—'}`);
                          if (selectedIntv.actionsRealisees?.length) {
                            lines.push('');
                            lines.push(`PRESTATIONS RÉALISÉES :`);
                            selectedIntv.actionsRealisees.forEach((a) => lines.push(`- ${a}`));
                          }
                          if (selectedIntv.compteRendu) {
                            lines.push('');
                            lines.push(`CONSTATATIONS TERRAIN :`);
                            lines.push(selectedIntv.compteRendu);
                          }
                          if (selectedIntv.photos?.length) {
                            lines.push('');
                            lines.push(`DOSSIER PHOTOS : ${selectedIntv.photos.length} photo(s) jointe(s).`);
                          }
                          lines.push('');
                          lines.push(`CONCLUSION : ${selectedIntv.resultatTechnique || 'Intervention réalisée sans réserve.'}`);
                          setSelectedIntv({
                            ...selectedIntv,
                            rapportFinal: lines.join('\n'),
                            statutRapport: 'Validé & Clôturé',
                            statutOperationnel: 'Clôturée',
                          });
                          toast.success('Rapport officiel pré-rempli et prêt à être validé');
                        }}
                      >
                        ⚡ Générer depuis les données terrain
                      </button>
                    </div>
                    <textarea
                      className="textarea font-mono"
                      rows={6}
                      style={{ fontSize: '11.5px', lineHeight: 1.45 }}
                      value={selectedIntv.rapportFinal || ''}
                      onChange={(e) => setSelectedIntv({ ...selectedIntv, rapportFinal: e.target.value })}
                      placeholder="Texte officiel du rapport client..."
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11.5px', fontWeight: 600 }}>Statut rapport :</label>
                        <select
                          className="select"
                          style={{ width: '200px' }}
                          value={selectedIntv.statutRapport || 'Déclaré par technicien'}
                          onChange={(e) => setSelectedIntv({ ...selectedIntv, statutRapport: e.target.value })}
                        >
                          <option value="Déclaré par technicien">Déclaré par technicien</option>
                          <option value="Rapport rédigé">Rapport rédigé (en attente)</option>
                          <option value="Validé & Clôturé">Validé & Clôturé</option>
                        </select>
                      </div>
                    </div>
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
      {/* Visionneuse plein écran de photos (Lightbox) */}
      {lightboxPhotos && (
        <PhotoLightbox
          photos={lightboxPhotos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxPhotos(null)}
        />
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
  // Charte stricte ANELEC : 3 couleurs logo (Vert #00bf63, Jaune #ffcc00, Rouge #ff0000) + Foncés #0a0f1d
  // Texte en contraste élevé AAA (lisible sans effort sur fond blanc)
  const colorMap: Record<string, { bg: string; fg: string; dot: string; border: string }> = {
    Accepté: { bg: '#ecfdf5', fg: '#047857', dot: '#00bf63', border: '#a7f3d0' },
    Clôturée: { bg: '#ecfdf5', fg: '#047857', dot: '#00bf63', border: '#a7f3d0' },
    'Terminée - à valider': { bg: '#ecfdf5', fg: '#047857', dot: '#00bf63', border: '#a7f3d0' },
    Planifiée: { bg: '#f8fafc', fg: '#0f172a', dot: '#0a0f1d', border: '#cbd5e1' },
    Affectée: { bg: '#f8fafc', fg: '#0f172a', dot: '#0a0f1d', border: '#cbd5e1' },
    'En cours': { bg: '#fffbeb', fg: '#b45309', dot: '#ffcc00', border: '#fde68a' },
    'En attente technicien': { bg: '#fffbeb', fg: '#b45309', dot: '#ffcc00', border: '#fde68a' },
    'Envoyé au client': { bg: '#f8fafc', fg: '#0f172a', dot: '#00bf63', border: '#cbd5e1' },
    'En négociation': { bg: '#fffbeb', fg: '#b45309', dot: '#ffcc00', border: '#fde68a' },
    'À planifier': { bg: '#fffbeb', fg: '#b45309', dot: '#ffcc00', border: '#fde68a' },
    Suspendue: { bg: '#fef2f2', fg: '#b91c1c', dot: '#ff0000', border: '#fecaca' },
    Refusé: { bg: '#fef2f2', fg: '#b91c1c', dot: '#ff0000', border: '#fecaca' },
  };
  const st = colorMap[statut] || { bg: '#f8fafc', fg: '#0f172a', dot: '#64748b', border: '#e2e8f0' };

  return (
    <span
      className="status-pill"
      style={{
        background: st.bg,
        color: st.fg,
        border: `1px solid ${st.border}`,
        fontWeight: 700,
        fontSize: '11px',
        padding: '2px 8px',
        borderRadius: '6px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
      }}
    >
      <span className="status-dot" style={{ background: st.dot, width: '6px', height: '6px', borderRadius: '50%' }} />
      {statut}
    </span>
  );
}
