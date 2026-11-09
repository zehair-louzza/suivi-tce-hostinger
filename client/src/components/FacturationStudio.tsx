import { useState, useMemo } from 'react';
import {
  Devis,
  Intervention,
  formatCurrency,
  formatDateFR,
  computeDurationHours,
} from '../lib/api';
import { PhotoItem } from './PhotoLightbox';
import {
  ProCheckIcon,
  ProAlertIcon,
  ProClockIcon,
  ProSearchIcon,
  ProCalendarIcon,
  ProFileTextIcon,
  ProFilterIcon,
  ProMailIcon,
  ProCopyIcon,
  ProLockIcon,
  ProExternalIcon,
} from './ProIcons';
import toast from 'react-hot-toast';

interface FacturationStudioProps {
  devisList: Devis[];
  interventionsList: Intervention[];
  onUpdateIntervention: (id: number, data: Partial<Intervention>) => Promise<void>;
  onUpdateDevis: (id: number, data: Partial<Devis>) => Promise<void>;
  onOpenInterventionDrawer: (intv: Intervention) => void;
  onOpenDevisDrawer: (devis: Devis) => void;
  onNavigateToPlanning: () => void;
  onOpenPhotoLightbox: (photos: PhotoItem[], index: number) => void;
}

export type BillingEligibilityCategory =
  | 'A_FACTURER'
  | 'A_VERIFIER'
  | 'NE_PAS_FACTURER'
  | 'FACTUREE';

export type ClientSegmentType = 'B2B' | 'B2C';

export type InterventionFluxType =
  | 'DIRECTE'
  | 'SUITE_DEVIS_AVEC_VISITE'
  | 'SUITE_DEVIS_SANS_VISITE'
  | 'VISITE_DEVIS';

export type TaxArbitrageMode = 'HT' | 'TTC';

export interface EnrichedBillingDossier {
  intervention: Intervention;
  linkedDevis: Devis | null;
  segment: ClientSegmentType;
  fluxType: InterventionFluxType;
  fluxLabel: string;
  fluxBadge: { bg: string; text: string; border: string };
  fluxDescription: string;
  hasDeplacementVisite: boolean;
  category: BillingEligibilityCategory;
  statusLabel: string;
  whyTitle: string;
  whyDetails: string[];
  blockingMissingItems: string[];
  suggestedAmountHT: number;
  suggestedAmountTTC: number;
  applicableTvaRate: number;
  amountSource: string;
  plannedHours: number;
  realHours: number | null;
  isDelayed: boolean;
  delayDays: number;
  delayRootCause: string;
  delayActionableAdvice: string;
  photosCount: number;
}

const KNOWN_B2B_KEYWORDS = [
  'presta',
  'emalec',
  'gms',
  'multi-serv',
  'c-multi',
  'ipc',
  'crea',
  'syndic',
  'foncia',
  'nexity',
  'citya',
  'cabinet',
  'immobili',
  'groupe',
  'société',
  'societe',
  'sarl',
  'sas',
  'sa ',
  'sci',
  'copropri',
  'mairie',
  'collectivit',
  'agence',
  'office',
  'habitat',
  'logement',
  'maintenance',
];

function detectClientSegment(intv: Intervention, linkedDevis: Devis | null): ClientSegmentType {
  const clientName = (intv.client || linkedDevis?.client || '').toLowerCase();
  const origine = (intv.origine || linkedDevis?.origine || '').toLowerCase();

  if (
    clientName.includes('particulier') ||
    clientName.includes('m. ') ||
    clientName.includes('mme ') ||
    clientName.includes('mr ') ||
    origine.includes('particulier') ||
    origine.includes('locataire')
  ) {
    return 'B2C';
  }

  if (
    origine.includes('donneur') ||
    origine.includes('contrat') ||
    origine.includes('syndic') ||
    KNOWN_B2B_KEYWORDS.some((kw) => clientName.includes(kw))
  ) {
    return 'B2B';
  }

  return 'B2B';
}

function diffDaysISO(dateA: string, dateB: string): number {
  const [y1, m1, d1] = dateA.split('-').map(Number);
  const [y2, m2, d2] = dateB.split('-').map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0;
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc1 - utc2) / 86400000);
}

function extractDateParts(rawDate?: any): { year: string; month: string; day: string } | null {
  if (!rawDate) return null;
  if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
    return {
      year: String(rawDate.getFullYear()),
      month: String(rawDate.getMonth() + 1).padStart(2, '0'),
      day: String(rawDate.getDate()).padStart(2, '0'),
    };
  }
  const s = String(rawDate).trim();
  if (!s) return null;
  if (/^\d{12,}$/.test(s)) {
    const d = new Date(Number(s));
    if (!isNaN(d.getTime())) {
      return {
        year: String(d.getFullYear()),
        month: String(d.getMonth() + 1).padStart(2, '0'),
        day: String(d.getDate()).padStart(2, '0'),
      };
    }
  }
  if (s.includes('-')) {
    const parts = s.slice(0, 10).split('-');
    if (parts.length >= 3) {
      return { year: parts[0], month: parts[1].padStart(2, '0'), day: parts[2].padStart(2, '0') };
    }
  } else if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length >= 3) {
      return { year: parts[2].slice(0, 4), month: parts[1].padStart(2, '0'), day: parts[0].padStart(2, '0') };
    }
  }
  return null;
}

