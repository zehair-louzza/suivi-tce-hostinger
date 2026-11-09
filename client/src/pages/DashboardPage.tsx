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
  ClientProfile,
  SendReportEmailPayload,
  STATUTS_COMMERCIAUX_DEVIS,
  TRAITEMENTS_ADMIN,
  PROCHAINES_ACTIONS_DEVIS,
  PRIORITES,
  CANAUX_RECEPTION,
  TYPES_INTERVENTION,
  MODES_PLANIFICATION,
  STATUTS_OPERATIONNELS_INTERVENTION,
  STATUTS_FACTURE,
  formatDateFR,
  demandeApi
} from '../lib/api';
import { Layout, AppSection } from '../components/Layout';




import { TechnicianMobileView } from '../components/TechnicianMobileView';

import { PhotoLightbox, PhotoItem } from '../components/PhotoLightbox';
import { SendReportEmailModal } from '../components/SendReportEmailModal';

import { SituationReportModal } from '../components/SituationReportModal';
import { exportSituationInterventionsExcel, exportSituationDevisExcel } from '../lib/exportSituationExcel';
import { DashboardSynthese } from '../components/dashboard/DashboardSynthese';
import { DashboardOperations } from '../components/dashboard/DashboardOperations';
import { DashboardAnalyse } from '../components/dashboard/DashboardAnalyse';
import { DevisStudioView } from '../components/DevisStudioView';
import { InterventionsStudioView } from '../components/InterventionsStudioView';
import { PlanningStudioView } from '../components/PlanningStudioView';
import { CarteStudioView } from '../components/CarteStudioView';
import { FacturationStudioView } from '../components/FacturationStudioView';
import { ComptabiliteStudioView } from '../components/ComptabiliteStudioView';
import { DonneursOrdreStudioView } from '../components/DonneursOrdreStudioView';
import { ParametresStudioView } from '../components/ParametresStudioView';
import { AdminWorkstation } from '../components/AdminWorkstation';
import { DemandesStudioView } from '../components/DemandesStudioView';
import type { PeriodeId } from '../lib/periode';
import { MaFileView } from '../components/MaFileView';
import { DossierPanel } from '../components/DossierPanel';
import { DossierDIField } from '../components/DossierDIField';
import { useDevisRealtime, useInterventionRealtime } from '../hooks/useSocket';
import { useAuth } from '../stores/authStore';
import toast from 'react-hot-toast';
import {
  isUserMobileOnly,
  canUserAccessSection,
  getDefaultAuthorizedSection,
} from '../../../shared/types';
import { ProAlertIcon, ProLockIcon } from '../components/ProIcons';

