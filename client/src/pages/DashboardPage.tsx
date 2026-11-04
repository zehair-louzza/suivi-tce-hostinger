// Dashboard Page - Main view with Devis and Interventions panels
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  devisApi, 
  interventionApi,
  Devis, 
  formatCurrency,
  formatDateFR,
} from '../lib/api';
import toast from 'react-hot-toast';
import { Fragment } from 'react';

// Modal component
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">&times;</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// Status badge component
type StatutType = 'a-traiter' | 'en-cours' | 'en-attente' | 'bloque' | 'traite';

const STATUT_LABELS: Record<StatutType, string> = {
  'a-traiter': 'À traiter',
  'en-cours': 'En cours',
  'en-attente': 'En attente',
  'bloque': 'Bloqué',
  'traite': 'Traité / Clôturé',
};

const STATUT_CLASSES: Record<StatutType, string> = {
  'a-traiter': 'badge-a-traiter',
  'en-cours': 'badge-en-cours',
  'en-attente': 'badge-en-attente',
  'bloque': 'badge-bloque',
  'traite': 'badge-traite',
};

function StatusBadge({ status, size = 'md' }: { status: StatutType; size?: 'sm' | 'md' }) {
  const className = `badge badge-status ${STATUT_CLASSES[status]} ${size === 'sm' ? 'badge-sm' : ''}`;
  return <span className={className}>{STATUT_LABELS[status] || status}</span>;
}

// Origine badge
function OrigineBadge({ devisId, client, date }: { devisId: number; client: string | null; date: string | null }) {
  return (
    <span className="badge badge-origine" title={`Converti depuis le devis #${devisId}`}>
      🔗 Devis #{devisId} • {client} ({formatDateFR(date)})
    </span>
  );
}

// Convert confirmation modal
interface ConvertConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  devis: Devis;
  isLoading: boolean;
}

function ConvertConfirmModal({ isOpen, onClose, onConfirm, devis, isLoading }: ConvertConfirmProps) {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transformer en intervention"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={isLoading}>Annuler</button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Conversion...' : 'Confirmer la conversion'}
          </button>
        </>
      }
    >
      <div className="convert-confirm">
        <p>Voulez-vous transformer le devis <strong>{devis.client}</strong> en intervention ?</p>
        <ul>
          <li>Le devis sera <strong>déplacé</strong> vers les interventions</li>
          <li>Toutes les informations seront conservées</li>
          <li>Un badge de traçabilité <strong>🔗 Devis #{devis.id}</strong> sera ajouté</li>
        </ul>
        <p className="convert-warning">Cette action est irréversible.</p>
      </div>
    </Modal>
  );
}

// Devis Form Modal
interface DevisFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  devis?: Devis | null;
  isLoading: boolean;
}

function DevisFormModal({ isOpen, onClose, onSubmit, devis, isLoading }: DevisFormModalProps) {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={devis ? 'Modifier le devis' : 'Nouveau devis'}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={isLoading}>Annuler</button>
          <button className="btn btn-primary" onClick={() => (document.getElementById('devis-form') as HTMLFormElement | null)?.requestSubmit()} disabled={isLoading}>
            {isLoading ? 'Enregistrement...' : devis ? 'Enregistrer' : 'Créer'}
          </button>
        </>
      }
    >
      <form id="devis-form" onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }}>
        <div className="form-group">
          <label htmlFor="client" className="form-label">Client / Projet <span className="form-required">*</span></label>
          <input id="client" name="client" type="text" className="input" placeholder="Ex: Mairie de Lyon - Rénovation école" defaultValue={devis?.client || ''} required />
        </div>
        <div className="form-group">
          <label htmlFor="amount" className="form-label">Montant (€) <span className="form-required">*</span></label>
          <input id="amount" name="amount" type="number" className="input" placeholder="Ex: 45000" step="0.01" min="0" defaultValue={devis?.amount || ''} required />
        </div>
        <div className="form-group">
          <label htmlFor="dateCreated" className="form-label">Date création</label>
          <input id="dateCreated" name="dateCreated" type="date" className="input" defaultValue={devis?.dateCreated || ''} />
        </div>
        <div className="form-group">
          <label htmlFor="echeance" className="form-label">Échéance</label>
          <input id="echeance" name="echeance" type="date" className="input" defaultValue={devis?.echeance || ''} />
        </div>
        <div className="form-group">
          <label htmlFor="status" className="form-label">Statut <span className="form-required">*</span></label>
          <select id="status" name="status" className={`select select-${devis?.status || 'a-traiter'}`} defaultValue={devis?.status || 'a-traiter'} required>
            <option value="a-traiter">À traiter</option>
            <option value="en-cours">En cours</option>
            <option value="en-attente">En attente</option>
            <option value="bloque">Bloqué</option>
            <option value="traite">Traité</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="notes" className="form-label">Notes</label>
          <textarea id="notes" name="notes" className="textarea" rows={3} placeholder="Observations, remarques…" defaultValue={devis?.notes || ''} />
        </div>
      </form>
    </Modal>
  );
}

