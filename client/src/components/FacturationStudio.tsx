import { useState, useMemo } from 'react';
import {
  Devis,
  Intervention,
  formatCurrency,
  formatDateFR,
  computeDurationHours,
} from '../lib/api';
import { PhotoItem } from './PhotoLightbox';
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

export interface EnrichedBillingDossier {
  intervention: Intervention;
  linkedDevis: Devis | null;
  segment: ClientSegmentType;
  category: BillingEligibilityCategory;
  statusLabel: string;
  whyTitle: string;
  whyDetails: string[];
  blockingMissingItems: string[];
  suggestedAmountHT: number;
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
  const [searchQuery, setSearchQuery] = useState('');

  // Overrides manuels B2B / B2C par ID d'intervention
  const [segmentOverrides, setSegmentOverrides] = useState<Record<number, ClientSegmentType>>({});

  // Sélection multiple pour Facturation Groupée B2B (Bordereau Donneur d'ordre)
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Modal de réponse client en 1 clic (Retards & Demandes clients initiaux)
  const [clientResponseModalDossier, setClientResponseModalDossier] =
    useState<EnrichedBillingDossier | null>(null);

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Construction et diagnostic complet de tous les dossiers
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

      // Diagnostic d'éligibilité à la facturation (À traiter vs À vérifier vs Ne pas facturer + Pourquoi)
      const statutOp = intv.statutOperationnel || 'À planifier';
      const isAlreadyBilled = intv.statutFacture === 'Facturée';
      const isVisitePrealable =
        Boolean(intv.isVisiteDevis) || intv.typeIntervention === 'Visite technique devis';
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
          whyDetails.push(`Lié au devis initial ${linkedDevis.reference}.`);
        }
      } else if (statutOp === 'Annulée' || intv.traitement === 'Classé sans suite') {
        category = 'NE_PAS_FACTURER';
        statusLabel = 'Ne pas facturer (Annulée)';
        whyTitle = 'Intervention annulée / classée sans suite';
        whyDetails.push('Aucune facturation ne doit être émise sur une mission annulée.');
      } else if (isVisitePrealable && statutOp !== 'Clôturée') {
        category = 'NE_PAS_FACTURER';
        statusLabel = 'Ne pas facturer (Visite Devis)';
        whyTitle = 'Visite technique préalable au chiffrage';
        whyDetails.push(
          'Il s’agit d’un relevé technique pour établir un devis client : la facturation interviendra après acceptation du devis et réalisation des travaux.'
        );
      } else if (isFinishedOnSite) {
        // L'intervention est terminée sur le terrain : voyons si tout est prêt ou s'il faut vérifier un point
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
        // Intervention non terminée (À planifier, Planifiée, En cours, Suspendue)
        category = 'NE_PAS_FACTURER';
        statusLabel = `En attente (${statutOp})`;
        if (statutOp === 'Suspendue' || intv.traitement === 'Bloqué' || intv.motifBlocage) {
          whyTitle = `Chantier bloqué / suspendu : ${intv.motifBlocage || 'Motif à préciser'}`;
          whyDetails.push(
            'Ne pas facturer le solde tant que la levée de réserve ou la pièce attendue n’est pas posée.'
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
        category,
        statusLabel,
        whyTitle,
        whyDetails,
        blockingMissingItems,
        suggestedAmountHT,
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
  }, [interventionsList, devisList, segmentOverrides, todayISO]);

  // Compteurs KPI Facturation
  const stats = useMemo(() => {
    const aFacturer = enrichedDossiers.filter((d) => d.category === 'A_FACTURER');
    const aVerifier = enrichedDossiers.filter((d) => d.category === 'A_VERIFIER');
    const nePasFacturer = enrichedDossiers.filter((d) => d.category === 'NE_PAS_FACTURER');
    const facturees = enrichedDossiers.filter((d) => d.category === 'FACTUREE');
    const enRetardOuBloque = enrichedDossiers.filter(
      (d) => d.isDelayed || Boolean(d.intervention.motifBlocage)
    );

    const montantAFacturerHT = aFacturer.reduce((acc, d) => acc + d.suggestedAmountHT, 0);
    const montantAVerifierHT = aVerifier.reduce((acc, d) => acc + d.suggestedAmountHT, 0);
    const montantFactureHT = facturees.reduce(
      (acc, d) => acc + (Number(d.intervention.amount) || d.suggestedAmountHT),
      0
    );

    const b2bCount = enrichedDossiers.filter((d) => d.segment === 'B2B').length;
    const b2cCount = enrichedDossiers.filter((d) => d.segment === 'B2C').length;

    return {
      aFacturer,
      aVerifier,
      nePasFacturer,
      facturees,
      enRetardOuBloque,
      montantAFacturerHT,
      montantAVerifierHT,
      montantFactureHT,
      b2bCount,
      b2cCount,
    };
  }, [enrichedDossiers]);

  const filteredDossiers = useMemo(() => {
    return enrichedDossiers.filter((d) => {
      if (filterCategory !== 'ALL' && d.category !== filterCategory) return false;
      if (filterSegment !== 'ALL' && d.segment !== filterSegment) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${d.intervention.reference} ${d.intervention.client} ${d.intervention.chantier} ${d.intervention.objet} ${d.intervention.entreprise} ${d.intervention.numeroFacture || ''} ${d.linkedDevis?.reference || ''} ${d.whyTitle} ${d.delayRootCause}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [enrichedDossiers, filterCategory, filterSegment, searchQuery]);

  const handleToggleFacture = async (dossier: EnrichedBillingDossier) => {
    const isBilled = dossier.intervention.statutFacture === 'Facturée';
    const nextStatut = isBilled ? 'Non facturée' : 'Facturée';
    const nextNum = !isBilled
      ? dossier.intervention.numeroFacture ||
        `FAC-${new Date().getFullYear()}-${String(dossier.intervention.id).padStart(4, '0')}`
      : dossier.intervention.numeroFacture;

    await onUpdateIntervention(dossier.intervention.id, {
      statutFacture: nextStatut,
      numeroFacture: nextNum,
      amount: dossier.suggestedAmountHT,
      statutOperationnel: isBilled ? dossier.intervention.statutOperationnel : 'Clôturée',
    });
    toast.success(
      isBilled
        ? `Dossier ${dossier.intervention.reference} repassé en non facturé`
        : `Dossier ${dossier.intervention.reference} marqué comme facturé (${nextNum}) !`
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
    const devisStr = d.linkedDevis ? ` (Devis initial ${d.linkedDevis.reference})` : '';
    const greeting =
      d.segment === 'B2B'
        ? `Bonjour,\n\nSuite à votre demande concernant le dossier d'intervention ${ref}${devisStr} pour le site « ${d.intervention.chantier} » (${d.intervention.client}) :`
        : `Bonjour ${d.intervention.client || ''},\n\nNous faisons suite à votre demande concernant notre intervention ${ref}${devisStr} à l'adresse « ${d.intervention.chantier} » :`;

    let body = '';
    if (d.category === 'FACTUREE') {
      body = `\n• État d'avancement : Les travaux de ${d.intervention.corpsEtat || 'maintenance'} ont été intégralement réalisés et clôturés le ${formatDateFR(d.intervention.dateReelle || d.intervention.datePlanifiee)}.\n• Résultat technique : ${d.intervention.resultatTechnique || 'Conforme'}.\n• Facturation : La facture N° ${d.intervention.numeroFacture || 'enregistrée'} d'un montant de ${formatCurrency(d.suggestedAmountHT)} HT est disponible.`;
    } else if (d.category === 'A_FACTURER' || d.category === 'A_VERIFIER') {
      body = `\n• État d'avancement : Notre technicien (${d.intervention.entreprise || 'équipe ANELEC'}) a terminé l'intervention sur site (${d.intervention.heureDebutReelle ? `pointage réel ${d.intervention.heureDebutReelle}–${d.intervention.heureFinReelle || ''}` : `créneau ${d.intervention.heureDebut || '08:00'}–${d.intervention.heureFin || '12:00'}`}).\n• Travaux effectués : ${
        (d.intervention.actionsRealisees || []).join(', ') ||
        d.intervention.compteRendu ||
        d.intervention.objet ||
        'Intervention technique réalisée'
      }.\n• Facturation : Le dossier technique (${d.photosCount} photo(s) jointe(s)) est en cours de validation finale par notre service facturation.`;
    } else if (d.isDelayed || d.intervention.motifBlocage) {
      body = `\n• Point de situation sur le délai : ${d.delayRootCause}.\n• Action mise en place par ANELEC : ${d.delayActionableAdvice}\n• Priorité : ${d.intervention.priorite || 'Haute'}.`;
    } else {
      body = `\n• Planification : Votre intervention est programmée le ${formatDateFR(d.intervention.datePlanifiee)} sur le créneau ${d.intervention.heureDebut || '08:00'}–${d.intervention.heureFin || '12:00'} avec notre technicien référent ${d.intervention.entreprise || 'ANELEC'}.`;
    }

    const closing =
      d.segment === 'B2B'
        ? `\n\nNous restons à votre entière disposition pour vous transmettre le rapport d'attachement complet avec reportage photos.\n\nCordialement,\nLe Service Exploitation & Facturation — ANELEC GROUPE`
        : `\n\nNotre équipe reste à votre écoute pour toute question complémentaire.\n\nBien cordialement,\nService Client & Facturation — ANELEC GROUPE`;

    return `${greeting}\n${body}${closing}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* =====================================================================
          1. EXECUTIVE BILLING KPI STRIP (À TRAITER / À VÉRIFIER / NON ÉLIGIBLE / RETARDS / FACTURÉ)
         ===================================================================== */}
      <div className="kpi-strip">
        <div
          className="kpi-card"
          onClick={() => {
            setActiveTab('triage');
            setFilterCategory('A_FACTURER');
          }}
          style={{
            borderTop: '3px solid #10b981',
            background:
              filterCategory === 'A_FACTURER'
                ? 'linear-gradient(145deg, rgba(16, 185, 129, 0.14), rgba(255, 255, 255, 0.9))'
                : undefined,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#059669', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              🟢 À facturer (Prêtes)
            </span>
            <span className="font-mono" style={{ fontSize: '11px', fontWeight: 800, color: '#059669', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {formatCurrency(stats.montantAFacturerHT)} HT
            </span>
          </div>
          <div className="font-mono" style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {stats.aFacturer.length}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Terminées sur site • Rapport OK
          </div>
        </div>

        <div
          className="kpi-card"
          onClick={() => {
            setActiveTab('triage');
            setFilterCategory('A_VERIFIER');
          }}
          style={{
            borderTop: '3px solid #f59e0b',
            background:
              filterCategory === 'A_VERIFIER'
                ? 'linear-gradient(145deg, rgba(245, 158, 11, 0.14), rgba(255, 255, 255, 0.9))'
                : undefined,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#d97706', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              🟡 À vérifier (En attente)
            </span>
            <span className="font-mono" style={{ fontSize: '11px', fontWeight: 800, color: '#d97706', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {formatCurrency(stats.montantAVerifierHT)} HT
            </span>
          </div>
          <div className="font-mono" style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {stats.aVerifier.length}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Rapport à valider ou réserve
          </div>
        </div>

        <div
          className="kpi-card"
          onClick={() => {
            setActiveTab('triage');
            setFilterCategory('NE_PAS_FACTURER');
          }}
          style={{
            borderTop: '3px solid #64748b',
            background:
              filterCategory === 'NE_PAS_FACTURER'
                ? 'linear-gradient(145deg, rgba(100, 116, 139, 0.14), rgba(255, 255, 255, 0.9))'
                : undefined,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              🔴 Ne pas facturer
            </span>
            <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              En cours / Visites
            </span>
          </div>
          <div className="font-mono" style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {stats.nePasFacturer.length}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Non terminés, visites devis
          </div>
        </div>

        <div
          className="kpi-card"
          onClick={() => setActiveTab('retards_clients')}
          style={{
            borderTop: '3px solid #ef4444',
            background:
              activeTab === 'retards_clients'
                ? 'linear-gradient(145deg, rgba(239, 68, 68, 0.14), rgba(255, 255, 255, 0.9))'
                : undefined,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#dc2626', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              ⏱️ Retards & Réponses
            </span>
            <span className="font-mono" style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Diagnostic 1-Clic
            </span>
          </div>
          <div className="font-mono" style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {stats.enRetardOuBloque.length}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Causes retards & courrier prêt
          </div>
        </div>

        <div
          className="kpi-card"
          onClick={() => {
            setActiveTab('triage');
            setFilterCategory('FACTUREE');
          }}
          style={{
            borderTop: '3px solid #2563eb',
            background:
              filterCategory === 'FACTUREE'
                ? 'linear-gradient(145deg, rgba(37, 99, 235, 0.14), rgba(255, 255, 255, 0.9))'
                : undefined,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              ✅ Facturées (B2B/B2C)
            </span>
            <span className="font-mono" style={{ fontSize: '11px', fontWeight: 800, color: '#2563eb', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {formatCurrency(stats.montantFactureHT)} HT
            </span>
          </div>
          <div className="font-mono" style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {stats.facturees.length}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {stats.b2bCount} B2B • {stats.b2cCount} B2C
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. NAVIGATION DES ONGLETS DE L'AGENT DE FACTURATION
         ===================================================================== */}
      <div className="fsm-toolbar" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div className="segmented-control">
          <button
            type="button"
            className={`segmented-btn ${activeTab === 'triage' ? 'active' : ''}`}
            onClick={() => setActiveTab('triage')}
          >
            🎯 1. Tri Facturation : À traiter vs Non-Éligibles ({enrichedDossiers.length})
          </button>
          <button
            type="button"
            className={`segmented-btn ${activeTab === 'retards_clients' ? 'active' : ''}`}
            onClick={() => setActiveTab('retards_clients')}
          >
            ⏱️ 2. Pourquoi les Retards & Réponses Clients Initiaux ({stats.enRetardOuBloque.length})
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Filtre Segment B2B / B2C */}
          <div className="segmented-control">
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
              🏢 B2B Pro ({stats.b2bCount})
            </button>
            <button
              type="button"
              className={`segmented-btn ${filterSegment === 'B2C' ? 'active' : ''}`}
              onClick={() => setFilterSegment('B2C')}
            >
              🏠 B2C Particulier ({stats.b2cCount})
            </button>
          </div>

          <input
            type="text"
            className="input"
            style={{ width: '240px' }}
            placeholder="Rechercher client, réf, facture, motif..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* =====================================================================
          ONGLET 1 : TRI INTELLIGENT (CE QUI EST À TRAITER ET CE QUI NE L'EST PAS + POURQUOI)
         ===================================================================== */}
      {activeTab === 'triage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Sous-filtres par statut d'éligibilité + Bouton Facturation Groupée B2B */}
          <div
            className="glass-analytics-card"
            style={{
              padding: '12px 16px',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { id: 'ALL', label: `Tous les dossiers (${enrichedDossiers.length})` },
                { id: 'A_FACTURER', label: `🟢 À traiter maintenant (${stats.aFacturer.length})` },
                { id: 'A_VERIFIER', label: `🟡 À vérifier / Débloquer (${stats.aVerifier.length})` },
                { id: 'NE_PAS_FACTURER', label: `🔴 Ne pas facturer (${stats.nePasFacturer.length})` },
                { id: 'FACTUREE', label: `✅ Facturées (${stats.facturees.length})` },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`btn btn-sm ${filterCategory === f.id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFilterCategory(f.id as any)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {selectedIds.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="font-mono" style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb' }}>
                  {selectedIds.length} dossier(s) sélectionné(s)
                </span>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleBatchEmitB2BInvoices}
                >
                  🏢 Facturer en lot (Bordereau B2B)
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedIds([])}
                >
                  Désélectionner
                </button>
              </div>
            )}
          </div>

          <div className="pro-table-container">
            <table className="pro-table">
              <thead>
                <tr>
                  <th style={{ width: '34px', textAlign: 'center' }}>
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
                  <th style={{ width: '135px' }}>Réf & Devis</th>
                  <th style={{ minWidth: '160px', maxWidth: '220px' }}>Client & Marché</th>
                  <th style={{ minWidth: '220px', maxWidth: '300px' }}>Décision & Pourquoi ?</th>
                  <th style={{ width: '150px' }}>Terrain & Pointage</th>
                  <th style={{ width: '130px' }}>Chiffrage HT / TTC</th>
                  <th style={{ textAlign: 'right', width: '150px' }}>Actions Facturation</th>
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

                  const applicableTva = d.segment === 'B2C' ? 10 : 20;
                  const ttcAmount = d.suggestedAmountHT * (1 + applicableTva / 100);

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

                      <td>
                        <div
                          className="font-mono"
                          style={{ fontWeight: 800, color: '#2563eb', cursor: 'pointer' }}
                          onClick={() => onOpenInterventionDrawer(intv)}
                        >
                          {intv.reference || `INT-${intv.id}`}
                        </div>
                        {d.linkedDevis ? (
                          <div
                            onClick={() => onOpenDevisDrawer(d.linkedDevis!)}
                            style={{
                              fontSize: '11px',
                              color: '#7c3aed',
                              fontWeight: 700,
                              cursor: 'pointer',
                              marginTop: '2px',
                            }}
                            title="Ouvrir le devis initial lié"
                          >
                            🔗 Devis {d.linkedDevis.reference || `DEV-${d.linkedDevis.id}`} (
                            {formatCurrency(d.linkedDevis.amount)})
                          </div>
                        ) : (
                          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                            Demande directe ({intv.origine || 'Client'})
                          </div>
                        )}
                        {intv.numeroFacture && (
                          <div
                            className="font-mono"
                            style={{
                              marginTop: '3px',
                              fontSize: '10.5px',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: 'rgba(37, 99, 235, 0.12)',
                              color: '#1d4ed8',
                              display: 'inline-block',
                              fontWeight: 700,
                            }}
                          >
                            🧾 {intv.numeroFacture}
                          </div>
                        )}
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 800, fontSize: '13px' }}>
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
                              padding: '1px 7px',
                              borderRadius: '999px',
                              fontSize: '10px',
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
                            {d.segment === 'B2B' ? '🏢 B2B Pro' : '🏠 B2C Particulier'}
                          </button>
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          📍 {intv.chantier} • <strong>{intv.corpsEtat || 'TCE'}</strong>
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            maxWidth: '240px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {intv.objet}
                        </div>
                      </td>

                      {/* COLONNE CLÉ : CE QUI EST À TRAITER / NE PAS TRAITER ET POURQUOI */}
                      <td style={{ maxWidth: '330px' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '2px 9px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: 800,
                            background: badgeColors.bg,
                            color: badgeColors.text,
                            border: `1px solid ${badgeColors.border}`,
                            marginBottom: '4px',
                          }}
                        >
                          {d.statusLabel}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-primary)' }}>
                          Pourquoi : {d.whyTitle}
                        </div>
                        {d.whyDetails.map((detail, idx) => (
                          <div
                            key={idx}
                            style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}
                          >
                            • {detail}
                          </div>
                        ))}
                        {d.isDelayed && (
                          <div
                            onClick={() => setClientResponseModalDossier(d)}
                            style={{
                              marginTop: '4px',
                              padding: '3px 7px',
                              borderRadius: '6px',
                              background: 'rgba(239, 68, 68, 0.12)',
                              color: '#dc2626',
                              fontSize: '10.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-block',
                            }}
                          >
                            ⚠️ Retard ({d.delayDays}j) : {d.delayRootCause} → Répondre au client
                          </div>
                        )}
                      </td>

                      <td>
                        <div style={{ fontSize: '12px', fontWeight: 700 }}>
                          👷 {intv.entreprise || 'Non affecté'}
                        </div>
                        <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Planifié : {formatDateFR(intv.datePlanifiee)} ({d.plannedHours}h)
                        </div>
                        {intv.heureDebutReelle && (
                          <div className="font-mono" style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>
                            Pointé : {intv.heureDebutReelle}–{intv.heureFinReelle || '...'} (
                            {d.realHours ? `${d.realHours}h` : 'En cours'})
                          </div>
                        )}
                        {d.photosCount > 0 && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ marginTop: '4px', padding: '1px 7px', fontSize: '10.5px' }}
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
                            📷 Voir {d.photosCount} photo(s)
                          </button>
                        )}
                      </td>

                      <td>
                        <div className="font-mono" style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {formatCurrency(d.suggestedAmountHT)} HT
                        </div>
                        <div className="font-mono" style={{ fontSize: '11.5px', color: '#2563eb', fontWeight: 700 }}>
                          {formatCurrency(ttcAmount)} TTC (TVA {applicableTva}%)
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {d.amountSource}
                        </div>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '4px', flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className={`btn btn-sm ${d.category === 'FACTUREE' ? 'btn-secondary' : 'btn-primary'}`}
                            style={{ padding: '2px 7px', fontSize: '10.5px' }}
                            onClick={() => handleToggleFacture(d)}
                            title={d.category === 'FACTUREE' ? 'Dossier déjà facturé. Cliquez pour basculer.' : 'Marquer comme Facturée'}
                          >
                            {d.category === 'FACTUREE' ? '✓ Facturée' : 'Facturer'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 7px', fontSize: '10.5px' }}
                            onClick={() => setClientResponseModalDossier(d)}
                            title="Générer une réponse claire pour le client initial (avancement, retard ou facture)"
                          >
                            💬 Répondre
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 6px', fontSize: '10.5px' }}
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
        </div>
      )}

      {/* =====================================================================
          ONGLET 2 : DIAGNOSTIC DES RETARDS & RÉPONSES AUX CLIENTS INITIAUX
         ===================================================================== */}
      {activeTab === 'retards_clients' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="glass-analytics-card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  ⏱️ Pourquoi les interventions prennent du retard & Comment répondre aux clients initiaux (B2B / B2C)
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                  Cette vue croise automatiquement la date de demande initiale, le devis lié, le planning technicien et les blocages terrain pour donner à l'agent l'explication exacte à communiquer au client.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onNavigateToPlanning}
              >
                📅 Ouvrir le Planning Gantt pour replanifier →
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '14px' }}>
            {(stats.enRetardOuBloque.length > 0 ? stats.enRetardOuBloque : enrichedDossiers.slice(0, 8)).map(
              (d) => {
                const intv = d.intervention;
                return (
                  <div
                    key={intv.id}
                    className="glass-analytics-card"
                    style={{
                      borderLeft: d.isDelayed ? '4px solid #ef4444' : '4px solid #f59e0b',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span className="font-mono" style={{ fontWeight: 800, fontSize: '12.5px', color: '#2563eb' }}>
                            {intv.reference || `INT-${intv.id}`}
                          </span>
                          <span
                            style={{
                              padding: '1px 7px',
                              borderRadius: '999px',
                              fontSize: '10px',
                              fontWeight: 800,
                              background: d.segment === 'B2B' ? 'rgba(37, 99, 235, 0.12)' : 'rgba(14, 165, 233, 0.14)',
                              color: d.segment === 'B2B' ? '#1d4ed8' : '#0369a1',
                            }}
                          >
                            {d.segment === 'B2B' ? '🏢 Client B2B' : '🏠 Client B2C'}
                          </span>
                          {d.isDelayed && (
                            <span
                              className="font-mono"
                              style={{
                                padding: '1px 7px',
                                borderRadius: '999px',
                                fontSize: '10.5px',
                                fontWeight: 800,
                                background: 'rgba(239, 68, 68, 0.14)',
                                color: '#dc2626',
                              }}
                            >
                              Retard : +{d.delayDays} jour(s)
                            </span>
                          )}
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '13.5px', marginTop: '4px' }}>
                          {intv.client} — <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{intv.chantier}</span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          {intv.corpsEtat} • {intv.objet}
                        </div>
                      </div>
                      <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Tech: <strong>{intv.entreprise || 'Non affecté'}</strong>
                      </span>
                    </div>

                    {/* Boîte d'explication du POURQUOI */}
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: '12px',
                        background: 'rgba(239, 68, 68, 0.06)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase' }}>
                        🔍 Pourquoi ce retard / blocage :
                      </div>
                      <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                        {d.delayRootCause}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        💡 <strong>Action & Réponse conseillée :</strong> {d.delayActionableAdvice}
                      </div>
                    </div>

                    {/* Chronologie rapide Demande -> Devis -> Planif -> Terrain */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '6px',
                        fontSize: '10.5px',
                        background: 'var(--bg-elevated)',
                        padding: '8px 10px',
                        borderRadius: '10px',
                      }}
                    >
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>1. Demande</div>
                        <div className="font-mono" style={{ fontWeight: 700 }}>
                          {formatDateFR(intv.dateDemande)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>2. Devis lié</div>
                        <div className="font-mono" style={{ fontWeight: 700, color: '#7c3aed' }}>
                          {d.linkedDevis ? d.linkedDevis.reference : 'Direct'}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>3. Planifiée</div>
                        <div className="font-mono" style={{ fontWeight: 700 }}>
                          {formatDateFR(intv.datePlanifiee)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>4. Échéance</div>
                        <div className="font-mono" style={{ fontWeight: 700, color: d.isDelayed ? '#dc2626' : 'inherit' }}>
                          {formatDateFR(intv.echeance)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setClientResponseModalDossier(d)}
                      >
                        💬 Générer Réponse au Client Initial
                      </button>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={onNavigateToPlanning}
                        >
                          📅 Replanifier
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onOpenInterventionDrawer(intv)}
                        >
                          Fiche 23 col.
                        </button>
                      </div>
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
                <div style={{ color: '#dc2626', marginTop: '3px', fontWeight: 700 }}>
                  ⏱️ Cause du retard ({clientResponseModalDossier.delayDays}j) : {clientResponseModalDossier.delayRootCause}
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
                onClick={() => {
                  navigator.clipboard.writeText(
                    buildClientResponseText(clientResponseModalDossier)
                  );
                  toast.success('Réponse client copiée dans le presse-papiers !');
                }}
              >
                📋 Copier la réponse pour le client
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
