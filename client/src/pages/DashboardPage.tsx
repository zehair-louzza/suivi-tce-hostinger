import { Fragment, useState, FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { devisApi, interventionApi, Devis, Intervention, formatCurrency, formatDateFR } from '../lib/api';
import toast from 'react-hot-toast';

type View = 'overview' | 'devis' | 'interventions';
type Kind = 'devis' | 'interventions';
type Item = Devis | Intervention;
type Status = Devis['status'];
const statuses: Status[] = ['a-traiter', 'en-cours', 'en-attente', 'bloque', 'traite'];
const labels: Record<Status, string> = { 'a-traiter': 'À traiter', 'en-cours': 'En cours', 'en-attente': 'En attente', bloque: 'Bloqué', traite: 'Traité / Clôturé' };
const publicStatus = (status: string) => status.toLowerCase().replace(/_/g, '-') as Status;
function Badge({ status }: { status: Status }) {
  return <span className={`badge badge-status badge-${status}`}>{labels[status] || status}</span>;
}
function errorMessage(error: any): string {
  const body = error?.response?.data;
  if (Array.isArray(body?.details)) return body.details.map((detail: any) => `${detail.field} : ${detail.message}`).join(' ; ');
  return typeof body?.error === 'string' ? body.error : error?.message || 'Erreur lors de la demande';
}

interface PanelProps {
  kind: Kind;
  items: Item[];
  stats: Record<string, number>;
  loading: boolean;
  failed: boolean;
  statsFailed: boolean;
  retry: () => void;
  busy: boolean;
  onAdd: () => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
  onConvert: (item: Devis) => void;
}
function BusinessPanel({ kind, items, stats, loading, failed, statsFailed, retry, busy, onAdd, onEdit, onDelete, onConvert }: PanelProps) {
  const [search, setSearch] = useState('');
  const isDevis = kind === 'devis';
  const title = isDevis ? 'DEVIS' : 'INTERVENTIONS';
  const filtered = items.filter(item => {
    const value = item as any;
    return [value.client, value.chantier, value.entreprise, value.notes, value.amount, labels[publicStatus(value.status)]].some(part => String(part ?? '').toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')));
  });
  const columns = isDevis ? ['N°', 'Client / Projet', 'Montant', 'Date création', 'Échéance', 'Statut', 'Actions'] : ['N°', 'Chantier / Lot', 'Entreprise', 'Date planifiée', 'Date réelle', 'Statut', 'Actions'];
  return (
    <section className="panel" aria-labelledby={`${kind}-title`}>
      <header className="panel-header"><h2 className="panel-title" id={`${kind}-title`}>{title}</h2><div className="panel-counters" aria-label={`Compteurs ${kind}`}>
        {statsFailed ? <span role="status">Statistiques indisponibles</span> : statuses.map(status => <span className="counter" key={status}><span className="counter-value">{stats[status] || 0}</span>{labels[status]}</span>)}
      </div></header>
      <div className="panel-toolbar"><button className="btn btn-primary" onClick={onAdd} disabled={busy}>+ Ajouter {isDevis ? 'un devis' : 'une intervention'}</button><input id={`${kind}-search`} name={`${kind}-search`} className="search" type="search" placeholder={`Filtrer les ${kind}…`} aria-label={`Filtrer les ${kind}`} value={search} onChange={event => setSearch(event.target.value)} /></div>
      {loading ? <div className="panel-loading" role="status">Chargement...</div> : failed ? <div className="empty-state" role="alert"><p>Impossible de charger les {kind}.</p><button className="btn btn-ghost" onClick={retry}>Réessayer</button></div> : <div className="table-wrapper"><table className="data-table"><thead><tr>{columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead><tbody>
        {filtered.length === 0 ? <tr><td colSpan={7}><div className="empty-state"><p>{items.length ? 'Aucun résultat ne correspond au filtre.' : `Aucun élément dans les ${kind}.`}</p></div></td></tr> : filtered.map(item => {
          const value = item as any;
          return <tr key={item.id} className={!isDevis && value.origineDevisId ? 'converted' : ''}>
            <td>{item.id}</td>
            <td><strong>{isDevis ? value.client : value.chantier}</strong>{!isDevis && value.origineDevisId && <Fragment><br /><span className="badge badge-origine">🔗 Devis #{value.origineDevisId} • {value.origineDevisClient} ({formatDateFR(value.origineDevisDate)})</span></Fragment>}{value.notes && <Fragment><br /><small className="text-tertiary">{value.notes}</small></Fragment>}</td>
            <td>{isDevis ? formatCurrency(value.amount) : value.entreprise || '—'}</td>
            <td>{formatDateFR(isDevis ? value.dateCreated : value.datePlanifiee)}</td>
            <td>{formatDateFR(isDevis ? value.echeance : value.dateReelle)}</td>
            <td><Badge status={publicStatus(value.status)} /></td>
            <td><div className="actions">{isDevis && <button type="button" className="btn-icon convert" disabled={busy} onClick={() => onConvert(item as Devis)} aria-label="Transformer en intervention" title="Transformer en intervention">↗</button>}<button type="button" className="btn-icon" disabled={busy} onClick={() => onEdit(item)} aria-label="Modifier" title="Modifier">✎</button><button type="button" className="btn-icon delete" disabled={busy} onClick={() => onDelete(item)} aria-label="Supprimer" title="Supprimer">×</button></div></td>
          </tr>;
        })}
      </tbody></table></div>}
      {items.length >= 100 && <p className="text-tertiary" style={{ padding: 16 }}>Affichage limité aux 100 éléments les plus récents.</p>}
    </section>
  );
}

interface EditorState { kind: Kind; item?: Item }
function Editor({ state, busy, submit, close }: { state: EditorState; busy: boolean; submit: (data: Record<string, unknown>) => Promise<void>; close: () => void }) {
  const isDevis = state.kind === 'devis';
  const value = (state.item || {}) as any;
  const prefix = isDevis ? 'devis' : 'intervention';
  const [error, setError] = useState('');
  const fields = isDevis ? [
    { name: 'client', label: 'Client / Projet', type: 'text', required: true },
    { name: 'amount', label: 'Montant (€)', type: 'number', required: true },
    { name: 'dateCreated', label: 'Date création', type: 'date', required: true },
    { name: 'echeance', label: 'Échéance', type: 'date', required: false },
  ] : [
    { name: 'chantier', label: 'Chantier / Lot', type: 'text', required: true },
    { name: 'entreprise', label: 'Entreprise', type: 'text', required: false },
    { name: 'amount', label: 'Montant (€)', type: 'number', required: false },
    { name: 'datePlanifiee', label: 'Date planifiée', type: 'date', required: true },
    { name: 'dateReelle', label: 'Date réelle', type: 'date', required: false },
  ];
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const data: Record<string, unknown> = Object.fromEntries(new FormData(event.currentTarget));
    data.amount = Number(String(data.amount || '0').replace(',', '.'));
    if (!Number.isFinite(data.amount) || Number(data.amount) < 0) { setError('Montant invalide'); return; }
    data.status = String(data.status).toUpperCase().replace(/-/g, '_');
    for (const name of ['echeance', 'dateReelle']) if (data[name] === '') data[name] = null;
    try { await submit(data); } catch (failure) { setError(errorMessage(failure)); }
  };
  return <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="editor-title" onClick={() => { if (!busy) close(); }}><div className="modal" onClick={event => event.stopPropagation()}>
    <header className="modal-header"><h2 className="modal-title" id="editor-title">{state.item ? 'Modifier' : 'Créer'} {isDevis ? 'un devis' : 'une intervention'}</h2><button type="button" className="modal-close" disabled={busy} onClick={close} aria-label="Fermer">×</button></header>
    <div className="modal-body"><form id="business-form" onSubmit={handleSubmit}>
      {fields.map(field => <div className="form-group" key={field.name}><label className="form-label" htmlFor={`${prefix}-${field.name}`}>{field.label}{field.required ? ' *' : ''}</label><input className="input" id={`${prefix}-${field.name}`} name={field.name} type={field.type} required={field.required} disabled={busy} min={field.type === 'number' ? 0 : undefined} step={field.type === 'number' ? '0.01' : undefined} maxLength={field.type === 'text' ? 200 : undefined} defaultValue={value[field.name] ?? ''} /></div>)}
      <div className="form-group"><label className="form-label" htmlFor={`${prefix}-status`}>Statut *</label><select className="select" id={`${prefix}-status`} name="status" defaultValue={publicStatus(value.status || 'a-traiter')} disabled={busy} required>{statuses.map(status => <option key={status} value={status}>{labels[status]}</option>)}</select></div>
      <div className="form-group"><label className="form-label" htmlFor={`${prefix}-notes`}>Notes</label><textarea className="textarea" id={`${prefix}-notes`} name="notes" maxLength={2000} rows={3} defaultValue={value.notes || ''} disabled={busy} /></div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form></div>
    <footer className="modal-footer"><button type="button" className="btn btn-ghost" disabled={busy} onClick={close}>Annuler</button><button type="submit" form="business-form" className="btn btn-primary" disabled={busy}>{busy ? 'Enregistrement...' : 'Enregistrer'}</button></footer>
  </div></div>;
}

type Action = { kind: Kind; operation: 'create' | 'update' | 'delete' | 'convert'; id?: number; data?: any };
export function DashboardPage({ view = 'overview' }: { view?: View }) {
  const showDevis = view !== 'interventions';
  const showInterventions = view !== 'devis';
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const devis = useQuery({ queryKey: ['devis', 'list'], enabled: showDevis, queryFn: () => devisApi.list({ limit: 100 }).then(response => response.data.data) });
  const devisStats = useQuery({ queryKey: ['devis', 'stats'], enabled: showDevis, queryFn: () => devisApi.stats().then(response => response.data) });
  const interventions = useQuery({ queryKey: ['interventions', 'list'], enabled: showInterventions, queryFn: () => interventionApi.list({ limit: 100 }).then(response => response.data.data) });
  const interventionStats = useQuery({ queryKey: ['interventions', 'stats'], enabled: showInterventions, queryFn: () => interventionApi.stats().then(response => response.data) });
  const mutation = useMutation({
    mutationFn: async (action: Action) => {
      if (action.operation === 'convert') return devisApi.convert(action.id!, {});
      const service = action.kind === 'devis' ? devisApi : interventionApi;
      if (action.operation === 'create') return service.create(action.data);
      if (action.operation === 'update') return service.update(action.id!, action.data);
      return service.delete(action.id!);
    },
    onSuccess: (_response, action) => {
      queryClient.invalidateQueries({ queryKey: [action.kind] });
      if (action.operation === 'convert') queryClient.invalidateQueries({ queryKey: ['interventions'] });
      if (action.operation === 'create' || action.operation === 'update') setEditor(null);
      toast.success(action.operation === 'convert' ? 'Devis converti en intervention' : action.operation === 'delete' ? 'Suppression effectuée' : 'Enregistrement effectué');
    },
    onError: failure => toast.error(errorMessage(failure)),
  });
  const remove = (kind: Kind, item: Item) => {
    if (window.confirm('Supprimer cet élément ? Cette action est irréversible.')) mutation.mutate({ kind, operation: 'delete', id: item.id });
  };
  const convert = (item: Devis) => {
    if (window.confirm(`Transformer le devis « ${item.client} » en intervention ? Le devis sera déplacé et supprimé de la liste des devis. Cette action est irréversible.`)) mutation.mutate({ kind: 'devis', operation: 'convert', id: item.id });
  };
  const save = async (data: Record<string, unknown>) => {
    if (!editor) return;
    await mutation.mutateAsync({ kind: editor.kind, operation: editor.item ? 'update' : 'create', id: editor.item?.id, data });
  };
  return <div className="dashboard">
    <aside className="legend" aria-label="Légende des badges"><h2 className="legend-title">Légende des badges</h2><div className="legend-grid">{statuses.map(status => <Badge key={status} status={status} />)}<span className="badge badge-origine">Converti depuis devis</span></div></aside>
    {showDevis && <BusinessPanel key="devis" kind="devis" items={devis.data || []} stats={devisStats.data || {}} loading={devis.isLoading} failed={devis.isError} statsFailed={devisStats.isError} retry={() => { void devis.refetch(); void devisStats.refetch(); }} busy={mutation.isPending} onAdd={() => setEditor({ kind: 'devis' })} onEdit={item => setEditor({ kind: 'devis', item })} onDelete={item => remove('devis', item)} onConvert={convert} />}
    {showInterventions && <BusinessPanel key="interventions" kind="interventions" items={interventions.data || []} stats={interventionStats.data || {}} loading={interventions.isLoading} failed={interventions.isError} statsFailed={interventionStats.isError} retry={() => { void interventions.refetch(); void interventionStats.refetch(); }} busy={mutation.isPending} onAdd={() => setEditor({ kind: 'interventions' })} onEdit={item => setEditor({ kind: 'interventions', item })} onDelete={item => remove('interventions', item)} onConvert={convert} />}
    {editor && <Editor key={`${editor.kind}-${editor.item?.id ?? 'new'}`} state={editor} busy={mutation.isPending} submit={save} close={() => setEditor(null)} />}
  </div>;
}