// Intervention Form Modal
interface InterventionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  intervention?: any | null;
  isLoading: boolean;
}

function InterventionFormModal({ isOpen, onClose, onSubmit, intervention, isLoading }: InterventionFormModalProps) {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={intervention ? 'Modifier l\'intervention' : 'Nouvelle intervention'}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={isLoading}>Annuler</button>
          <button className="btn btn-primary" onClick={() => (document.getElementById('intervention-form') as HTMLFormElement | null)?.requestSubmit()} disabled={isLoading}>
            {isLoading ? 'Enregistrement...' : intervention ? 'Enregistrer' : 'Créer'}
          </button>
        </>
      }
    >
      <form id="intervention-form" onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }}>
        <div className="form-group">
          <label htmlFor="chantier" className="form-label">Chantier / Lot <span className="form-required">*</span></label>
          <input id="chantier" name="chantier" type="text" className="input" placeholder="Ex: Lycée Victor Hugo - Lot 03 Maçonnerie" defaultValue={intervention?.chantier || ''} required />
        </div>
        <div className="form-group">
          <label htmlFor="entreprise" className="form-label">Entreprise</label>
          <input id="entreprise" name="entreprise" type="text" className="input" placeholder="Ex: SARL Dubois" defaultValue={intervention?.entreprise || ''} />
        </div>
        <div className="form-group">
          <label htmlFor="amount" className="form-label">Montant (€)</label>
          <input id="amount" name="amount" type="number" className="input" placeholder="Ex: 12000" step="0.01" min="0" defaultValue={intervention?.amount || ''} />
        </div>
        <div className="form-group">
          <label htmlFor="datePlanifiee" className="form-label">Date planifiée <span className="form-required">*</span></label>
          <input id="datePlanifiee" name="datePlanifiee" type="date" className="input" defaultValue={intervention?.datePlanifiee || ''} required />
        </div>
        <div className="form-group">
          <label htmlFor="dateReelle" className="form-label">Date réelle</label>
          <input id="dateReelle" name="dateReelle" type="date" className="input" defaultValue={intervention?.dateReelle || ''} />
        </div>
        <div className="form-group">
          <label htmlFor="status" className="form-label">Statut <span className="form-required">*</span></label>
          <select id="status" name="status" className={`select select-${intervention?.status || 'a-traiter'}`} defaultValue={intervention?.status || 'a-traiter'} required>
            <option value="a-traiter">À traiter</option>
            <option value="en-cours">En cours</option>
            <option value="en-attente">En attente</option>
            <option value="bloque">Bloqué</option>
            <option value="traite">Clôturé</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="notes" className="form-label">Notes</label>
          <textarea id="notes" name="notes" className="textarea" rows={3} placeholder="Observations…" defaultValue={intervention?.notes || ''} />
        </div>
      </form>
    </Modal>
  );
}

// Panel component for Devis
interface DevisPanelProps {
  devis: Devis[];
  stats: Record<string, number>;
  isLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onAdd: () => void;
  onEdit: (devis: Devis) => void;
  onDelete: (id: number) => void;
  onConvert: (devis: Devis) => void;
}