export function FacturationStudio({
  devisList,
  interventionsList,
  onUpdateIntervention,
  onOpenInterventionDrawer,
  onOpenDevisDrawer,
  onNavigateToPlanning,
  onOpenPhotoLightbox,
}: FacturationStudioProps) {
  const [activeTab, setActiveTab] = useState<'triage' | 'retards_clients'>('triage');
  const [filterCategory, setFilterCategory] = useState<'ALL' | BillingEligibilityCategory>('ALL');
  const [filterSegment, setFilterSegment] = useState<'ALL' | ClientSegmentType>('ALL');
  const [filterFlux, setFilterFlux] = useState<'ALL' | InterventionFluxType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtres temporels : Jour, Mois, Année
  const [filterYear, setFilterYear] = useState<string>('ALL');
  const [filterMonth, setFilterMonth] = useState<string>('ALL');
  const [filterDay, setFilterDay] = useState<string>('ALL');

  // Overrides manuels B2B / B2C par ID d'intervention
  const [segmentOverrides, setSegmentOverrides] = useState<Record<number, ClientSegmentType>>({});

  // Arbitrage Libre Taxe HT vs TTC par intervention + Taux TVA
  const [taxArbitrageMap, setTaxArbitrageMap] = useState<Record<number, TaxArbitrageMode>>({});
  const [tvaRateMap, setTvaRateMap] = useState<Record<number, number>>({});
  const [globalTaxArbitrage, setGlobalTaxArbitrage] = useState<'LIBRE' | 'FORCE_HT' | 'FORCE_TTC'>('LIBRE');

  // Sélection multiple pour Facturation Groupée B2B (Bordereau Donneur d'ordre)
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Modal de réponse client en 1 clic (Retards & Demandes clients initiaux)
  const [clientResponseModalDossier, setClientResponseModalDossier] =
    useState<EnrichedBillingDossier | null>(null);

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Règle Métier ANELEC : on ne facture que les interventions (sauf si exceptionnellement cochée en console Admin)
  const allowDirectDevisBilling = useMemo(() => {
    return localStorage.getItem('anelec_allow_direct_devis_billing') === 'true';
  }, []);

  // Construction et diagnostic complet de tous les dossiers d'intervention
  const enrichedDossiers = useMemo<EnrichedBillingDossier[]>(() => {
    return interventionsList.map((intv) => {
      // Recherche du devis initial lié
      const linkedDevis =
        devisList.find(
          (d) =>
            d.id === intv.devisId ||
            d.id === intv.origineDevisId ||
            (intv.refDevisTexte &&
              d.reference &&
              d.reference.toLowerCase() === intv.refDevisTexte.toLowerCase())
        ) || null;

      const segment = segmentOverrides[intv.id] || detectClientSegment(intv, linkedDevis);
      const photosCount = Array.isArray(intv.photos) ? intv.photos.length : 0;
      const actionsCount = Array.isArray(intv.actionsRealisees) ? intv.actionsRealisees.length : 0;

      // Calcul des heures planifiées vs réelles
      const plannedHours = computeDurationHours(intv.heureDebut, intv.heureFin) || 2;
      const realHours = computeDurationHours(intv.heureDebutReelle, intv.heureFinReelle);

      // Montant HT suggéré (Intervention -> sinon Devis lié -> sinon estimation heures)
      let suggestedAmountHT = Number(intv.amount) || 0;
      let amountSource = 'Montant saisi sur l’intervention';
      if (!suggestedAmountHT && linkedDevis && Number(linkedDevis.amount) > 0) {
        suggestedAmountHT = Number(linkedDevis.amount);
        amountSource = `Hérité du Devis ${linkedDevis.reference || `DEV-${linkedDevis.id}`}`;
      } else if (!suggestedAmountHT) {
        const hrs = realHours || plannedHours;
        suggestedAmountHT = Math.round(hrs * 65 + 45);
        amountSource = `Estimation indicative (${hrs}h × 65€ + 45€ dépl.)`;
      }

      // Typologie et flux d'intervention (Intervention Directe vs Suite à Devis avec ou sans visite de repérage)
      const isVisitePrealable =
        Boolean(intv.isVisiteDevis) ||
        intv.typeIntervention === 'Visite technique devis' ||
        (intv.objet || '').toLowerCase().includes('visite devis');

      let fluxType: InterventionFluxType = 'DIRECTE';
      let fluxLabel = 'Directe (Sans devis)';
      let fluxBadge = { bg: 'rgba(37, 99, 235, 0.12)', text: '#1d4ed8', border: '#2563eb' };
      let fluxDescription = 'Intervention directe (dépannage urgent ou régie sans devis préalable)';
      let hasDeplacementVisite = false;

      if (isVisitePrealable) {
        fluxType = 'VISITE_DEVIS';
        fluxLabel = 'Visite Devis (Relevé préalable)';
        fluxBadge = { bg: 'rgba(100, 116, 139, 0.14)', text: '#475569', border: '#94a3b8' };
        fluxDescription = 'Visite technique préalable sur site pour métré et chiffrage (Non facturable directement)';
      } else if (linkedDevis) {
        hasDeplacementVisite = Boolean(
          linkedDevis.visiteNecessaire ||
          linkedDevis.visiteDate ||
          linkedDevis.visiteTechnicien ||
          (linkedDevis.visiteStatut && linkedDevis.visiteStatut !== 'Non requise') ||
          intv.typeIntervention?.toLowerCase().includes('visite') ||
          intv.origine?.toLowerCase().includes('visite')
        );

        if (hasDeplacementVisite) {
          fluxType = 'SUITE_DEVIS_AVEC_VISITE';
          fluxLabel = 'Suite à Devis (Avec Visite sur site)';
          fluxBadge = { bg: 'rgba(124, 58, 237, 0.14)', text: '#7c3aed', border: '#8b5cf6' };
          fluxDescription = `Chiffrage validé suite à déplacement sur site (Tech: ${linkedDevis.visiteTechnicien || intv.entreprise || 'Affecté'})`;
        } else {
          fluxType = 'SUITE_DEVIS_SANS_VISITE';
          fluxLabel = 'Suite à Devis (Sans déplacement)';
          fluxBadge = { bg: 'rgba(16, 185, 129, 0.14)', text: '#059669', border: '#10b981' };
          fluxDescription = 'Devis chiffré directement à distance sur plans, photos ou descriptif (sans visite préalable)';
        }
      } else {
        fluxType = 'DIRECTE';
        fluxLabel = 'Intervention Directe';
        fluxBadge = { bg: 'rgba(37, 99, 235, 0.12)', text: '#1d4ed8', border: '#2563eb' };
        fluxDescription = 'Demande directe client / Ordre de mission sans devis préalable (facturation directe)';
      }

      // Taux de TVA applicable et calcul TTC
      const defaultTva = segment === 'B2C' ? 10 : 20;
      const applicableTvaRate = tvaRateMap[intv.id] !== undefined ? tvaRateMap[intv.id] : defaultTva;
      const suggestedAmountTTC = Math.round(suggestedAmountHT * (1 + applicableTvaRate / 100) * 100) / 100;

      // Diagnostic d'éligibilité à la facturation (À traiter vs À vérifier vs Ne pas facturer + Pourquoi)
      const statutOp = intv.statutOperationnel || 'À planifier';
      const isAlreadyBilled = intv.statutFacture === 'Facturée';
      const isFinishedOnSite =
        statutOp === 'Clôturée' ||
        statutOp === 'Terminée - à valider' ||
        intv.statutRapport === 'Validé & Clôturé' ||
        intv.statutRapport === 'Déclaré par technicien';

      let category: BillingEligibilityCategory = 'NE_PAS_FACTURER';
      let statusLabel = 'Non éligible';
      let whyTitle = '';
      const whyDetails: string[] = [];
      const blockingMissingItems: string[] = [];

      if (isAlreadyBilled) {
        category = 'FACTUREE';
        statusLabel = 'Facturée & Traitée';
        whyTitle = `Facture émise (${intv.numeroFacture || 'N° validé'})`;
        whyDetails.push(
          `Dossier déjà facturé (${formatCurrency(intv.amount || suggestedAmountHT)} HT).`
        );
        if (linkedDevis) {
          whyDetails.push(`Lié au devis initial ${linkedDevis.reference} (${hasDeplacementVisite ? 'visite effectuée' : 'sans visite'}).`);
        } else {
          whyDetails.push('Intervention directe sans devis préalable.');
        }
      } else if (statutOp === 'Annulée' || intv.traitement === 'Classé sans suite') {
        category = 'NE_PAS_FACTURER';
        statusLabel = 'Ne pas facturer (Annulée)';
        whyTitle = 'Intervention annulée / classée sans suite';
        whyDetails.push('Aucune facturation ne doit être émise sur une mission annulée.');
      } else if (isVisitePrealable && statutOp !== 'Clôturée') {
        category = 'NE_PAS_FACTURER';
        statusLabel = 'Ne pas facturer (Visite Devis)';
        whyTitle = 'Visite technique préalable au chiffrage d’un devis';
        whyDetails.push(
          'Règle ANELEC : on ne facture que les interventions de travaux. Cette visite sert au chiffrage du devis.'
        );
      } else if (isFinishedOnSite) {
        // L'intervention est terminée sur le terrain
        if (intv.statutRapport === 'Déclaré par technicien') {
          blockingMissingItems.push('Rapport technicien reçu à valider par l’administration');
        }
        if (!intv.amount && (!linkedDevis || !linkedDevis.amount)) {
          blockingMissingItems.push('Montant HT définitif à confirmer');
        }
        if (
          intv.resultatTechnique === 'Devis complémentaire nécessaire' ||
          intv.resultatTechnique === 'Pièce à remplacer (en commande)' ||
          intv.resultatTechnique === 'Non résolu (accès / client absent)'
        ) {
          blockingMissingItems.push(`Résultat technique : « ${intv.resultatTechnique} »`);
        }

        if (blockingMissingItems.length === 0) {
          category = 'A_FACTURER';
          statusLabel = 'À traiter maintenant (Prêt)';
          whyTitle = 'Travaux terminés & dossier complet prêt à facturer';
          whyDetails.push(`Statut opérationnel : ${statutOp}`);
          if (intv.resultatTechnique) {
            whyDetails.push(`Résultat : ${intv.resultatTechnique}`);
          }
          if (photosCount > 0 || actionsCount > 0) {
            whyDetails.push(
              `Preuves terrain : ${actionsCount} action(s) cochée(s) • ${photosCount} photo(s)`
            );
          }
        } else {
          category = 'A_VERIFIER';
          statusLabel = 'À vérifier avant facturation';
          whyTitle = `Terminée sur site mais ${blockingMissingItems.length} point(s) à vérifier`;
          whyDetails.push(...blockingMissingItems);
          if (intv.elementsChiffrage) {
            whyDetails.push(`Notes chiffrage technicien : « ${intv.elementsChiffrage} »`);
          }
        }
      } else {
        // Intervention non terminée
        category = 'NE_PAS_FACTURER';
        statusLabel = `En attente (${statutOp})`;
        if (statutOp === 'Suspendue' || intv.traitement === 'Bloqué' || intv.motifBlocage) {
          whyTitle = `Chantier bloqué / suspendu : ${intv.motifBlocage || 'Motif à préciser'}`;
          whyDetails.push(
            'Ne pas facturer tant que la levée de réserve ou la pièce attendue n’est pas posée.'
          );
        } else if (statutOp === 'À planifier' || !intv.datePlanifiee) {
          whyTitle = 'Travaux non encore réalisés (En attente de planification)';
          whyDetails.push('La mission doit d’abord être planifiée et exécutée par un technicien.');
        } else {
          whyTitle = `Intervention en cours / planifiée le ${formatDateFR(intv.datePlanifiee)} (${
            intv.entreprise || 'Technicien à affecter'
          })`;
          whyDetails.push(
            'Attendre le pointage de fin de mission et le rapport du technicien avant de facturer.'
          );
        }
      }

      // Diagnostic des retards pour répondre aux demandes du client initial
      let isDelayed = false;
      let delayDays = 0;
      let delayRootCause = 'Aucun retard détecté';
      let delayActionableAdvice = 'Le dossier suit son cours normal.';

      const isTerminal = ['Clôturée', 'Annulée'].includes(statutOp);
      if (!isTerminal) {
        if (intv.echeance && intv.echeance < todayISO) {
          isDelayed = true;
          delayDays = Math.max(1, diffDaysISO(todayISO, intv.echeance));
        } else if (intv.datePlanifiee && intv.datePlanifiee < todayISO) {
          isDelayed = true;
          delayDays = Math.max(1, diffDaysISO(todayISO, intv.datePlanifiee));
        } else if (intv.computed?.alerteDelai === 'En retard') {
          isDelayed = true;
          delayDays = Math.max(1, delayDays);
        }

        if (isDelayed || intv.motifBlocage || statutOp === 'Suspendue') {
          if (intv.motifBlocage) {
            delayRootCause = `Blocage technique/logistique : ${intv.motifBlocage}`;
            delayActionableAdvice = `Informer le client initial que l'intervention est momentanément suspendue pour cause de « ${intv.motifBlocage} » et communiquer la nouvelle date dès réception.`;
          } else if (!intv.datePlanifiee || !intv.entreprise) {
            delayRootCause = `Absence de créneau ou de technicien affecté (Demande du ${formatDateFR(
              intv.dateDemande
            )})`;
            delayActionableAdvice = `Affecter immédiatement un technicien qualifié en ${
              intv.corpsEtat || 'TCE'
            } depuis la Console Planning et confirmer le créneau au client.`;
          } else if (statutOp === 'Terminée - à valider') {
            delayRootCause = `Travaux terminés le ${formatDateFR(
              intv.dateReelle || intv.datePlanifiee
            )} par ${intv.entreprise}, en attente de validation administrative du rapport`;
            delayActionableAdvice = `Rassurer le client : l'intervention technique est bien terminée sur site, le rapport final et la facture sont en cours d'édition.`;
          } else if (linkedDevis && !['Accepté'].includes(linkedDevis.statutCommercial)) {
            delayRootCause = `En attente du bon pour accord sur le devis initial ${linkedDevis.reference} (${linkedDevis.statutCommercial})`;
            delayActionableAdvice = `Rappeler au client que le devis ${linkedDevis.reference} (${formatCurrency(
              linkedDevis.amount
            )} HT) attend sa validation signée pour lancer les travaux.`;
          } else {
            delayRootCause = `Date planifiée (${formatDateFR(intv.datePlanifiee)}) dépassée avec ${
              intv.entreprise || 'le technicien'
            } sans clôture pointée`;
            delayActionableAdvice = `Vérifier auprès de ${
              intv.entreprise || 'l’équipe terrain'
            } si le chantier a été finalisé ou s'il nécessite un second passage.`;
          }
        }
      }

      return {
        intervention: intv,
        linkedDevis,
        segment,
        fluxType,
        fluxLabel,
        fluxBadge,
        fluxDescription,
        hasDeplacementVisite,
        category,
        statusLabel,
        whyTitle,
        whyDetails,
        blockingMissingItems,
        suggestedAmountHT,
        suggestedAmountTTC,
        applicableTvaRate,
        amountSource,
        plannedHours,
        realHours,
        isDelayed,
        delayDays,
        delayRootCause,
        delayActionableAdvice,
        photosCount,
      };
    });
  }, [interventionsList, devisList, segmentOverrides, tvaRateMap, todayISO]);

  // Helpers arbitrage taxe HT vs TTC
  const getDossierArbitrage = (d: EnrichedBillingDossier): TaxArbitrageMode => {
    if (globalTaxArbitrage === 'FORCE_HT') return 'HT';
    if (globalTaxArbitrage === 'FORCE_TTC') return 'TTC';
    if (taxArbitrageMap[d.intervention.id]) return taxArbitrageMap[d.intervention.id];
    return d.segment === 'B2C' ? 'TTC' : 'HT';
  };

  const getDossierTva = (d: EnrichedBillingDossier): number => {
    if (tvaRateMap[d.intervention.id] !== undefined) return tvaRateMap[d.intervention.id];
    return d.applicableTvaRate;
  };

  const handleToggleArbitrage = (dossierId: number, currentMode: TaxArbitrageMode) => {
    const nextMode: TaxArbitrageMode = currentMode === 'HT' ? 'TTC' : 'HT';
    setTaxArbitrageMap((prev) => ({ ...prev, [dossierId]: nextMode }));
    toast.success(`Arbitrage basculé en ${nextMode} pour ce dossier`, { icon: '§' });
  };

  const handleChangeTvaRate = (dossierId: number, nextRate: number) => {
    setTvaRateMap((prev) => ({ ...prev, [dossierId]: nextRate }));
  };

  // Filtrage temporel de base (Jour / Mois / Année) appliqué à toute la vue Facturation
  const dateFilteredDossiers = useMemo(() => {
    if (filterYear === 'ALL' && filterMonth === 'ALL' && filterDay === 'ALL') {
      return enrichedDossiers;
    }
    return enrichedDossiers.filter((d) => {
      const parts = extractDateParts(
        d.intervention.dateReelle ||
        d.intervention.datePlanifiee ||
        d.intervention.dateDebut ||
        d.intervention.dateDemande ||
        (d.intervention.createdAt ? String(d.intervention.createdAt).slice(0, 10) : '')
      );
      if (!parts) return false;
      if (filterYear !== 'ALL' && parts.year !== filterYear) return false;
      if (filterMonth !== 'ALL' && parts.month !== filterMonth) return false;
      if (filterDay !== 'ALL' && parts.day !== filterDay.padStart(2, '0')) return false;
      return true;
    });
  }, [enrichedDossiers, filterYear, filterMonth, filterDay]);

  // Compteurs KPI Facturation synchronisés avec les filtres temporels
  const stats = useMemo(() => {
    const aFacturer = dateFilteredDossiers.filter((d) => d.category === 'A_FACTURER');
    const aVerifier = dateFilteredDossiers.filter((d) => d.category === 'A_VERIFIER');
    const nePasFacturer = dateFilteredDossiers.filter((d) => d.category === 'NE_PAS_FACTURER');
    const facturees = dateFilteredDossiers.filter((d) => d.category === 'FACTUREE');
    const enRetardOuBloque = dateFilteredDossiers.filter(
      (d) => d.isDelayed || Boolean(d.intervention.motifBlocage)
    );

    const directeCount = dateFilteredDossiers.filter((d) => d.fluxType === 'DIRECTE').length;
    const suiteDevisAvecVisiteCount = dateFilteredDossiers.filter(
      (d) => d.fluxType === 'SUITE_DEVIS_AVEC_VISITE'
    ).length;
    const suiteDevisSansVisiteCount = dateFilteredDossiers.filter(
      (d) => d.fluxType === 'SUITE_DEVIS_SANS_VISITE'
    ).length;
    const visiteDevisCount = dateFilteredDossiers.filter((d) => d.fluxType === 'VISITE_DEVIS').length;

    const montantAFacturerHT = aFacturer.reduce((acc, d) => acc + d.suggestedAmountHT, 0);
    const montantAFacturerTTC = aFacturer.reduce((acc, d) => acc + d.suggestedAmountTTC, 0);

    const montantAVerifierHT = aVerifier.reduce((acc, d) => acc + d.suggestedAmountHT, 0);
    const montantAVerifierTTC = aVerifier.reduce((acc, d) => acc + d.suggestedAmountTTC, 0);

    const montantFactureHT = facturees.reduce(
      (acc, d) => acc + (Number(d.intervention.amount) || d.suggestedAmountHT),
      0
    );
    const montantFactureTTC = facturees.reduce((acc, d) => acc + d.suggestedAmountTTC, 0);

    const b2bCount = dateFilteredDossiers.filter((d) => d.segment === 'B2B').length;
    const b2cCount = dateFilteredDossiers.filter((d) => d.segment === 'B2C').length;

    return {
      aFacturer,
      aVerifier,
      nePasFacturer,
      facturees,
      enRetardOuBloque,
      directeCount,
      suiteDevisAvecVisiteCount,
      suiteDevisSansVisiteCount,
      visiteDevisCount,
      montantAFacturerHT,
      montantAFacturerTTC,
      montantAVerifierHT,
      montantAVerifierTTC,
      montantFactureHT,
      montantFactureTTC,
      b2bCount,
      b2cCount,
    };
  }, [dateFilteredDossiers]);

  // Liste dynamique des années présentes
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    const curYear = new Date().getFullYear();
    years.add(String(curYear));
    years.add(String(curYear - 1));
    enrichedDossiers.forEach((d) => {
      const parts = extractDateParts(
        d.intervention.dateReelle ||
        d.intervention.datePlanifiee ||
        d.intervention.dateDebut ||
        d.intervention.dateDemande ||
        (d.intervention.createdAt ? String(d.intervention.createdAt).slice(0, 10) : '')
      );
      if (parts?.year) years.add(parts.year);
    });
    return Array.from(years).sort().reverse();
  }, [enrichedDossiers]);

  const filteredDossiers = useMemo(() => {
    return dateFilteredDossiers.filter((d) => {
      if (filterCategory !== 'ALL' && d.category !== filterCategory) return false;
      if (filterSegment !== 'ALL' && d.segment !== filterSegment) return false;
      if (filterFlux !== 'ALL' && d.fluxType !== filterFlux) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${d.intervention.reference} ${d.intervention.client} ${d.intervention.chantier} ${d.intervention.objet} ${d.intervention.entreprise} ${d.intervention.numeroFacture || ''} ${d.linkedDevis?.reference || ''} ${d.fluxLabel} ${d.whyTitle} ${d.delayRootCause}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    dateFilteredDossiers,
    filterCategory,
    filterSegment,
    filterFlux,
    searchQuery,
  ]);

  const handleToggleFacture = async (dossier: EnrichedBillingDossier) => {
    const isBilled = dossier.intervention.statutFacture === 'Facturée';
    const nextStatut = isBilled ? 'Non facturée' : 'Facturée';
    const nextNum = !isBilled
      ? dossier.intervention.numeroFacture ||
        `FAC-${new Date().getFullYear()}-${String(dossier.intervention.id).padStart(4, '0')}`
      : dossier.intervention.numeroFacture;

    const mode = getDossierArbitrage(dossier);
    const finalAmount = mode === 'TTC' ? dossier.suggestedAmountTTC : dossier.suggestedAmountHT;

    await onUpdateIntervention(dossier.intervention.id, {
      statutFacture: nextStatut,
      numeroFacture: nextNum,
      amount: dossier.suggestedAmountHT,
      statutOperationnel: isBilled ? dossier.intervention.statutOperationnel : 'Clôturée',
    });
    toast.success(
      isBilled
        ? `Dossier ${dossier.intervention.reference} repassé en non facturé`
        : `Dossier ${dossier.intervention.reference} marqué comme facturé (${nextNum}) en arbitrage ${mode} (${formatCurrency(finalAmount)} ${mode}) !`
    );
  };

  const handleBatchEmitB2BInvoices = async () => {
    if (selectedIds.length === 0) return;
    const batchRef = `BORD-B2B-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
    for (const id of selectedIds) {
      const d = enrichedDossiers.find((x) => x.intervention.id === id);
      if (!d) continue;
      await onUpdateIntervention(id, {
        statutFacture: 'Facturée',
        numeroFacture: `${batchRef}-${id}`,
        amount: d.suggestedAmountHT,
        statutOperationnel: 'Clôturée',
        statutRapport: 'Validé & Clôturé',
        traitement: 'Traité',
      });
    }
    toast.success(`${selectedIds.length} dossier(s) B2B facturés sous le bordereau ${batchRef}`);
    setSelectedIds([]);
  };

  const buildClientResponseText = (d: EnrichedBillingDossier) => {
    const ref = d.intervention.reference || `INT-${d.intervention.id}`;
    const devisStr = d.linkedDevis
      ? ` (Suite au Devis ${d.linkedDevis.reference}${d.hasDeplacementVisite ? ' après visite de repérage' : ' chiffré sur plan'})`
      : ' (Intervention directe de maintenance/dépannage)';
    const greeting =
      d.segment === 'B2B'
        ? `Bonjour,

Suite à votre demande concernant le dossier d'intervention ${ref}${devisStr} pour le site « ${d.intervention.chantier} » (${d.intervention.client}) :
`
        : `Bonjour ${d.intervention.client || ''},

Nous faisons suite à votre demande concernant notre intervention ${ref}${devisStr} à l'adresse « ${d.intervention.chantier} » :
`;

    let body = '';
    const mode = getDossierArbitrage(d);
    const amountVal = mode === 'TTC' ? d.suggestedAmountTTC : d.suggestedAmountHT;

    if (d.category === 'FACTUREE') {
      body = `• État d'avancement : Les travaux de ${d.intervention.corpsEtat || 'maintenance'} ont été intégralement réalisés et clôturés le ${formatDateFR(d.intervention.dateReelle || d.intervention.datePlanifiee)}.
• Typologie : ${d.fluxLabel}.
• Résultat technique : ${d.intervention.resultatTechnique || 'Conforme'}.
• Facturation : La facture N° ${d.intervention.numeroFacture || 'enregistrée'} d'un montant de ${formatCurrency(amountVal)} ${mode} est validée.`;
    } else if (d.category === 'A_FACTURER' || d.category === 'A_VERIFIER') {
      body = `• État d'avancement : Notre technicien (${d.intervention.entreprise || 'équipe ANELEC'}) a terminé l'intervention sur site (${d.intervention.heureDebutReelle ? `pointage réel ${d.intervention.heureDebutReelle}–${d.intervention.heureFinReelle || ''}` : `créneau ${d.intervention.heureDebut || '08:00'}–${d.intervention.heureFin || '12:00'}`}).
• Travaux effectués : ${
        (d.intervention.actionsRealisees || []).join(', ') ||
        d.intervention.rapportFinal ||
        d.intervention.compteRendu ||
        d.intervention.objet ||
        'Prestations achevées'
      }.
• Facturation : Le dossier (${formatCurrency(amountVal)} ${mode}) est en cours de validation administrative.`;
    } else if (d.isDelayed || d.intervention.motifBlocage) {
      body = `• Point de situation sur le délai : ${d.delayRootCause}.
• Action mise en place par ANELEC : ${d.delayActionableAdvice}
• Typologie mission : ${d.fluxDescription}.`;
    } else {
      body = `• Planification : Votre intervention est programmée le ${formatDateFR(d.intervention.datePlanifiee)} sur le créneau ${d.intervention.heureDebut || '08:00'}–${d.intervention.heureFin || '12:00'} avec notre technicien référent ${d.intervention.entreprise || 'ANELEC'}.`;
    }

    const closing =
      d.segment === 'B2B'
        ? `

Nous restons à votre entière disposition pour vous transmettre le rapport d'attachement complet avec reportage photos.

Cordialement,
Le Service Exploitation & Facturation — ANELEC GROUPE`
        : `

Notre équipe reste à votre écoute pour toute question complémentaire.

Bien cordialement,
Service Client & Facturation — ANELEC GROUPE`;

    return `${greeting}${body}${closing}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* =====================================================================
          1. EXECUTIVE BILLING KPI STRIP (À TRAITER / À VÉRIFIER / NON ÉLIGIBLE / RETARDS / FACTURÉ)
          AVEC DISTINCTION HT & TTC — TITRES INTÉGRAUX SANS TRONCATURE
         ===================================================================== */}
      <div className="kpi-strip">
        {/* CARTE 1 : À FACTURER */}
        <div
          className="kpi-card"
          onClick={() => {
            setActiveTab('triage');
            setFilterCategory('A_FACTURER');
          }}
          style={{
            border: filterCategory === 'A_FACTURER' ? '1.5px solid #047857' : '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            borderRadius: '10px',
            padding: '13px 15px',
            boxShadow: filterCategory === 'A_FACTURER' ? '0 0 0 2px rgba(4, 120, 87, 0.15), 0 2px 6px rgba(0,0,0,0.04)' : '0 1px 3px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11.5px',
                fontWeight: 700,
                color: '#047857',
                background: 'rgba(4, 120, 87, 0.09)',
                padding: '3px 9px',
                borderRadius: '6px',
                lineHeight: 1.3,
              }}
            >
              <ProCheckIcon size={12} color="#047857" />
              <span>À facturer (Prêtes)</span>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', margin: '6px 0 3px' }}>
            <div className="font-mono" style={{ fontSize: '23px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {stats.aFacturer.length}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="font-mono" style={{ fontSize: '12px', fontWeight: 700, color: '#047857', whiteSpace: 'nowrap' }}>
                {formatCurrency(stats.montantAFacturerHT)} HT
              </div>
              <div className="font-mono" style={{ fontSize: '10.5px', color: '#64748b', whiteSpace: 'nowrap' }}>
                {formatCurrency(stats.montantAFacturerTTC)} TTC
              </div>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
            Terminées sur site • Rapport validé
          </div>
        </div>

        {/* CARTE 2 : À VÉRIFIER */}
        <div
          className="kpi-card"
          onClick={() => {
            setActiveTab('triage');
            setFilterCategory('A_VERIFIER');
          }}
          style={{
            border: filterCategory === 'A_VERIFIER' ? '1.5px solid #d97706' : '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            borderRadius: '10px',
            padding: '13px 15px',
            boxShadow: filterCategory === 'A_VERIFIER' ? '0 0 0 2px rgba(217, 119, 6, 0.15), 0 2px 6px rgba(0,0,0,0.04)' : '0 1px 3px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11.5px',
                fontWeight: 700,
                color: '#b45309',
                background: 'rgba(217, 119, 6, 0.09)',
                padding: '3px 9px',
                borderRadius: '6px',
                lineHeight: 1.3,
              }}
            >
              <ProAlertIcon size={12} color="#b45309" />
              <span>À vérifier (En attente)</span>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', margin: '6px 0 3px' }}>
            <div className="font-mono" style={{ fontSize: '23px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {stats.aVerifier.length}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="font-mono" style={{ fontSize: '12px', fontWeight: 700, color: '#b45309', whiteSpace: 'nowrap' }}>
                {formatCurrency(stats.montantAVerifierHT)} HT
              </div>
              <div className="font-mono" style={{ fontSize: '10.5px', color: '#64748b', whiteSpace: 'nowrap' }}>
                {formatCurrency(stats.montantAVerifierTTC)} TTC
              </div>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
            Rapport à certifier ou réserve
          </div>
        </div>

        {/* CARTE 3 : NE PAS FACTURER */}
        <div
          className="kpi-card"
          onClick={() => {
            setActiveTab('triage');
            setFilterCategory('NE_PAS_FACTURER');
          }}
          style={{
            border: filterCategory === 'NE_PAS_FACTURER' ? '1.5px solid #64748b' : '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            borderRadius: '10px',
            padding: '13px 15px',
            boxShadow: filterCategory === 'NE_PAS_FACTURER' ? '0 0 0 2px rgba(100, 116, 139, 0.15), 0 2px 6px rgba(0,0,0,0.04)' : '0 1px 3px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11.5px',
                fontWeight: 700,
                color: '#475569',
                background: 'rgba(100, 116, 139, 0.09)',
                padding: '3px 9px',
                borderRadius: '6px',
                lineHeight: 1.3,
              }}
            >
              <ProLockIcon size={12} color="#475569" />
              <span>Ne se facture pas</span>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', margin: '6px 0 3px' }}>
            <div className="font-mono" style={{ fontSize: '23px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {stats.nePasFacturer.length}
            </div>
            <span className="font-mono" style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', fontWeight: 600 }}>
              En cours / Visites
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
            Non terminés, visites devis
          </div>
        </div>

        {/* CARTE 4 : RETARDS & RÉPONSES */}
        <div
          className="kpi-card"
          onClick={() => setActiveTab('retards_clients')}
          style={{
            border: activeTab === 'retards_clients' ? '1.5px solid #be123c' : '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            borderRadius: '10px',
            padding: '13px 15px',
            boxShadow: activeTab === 'retards_clients' ? '0 0 0 2px rgba(190, 18, 60, 0.15), 0 2px 6px rgba(0,0,0,0.04)' : '0 1px 3px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11.5px',
                fontWeight: 700,
                color: '#be123c',
                background: 'rgba(190, 18, 60, 0.09)',
                padding: '3px 9px',
                borderRadius: '6px',
                lineHeight: 1.3,
              }}
            >
              <ProClockIcon size={12} color="#be123c" />
              <span>Retards & Réponses</span>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', margin: '6px 0 3px' }}>
            <div className="font-mono" style={{ fontSize: '23px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {stats.enRetardOuBloque.length}
            </div>
            <span className="font-mono" style={{ fontSize: '11px', fontWeight: 600, color: '#be123c', whiteSpace: 'nowrap' }}>
              Diagnostic 1-Clic
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
            Causes retards & courrier prêt
          </div>
        </div>

        {/* CARTE 5 : FACTURÉES (BILAN B2B/B2C) */}
        <div
          className="kpi-card"
          onClick={() => {
            setActiveTab('triage');
            setFilterCategory('FACTUREE');
          }}
          style={{
            border: filterCategory === 'FACTUREE' ? '1.5px solid var(--text-primary)' : '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            borderRadius: '10px',
            padding: '13px 15px',
            boxShadow: filterCategory === 'FACTUREE' ? '0 0 0 2px rgba(30, 41, 59, 0.15), 0 2px 6px rgba(0,0,0,0.04)' : '0 1px 3px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11.5px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                background: 'var(--color-primary-soft, rgba(148, 163, 184, 0.15))',
                padding: '3px 9px',
                borderRadius: '6px',
                lineHeight: 1.3,
              }}
            >
              <ProFileTextIcon size={12} color="var(--text-primary)" />
              <span>Facturées (B2B/B2C)</span>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', margin: '6px 0 3px' }}>
            <div className="font-mono" style={{ fontSize: '23px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {stats.facturees.length}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="font-mono" style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>
                {formatCurrency(stats.montantFactureHT)} HT
              </div>
              <div className="font-mono" style={{ fontSize: '10.5px', color: '#64748b', whiteSpace: 'nowrap' }}>
                {formatCurrency(stats.montantFactureTTC)} TTC
              </div>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
            {stats.b2bCount} B2B • {stats.b2cCount} B2C
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. NAVIGATION DES ONGLETS DE L'AGENT DE FACTURATION
         ===================================================================== */}
      <div className="fsm-toolbar" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div className="segmented-control segmented-control-fluid">
          <button
            type="button"
            className={`segmented-btn ${activeTab === 'triage' ? 'active' : ''}`}
            onClick={() => setActiveTab('triage')}
          >
            <span className="desktop-only-el" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <ProFilterIcon size={13} />
              <span>1. Tri Facturation : À traiter vs Non-Éligibles ({enrichedDossiers.length})</span>
            </span>
            <span className="mobile-only-flex" style={{ alignItems: 'center', gap: '5px' }}>
              <ProFilterIcon size={12} />
              <span>1. Tri ({enrichedDossiers.length})</span>
            </span>
          </button>
          <button
            type="button"
            className={`segmented-btn ${activeTab === 'retards_clients' ? 'active' : ''}`}
            onClick={() => setActiveTab('retards_clients')}
          >
            <span className="desktop-only-el" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <ProClockIcon size={13} />
              <span>2. Pourquoi les Retards & Réponses Clients Initiaux ({stats.enRetardOuBloque.length})</span>
            </span>
            <span className="mobile-only-flex" style={{ alignItems: 'center', gap: '5px' }}>
              <ProClockIcon size={12} />
              <span>2. Retards ({stats.enRetardOuBloque.length})</span>
            </span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: '1 1 320px' }}>
          {/* Filtre Segment B2B / B2C */}
          <div className="segmented-control segmented-control-fluid" style={{ flex: '0 0 auto' }}>
            <button
              type="button"
              className={`segmented-btn ${filterSegment === 'ALL' ? 'active' : ''}`}
              onClick={() => setFilterSegment('ALL')}
            >
              Tous ({enrichedDossiers.length})
            </button>
            <button
              type="button"
              className={`segmented-btn ${filterSegment === 'B2B' ? 'active' : ''}`}
              onClick={() => setFilterSegment('B2B')}
            >
              B2B ({stats.b2bCount})
            </button>
            <button
              type="button"
              className={`segmented-btn ${filterSegment === 'B2C' ? 'active' : ''}`}
              onClick={() => setFilterSegment('B2C')}
            >
              B2C ({stats.b2cCount})
            </button>
          </div>

          <input
            type="text"
            className="input"
            style={{ flex: '1 1 220px', minWidth: '210px' }}
            placeholder="Rechercher client, réf, facture..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Barre de filtres temporels : Jour, Mois, Année */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '8px',
            flexWrap: 'wrap',
            paddingTop: '8px',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <ProCalendarIcon size={13} />
            <span>Filtre Temporel :</span>
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {/* Filtre Année */}
            <select
              className="select"
              style={{ width: '130px', height: '32px', fontSize: '11.5px', padding: '2px 8px' }}
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              title="Filtrer par Année"
            >
              <option value="ALL">Année (Toutes)</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  Année {yr}
                </option>
              ))}
            </select>

            {/* Filtre Mois */}
            <select
              className="select"
              style={{ width: '140px', height: '32px', fontSize: '11.5px', padding: '2px 8px' }}
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              title="Filtrer par Mois"
            >
              <option value="ALL">Mois (Tous)</option>
              <option value="01">01 - Janvier</option>
              <option value="02">02 - Février</option>
              <option value="03">03 - Mars</option>
              <option value="04">04 - Avril</option>
              <option value="05">05 - Mai</option>
              <option value="06">06 - Juin</option>
              <option value="07">07 - Juillet</option>
              <option value="08">08 - Août</option>
              <option value="09">09 - Septembre</option>
              <option value="10">10 - Octobre</option>
              <option value="11">11 - Novembre</option>
              <option value="12">12 - Décembre</option>
            </select>

            {/* Filtre Jour */}
            <select
              className="select"
              style={{ width: '110px', height: '32px', fontSize: '11.5px', padding: '2px 8px' }}
              value={filterDay}
              onChange={(e) => setFilterDay(e.target.value)}
              title="Filtrer par Jour"
            >
              <option value="ALL">Jour (Tous)</option>
              {Array.from({ length: 31 }, (_, idx) => String(idx + 1).padStart(2, '0')).map((d) => (
                <option key={d} value={d}>
                  Jour {d}
                </option>
              ))}
            </select>

            {(filterYear !== 'ALL' || filterMonth !== 'ALL' || filterDay !== 'ALL') && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ height: '32px', padding: '2px 10px', fontSize: '11px', color: '#dc2626' }}
                onClick={() => {
                  setFilterYear('ALL');
                  setFilterMonth('ALL');
                  setFilterDay('ALL');
                }}
                title="Effacer le filtre temporel"
              >
                ✕ Effacer date ({filteredDossiers.length} résultat{filteredDossiers.length > 1 ? 's' : ''})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          ONGLET 1 : TRI INTELLIGENT AVEC PRIORISATION DES FLUX D'INTERVENTION
          ET ARBITRAGE LIBRE HT vs TTC
         ===================================================================== */}
      {activeTab === 'triage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* BANDEAU DE PRIORISATION DES FLUX D'INTERVENTION & ARBITRAGE LIBRE HT vs TTC */}
          <div
            className="glass-analytics-card"
            style={{
              padding: '12px 16px',
              gap: '10px',
              background: 'rgba(255, 255, 255, 0.88)',
              borderLeft: '4px solid #2563eb',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '10px',
                    fontWeight: 800,
                    background: 'rgba(37, 99, 235, 0.12)',
                    color: '#1d4ed8',
                    letterSpacing: '0.04em',
                  }}
                >
                  SECTION PRIORITÉ DES INTERVENTIONS & FLUX
                </span>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '3px' }}>
                  Filtrer & Privilégier les Interventions : Directes vs Suite à Devis (Visite ou Sans déplacement)
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Règle standard ANELEC : on ne facture que les interventions.</span>
                  {allowDirectDevisBilling ? (
                    <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 800, background: 'rgba(239,68,68,0.14)', color: '#dc2626' }}>
                      Dérogation Admin Active : Devis facturables
                    </span>
                  ) : (
                    <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, background: 'rgba(16,185,129,0.12)', color: '#059669' }}>
                      ✓ Règle stricte active (Option admin auto-décochée)
                    </span>
                  )}
                </div>
              </div>

              {/* Contrôle Global de l'Arbitrage HT vs TTC */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-surface)', padding: '4px 8px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#1e40af' }}>
                  § Arbitrage Taxe :
                </span>
                <div className="segmented-control" style={{ padding: '2px' }}>
                  <button
                    type="button"
                    className={`segmented-btn ${globalTaxArbitrage === 'LIBRE' ? 'active' : ''}`}
                    onClick={() => {
                      setGlobalTaxArbitrage('LIBRE');
                      toast.success('Arbitrage libre actif : chaque dossier est personnalisable individuellement');
                    }}
                    title="Arbitrage libre par dossier : B2C en TTC et B2B en HT avec choix manuel libre par ligne"
                  >
                    Arbitrage Libre
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${globalTaxArbitrage === 'FORCE_HT' ? 'active' : ''}`}
                    onClick={() => {
                      setGlobalTaxArbitrage('FORCE_HT');
                      toast.success('Affichage forcé de tous les dossiers en Montant HT');
                    }}
                    title="Forcer l'affichage de tous les dossiers en Montant HT"
                  >
                    Tout HT
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${globalTaxArbitrage === 'FORCE_TTC' ? 'active' : ''}`}
                    onClick={() => {
                      setGlobalTaxArbitrage('FORCE_TTC');
                      toast.success('Affichage forcé de tous les dossiers en Montant TTC');
                    }}
                    title="Forcer l'affichage de tous les dossiers en Montant TTC"
                  >
                    Tout TTC
                  </button>
                </div>
              </div>
            </div>

            {/* Boutons de priorisation des typologies de flux */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingTop: '4px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <button
                type="button"
                className={`btn btn-sm ${filterFlux === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterFlux('ALL')}
                style={{ padding: '4px 10px', fontSize: '11px' }}
              >
                → Toutes les Interventions ({enrichedDossiers.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${filterFlux === 'DIRECTE' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterFlux('DIRECTE')}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  background: filterFlux === 'DIRECTE' ? '#1d4ed8' : undefined,
                  fontWeight: 800,
                }}
                title="Privilégier les interventions directes (dépannages, régie, ordres de mission sans devis préalable)"
              >
                ▸ Interventions Directes ({stats.directeCount})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${filterFlux === 'SUITE_DEVIS_AVEC_VISITE' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterFlux('SUITE_DEVIS_AVEC_VISITE')}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  background: filterFlux === 'SUITE_DEVIS_AVEC_VISITE' ? '#7c3aed' : undefined,
                }}
                title="Interventions suite à un devis qui a nécessité un déplacement préalable sur site pour métré et chiffrage"
              >
                → Suite à Devis : Avec Visite / Déplacement ({stats.suiteDevisAvecVisiteCount})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${filterFlux === 'SUITE_DEVIS_SANS_VISITE' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterFlux('SUITE_DEVIS_SANS_VISITE')}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  background: filterFlux === 'SUITE_DEVIS_SANS_VISITE' ? '#059669' : undefined,
                }}
                title="Interventions suite à un devis chiffré directement à distance sur plans, photos ou descriptif (sans déplacement préalable)"
              >
                ≡ Suite à Devis : Sans Déplacement ({stats.suiteDevisSansVisiteCount})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${filterFlux === 'VISITE_DEVIS' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterFlux('VISITE_DEVIS')}
                style={{ padding: '4px 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                title="Visites préalables en vue de l'établissement d'un devis (non facturables directement)"
              >
                <ProSearchIcon size={12} />
                <span>Visites Devis ({stats.visiteDevisCount})</span>
              </button>
            </div>
          </div>

          {/* Sous-filtres par statut d'éligibilité + Bouton Facturation Groupée B2B */}
          <div
            className="glass-analytics-card"
            style={{
              padding: '10px 14px',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { id: 'ALL', label: `Tous statuts (${enrichedDossiers.length})` },
                { id: 'A_FACTURER', label: `À traiter maintenant (${stats.aFacturer.length})` },
                { id: 'A_VERIFIER', label: `À vérifier (${stats.aVerifier.length})` },
                { id: 'NE_PAS_FACTURER', label: `Ne pas facturer (${stats.nePasFacturer.length})` },
                { id: 'FACTUREE', label: `✓ Facturées (${stats.facturees.length})` },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`btn btn-sm ${filterCategory === f.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '2px 8px', fontSize: '11px' }}
                  onClick={() => setFilterCategory(f.id as any)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {selectedIds.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="font-mono" style={{ fontSize: '11.5px', fontWeight: 700, color: '#2563eb' }}>
                  {selectedIds.length} sélectionné(s)
                </span>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ padding: '2px 8px', fontSize: '11px' }}
                  onClick={handleBatchEmitB2BInvoices}
                >
                  Facturer en lot (Bordereau B2B)
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '2px 6px', fontSize: '10.5px' }}
                  onClick={() => setSelectedIds([])}
                >
                  Désélectionner
                </button>
              </div>
            )}
          </div>

          <div className="desktop-only-block pro-table-container">
            <table className="pro-table">
              <thead>
                <tr>
                  <th style={{ width: '30px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={
                        filteredDossiers.length > 0 &&
                        selectedIds.length === filteredDossiers.length
                      }
                      onChange={(e) =>
                        setSelectedIds(
                          e.target.checked ? filteredDossiers.map((d) => d.intervention.id) : []
                        )
                      }
                    />
                  </th>
                  <th style={{ width: '165px' }}>Réf & Flux d'Intervention</th>
                  <th style={{ minWidth: '150px', maxWidth: '190px' }}>Client & Marché</th>
                  <th style={{ minWidth: '220px', maxWidth: '280px' }}>Décision Facturation & Pourquoi ?</th>
                  <th style={{ width: '135px' }}>Terrain & Preuves</th>
                  <th style={{ width: '185px' }}>Chiffrage & Arbitrage Taxe (HT / TTC)</th>
                  <th style={{ textAlign: 'right', width: '135px' }}>Actions Agent</th>
                </tr>
              </thead>
              <tbody>
                {filteredDossiers.map((d) => {
                  const intv = d.intervention;
                  const badgeColors =
                    d.category === 'A_FACTURER'
                      ? { bg: 'rgba(16, 185, 129, 0.15)', text: '#059669', border: '#10b981' }
                      : d.category === 'A_VERIFIER'
                      ? { bg: 'rgba(245, 158, 11, 0.15)', text: '#d97706', border: '#f59e0b' }
                      : d.category === 'FACTUREE'
                      ? { bg: 'rgba(37, 99, 235, 0.14)', text: '#2563eb', border: '#3b82f6' }
                      : { bg: 'rgba(100, 116, 139, 0.14)', text: '#475569', border: '#94a3b8' };

                  const currentMode = getDossierArbitrage(d);
                  const currentTva = getDossierTva(d);
                  const htAmount = d.suggestedAmountHT;
                  const ttcAmount = Math.round(htAmount * (1 + currentTva / 100) * 100) / 100;

                  return (
                    <tr key={intv.id}>
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(intv.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds((prev) => [...prev, intv.id]);
                            } else {
                              setSelectedIds((prev) => prev.filter((id) => id !== intv.id));
                            }
                          }}
                        />
                      </td>

                      {/* COLONNE 2 : RÉFÉRENCE & FLUX D'INTERVENTION (DIRECTE VS SUITE DEVIS VISITE/SANS VISITE) */}
                      <td>
                        <div
                          className="font-mono"
                          style={{ fontWeight: 800, color: '#2563eb', cursor: 'pointer', fontSize: '12px' }}
                          onClick={() => onOpenInterventionDrawer(intv)}
                          title="Cliquer pour ouvrir la fiche intervention"
                        >
                          {intv.reference || `INT-${intv.id}`}
                        </div>

                        {/* Badge Typologie de flux */}
                        <div style={{ marginTop: '3px' }}>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '999px',
                              fontSize: '10px',
                              fontWeight: 800,
                              background: d.fluxBadge.bg,
                              color: d.fluxBadge.text,
                              border: `1px solid ${d.fluxBadge.border}`,
                              display: 'inline-block',
                              whiteSpace: 'nowrap',
                            }}
                            title={d.fluxDescription}
                          >
                            {d.fluxLabel}
                          </span>
                        </div>

                        {/* Lien vers Devis si suite à devis */}
                        {d.linkedDevis ? (
                          <div
                            onClick={() => onOpenDevisDrawer(d.linkedDevis!)}
                            style={{
                              fontSize: '10.5px',
                              color: '#7c3aed',
                              fontWeight: 700,
                              cursor: 'pointer',
                              marginTop: '2px',
                            }}
                            title="Ouvrir le devis initial lié"
                          >
                            ↗ Devis {d.linkedDevis.reference || `DEV-${d.linkedDevis.id}`} ({formatCurrency(d.linkedDevis.amount)})
                            {d.hasDeplacementVisite ? ' • Visite sur site' : ' • Sans déplacement'}
                          </div>
                        ) : (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Demande directe ({intv.origine || 'Client'})
                          </div>
                        )}

                        {intv.numeroFacture && (
                          <div
                            className="font-mono"
                            style={{
                              marginTop: '3px',
                              fontSize: '10px',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: 'rgba(37, 99, 235, 0.12)',
                              color: '#1d4ed8',
                              display: 'inline-block',
                              fontWeight: 700,
                            }}
                          >
                            ≡ {intv.numeroFacture}
                          </div>
                        )}
                      </td>

                      {/* COLONNE 3 : CLIENT & MARCHÉ (B2B vs B2C) */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 800, fontSize: '12px' }}>
                            {intv.client || 'Client à préciser'}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setSegmentOverrides((prev) => ({
                                ...prev,
                                [intv.id]: d.segment === 'B2B' ? 'B2C' : 'B2B',
                              }))
                            }
                            title="Cliquez pour basculer entre régime B2B (Pro/Donneur d'ordre) et B2C (Particulier)"
                            style={{
                              padding: '1px 6px',
                              borderRadius: '999px',
                              fontSize: '9.5px',
                              fontWeight: 800,
                              cursor: 'pointer',
                              border:
                                d.segment === 'B2B'
                                  ? '1px solid rgba(37, 99, 235, 0.4)'
                                  : '1px solid rgba(14, 165, 233, 0.4)',
                              background:
                                d.segment === 'B2B'
                                  ? 'rgba(37, 99, 235, 0.12)'
                                  : 'rgba(14, 165, 233, 0.14)',
                              color: d.segment === 'B2B' ? '#1d4ed8' : '#0369a1',
                            }}
                          >
                            {d.segment === 'B2B' ? 'B2B (Pro)' : 'B2C (Particulier)'}
                          </button>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {intv.chantier} • <strong>{intv.corpsEtat || 'TCE'}</strong>
                        </div>
                        <div
                          style={{
                            fontSize: '10.5px',
                            color: 'var(--text-muted)',
                            maxWidth: '180px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={intv.objet || ''}
                        >
                          {intv.objet}
                        </div>
                      </td>

                      {/* COLONNE 4 : DÉCISION FACTURATION & POURQUOI */}
                      <td style={{ maxWidth: '280px' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '1px 7px',
                            borderRadius: '999px',
                            fontSize: '10.5px',
                            fontWeight: 800,
                            background: badgeColors.bg,
                            color: badgeColors.text,
                            border: `1px solid ${badgeColors.border}`,
                            marginBottom: '3px',
                          }}
                        >
                          {d.statusLabel}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '11.5px', color: 'var(--text-primary)' }}>
                          Pourquoi : {d.whyTitle}
                        </div>
                        {d.whyDetails.slice(0, 2).map((detail, idx) => (
                          <div
                            key={idx}
                            style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '1px' }}
                          >
                            • {detail}
                          </div>
                        ))}
                        {d.isDelayed && (
                          <div
                            onClick={() => setClientResponseModalDossier(d)}
                            style={{
                              marginTop: '3px',
                              padding: '2px 6px',
                              borderRadius: '5px',
                              background: 'rgba(239, 68, 68, 0.12)',
                              color: '#dc2626',
                              fontSize: '10px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-block',
                            }}
                            title="Générer immédiatement la réponse client pour expliquer le retard"
                          >
                            Retard (+{d.delayDays}j) : Répondre au client →
                          </div>
                        )}
                      </td>

                      {/* COLONNE 5 : TERRAIN & PREUVES */}
                      <td>
                        <div style={{ fontSize: '11.5px', fontWeight: 700 }}>
                          {intv.entreprise || 'Non affecté'}
                        </div>
                        <div className="font-mono" style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                          Planifié : {formatDateFR(intv.datePlanifiee)} ({d.plannedHours}h)
                        </div>
                        {intv.heureDebutReelle && (
                          <div className="font-mono" style={{ fontSize: '10.5px', color: '#059669', fontWeight: 700 }}>
                            Pointé : {intv.heureDebutReelle}–{intv.heureFinReelle || '...'} (
                            {d.realHours ? `${d.realHours}h` : 'En cours'})
                          </div>
                        )}
                        {d.photosCount > 0 && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ marginTop: '3px', padding: '1px 6px', fontSize: '10px' }}
                            onClick={() =>
                              onOpenPhotoLightbox(
                                (intv.photos || []).map((p: any, idx: number) => ({
                                  id: p.id || `ph-${idx}`,
                                  url: p.url,
                                  category: p.category || 'Terrain',
                                  caption: p.caption || intv.reference || '',
                                  takenAt: p.takenAt,
                                  auteur: p.auteur || intv.entreprise || '',
                                })),
                                0
                              )
                            }
                          >
                            ⊞ {d.photosCount} photo(s)
                          </button>
                        )}
                      </td>

                      {/* COLONNE 6 : CHIFFRAGE & ARBITRAGE TAXE HT vs TTC (ARBITRAGE LIBRE À CHOISIR) */}
                      <td>
                        {/* Contrôle de l'Arbitrage HT vs TTC par dossier */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                          <div className="segmented-control" style={{ padding: '1px' }}>
                            <button
                              type="button"
                              className={`segmented-btn ${currentMode === 'HT' ? 'active' : ''}`}
                              style={{ padding: '1px 6px', fontSize: '10px', fontWeight: 800 }}
                              onClick={() => handleToggleArbitrage(intv.id, 'TTC')}
                              title="Basculer en arbitrage Montant HT"
                            >
                              HT
                            </button>
                            <button
                              type="button"
                              className={`segmented-btn ${currentMode === 'TTC' ? 'active' : ''}`}
                              style={{ padding: '1px 6px', fontSize: '10px', fontWeight: 800 }}
                              onClick={() => handleToggleArbitrage(intv.id, 'HT')}
                              title="Basculer en arbitrage Montant TTC"
                            >
                              TTC
                            </button>
                          </div>

                          {/* Sélecteur de TVA */}
                          <select
                            className="select font-mono"
                            style={{ padding: '1px 4px', fontSize: '10px', height: '22px' }}
                            value={currentTva}
                            onChange={(e) => handleChangeTvaRate(intv.id, Number(e.target.value))}
                            title="Taux de TVA applicable"
                          >
                            <option value={20}>20%</option>
                            <option value={10}>10%</option>
                            <option value={5.5}>5.5%</option>
                            <option value={0}>0%</option>
                          </select>
                        </div>

                        {/* Affichage du Montant selon le mode d'arbitrage choisi */}
                        {currentMode === 'HT' ? (
                          <>
                            <div className="font-mono" style={{ fontSize: '13.5px', fontWeight: 800, color: '#1d4ed8' }}>
                              {formatCurrency(htAmount)} HT
                            </div>
                            <div className="font-mono" style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                              {formatCurrency(ttcAmount)} TTC (TVA {currentTva}%)
                            </div>
                            <span style={{ fontSize: '9px', fontWeight: 700, color: '#1d4ed8', background: 'rgba(37,99,235,0.08)', padding: '1px 4px', borderRadius: '4px', display: 'inline-block', marginTop: '2px' }}>
                              Arbitrage : Facture HT
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="font-mono" style={{ fontSize: '13.5px', fontWeight: 800, color: '#7c3aed' }}>
                              {formatCurrency(ttcAmount)} TTC
                            </div>
                            <div className="font-mono" style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                              {formatCurrency(htAmount)} HT (TVA {currentTva}%)
                            </div>
                            <span style={{ fontSize: '9px', fontWeight: 700, color: '#7c3aed', background: 'rgba(124,58,237,0.08)', padding: '1px 4px', borderRadius: '4px', display: 'inline-block', marginTop: '2px' }}>
                              Arbitrage : Facture TTC
                            </span>
                          </>
                        )}

                        <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {d.amountSource}
                        </div>
                      </td>

                      {/* COLONNE 7 : ACTIONS AGENT */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '3px', flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className={`btn btn-sm ${d.category === 'FACTUREE' ? 'btn-secondary' : 'btn-primary'}`}
                            style={{ padding: '2px 7px', fontSize: '10.5px', whiteSpace: 'nowrap' }}
                            onClick={() => handleToggleFacture(d)}
                            title={d.category === 'FACTUREE' ? 'Dossier déjà facturé. Cliquez pour basculer.' : `Marquer comme Facturée en ${currentMode}`}
                          >
                            {d.category === 'FACTUREE' ? '✓ Facturée' : 'Facturer'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 6px', fontSize: '10.5px' }}
                            onClick={() => setClientResponseModalDossier(d)}
                            title="Générer une réponse claire pour le client initial (avancement, retard ou facture)"
                          >
                            • Répondre
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 5px', fontSize: '10.5px' }}
                            onClick={() => onOpenInterventionDrawer(intv)}
                            title="Ouvrir la fiche intervention"
                          >
                            Fiche
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cartes Mobiles Dossiers Facturation (Affichage optimisé tactile 0px débordement) */}
          <div className="mobile-only-block mobile-card-grid">
            {filteredDossiers.map((d) => {
              const intv = d.intervention;
              const currentMode = getDossierArbitrage(d);
              const currentTva = getDossierTva(d);
              const htAmount = d.suggestedAmountHT;
              const ttcAmount = Math.round(htAmount * (1 + currentTva / 100) * 100) / 100;
              const isSelected = selectedIds.includes(intv.id);

              return (
                <div
                  key={intv.id}
                  className="mobile-record-card"
                  style={{
                    borderLeft: `4px solid ${
                      d.category === 'A_FACTURER'
                        ? '#00bf63'
                        : d.category === 'A_VERIFIER'
                        ? '#ffcc00'
                        : d.category === 'FACTUREE'
                        ? '#2563eb'
                        : '#94a3b8'
                    }`,
                  }}
                  onClick={() => onOpenInterventionDrawer(intv)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds((prev) => [...prev, intv.id]);
                          else setSelectedIds((prev) => prev.filter((id) => id !== intv.id));
                        }}
                      />
                      <span className="font-mono" style={{ fontWeight: 800, fontSize: '13px', color: '#2563eb' }}>
                        {intv.reference || `INT-${intv.id}`}
                      </span>
                    </div>

                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background:
                          d.category === 'A_FACTURER'
                            ? 'rgba(0, 191, 99, 0.14)'
                            : d.category === 'A_VERIFIER'
                            ? 'rgba(255, 204, 0, 0.2)'
                            : d.category === 'FACTUREE'
                            ? 'rgba(37, 99, 235, 0.14)'
                            : 'rgba(100, 116, 139, 0.14)',
                        color:
                          d.category === 'A_FACTURER'
                            ? '#047857'
                            : d.category === 'A_VERIFIER'
                            ? '#b45309'
                            : d.category === 'FACTUREE'
                            ? '#1d4ed8'
                            : '#475569',
                      }}
                    >
                      {d.statusLabel}
                    </span>
                  </div>

                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-primary)' }}>
                      {intv.client || 'Client non précisé'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {intv.chantier || 'Chantier non précisé'} • • {intv.corpsEtat || 'TCE'}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: d.fluxBadge.bg,
                          color: d.fluxBadge.text,
                          border: `1px solid ${d.fluxBadge.border}`,
                        }}
                      >
                        {d.fluxLabel}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: d.segment === 'B2B' ? 'rgba(37,99,235,0.1)' : 'rgba(16,185,129,0.1)',
                          color: d.segment === 'B2B' ? '#2563eb' : '#059669',
                        }}
                      >
                        {d.segment === 'B2B' ? 'B2B (Pro)' : 'B2C (Particulier)'}
                      </span>
                    </div>
                  </div>

                  {/* Bloc Financier & Arbitrage */}
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div>
                      <div className="font-mono" style={{ fontSize: '15px', fontWeight: 800, color: currentMode === 'HT' ? '#1d4ed8' : '#7c3aed' }}>
                        {formatCurrency(currentMode === 'HT' ? htAmount : ttcAmount)} {currentMode}
                      </div>
                      <div className="font-mono" style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                        {currentMode === 'HT' ? `${formatCurrency(ttcAmount)} TTC (TVA ${currentTva}%)` : `${formatCurrency(htAmount)} HT (TVA ${currentTva}%)`}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '10.5px', padding: '3px 7px' }}
                      onClick={() => handleToggleArbitrage(intv.id, currentMode)}
                      title="Basculer HT vs TTC pour cette facture"
                    >
                      § Basculer {currentMode === 'HT' ? 'TTC' : 'HT'}
                    </button>
                  </div>

                  {/* Actions Rapides Agent */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '6px',
                      borderTop: '1px solid var(--border-subtle)',
                      gap: '6px',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {intv.entreprise || 'Non assigné'}
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        className={`btn btn-sm ${d.category === 'FACTUREE' ? 'btn-secondary' : 'btn-primary'}`}
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                        onClick={() => handleToggleFacture(d)}
                      >
                        {d.category === 'FACTUREE' ? '✓ Facturée' : 'Facturer'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                        onClick={() => setClientResponseModalDossier(d)}
                      >
                        • Répondre
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredDossiers.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                Aucun dossier de facturation trouvé.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          ONGLET 2 : DIAGNOSTIC DES RETARDS & RÉPONSES AUX CLIENTS INITIAUX
         ===================================================================== */}
      {activeTab === 'retards_clients' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            className="glass-analytics-card"
            style={{
              padding: '16px 20px',
              borderLeft: stats.enRetardOuBloque.length > 0 ? '4px solid #be123c' : '4px solid #047857',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ minWidth: 0, flex: '1 1 420px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'flex-start', gap: '8px', lineHeight: 1.35 }}>
                  <ProClockIcon size={16} color={stats.enRetardOuBloque.length > 0 ? '#be123c' : '#047857'} style={{ marginTop: '2px', flexShrink: 0 }} />
                  <span>Pourquoi les interventions prennent du retard & Comment répondre aux clients initiaux (B2B / B2C)</span>
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.45 }}>
                  Cette vue croise automatiquement la date de demande initiale, le devis lié, le planning technicien et les blocages terrain pour donner à l'agent l'explication exacte à communiquer au client.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onNavigateToPlanning}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}
              >
                <ProCalendarIcon size={13} color="#ffffff" />
                <span>Ouvrir le Planning Gantt pour replanifier →</span>
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 330px), 1fr))',
              gap: '14px',
              alignItems: 'stretch',
            }}
          >
            {(stats.enRetardOuBloque.length > 0 ? stats.enRetardOuBloque : filteredDossiers.slice(0, 9)).map(
              (d) => {
                const intv = d.intervention;
                const hasIssue = d.isDelayed || Boolean(intv.motifBlocage) || intv.statutOperationnel === 'Suspendue';
                const accentColor = d.isDelayed ? '#ef4444' : hasIssue ? '#f59e0b' : '#059669';

                return (
                  <div
                    key={intv.id}
                    className="glass-analytics-card"
                    style={{
                      borderLeft: `4px solid ${accentColor}`,
                      padding: '16px 18px',
                      gap: '12px',
                      height: '100%',
                      justifyContent: 'space-between',
                    }}
                  >
                    {/* EN-TÊTE STRUCTURÉ À HAUTEUR HOMOGÈNE (ZÉRO DÉCALAGE ENTRE LES CARTES D'UNE MÊME LIGNE) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                      {/* Ligne 1 : Référence + Segment + Statut Retard à gauche | Technicien à droite */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', minWidth: 0 }}>
                          <span className="font-mono" style={{ fontWeight: 800, fontSize: '13px', color: '#2563eb' }}>
                            {intv.reference || `INT-${intv.id}`}
                          </span>
                          <span
                            style={{
                              padding: '2px 7px',
                              borderRadius: '999px',
                              fontSize: '10px',
                              fontWeight: 800,
                              background: d.segment === 'B2B' ? 'rgba(37, 99, 235, 0.12)' : 'rgba(14, 165, 233, 0.14)',
                              color: d.segment === 'B2B' ? '#1d4ed8' : '#0369a1',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {d.segment === 'B2B' ? 'Client B2B' : 'Client B2C'}
                          </span>
                          {d.isDelayed ? (
                            <span
                              className="font-mono"
                              style={{
                                padding: '2px 7px',
                                borderRadius: '999px',
                                fontSize: '10px',
                                fontWeight: 800,
                                background: 'rgba(239, 68, 68, 0.14)',
                                color: '#dc2626',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Retard : +{d.delayDays}j
                            </span>
                          ) : (
                            <span
                              style={{
                                padding: '2px 7px',
                                borderRadius: '999px',
                                fontSize: '10px',
                                fontWeight: 700,
                                background: 'rgba(5, 150, 105, 0.1)',
                                color: '#047857',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              À jour
                            </span>
                          )}
                        </div>
                        <span
                          className="font-mono"
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            background: 'var(--bg-elevated)',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          Tech: <strong style={{ color: 'var(--text-primary)' }}>{intv.entreprise || 'Non affecté'}</strong>
                        </span>
                      </div>

                      {/* Ligne 2 dédiée : Badge Typologie Flux avec icône SVG nette */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '10.5px',
                            fontWeight: 700,
                            background: d.fluxBadge.bg,
                            color: d.fluxBadge.text,
                            border: `1px solid ${d.fluxBadge.border}40`,
                            maxWidth: '100%',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={d.fluxDescription}
                        >
                          {d.fluxType === 'VISITE_DEVIS' ? (
                            <ProSearchIcon size={11} color={d.fluxBadge.text} />
                          ) : d.fluxType === 'SUITE_DEVIS_AVEC_VISITE' ? (
                            <ProExternalIcon size={11} color={d.fluxBadge.text} />
                          ) : d.fluxType === 'SUITE_DEVIS_SANS_VISITE' ? (
                            <ProFileTextIcon size={11} color={d.fluxBadge.text} />
                          ) : (
                            <ProCheckIcon size={11} color={d.fluxBadge.text} />
                          )}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.fluxLabel}</span>
                        </span>
                      </div>

                      {/* Ligne 3 & 4 : Client — Chantier & Corps d'état — Objet */}
                      <div style={{ marginTop: '2px', minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: '13.5px',
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={`${intv.client || ''} — ${intv.chantier || ''}`}
                        >
                          {intv.client || 'Client'} — <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{intv.chantier || 'Site'}</span>
                        </div>
                        <div
                          style={{
                            fontSize: '11.5px',
                            color: 'var(--text-muted)',
                            marginTop: '2px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={`${intv.corpsEtat || 'TCE'} • ${intv.objet || ''}`}
                        >
                          {intv.corpsEtat || 'TCE'} • {intv.objet || 'Intervention technique'}
                        </div>
                      </div>
                    </div>

                    {/* BOÎTE D'EXPLICATION DU POURQUOI (ALERTE SI RETARD/BLOCAGE, SINON SUIVI NORMAL) */}
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: hasIssue ? 'rgba(239, 68, 68, 0.06)' : 'rgba(16, 185, 129, 0.06)',
                        border: hasIssue ? '1px solid rgba(239, 68, 68, 0.22)' : '1px solid rgba(16, 185, 129, 0.22)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '11px',
                          fontWeight: 800,
                          color: hasIssue ? '#dc2626' : '#047857',
                          textTransform: 'uppercase',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {hasIssue ? (
                          <ProAlertIcon size={13} color="#dc2626" />
                        ) : (
                          <ProCheckIcon size={13} color="#047857" />
                        )}
                        <span>{hasIssue ? 'Pourquoi ce retard / blocage :' : 'Diagnostic délai & avancement :'}</span>
                      </div>
                      <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                        {d.delayRootCause}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.4 }}>
                        • <strong>Action & Réponse conseillée :</strong> {d.delayActionableAdvice}
                      </div>
                    </div>

                    {/* CHRONOLOGIE RAPIDE : 1. DEMANDE -> 2. FLUX DEVIS -> 3. PLANIFIÉE -> 4. ÉCHÉANCE */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                        gap: '8px',
                        fontSize: '10.5px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        padding: '8px 10px',
                        borderRadius: '8px',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>1. Demande</div>
                        <div className="font-mono" style={{ fontWeight: 700, marginTop: '2px', whiteSpace: 'nowrap' }}>
                          {formatDateFR(intv.dateDemande)}
                        </div>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>2. Flux Devis</div>
                        <div className="font-mono" style={{ fontWeight: 700, color: '#7c3aed', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {d.linkedDevis ? d.linkedDevis.reference : 'Direct'}
                        </div>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>3. Planifiée</div>
                        <div className="font-mono" style={{ fontWeight: 700, marginTop: '2px', whiteSpace: 'nowrap' }}>
                          {formatDateFR(intv.datePlanifiee)}
                        </div>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>4. Échéance</div>
                        <div className="font-mono" style={{ fontWeight: 700, color: d.isDelayed ? '#dc2626' : 'inherit', marginTop: '2px', whiteSpace: 'nowrap' }}>
                          {formatDateFR(intv.echeance)}
                        </div>
                      </div>
                    </div>

                    {/* BARRE D'ACTIONS PIED DE CARTE : ZÉRO DÉBORDEMENT HORIZONTAL */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', minWidth: 0 }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{
                          flex: '1 1 auto',
                          minWidth: 0,
                          padding: '6px 9px',
                          fontSize: '11.5px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                        }}
                        onClick={() => setClientResponseModalDossier(d)}
                        title="Générer une réponse complète pour le client initial"
                      >
                        <ProMailIcon size={12} color="#ffffff" />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Réponse Client
                        </span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{
                          flexShrink: 0,
                          padding: '6px 8px',
                          fontSize: '11px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        onClick={onNavigateToPlanning}
                        title="Ouvrir le Planning Gantt pour replanifier"
                      >
                        <ProCalendarIcon size={12} />
                        <span>Replanifier</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{
                          flexShrink: 0,
                          padding: '6px 8px',
                          fontSize: '11px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        onClick={() => onOpenInterventionDrawer(intv)}
                        title="Ouvrir la fiche intervention complète (23 colonnes)"
                      >
                        <ProFileTextIcon size={12} />
                        <span>Fiche</span>
                      </button>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL D'ASSISTANCE RÉPONSE AU CLIENT INITIAL (B2B / B2C)
         ===================================================================== */}
      {clientResponseModalDossier && (
        <div
          className="cmd-palette-backdrop"
          onClick={() => setClientResponseModalDossier(null)}
        >
          <div
            className="cmd-palette-modal"
            style={{ width: 'min(640px, 95vw)', padding: '22px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '10px',
                    fontWeight: 800,
                    background: 'rgba(37, 99, 235, 0.12)',
                    color: '#2563eb',
                  }}
                >
                  ASSISTANT RELATION CLIENT ({clientResponseModalDossier.segment})
                </span>
                <h3 style={{ fontSize: '15px', fontWeight: 800, marginTop: '4px' }}>
                  Réponse prête pour {clientResponseModalDossier.intervention.client} ({clientResponseModalDossier.intervention.reference})
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setClientResponseModalDossier(null)}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                padding: '10px 12px',
                borderRadius: '10px',
                background: 'rgba(37, 99, 235, 0.07)',
                border: '1px solid rgba(37, 99, 235, 0.2)',
                marginBottom: '12px',
                fontSize: '12px',
              }}
            >
              <div>
                <strong>Synthèse interne pour l'agent :</strong> {clientResponseModalDossier.whyTitle}
              </div>
              {clientResponseModalDossier.isDelayed && (
                <div style={{ color: '#dc2626', marginTop: '3px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <ProClockIcon size={13} color="#dc2626" />
                  <span>Cause du retard ({clientResponseModalDossier.delayDays}j) : {clientResponseModalDossier.delayRootCause}</span>
                </div>
              )}
            </div>

            <textarea
              readOnly
              className="input"
              rows={10}
              style={{ width: '100%', padding: '12px', fontSize: '12.5px', lineHeight: 1.5 }}
              value={buildClientResponseText(clientResponseModalDossier)}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setClientResponseModalDossier(null)}
              >
                Fermer
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => {
                  navigator.clipboard.writeText(
                    buildClientResponseText(clientResponseModalDossier)
                  );
                  toast.success('Réponse client copiée dans le presse-papiers !');
                }}
              >
                <ProCopyIcon size={13} color="#ffffff" />
                <span>Copier la réponse pour le client</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