/** Frise chronologique des événements enregistrés par le serveur (création, modifications, conversions…). */
function HistoriqueTimeline({ events }: { events?: Array<{ id?: string; date?: string; auteur?: string; action?: string; details?: string }> }) {
  const list = Array.isArray(events) ? events : [];
  return (
    <div
      style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
      data-testid="historique-timeline"
    >
      <div style={{ fontWeight: 700, marginBottom: '8px' }}>Historique des actions ({list.length})</div>
      {list.length === 0 ? (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Aucun événement enregistré pour le moment.</div>
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {list.map((ev, i) => {
            const d = ev.date ? new Date(ev.date) : null;
            const when = d && !Number.isNaN(d.getTime())
              ? d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
              : '';
            return (
              <li key={ev.id || i} style={{ display: 'grid', gridTemplateColumns: '10px 1fr', gap: '10px' }}>
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--color-primary, #047857)', marginTop: 5 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>{ev.action || 'Événement'}</div>
                  {ev.details && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>{ev.details}</div>}
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{[when, ev.auteur].filter(Boolean).join(' · ')}</div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const isMobileTechUser = isUserMobileOnly(user);

  const sectionFromPath = (pathname: string): AppSection => {
    if (isMobileTechUser) return 'mobile_tech';
    let target: AppSection = 'aujourdhui';
    if (pathname.startsWith('/demandes')) target = 'demandes';
    else if (pathname.startsWith('/planning')) target = 'planning';
    else if (pathname.startsWith('/devis')) target = 'devis';
    else if (pathname.startsWith('/interventions')) target = 'interventions';
    else if (pathname.startsWith('/carte')) target = 'carte';
    else if (pathname.startsWith('/facturation')) target = 'facturation';
    else if (pathname.startsWith('/rentabilite')) target = 'rentabilite';
    else if (pathname.startsWith('/clients')) target = 'clients';
    else if (pathname.startsWith('/referentiels')) target = 'referentiels';
    else if (pathname.startsWith('/admin')) target = 'admin';
    else if (pathname.startsWith('/mobile')) target = 'mobile_tech';

    // Isolation stricte : si l'utilisateur n'a pas les droits pour cette section, basculer sur sa section par défaut
    if (!canUserAccessSection(target, user)) {
      return getDefaultAuthorizedSection(user) as AppSection;
    }
    return target;
  };

  const [activeSection, setActiveSection] = useState<AppSection>(() =>
    sectionFromPath(location.pathname)
  );
  const [selectedMobileTech, setSelectedMobileTech] = useState<string>(
    () => user?.technicienNom || ''
  );
  const [selectedMapTech, setSelectedMapTech] = useState<string>('TOUS');

  useEffect(() => {
    if (user?.technicienNom) {
      setSelectedMobileTech(user.technicienNom);
    }
  }, [user?.technicienNom]);

  useEffect(() => {
    setActiveSection(sectionFromPath(location.pathname));
  }, [location.pathname, isMobileTechUser, user?.role, user?.permissions]);

  const handleSectionChange = (sec: AppSection) => {
    if (!canUserAccessSection(sec, user)) {
      toast.error('Accès non autorisé à ce service');
      return;
    }
    setActiveSection(sec);
    const pathMap: Record<AppSection, string> = {
      aujourdhui: '/',
      demandes: '/demandes',
      planning: '/planning',
      devis: '/devis',
      interventions: '/interventions',
      carte: '/carte',
      facturation: '/facturation',
      rentabilite: '/rentabilite',
      clients: '/clients',
      referentiels: '/referentiels',
      admin: '/admin',
      mobile_tech: '/mobile',
    };
    navigate(pathMap[sec]);
  };

  // Dashboard Sub-Tabs (Synthèse / Opérations / Analyse - Refonte ANELEC)
  // Période du tableau de bord : partagée par les trois vues, et réellement filtrante
  const [dashboardPeriod, setDashboardPeriod] = useState<PeriodeId>('month');
  const [dashboardTab, setDashboardTab] = useState<'synthese' | 'operations' | 'analyse'>('synthese');

  // Table vs Kanban view modes for Devis & Interventions (Jobber / Linear style)
  const [_devisViewStyle, _setDevisViewStyle] = useState<'table' | 'kanban'>('table');
  const [_intvViewStyle, _setIntvViewStyle] = useState<'table' | 'kanban'>('table');

  // Filters
  const [devisSearch, setDevisSearch] = useState('');
  const [devisStatutFilter, setDevisStatutFilter] = useState('ALL');
  const [devisResponsableFilter, setDevisResponsableFilter] = useState('ALL');
  const [devisVisitesOnly] = useState(false);

  const [intvSearch, setIntvSearch] = useState('');
  const [intvStatutFilter, setIntvStatutFilter] = useState('ALL');
  const [intvTechFilter, setIntvTechFilter] = useState('ALL');
  void _devisViewStyle;
  void _setDevisViewStyle;
  void _intvViewStyle;
  void _setIntvViewStyle;
  void devisSearch;
  void setDevisSearch;
  void devisStatutFilter;
  void setDevisStatutFilter;
  void devisResponsableFilter;
  void setDevisResponsableFilter;
  void intvStatutFilter;
  void setIntvStatutFilter;
  void intvTechFilter;
  void setIntvTechFilter;


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

  // Modale d'envoi du Rapport Officiel d'Intervention par e-mail
  const [reportEmailIntv, setReportEmailIntv] = useState<Intervention | null>(null);

  // Modale des Rapports de Situation & Avancement en 1 Clic (Excel .xlsx)
  const [isSituationModalOpen, setIsSituationModalOpen] = useState(false);

  // Modal de Reconversion d'un Devis déjà transformé (SAV, Reprise, Avenant, Phase 2)
  const [reconversionModalDevis, setReconversionModalDevis] = useState<Devis | null>(null);
  const [reconversionMotif, setReconversionMotif] = useState<'SAV' | 'REPRISE' | 'AVENANT' | 'PHASE2'>('SAV');
  const [reconversionNotes, setReconversionNotes] = useState('');

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

  const canAccessDevisData = !isMobileTechUser && (canUserAccessSection('devis', user) || canUserAccessSection('aujourdhui', user));

  // Fetch Data (actualisation automatique via WebSockets + sécurité toutes les 25s)
  const { data: devisRes } = useQuery({
    queryKey: ['devis'],
    enabled: Boolean(user) && canAccessDevisData,
    queryFn: async () => {
      const r = await devisApi.list({ limit: 500 });
      return r.data;
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const boundTechnicienName = (user?.technicienNom || user?.name || '').trim();
  const { data: intvRes } = useQuery({
    queryKey: ['interventions', isMobileTechUser ? boundTechnicienName : 'all'],
    queryFn: async () => {
      const params: any = { limit: 500 };
      if (isMobileTechUser && boundTechnicienName) {
        params.technicien = boundTechnicienName;
      }
      const r = await interventionApi.list(params);
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
  // Les listes viennent uniquement du serveur (cloisonnées par entreprise) : aucune valeur « maison »
  // ANELEC n'est injectée côté navigateur, sinon une autre entreprise verrait vos noms et contacts.
  const refs: ReferentielsMap = refRes?.data || {
    ...DEFAULT_REFERENTIELS,
    clients: [],
    clients_fiches: [],
    responsables: [],
    techniciens: [],
    technicien_competences: {},
  };

  // Badge « Demandes reçues » : nombre de demandes encore à décider
  const { data: demandesQueue } = useQuery({
    queryKey: ['demandes'],
    queryFn: async () => (await demandeApi.list({ limit: 300 })).data.data,
    enabled: canUserAccessSection('demandes', user),
  });
  const demandesADecider = (demandesQueue || []).filter((d) => d.statut === 'A_DECIDER').length;

  const techniciensList = refs.techniciens || [];
  const responsablesList = refs.responsables || [];
  const corpsEtatList = refs.corps_etat?.length ? refs.corps_etat : DEFAULT_REFERENTIELS.corps_etat;
  const originesList = refs.origines?.length ? refs.origines : DEFAULT_REFERENTIELS.origines;
  const clientsList = refs.clients || [];
  const clientProfiles: ClientProfile[] = refs.clients_fiches || [];

  // Gestion des menus déroulants automatisés Donneurs d'ordre / Clients
  const [isCustomDevisClient, setIsCustomDevisClient] = useState(false);
  const [isCustomIntvClient, setIsCustomIntvClient] = useState(false);

  const devisClientOptions = useMemo(() => {
    const list = [...clientsList];
    if (selectedDevis?.client && !list.includes(selectedDevis.client)) {
      list.push(selectedDevis.client);
    }
    return list;
  }, [clientsList, selectedDevis?.client]);

  const intvClientOptions = useMemo(() => {
    const list = [...clientsList];
    if (selectedIntv?.client && !list.includes(selectedIntv.client)) {
      list.push(selectedIntv.client);
    }
    return list;
  }, [clientsList, selectedIntv?.client]);

  // Actions dynamiques sur les référentiels
  const [editingRef, setEditingRef] = useState<{ category: string; oldValue: string; currentVal: string } | null>(null);
  const [confirmDeleteRef, setConfirmDeleteRef] = useState<{ category: string; value: string } | null>(null);

  // État local réactif immédiat pour les compétences des techniciens (0ms)
  const [competencesOverrides, setCompetencesOverrides] = useState<Record<string, string[]> | null>(null);

  const activeCompMap: Record<string, string[]> = useMemo(() => {
    return {
      ...(refs.technicien_competences || DEFAULT_TECHNICIEN_COMPETENCES),
      ...(competencesOverrides || {}),
    };
  }, [refs.technicien_competences, competencesOverrides]);

  const handleToggleTechSkill = async (tech: string, skill: string) => {
    const currentSkills = activeCompMap[tech] || [];
    const exists = currentSkills.includes(skill);
    const updatedSkills = exists
      ? currentSkills.filter((s) => s !== skill)
      : [...currentSkills, skill];
    const nextMap = { ...activeCompMap, [tech]: updatedSkills };

    // 1. Mise à jour visuelle instantanée (0ms)
    setCompetencesOverrides(nextMap);

    // 2. Mise à jour directe du cache React Query
    queryClient.setQueryData(['referentiels'], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        data: {
          ...old.data,
          technicien_competences: nextMap,
        },
      };
    });

    // 3. Persistance serveur en arrière-plan
    try {
      await referentielsApi.updateCompetences(nextMap);
      toast.success(
        exists
          ? `« ${skill} » décochée pour ${tech}`
          : `« ${skill} » cochée pour ${tech}`,
        { duration: 2000 }
      );
    } catch (err: any) {
      toast.error(`Erreur d'enregistrement : ${err?.response?.data?.error || err.message || 'Échec réseau'}`);
      queryClient.invalidateQueries({ queryKey: ['referentiels'] });
    }
  };

  const handleAddCustomTechSkill = async (tech: string, skillName: string) => {
    const trimmed = skillName.trim();
    if (!trimmed) return;
    const currentSkills = activeCompMap[tech] || [];
    if (currentSkills.includes(trimmed)) {
      toast('Cette compétence est déjà attribuée à ce technicien', { icon: 'ℹ' });
      return;
    }
    const updatedSkills = [...currentSkills, trimmed];
    const nextMap = { ...activeCompMap, [tech]: updatedSkills };

    setCompetencesOverrides(nextMap);

    queryClient.setQueryData(['referentiels'], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        data: {
          ...old.data,
          technicien_competences: nextMap,
        },
      };
    });

    try {
      await referentielsApi.updateCompetences(nextMap);
      toast.success(`Compétence « ${trimmed} » ajoutée à ${tech}`);
    } catch (err: any) {
      toast.error(`Erreur : ${err?.response?.data?.error || err.message}`);
      queryClient.invalidateQueries({ queryKey: ['referentiels'] });
    }
  };

  const handleExecuteDeleteRef = async (category: string, valueToRemove: string) => {
    const rawVals = (refs as any)[category] || [];
    const currentVals: string[] = Array.isArray(rawVals) ? rawVals.map(String) : [];
    const nextVals = currentVals.filter((v) => v !== valueToRemove);
    try {
      await referentielsApi.updateCategory(category as any, nextVals);
      queryClient.invalidateQueries({ queryKey: ['referentiels'] });
      toast.success(`« ${valueToRemove} » supprimé du référentiel`);
    } catch {
      toast.error('Erreur lors de la suppression');
    } finally {
      setConfirmDeleteRef(null);
    }
  };

  const handleInlineAddRef = async (category: string, newValue: string) => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    const rawVals = (refs as any)[category] || [];
    const currentVals: string[] = Array.isArray(rawVals) ? rawVals.map(String) : [];
    if (currentVals.includes(trimmed)) {
      toast('Cette valeur existe déjà dans cette catégorie', { icon: 'ℹ' });
      return;
    }
    try {
      await referentielsApi.updateCategory(category as any, [...currentVals, trimmed]);
      queryClient.invalidateQueries({ queryKey: ['referentiels'] });
      toast.success(`« ${trimmed} » ajouté au référentiel`);
    } catch {
      toast.error("Erreur lors de l'ajout");
    }
  };

  const handleSaveInlineEditRef = async (category: string, oldValue: string, nextValue: string) => {
    const trimmed = nextValue.trim();
    if (!trimmed || trimmed === oldValue.trim()) {
      setEditingRef(null);
      return;
    }
    const rawVals = (refs as any)[category] || [];
    const currentVals: string[] = Array.isArray(rawVals) ? rawVals.map(String) : [];
    const nextVals = currentVals.map((v) => (v === oldValue ? trimmed : v));
    try {
      await referentielsApi.updateCategory(category as any, nextVals);
      queryClient.invalidateQueries({ queryKey: ['referentiels'] });
      toast.success(`Valeur mise à jour : « ${trimmed} »`);
    } catch {
      toast.error('Erreur lors de la modification');
    } finally {
      setEditingRef(null);
    }
  };

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
    mutationFn: ({ id, data }: { id: number; data?: any }) => devisApi.convert(id, data || { mode: 'travaux' }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      toast.success(res.data.message || `Intervention créée avec succès !`);
      if (selectedDevis && res.data.devis) {
        setSelectedDevis(res.data.devis);
      }
      setReconversionModalDevis(null);
      setReconversionNotes('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erreur lors de la conversion'),
  });

  const handleTriggerConvertDevis = (d: Devis) => {
    const linkedIntvs = interventionsList.filter(
      (i) => (i.devisId === d.id || i.origineDevisId === d.id) && i.statutOperationnel !== 'Annulée'
    );
    if ((d.interventionsCount && d.interventionsCount > 0) || linkedIntvs.length > 0) {
      setReconversionModalDevis(d);
      setReconversionMotif('SAV');
      setReconversionNotes('');
    } else {
      convertDevisMut.mutate({ id: d.id, data: { mode: 'travaux' } });
    }
  };

  const handleConfirmReconversion = () => {
    if (!reconversionModalDevis) return;
    const motifLabels: Record<string, { prefix: string; type: string; title: string }> = {
      SAV: {
        prefix: '[SAV] ',
        type: 'SAV',
        title: 'Service Après-Vente / Garantie',
      },
      REPRISE: {
        prefix: '[REPRISE] ',
        type: 'Reprise de travaux',
        title: 'Reprise de travaux / Refaire',
      },
      AVENANT: {
        prefix: '[AVENANT] ',
        type: 'Travaux supplémentaires',
        title: 'Travaux supplémentaires / Avenant',
      },
      PHASE2: {
        prefix: '[PHASE 2] ',
        type: '2ème Phase',
        title: 'Deuxième tranche / Phase 2',
      },
    };

    const cfg = motifLabels[reconversionMotif] || motifLabels.SAV;
    const baseObjet = reconversionModalDevis.objet || `Chantier ${reconversionModalDevis.reference || 'DEV-' + reconversionModalDevis.id}`;
    const newObjet = `${cfg.prefix}${baseObjet}`;

    convertDevisMut.mutate({
      id: reconversionModalDevis.id,
      data: {
        mode: 'travaux',
        typeIntervention: cfg.type,
        objet: newObjet,
        notes: reconversionNotes.trim() ? `[MOTIF: ${cfg.title}] ${reconversionNotes.trim()}` : `[MOTIF: ${cfg.title}]`,
      },
    });
  };

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

  const updateFichesMut = useMutation({
    mutationFn: (fiches: ClientProfile[]) => referentielsApi.updateClientsFiches(fiches),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referentiels'] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error || 'Erreur lors de la mise à jour des fiches clients'),
  });

  const sendReportEmailMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: SendReportEmailPayload }) =>
      interventionApi.sendReportEmail(id, payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      if (selectedIntv && selectedIntv.id === res.data.data.id) {
        setSelectedIntv(res.data.data);
      }
    },
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
  const _filteredDevis = useMemo(() => {
    return devisList.filter((d) => {
      if (devisStatutFilter !== 'ALL' && d.statutCommercial !== devisStatutFilter) return false;
      if (devisResponsableFilter !== 'ALL' && d.responsable !== devisResponsableFilter) return false;
      if (devisVisitesOnly && !(d.visiteNecessaire || d.visiteTechnicien)) return false;
      if (devisSearch.trim()) {
        const q = devisSearch.toLowerCase();
        const hay = `${d.reference} ${d.client} ${d.site} ${d.objet} ${d.responsable} ${d.corpsEtat}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [devisList, devisStatutFilter, devisResponsableFilter, devisVisitesOnly, devisSearch]);

  const _filteredInterventions = useMemo(() => {
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
  void _filteredDevis;
  void _filteredInterventions;
  void adminSubTab;
  void setAdminSubTab;
  void newRefCategory;
  void setNewRefCategory;
  void newRefValue;
  void setNewRefValue;
  void editingRef;
  void setEditingRef;
  void confirmDeleteRef;
  void setConfirmDeleteRef;
  void handleToggleTechSkill;
  void handleAddCustomTechSkill;
  void handleExecuteDeleteRef;
  void handleInlineAddRef;
  void handleSaveInlineEditRef;
  void deleteDevisMut;
  void deleteIntvMut;




  const openNewDevisDrawer = () => {
    setIsCreatingDevis(true);
    setIsCustomDevisClient(false);
    setDevisTab('qualif');
    setSelectedDevis({
      reference: '',
      numeroDI: '',
      statutCommercial: 'À préparer',
      traitement: 'À traiter',
      priorite: 'Normale',
      client: '',
      site: '',
      corpsEtat: 'Électricité',
      objet: '',
      origine: 'Client',
      responsable: '',
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
    setIsCustomIntvClient(false);
    setIntvTab('planif');
    setSelectedIntv({
      reference: '',
      numeroDI: '',
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

  /** Cas 1 : nouvelle intervention rattachée à un devis (infos reprises du devis). */
  const intvDefaultsFromDevis = (d: Devis): Partial<Intervention> => ({
    numeroDI: d.numeroDI || '',
    devisId: d.id,
    client: d.client || '',
    chantier: d.site || '',
    corpsEtat: d.corpsEtat || 'Électricité',
    objet: d.objet || '',
    origine: d.origine || undefined,
    refDevisTexte: d.reference || undefined,
    priorite: d.priorite || 'Normale',
  });
  const startInterventionFromDevis = (d: Devis) => {
    setSelectedDevis(null);
    setIsCreatingDevis(false);
    handleSectionChange('interventions');
    setIsCreatingIntv(true);
    setIsCustomIntvClient(false);
    setIntvTab('planif');
    setSelectedIntv({
      statutOperationnel: 'À planifier',
      traitement: 'À traiter',
      typeIntervention: 'Corrective',
      heureDebut: '08:00',
      heureFin: '12:00',
      modePlanification: 'Planifiée',
      statutFacture: 'Non facturée',
      entreprise: '',
      ...intvDefaultsFromDevis(d),
    });
  };
  const pickSourceDevis = (d: Devis | null) => {
    setSelectedIntv((cur) => {
      if (!cur) return cur;
      if (!d) return { ...cur, devisId: undefined, origineDevisId: undefined, refDevisTexte: undefined };
      return { ...cur, ...intvDefaultsFromDevis(d) };
    });
  };
  /** Cas 3 : devis suite à intervention — le DI relie automatiquement les deux fiches. */
  const startDevisFromIntervention = (i: Intervention) => {
    const di = (i.numeroDI || '').trim() || (i.reference || '').trim() || `INT-${i.id}`;
    if (!(i.numeroDI || '').trim()) {
      updateIntvMut.mutate({ id: i.id, data: { ...i, numeroDI: di } });
    }
    setSelectedIntv(null);
    setIsCreatingIntv(false);
    handleSectionChange('devis');
    setIsCreatingDevis(true);
    setIsCustomDevisClient(false);
    setDevisTab('qualif');
    setSelectedDevis({
      reference: '',
      numeroDI: di,
      statutCommercial: 'À préparer',
      traitement: 'À traiter',
      priorite: i.priorite || 'Normale',
      client: i.client || '',
      site: i.chantier || '',
      corpsEtat: i.corpsEtat || 'Électricité',
      objet: i.objet || '',
      origine: 'Intervention',
      refInterventionTexte: i.reference || `#${i.id}`,
      responsable: '',
      prochaineAction: 'Chiffrer',
      amount: 0,
      validiteJours: 30,
      visiteNecessaire: false,
      notes: [i.resultatTechnique, i.elementsChiffrage].filter(Boolean).join('\n') || undefined,
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
        demandes: demandesADecider,
        devis: devisList.length,
        interventions: interventionsList.length,
        facturation: queues.intvAFacturer.length,
        admin: queues.rapportsEnAttente.length,
      }}
      onOpenCommandPalette={() => setCmdOpen(true)}
      onQuickNewDevis={openNewDevisDrawer}
      onQuickNewIntervention={openNewIntvDrawer}
      onOpenSituationReport={() => setIsSituationModalOpen(true)}
    >
      {/* =====================================================================
          SECTION 1 : CENTRE DE PILOTAGE ("AUJOURD'HUI" / TABLEAU DE BORD)
         ===================================================================== */}
      {activeSection === 'aujourdhui' && canUserAccessSection('aujourdhui', user) && (
        <>
          {/* « Ma file » en tête du tableau de bord, quand la société a activé la bascule */}
          {user?.company?.accueilMaFile === true && (
            <div style={{ padding: '18px 20px 0' }}>
              <MaFileView
                user={user}
                devisList={devisList}
                interventionsList={interventionsList}
                demandes={demandesQueue || []}
                queues={queues}
                onOpenDevis={(d) => {
                  handleSectionChange('devis');
                  setIsCreatingDevis(false);
                  setDevisTab('qualif');
                  setSelectedDevis(d);
                }}
                onOpenIntervention={(i) => {
                  handleSectionChange('interventions');
                  setIsCreatingIntv(false);
                  setIntvTab('planif');
                  setSelectedIntv(i);
                }}
                onGoDemandes={() => handleSectionChange('demandes')}
              />
            </div>
          )}

          {dashboardTab === 'synthese' && (
            <DashboardSynthese
              period={dashboardPeriod}
              onPeriodChange={setDashboardPeriod}
              devisList={devisList}
              interventionsList={interventionsList}
              techniciensList={techniciensList}
              queues={queues}
              activeTab={dashboardTab}
              onTabChange={setDashboardTab}
              onNavigateSection={handleSectionChange}
              onOpenDevis={(d) => {
                setIsCreatingDevis(false);
                setSelectedDevis(d);
              }}
              onOpenIntv={(i) => {
                setIsCreatingIntv(false);
                setSelectedIntv(i);
              }}
              onNewIntv={openNewIntvDrawer}
              onConvertDevis={(d) => handleTriggerConvertDevis(d)}
              onGoAdminRapports={() => {
                setAdminSubTab('rapports');
                handleSectionChange('admin');
              }}
              onFilterInterventions={(trade) => {
                setIntvSearch(trade);
                handleSectionChange('interventions');
              }}
              onOpenSituationModal={() => setIsSituationModalOpen(true)}
            />
          )}

          {dashboardTab === 'operations' && (
            <DashboardOperations
              period={dashboardPeriod}
              onPeriodChange={setDashboardPeriod}
              devisList={devisList}
              interventionsList={interventionsList}
              techniciensList={techniciensList}
              queues={queues}
              activeTab={dashboardTab}
              onTabChange={setDashboardTab}
              onNavigateSection={handleSectionChange}
              onOpenDevis={(d) => {
                setIsCreatingDevis(false);
                setSelectedDevis(d);
              }}
              onOpenIntv={(i) => {
                setIsCreatingIntv(false);
                setSelectedIntv(i);
              }}
              onNewIntv={openNewIntvDrawer}
              onConvertDevis={(d) => handleTriggerConvertDevis(d)}
              onRelanceDevis={(id) => {
                updateDevisMut.mutate({
                  id,
                  data: {
                    dateRelance: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
                    prochaineAction: 'Relancer le client',
                  },
                });
              }}
              onFactureIntv={(id) => {
                updateIntvMut.mutate({
                  id,
                  data: { statutFacture: 'Facturée' },
                });
              }}
              onGoAdminRapports={() => {
                setAdminSubTab('rapports');
                handleSectionChange('admin');
              }}
            />
          )}

          {dashboardTab === 'analyse' && (
            <DashboardAnalyse
              period={dashboardPeriod}
              onPeriodChange={setDashboardPeriod}
              clientProfiles={clientProfiles}
              devisList={devisList}
              interventionsList={interventionsList}
              techniciensList={techniciensList}
              queues={queues}
              activeTab={dashboardTab}
              onTabChange={setDashboardTab}
              onNavigateSection={handleSectionChange}
              onNewIntv={openNewIntvDrawer}
              onFilterInterventions={(trade) => {
                setIntvSearch(trade);
                handleSectionChange('interventions');
              }}
              onGoAdminRapports={() => {
                setAdminSubTab('rapports');
                handleSectionChange('admin');
              }}
            />
          )}
        </>
      )}

      {/* =====================================================================
          SECTION 2 : CONSOLE DISPATCH & PLANNING TECHNICIENS (ATLAS CLARITY)
         ===================================================================== */}
      {/* =====================================================================
          SECTION 1B : DEMANDES REÇUES — LA FILE D'ENTRÉE (DI DU DONNEUR D'ORDRE)
         ===================================================================== */}
      {activeSection === 'demandes' && canUserAccessSection('demandes', user) && (
        <DemandesStudioView
          clientProfiles={clientProfiles}
          corpsEtatList={corpsEtatList}
          prioritesList={[...PRIORITES]}
          canalList={CANAUX_RECEPTION}
          onOpenDevis={async (id) => {
            // La pièce vient d'être créée : on la charge directement, la liste n'est pas encore rafraîchie
            const d = devisList.find((x) => x.id === id) || (await devisApi.get(id).then((r) => r.data.data).catch(() => null));
            if (!d) return;
            handleSectionChange('devis');
            setIsCreatingDevis(false);
            setDevisTab('qualif');
            setSelectedDevis(d);
          }}
          onOpenIntervention={async (id) => {
            const i =
              interventionsList.find((x) => x.id === id) ||
              (await interventionApi.get(id).then((r) => r.data.data).catch(() => null));
            if (!i) return;
            handleSectionChange('interventions');
            setIsCreatingIntv(false);
            setIntvTab('planif');
            setSelectedIntv(i);
          }}
        />
      )}

      {activeSection === 'planning' && canUserAccessSection('planning', user) && (
        <PlanningStudioView
          devisList={devisList}
          interventionsList={interventionsList}
          techniciens={techniciensList}
          onOpenDevis={(d) => {
            setIsCreatingDevis(false);
            setSelectedDevis(d);
          }}
          onOpenIntv={(i) => {
            setIsCreatingIntv(false);
            setSelectedIntv(i);
          }}
          onUpdateDevisPlanning={async (devisId, payload) => {
            await updateDevisMut.mutateAsync({ id: devisId, data: payload });
          }}
          onUpdateIntvPlanning={async (intvId, payload) => {
            await updateIntvMut.mutateAsync({ id: intvId, data: payload });
          }}
        />
      )}

      {/* =====================================================================
          SECTION 3 : PIPELINE DEVIS (TABLEAU 8 COLONNES + KANBAN + DRAWER 22 COL)
         ===================================================================== */}
      {activeSection === 'devis' && canUserAccessSection('devis', user) && (
        <DevisStudioView
          devisList={devisList}
          onOpenNewDevis={openNewDevisDrawer}
          onSelectDevis={(d) => setSelectedDevis(d)}
          onConvertDevis={(d) => {
            if (d.id) {
              convertDevisMut.mutate({ id: d.id });
            }
          }}
          onExportExcel={() => exportSituationDevisExcel(devisList)}
          techniciens={techniciensList}
        />
      )}

      {/* =====================================================================
          SECTION 4 : INTERVENTIONS TCE (TABLEAU 8 COL + KANBAN + DRAWER 23 COL)
         ===================================================================== */}
      {activeSection === 'interventions' && canUserAccessSection('interventions', user) && (
        <InterventionsStudioView
          interventionsList={interventionsList}
          onOpenNewIntv={openNewIntvDrawer}
          onSelectIntv={(i) => setSelectedIntv(i)}
          onValidateIntv={(i) => {
            if (i.id) {
              updateIntvMut.mutate({
                id: i.id,
                data: { statutOperationnel: 'CLOTUREE' },
              });
              toast.success(`Rapport ${i.reference} validé — prêt à facturer !`);
            }
          }}
          onSendReport={(i) => setReportEmailIntv(i)}
          onExportExcel={() => exportSituationInterventionsExcel(interventionsList)}
          techniciens={techniciensList}
        />
      )}

      {/* =====================================================================
          SECTION 4B-MAP : CARTE INTERACTIVE & CALCUL AUTOMATIQUE DE TRAJET (ATLAS CLARITY)
         ===================================================================== */}
      {activeSection === 'carte' && canUserAccessSection('carte', user) && (
        <CarteStudioView
          interventions={interventionsList}
          devis={devisList}
          techniciensList={techniciensList}
          currentTechnicien={selectedMapTech}
          onSelectTechnicien={setSelectedMapTech}
          onOpenIntervention={(i) => {
            setIsCreatingIntv(false);
            setSelectedIntv(i);
          }}
          onOpenDevis={(d) => {
            setIsCreatingDevis(false);
            setSelectedDevis(d);
          }}
        />
      )}

      {/* =====================================================================
          SECTION 4B : ESPACE FACTURATION & RELATION CLIENT (B2B & B2C - ATLAS CLARITY)
         ===================================================================== */}
      {activeSection === 'facturation' && canUserAccessSection('facturation', user) && (
        <FacturationStudioView
          devisList={devisList}
          interventionsList={interventionsList}
          onUpdateIntervention={async (id, data) => {
            await updateIntvMut.mutateAsync({ id, data });
          }}
          onUpdateDevis={async (id, data) => {
            await updateDevisMut.mutateAsync({ id, data });
          }}
        />
      )}

      {/* =====================================================================
          SECTION 4C : COMPTABILITÉ, SUIVI D'ACTIVITÉ & RENTABILITÉ ÉQUIPES (ATLAS CLARITY)
         ===================================================================== */}
      {activeSection === 'rentabilite' && canUserAccessSection('rentabilite', user) && (
        <ComptabiliteStudioView
          interventionsList={interventionsList}
          devisList={devisList}
          techniciens={techniciensList}
          onOpenDevis={(d) => {
            handleSectionChange('devis');
            setIsCreatingDevis(false);
            setDevisTab('qualif');
            setSelectedDevis(d);
          }}
          onOpenIntervention={(i) => {
            handleSectionChange('interventions');
            setIsCreatingIntv(false);
            setIntvTab('planif');
            setSelectedIntv(i);
          }}
        />
      )}

      {/* =====================================================================
          SECTION 4D : PROFILS ENTREPRISES & DONNEURS D'ORDRE (ATLAS CLARITY)
         ===================================================================== */}
      {activeSection === 'clients' && canUserAccessSection('clients', user) && (
        <DonneursOrdreStudioView
          clientProfiles={clientProfiles}
          devisList={devisList}
          interventionsList={interventionsList}
          onUpdateProfiles={async (nextProfiles) => {
            await updateFichesMut.mutateAsync(nextProfiles);
          }}
          onNewDevisForClient={(clientName) => {
            openNewDevisDrawer();
            setSelectedDevis((prev) => (prev ? { ...prev, client: clientName } : prev));
          }}
          onNewIntvForClient={(clientName) => {
            openNewIntvDrawer();
            setSelectedIntv((prev) => (prev ? { ...prev, client: clientName } : prev));
          }}
        />
      )}

      {/* =====================================================================
          SECTION 5 : RÉFÉRENTIELS & PARAMÈTRES MÉTIER (ATLAS CLARITY)
         ===================================================================== */}
      {activeSection === 'referentiels' && canUserAccessSection('referentiels', user) && (
        <ParametresStudioView
          referencesDevis={devisList.map((d) => d.reference || '').filter(Boolean)}
          referencesInterventions={interventionsList.map((i) => i.reference || '').filter(Boolean)}
          techniciens={techniciensList}
          corpsEtatList={corpsEtatList}
          technicienCompetences={refs.technicien_competences || DEFAULT_TECHNICIEN_COMPETENCES}
          onUpdateCompetences={async (nextMap) => {
            await referentielsApi.updateCompetences(nextMap);
            queryClient.invalidateQueries({ queryKey: ['referentiels'] });
          }}
        />
      )}

      {/* =====================================================================
          SECTION 6 : WORKSTATION ADMIN & UTILISATEURS (ATLAS CLARITY)
         ===================================================================== */}
      {activeSection === 'admin' && canUserAccessSection('admin', user) && (
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
          onOpenSendReportEmail={(intv) => setReportEmailIntv(intv)}
        />
      )}

      {/* =====================================================================
          SECTION 7 : APPLICATION MOBILE DÉDIÉE TECHNICIEN TERRAIN
         ===================================================================== */}
      {activeSection === 'mobile_tech' && (
        <div style={{ width: '100%', minHeight: '100vh', margin: 0, padding: 0 }}>
          <TechnicianMobileView
            techniciens={isMobileTechUser ? [user?.technicienNom || user?.name || 'Technicien'] : techniciensList}
            currentTechnicien={
              isMobileTechUser
                ? (user?.technicienNom || user?.name || 'Technicien')
                : (selectedMobileTech || user?.technicienNom || techniciensList[0] || '')
            }
            canSwitchTechnicien={!isMobileTechUser && Boolean(user?.id === 1 || (user?.role || '').toUpperCase() === 'ADMIN' || user?.permissions?.canEditPlanning)}
            onSelectTechnicien={(t) => {
              if (!isMobileTechUser) setSelectedMobileTech(t);
            }}
            interventionsList={interventionsList}
            devisList={devisList}
          />
        </div>
      )}

      {/* =====================================================================
          MESSAGE DE SÉCURITÉ : ACCÈS NON AUTORISÉ AU SERVICE
         ===================================================================== */}
      {!canUserAccessSection(activeSection, user) && (
        <div className="dashboard-container" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ marginBottom: '16px' }}><ProLockIcon size={48} /></div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Accès non autorisé à ce service
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '460px', margin: '0 auto 20px', lineHeight: 1.6 }}>
            Votre compte collaborateur ne dispose pas des droits nécessaires pour accéder à ce module métier.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleSectionChange(getDefaultAuthorizedSection(user) as AppSection)}
          >
            Retourner à votre espace de travail autorisé
          </button>
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
                  <span className="font-mono" style={{ fontWeight: 800, fontSize: '14px', color: '#2563eb' }}>
                    {isCreatingDevis ? 'NOUVEAU DEVIS' : selectedDevis.reference || `DEV-${selectedDevis.id}`}
                  </span>
                  <StatusPill statut={selectedDevis.statutCommercial || 'À préparer'} />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Fiche complète 22 colonnes ANELEC • Qualification & Chiffrage
                </div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedDevis(null)}>
                ✕
              </button>
            </div>

            <div
              className="drawer-subtabs-strip"
              style={{
                borderBottom: '1px solid var(--border-subtle)',
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
              <DossierPanel
                kind="devis"
                current={selectedDevis}
                creating={isCreatingDevis}
                devisList={devisList}
                interventionsList={interventionsList}
                onOpenDevis={(d) => { setIsCreatingDevis(false); setDevisTab('qualif'); setSelectedDevis(d); }}
                onOpenIntervention={(it) => { setSelectedDevis(null); handleSectionChange('interventions'); setIsCreatingIntv(false); setIntvTab('planif'); setSelectedIntv(it); }}
                onNewIntervention={startInterventionFromDevis}
                onNewDevisFromIntervention={startDevisFromIntervention}
                demandes={demandesQueue || []}
              />
              {devisTab === 'qualif' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <DossierDIField
                    kind="devis"
                    client={selectedDevis.client}
                    value={selectedDevis.numeroDI}
                    onChange={(v) => setSelectedDevis({ ...selectedDevis, numeroDI: v })}
                    devisList={devisList}
                    interventionsList={interventionsList}
                    currentId={selectedDevis.id}
                  />
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Client / Donneur d'ordre *</label>
                    <select
                      className="select"
                      value={isCustomDevisClient ? '__CUSTOM__' : (selectedDevis.client || '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__CUSTOM__') {
                          setIsCustomDevisClient(true);
                        } else {
                          setIsCustomDevisClient(false);
                          setSelectedDevis({ ...selectedDevis, client: val });
                        }
                      }}
                    >
                      <option value="">— Sélectionner un Donneur d'ordre —</option>
                      {devisClientOptions.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="__CUSTOM__">+ Nouveau donneur d'ordre (saisie libre)...</option>
                    </select>
                    {isCustomDevisClient && (
                      <div style={{ marginTop: '6px', display: 'flex', gap: '6px' }}>
                        <input
                          className="input"
                          style={{ flex: 1, borderColor: '#2563eb' }}
                          placeholder="Saisir le nom du donneur d'ordre..."
                          value={selectedDevis.client || ''}
                          onChange={(e) => setSelectedDevis({ ...selectedDevis, client: e.target.value })}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          title="Revenir à la liste déroulante"
                          onClick={() => {
                            setIsCustomDevisClient(false);
                            if (!clientsList.includes(selectedDevis.client || '')) {
                              setSelectedDevis({ ...selectedDevis, client: clientsList[0] || '' });
                            }
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    )}
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
                      {selectedDevis.corpsEtat && !corpsEtatList.includes(selectedDevis.corpsEtat) && (
                        <option value={selectedDevis.corpsEtat}>{selectedDevis.corpsEtat}</option>
                      )}
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
                      <span style={{ fontWeight: 700, color: '#6d28d9', fontSize: '12.5px' }}>
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
                      {(originesList.includes('Intervention') ? originesList : [...originesList, 'Intervention']).map((p) => (
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

                  {Boolean(selectedDevis.id && (selectedDevis.interventionsCount || 0) > 0) && (
                    <div
                      style={{
                        gridColumn: '1 / -1',
                        padding: '10px 14px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ color: 'var(--text-secondary)' }}>
                        ↗ <strong>{selectedDevis.interventionsCount}</strong> intervention(s) liée(s) en cours ou planifiée(s).
                      </span>
                      {(() => {
                        const linked = interventionsList.find(
                          (i) => (i.devisId === selectedDevis.id || i.origineDevisId === selectedDevis.id) && i.statutOperationnel !== 'Annulée'
                        );
                        if (!linked) return null;
                        return (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 8px', fontSize: '11px', background: '#fff' }}
                            onClick={() => {
                              setSelectedDevis(null);
                              setSelectedIntv(linked);
                            }}
                          >
                            Ouvrir Fiche Intervention ({linked.reference || `INT-${linked.id}`}) →
                          </button>
                        );
                      })()}
                    </div>
                  )}
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
                  <HistoriqueTimeline events={selectedDevis.historique} />
                </div>
              )}
            </div>

            <div
              className="inspector-drawer__footer"
              style={{
                padding: '14px 20px',
                borderTop: '1px solid var(--border-default)',
                background: 'var(--bg-elevated)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                {!isCreatingDevis && selectedDevis.id && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11.5px', color: '#047857', borderColor: 'rgba(4, 120, 87, 0.4)', background: 'rgba(4, 120, 87, 0.04)' }}
                    onClick={() => handleTriggerConvertDevis(selectedDevis as Devis)}
                    title={(selectedDevis.interventionsCount || 0) > 0 ? "Ajouter une intervention SAV, suite ou reprise" : "Créer une intervention travaux rattachée"}
                  >
                    {(selectedDevis.interventionsCount || 0) > 0 ? '+ Intervention (Suite)' : '▸ Convertir en Intervention'}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
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
              className="drawer-subtabs-strip"
              style={{
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              {[
                { id: 'planif', label: '1. Affectation & Créneau' },
                {
                  id: 'terrain',
                  label: `2. Dossier Terrain & Photos ${(selectedIntv?.photos || []).length > 0 ? `(${selectedIntv!.photos!.length}) ⊞` : ''}`,
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
              <DossierPanel
                kind="intervention"
                current={selectedIntv}
                creating={isCreatingIntv}
                devisList={devisList}
                interventionsList={interventionsList}
                onOpenDevis={(d) => { setIsCreatingDevis(false); setDevisTab('qualif'); setSelectedDevis(d); }}
                onOpenIntervention={(it) => { setSelectedDevis(null); handleSectionChange('interventions'); setIsCreatingIntv(false); setIntvTab('planif'); setSelectedIntv(it); }}
                onNewIntervention={startInterventionFromDevis}
                onNewDevisFromIntervention={startDevisFromIntervention}
                demandes={demandesQueue || []}
                onPickSourceDevis={pickSourceDevis}
              />
              {intvTab === 'planif' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <DossierDIField
                    kind="intervention"
                    client={selectedIntv.client}
                    value={selectedIntv.numeroDI}
                    onChange={(v) => setSelectedIntv({ ...selectedIntv, numeroDI: v })}
                    devisList={devisList}
                    interventionsList={interventionsList}
                    currentId={selectedIntv.id}
                    onApplyDevis={(d) => {
                      setIsCustomIntvClient(false);
                      setSelectedIntv({
                        ...selectedIntv,
                        client: d.client || selectedIntv.client,
                        chantier: d.site || selectedIntv.chantier,
                        corpsEtat: d.corpsEtat || selectedIntv.corpsEtat,
                        objet: d.objet || selectedIntv.objet,
                        devisId: d.id,
                        refDevisTexte: d.reference || selectedIntv.refDevisTexte,
                      });
                      toast.success(`Informations reprises du devis ${d.reference || d.id}`);
                    }}
                  />
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Client / Donneur d'ordre *</label>
                    <select
                      className="select"
                      value={isCustomIntvClient ? '__CUSTOM__' : (selectedIntv.client || '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__CUSTOM__') {
                          setIsCustomIntvClient(true);
                        } else {
                          setIsCustomIntvClient(false);
                          setSelectedIntv({ ...selectedIntv, client: val });
                        }
                      }}
                    >
                      <option value="">— Sélectionner un Donneur d'ordre —</option>
                      {intvClientOptions.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="__CUSTOM__">+ Nouveau donneur d'ordre (saisie libre)...</option>
                    </select>
                    {isCustomIntvClient && (
                      <div style={{ marginTop: '6px', display: 'flex', gap: '6px' }}>
                        <input
                          className="input"
                          style={{ flex: 1, borderColor: '#2563eb' }}
                          placeholder="Saisir le nom du donneur d'ordre..."
                          value={selectedIntv.client || ''}
                          onChange={(e) => setSelectedIntv({ ...selectedIntv, client: e.target.value })}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          title="Revenir à la liste déroulante"
                          onClick={() => {
                            setIsCustomIntvClient(false);
                            if (!clientsList.includes(selectedIntv.client || '')) {
                              setSelectedIntv({ ...selectedIntv, client: clientsList[0] || '' });
                            }
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    )}
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
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Corps d'état TCE</label>
                    <select
                      className="select"
                      value={selectedIntv.corpsEtat || ''}
                      onChange={(e) => setSelectedIntv({ ...selectedIntv, corpsEtat: e.target.value })}
                      data-testid="intv-corps-etat"
                    >
                      <option value="">— Sélectionner un corps d'état —</option>
                      {selectedIntv.corpsEtat && !corpsEtatList.includes(selectedIntv.corpsEtat) && (
                        <option value={selectedIntv.corpsEtat}>{selectedIntv.corpsEtat}</option>
                      )}
                      {corpsEtatList.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
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
                          • ARRIVÉE RÉELLE POINTÉE
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
                          • DÉPART RÉEL POINTÉ
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
                        ⊞ Dossier Photos Terrain ({selectedIntv.photos?.length || 0})
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
                        Éléments relevés par le technicien pour chiffrage / devis :
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
                        ▸ Générer depuis les données terrain
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
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
                          <option value="Envoyé au client">Envoyé au client</option>
                        </select>
                      </div>

                      {!isMobileTechUser && selectedIntv.id && (
                        <button
                          type="button"
                          className="btn"
                          style={{
                            background: '#00bf63',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '11.5px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 14px',
                            border: 'none',
                          }}
                          onClick={() => {
                            setReportEmailIntv(selectedIntv as Intervention);
                          }}
                        >
                          Envoyer le Rapport par Email
                        </button>
                      )}
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
                  {(() => {
                    const diKey = (selectedIntv.numeroDI || '').trim().toUpperCase();
                    const byDI = diKey ? devisList.find((d) => (d.numeroDI || '').trim().toUpperCase() === diKey) : undefined;
                    const linkedId = selectedIntv.devisId || selectedIntv.origineDevisId || byDI?.id;
                    const linked = linkedId ? devisList.find((d) => d.id === linkedId) : undefined;
                    if (!linkedId && !selectedIntv.refDevisTexte) {
                      return (
                        <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {diKey && <>Dossier <strong>{diKey}</strong> · </>}
                          Devis lié : <strong>aucun</strong> (intervention créée directement
                          {diKey ? ' ; elle sera rattachée dès qu’un devis portera ce DI' : ''}).
                        </div>
                      );
                    }
                    return (
                      <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '12.5px', minWidth: 0 }}>
                          <div style={{ fontWeight: 700 }}>
                            {selectedIntv.numeroDI ? <>Dossier {selectedIntv.numeroDI} · </> : null}
                            Devis lié : {linked?.reference || selectedIntv.refDevisTexte || `#${linkedId}`}
                          </div>
                          <div style={{ color: 'var(--text-secondary)' }}>
                            {[linked?.client || selectedIntv.origineDevisClient, linked?.objet].filter(Boolean).join(' — ') || 'Devis d’origine'}
                          </div>
                        </div>
                        {linked && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setSelectedIntv(null);
                              handleSectionChange('devis');
                              setIsCreatingDevis(false);
                              setDevisTab('qualif');
                              setSelectedDevis(linked);
                            }}
                          >
                            Ouvrir le devis
                          </button>
                        )}
                      </div>
                    );
                  })()}
                  <div style={{ marginTop: '10px' }}>
                    <HistoriqueTimeline events={selectedIntv.historique} />
                  </div>
                </div>
              )}
            </div>

            <div
              className="inspector-drawer__footer"
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
                { label: 'Ouvrir Console Dispatch & Timeline Gantt', action: () => handleSectionChange('planning'), section: 'planning' as AppSection },
                { label: 'Créer un Nouveau Devis (22 colonnes)', action: openNewDevisDrawer, section: 'devis' as AppSection },
                { label: 'Créer une Nouvelle Intervention (23 colonnes)', action: openNewIntvDrawer, section: 'interventions' as AppSection },
                { label: 'Aller au Centre de Pilotage (Aujourd’hui)', action: () => handleSectionChange('aujourdhui'), section: 'aujourdhui' as AppSection },
              ]
                .filter((cmd) => canUserAccessSection(cmd.section, user))
                .map((cmd) => (
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
                  {canUserAccessSection('devis', user) && devisList
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
                  {canUserAccessSection('interventions', user) && interventionsList
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

      {/* Modale d'envoi du Rapport Officiel d'Intervention par e-mail */}
      {reportEmailIntv && (
        <SendReportEmailModal
          isOpen={Boolean(reportEmailIntv)}
          onClose={() => setReportEmailIntv(null)}
          intervention={reportEmailIntv}
          clientProfiles={clientProfiles}
          onSendEmail={async (payload) => {
            await sendReportEmailMut.mutateAsync({ id: reportEmailIntv.id, payload });
          }}
        />
      )}

      {/* Modale des Rapports de Situation & Avancement en 1 Clic (Excel) */}
      <SituationReportModal
        isOpen={isSituationModalOpen}
        onClose={() => setIsSituationModalOpen(false)}
        interventions={interventionsList}
        devis={devisList}
        clientsList={clientsList}
      />

      {/* =====================================================================
          MODAL DE SÉLECTION DU MOTIF DE RECONVERSION EN INTERVENTION (SAV / REPRISE)
         ===================================================================== */}
      {reconversionModalDevis && (
        <div
          className="cmd-palette-backdrop"
          style={{ zIndex: 9999, background: 'rgba(10, 15, 29, 0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setReconversionModalDevis(null)}
        >
          <div
            className="pro-table-container"
            style={{
              maxWidth: '620px',
              width: '92%',
              background: '#ffffff',
              borderRadius: '14px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.35)',
              border: '1.5px solid var(--border-default)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px 20px',
                background: '#0a0f1d',
                color: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '3px solid #ffcc00',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ProAlertIcon size={20} />
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    Ce devis a déjà été transformé en intervention
                  </h3>
                </div>
                <div style={{ fontSize: '11.5px', color: '#cbd5e1', marginTop: '3px' }}>
                  Devis {reconversionModalDevis.reference || `DEV-${reconversionModalDevis.id}`} • {reconversionModalDevis.client}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ color: '#ffffff', fontSize: '16px', padding: '4px 8px' }}
                onClick={() => setReconversionModalDevis(null)}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  padding: '10px 14px',
                  background: '#fffbeb',
                  borderRadius: '8px',
                  border: '1px solid #fde68a',
                  fontSize: '12px',
                  color: '#92400e',
                  lineHeight: 1.5,
                }}
              >
                Une intervention travaux a déjà été générée pour ce devis. Pour garantir une traçabilité rigoureuse et éviter les interventions fantômes, veuillez indiquer la <strong>raison opérationnelle</strong> de cette nouvelle intervention :
              </div>

              {/* Grille des 4 motifs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '10px' }}>
                {[
                  {
                    id: 'SAV',
                    title: 'Service Après-Vente (SAV / Garantie)',
                    badge: 'Garantie / Réserve',
                    color: '#dc2626',
                    bg: '#fef2f2',
                    desc: 'Réglage, retouche de finition, réserve de réception ou problème couvert par la garantie.',
                  },
                  {
                    id: 'REPRISE',
                    title: '↻ Reprise de Travaux / Refaire',
                    badge: 'Malfaçon ou Inachevé',
                    color: '#b45309',
                    bg: '#fffbeb',
                    desc: 'Le travail précédent doit être refait ou complété suite à un problème survenu sur site.',
                  },
                  {
                    id: 'AVENANT',
                    title: '+ Travaux Supplémentaires / Avenant',
                    badge: 'Prestation en plus',
                    color: '#047857',
                    bg: '#ecfdf5',
                    desc: 'Demande additionnelle validée par le client sur le même chantier (facturable en sus).',
                  },
                  {
                    id: 'PHASE2',
                    title: '2ème Phase / Tranche de Chantier',
                    badge: 'Étape 2 prévue',
                    color: 'var(--text-primary)',
                    bg: 'var(--bg-elevated)',
                    desc: 'Chantier planifié en plusieurs temps (ex: pose après séchage, raccordement final).',
                  },
                ].map((opt) => {
                  const isSelected = reconversionMotif === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setReconversionMotif(opt.id as any)}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        border: isSelected ? `2px solid ${opt.color}` : '1px solid var(--border-default)',
                        background: isSelected ? opt.bg : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, fontSize: '12.5px', color: isSelected ? opt.color : 'var(--text-primary)' }}>
                          {opt.title}
                        </span>
                        <input
                          type="radio"
                          name="reconversionMotif"
                          checked={isSelected}
                          onChange={() => setReconversionMotif(opt.id as any)}
                          style={{ accentColor: opt.color }}
                        />
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {opt.desc}
                      </div>
                      <span
                        className="badge"
                        style={{
                          alignSelf: 'flex-start',
                          fontSize: '9.5px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          background: opt.bg,
                          color: opt.color,
                          border: `1px solid ${opt.color}40`,
                        }}
                      >
                        {opt.badge}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Précisions / Notes */}
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', display: 'block' }}>
                  Précisions sur cette nouvelle intervention (optionnel) :
                </label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Ex : Problème de fuite persistante sous l'évier, client demande reprise urgente..."
                  value={reconversionNotes}
                  onChange={(e) => setReconversionNotes(e.target.value)}
                  style={{ width: '100%', fontSize: '12px', padding: '8px 10px', resize: 'vertical' }}
                />
              </div>

              {/* Footer Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '8px',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                {(() => {
                  const linked = interventionsList.find(
                    (i) => (i.devisId === reconversionModalDevis.id || i.origineDevisId === reconversionModalDevis.id) && i.statutOperationnel !== 'Annulée'
                  );
                  if (!linked) return <div />;
                  return (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11.5px' }}
                      onClick={() => {
                        setReconversionModalDevis(null);
                        setSelectedDevis(null);
                        setIsCreatingIntv(false);
                        setSelectedIntv(linked);
                        setIntvTab('terrain');
                      }}
                    >
                      Voir intervention existante ({linked.reference || `INT-${linked.id}`}) →
                    </button>
                  );
                })()}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setReconversionModalDevis(null)}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ background: '#00bf63', borderColor: '#00994f', fontWeight: 800 }}
                    onClick={handleConfirmReconversion}
                    disabled={convertDevisMut.isPending}
                  >
                    {convertDevisMut.isPending ? 'Création...' : 'Valider & Créer l’intervention'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export function ActionQueueCard({
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