function DevisPanel({ devis, stats, isLoading, search, onSearchChange, onAdd, onEdit, onDelete, onConvert }: DevisPanelProps) {
  const filteredDevis = devis.filter(d => 
    d.client.toLowerCase().includes(search.toLowerCase()) ||
    (d.notes?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
    String(d.amount).includes(search) ||
    STATUT_LABELS[d.status as StatutType].toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="panel">
        <div className="panel-loading">Chargement des devis...</div>
      </div>
    );
  }

  return (
    <section className="panel" aria-labelledby="devis-title">
      <header className="panel-header">
        <h2 id="devis-title" className="panel-title">DEVIS</h2>
        <div className="panel-counters" role="group" aria-label="Compteurs de statuts devis">
          {(["a-traiter", "en-cours", "en-attente", "bloque", "traite"] as const).map(status => (
            <span key={status} className="counter" data-status={status}>
              <span className="counter-value">{stats[status] || 0}</span>
              {STATUT_LABELS[status as StatutType]}
            </span>
          ))}
        </div>
      </header>
      
      <div className="panel-toolbar">
        <button className="btn btn-primary" onClick={onAdd}>+ Ajouter un devis</button>
        <input
          type="text"
          className="search"
          placeholder="Filtrer les devis…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Filtrer les devis"
        />
      </div>
      
      <div className="table-wrapper">
        <table className="data-table" role="grid">
          <thead>
            <tr>
              <th scope="col">N°</th>
              <th scope="col">Client / Projet</th>
              <th scope="col">Montant</th>
              <th scope="col">Date création</th>
              <th scope="col">Échéance</th>
              <th scope="col">Statut</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevis.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M9 12h6" />
                      <path d="M12 9v6" />
                    </svg>
                    <p className="empty-state-text">
                      {devis.length === 0 ? 'Aucun devis. Cliquez sur « + Ajouter un devis » pour commencer.' : 'Aucun devis ne correspond au filtre.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredDevis.map((d, idx) => (
                <tr key={d.id}>
                  <td>{idx + 1}</td>
                  <td>
                    <strong>{d.client}</strong>
                    {d.notes && (
                      <Fragment>
                        <br />
                        <small style={{ color: 'var(--color-tertiary-text)' }}>{d.notes}</small>
                      </Fragment>
                    )}
                  </td>
                  <td>{formatCurrency(d.amount)}</td>
                  <td>{formatDateFR(d.dateCreated)}</td>
                  <td>{formatDateFR(d.echeance)}</td>
                  <td>
                    <StatusBadge status={d.status as StatutType} />
                  </td>
                  <td>
                    <div className="actions">
                      <button className="btn-icon convert" onClick={() => onConvert(d)} title="Transformer en intervention" aria-label="Transformer en intervention">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                      </button>
                      <button className="btn-icon" onClick={() => onEdit(d)} title="Modifier" aria-label="Modifier">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button className="btn-icon delete" onClick={() => onDelete(d.id)} title="Supprimer" aria-label="Supprimer">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Panel component for Interventions
interface InterventionPanelProps {
  interventions: any[];
  stats: Record<string, number>;
  isLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onAdd: () => void;
  onEdit: (intervention: any) => void;
  onDelete: (id: number) => void;
}

function InterventionPanel({ interventions, stats, isLoading, search, onSearchChange, onAdd, onEdit, onDelete }: InterventionPanelProps) {
  const filteredInterventions = interventions.filter(i =>
    i.chantier.toLowerCase().includes(search.toLowerCase()) ||
    (i.entreprise?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
    (i.notes?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
    STATUT_LABELS[i.status as StatutType].toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="panel">
        <div className="panel-loading">Chargement des interventions...</div>
      </div>
    );
  }

  return (
    <section className="panel" aria-labelledby="interventions-title">
      <header className="panel-header">
        <h2 id="interventions-title" className="panel-title">INTERVENTIONS</h2>
        <div className="panel-counters" role="group" aria-label="Compteurs de statuts interventions">
          {(["a-traiter", "en-cours", "en-attente", "bloque", "traite"] as const).map(status => (
            <span key={status} className="counter" data-status={status}>
              <span className="counter-value">{stats[status] || 0}</span>
              {STATUT_LABELS[status as StatutType]}
            </span>
          ))}
        </div>
      </header>
      
      <div className="panel-toolbar">
        <button className="btn btn-primary" onClick={onAdd}>+ Ajouter une intervention</button>
        <input
          type="text"
          className="search"
          placeholder="Filtrer les interventions…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Filtrer les interventions"
        />
      </div>
      
      <div className="table-wrapper">
        <table className="data-table" role="grid">
          <thead>
            <tr>
              <th scope="col">N°</th>
              <th scope="col">Chantier / Lot</th>
              <th scope="col">Entreprise</th>
              <th scope="col">Date planifiée</th>
              <th scope="col">Date réelle</th>
              <th scope="col">Statut</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInterventions.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M9 12h6" />
                      <path d="M12 9v6" />
                    </svg>
                    <p className="empty-state-text">
                      {interventions.length === 0 ? 'Aucune intervention. Cliquez sur « + Ajouter une intervention » pour commencer.' : 'Aucune intervention ne correspond au filtre.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredInterventions.map((i, idx) => (
                <tr key={i.id} className={i.origineDevisId ? 'converted' : ''}>
                  <td>{idx + 1}</td>
                  <td>
                    <strong>{i.chantier}</strong>
                    {i.origineDevisId && (
                      <Fragment>
                        <br />
                        <OrigineBadge devisId={i.origineDevisId} client={i.origineDevisClient} date={i.origineDevisDate} />
                      </Fragment>
                    )}
                    {i.notes && !i.origineDevisId && (
                      <Fragment>
                        <br />
                        <small style={{ color: 'var(--color-tertiary-text)' }}>{i.notes}</small>
                      </Fragment>
                    )}
                    {i.notes && i.origineDevisId && (
                      <Fragment>
                        <br />
                        <small style={{ color: 'var(--color-tertiary-text)' }}>{i.notes.split('--- Converti depuis')[0]}</small>
                      </Fragment>
                    )}
                  </td>
                  <td>{i.entreprise || '—'}</td>
                  <td>{formatDateFR(i.datePlanifiee)}</td>
                  <td>{formatDateFR(i.dateReelle)}</td>
                  <td>
                    <StatusBadge status={i.status as StatutType} />
                  </td>
                  <td>
                    <div className="actions">
                      <button className="btn-icon" onClick={() => onEdit(i)} title="Modifier" aria-label="Modifier">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button className="btn-icon delete" onClick={() => onDelete(i.id)} title="Supprimer" aria-label="Supprimer">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Main Dashboard Page
export function DashboardPage() {
  const queryClient = useQueryClient();
  const [devisSearch, setDevisSearch] = useState('');
  const [intervSearch, setIntervSearch] = useState('');
  
  // Modals state
  const [devisModal, setDevisModal] = useState<{ isOpen: boolean; devis?: Devis }>({ isOpen: false });
  const [intervModal, setIntervModal] = useState<{ isOpen: boolean; intervention?: any }>({ isOpen: false });
  const [convertModal, setConvertModal] = useState<{ isOpen: boolean; devis?: Devis }>({ isOpen: false });

  // Fetch data
  const { data: devisData, isLoading: devisLoading } = useQuery({
    queryKey: ['devis', 'list'],
    queryFn: () => devisApi.list({ limit: 100 }).then((r) => r.data),
    select: (data) => data.data,
  });

  const { data: devisStats, isLoading: statsLoading } = useQuery({
    queryKey: ['devis', 'stats'],
    queryFn: () => devisApi.stats().then((r) => r.data),
  });

  const { data: intervData, isLoading: intervLoading } = useQuery({
    queryKey: ['interventions', 'list'],
    queryFn: () => interventionApi.list({ limit: 100 }).then((r) => r.data),
    select: (data) => data.data,
  });

  const { data: intervStats } = useQuery({
    queryKey: ['interventions', 'stats'],
    queryFn: () => interventionApi.stats().then((r) => r.data),
  });

  // Mutations
  const createDevisMutation = useMutation({
    mutationFn: (data: FormData) => devisApi.create(Object.fromEntries(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      toast.success('Devis créé avec succès');
      setDevisModal({ isOpen: false });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur lors de la création'),
  });

  const updateDevisMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) => devisApi.update(id, Object.fromEntries(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      toast.success('Devis mis à jour');
      setDevisModal({ isOpen: false });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur lors de la mise à jour'),
  });

  const deleteDevisMutation = useMutation({
    mutationFn: (id: number) => devisApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      toast.success('Devis supprimé');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur lors de la suppression'),
  });

  const convertDevisMutation = useMutation({
    mutationFn: (id: number) => devisApi.convert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      toast.success('Devis converti en intervention !');
      setConvertModal({ isOpen: false });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur lors de la conversion'),
  });

  const createIntervMutation = useMutation({
    mutationFn: (data: FormData) => interventionApi.create(Object.fromEntries(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      toast.success('Intervention créée avec succès');
      setIntervModal({ isOpen: false });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur lors de la création'),
  });

  const updateIntervMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) => interventionApi.update(id, Object.fromEntries(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      toast.success('Intervention mise à jour');
      setIntervModal({ isOpen: false });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur lors de la mise à jour'),
  });

  const deleteIntervMutation = useMutation({
    mutationFn: (id: number) => interventionApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      toast.success('Intervention supprimée');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur lors de la suppression'),
  });

  // Handlers
  const handleAddDevis = () => setDevisModal({ isOpen: true, devis: undefined });
  const handleEditDevis = (d: Devis) => setDevisModal({ isOpen: true, devis: d });
  const handleDeleteDevis = (id: number) => {
    if (confirm('Supprimer ce devis ? Cette action est irréversible.')) {
      deleteDevisMutation.mutate(id);
    }
  };
  const handleConvertDevis = (d: Devis) => setConvertModal({ isOpen: true, devis: d });

  const handleDevisSubmit = async (formData: FormData) => {
    if (devisModal.devis) {
      await updateDevisMutation.mutateAsync({ id: devisModal.devis.id, data: formData });
    } else {
      await createDevisMutation.mutateAsync(formData);
    }
  };

  const handleAddInterv = () => setIntervModal({ isOpen: true, intervention: undefined });
  const handleEditInterv = (i: any) => setIntervModal({ isOpen: true, intervention: i });
  const handleDeleteInterv = (id: number) => {
    if (confirm('Supprimer cette intervention ? Cette action est irréversible.')) {
      deleteIntervMutation.mutate(id);
    }
  };

  const handleIntervSubmit = async (formData: FormData) => {
    if (intervModal.intervention) {
      await updateIntervMutation.mutateAsync({ id: intervModal.intervention.id, data: formData });
    } else {
      await createIntervMutation.mutateAsync(formData);
    }
  };

  const handleConfirmConvert = () => {
    if (convertModal.devis) {
      convertDevisMutation.mutate(convertModal.devis.id);
    }
  };

  return (
    <div className="dashboard">
      {/* Legend */}
      <aside className="legend" aria-label="Légende des badges">
        <h3 className="legend-title">LÉGENDE DES BADGES</h3>
        <div className="legend-grid">
          <div className="legend-item"><StatusBadge status="a-traiter" /></div>
          <div className="legend-item"><StatusBadge status="en-cours" /></div>
          <div className="legend-item"><StatusBadge status="en-attente" /></div>
          <div className="legend-item"><StatusBadge status="bloque" /></div>
          <div className="legend-item"><StatusBadge status="traite" /></div>
          <div className="legend-item"><span className="badge badge-origine">Converti depuis devis</span></div>
        </div>
      </aside>

      {/* Main grid */}
      <div className="dashboard-grid">
        <DevisPanel
          devis={devisData || []}
          stats={devisStats || { 'a-traiter': 0, 'en-cours': 0, 'en-attente': 0, 'bloque': 0, 'traite': 0 }}
          isLoading={devisLoading || statsLoading}
          search={devisSearch}
          onSearchChange={setDevisSearch}
          onAdd={handleAddDevis}
          onEdit={handleEditDevis}
          onDelete={handleDeleteDevis}
          onConvert={handleConvertDevis}
        />
        
        <InterventionPanel
          interventions={intervData || []}
          stats={intervStats || { 'a-traiter': 0, 'en-cours': 0, 'en-attente': 0, 'bloque': 0, 'traite': 0 }}
          isLoading={intervLoading}
          search={intervSearch}
          onSearchChange={setIntervSearch}
          onAdd={handleAddInterv}
          onEdit={handleEditInterv}
          onDelete={handleDeleteInterv}
        />
      </div>

      {/* Modals */}
      <DevisFormModal
        isOpen={devisModal.isOpen}
        onClose={() => setDevisModal({ isOpen: false })}
        onSubmit={handleDevisSubmit}
        devis={devisModal.devis}
        isLoading={createDevisMutation.isPending || updateDevisMutation.isPending}
      />

      <InterventionFormModal
        isOpen={intervModal.isOpen}
        onClose={() => setIntervModal({ isOpen: false })}
        onSubmit={handleIntervSubmit}
        intervention={intervModal.intervention}
        isLoading={createIntervMutation.isPending || updateIntervMutation.isPending}
      />

      <ConvertConfirmModal
        isOpen={convertModal.isOpen}
        onClose={() => setConvertModal({ isOpen: false })}
        onConfirm={handleConfirmConvert}
        devis={convertModal.devis!}
        isLoading={convertDevisMutation.isPending}
      />
    </div>
  );
}
