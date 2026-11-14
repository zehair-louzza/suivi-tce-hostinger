import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Sheet,
  Send,
  ArrowRightLeft,
  CalendarCheck,
  Eye,
  LayoutList,
  Columns3,
  FileText,
  Euro,
  CheckCircle2,
  Search,
  Link2,
  History,
  User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Devis } from '../lib/api';
import { DevisClientPanel } from './DevisClientPanel';
import {
  Page,
  SubNav,
  Kpi,
  Btn,
  IconBtn,
  StatusPill,
  Pill,
  Segmented,
  Dropdown,
  SearchInput,
  DataTable,
  Drawer,
  Avatar,
  useIsMobile,
} from './ui';

export interface DevisStudioViewProps {
  devisList: Devis[];
  onOpenNewDevis?: () => void;
  /** false : pas de création de devis (profil sans droit de chiffrage) */
  canCreate?: boolean;
  onSelectDevis?: (devis: Devis) => void;
  onConvertDevis?: (devis: Devis) => void;
  onExportExcel?: () => void;
  techniciens?: string[];
  donneursOrdre?: string[];
  /** Devis à ouvrir dans le tiroir (clic sur une notification) */
  ouvrirDevisId?: number | null;
  onDevisOuvert?: () => void;
}

const STATUSES = ['À préparer', 'À valider en interne', 'Envoyé au client', 'Accepté', 'Expiré', 'Refusé', 'Annulé'];

/** Anciennes valeurs « Envoyé » / « Devis envoyé » : affichées comme « Envoyé au client ». */
const statutNormalise = (s?: string | null) => (s === 'Envoyé' || s === 'Devis envoyé' ? 'Envoyé au client' : s || 'À préparer');

function eur(val: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
}

function primaryAction(d: Devis) {
  const status = d.statutCommercial;
  if (status === 'Accepté' && !d.refInterventionTexte) {
    return { label: 'Convertir', icon: ArrowRightLeft, variant: 'primary' as const, kind: 'convert' };
  }
  if (status === 'Accepté' && d.refInterventionTexte) {
    return { label: d.refInterventionTexte, icon: Link2, variant: 'ghost' as const, kind: 'linked' };
  }
  if (status === 'Envoyé' || status === 'Envoyé au client' || status === 'En négociation') {
    return { label: 'Relancer', icon: Send, variant: 'secondary' as const, kind: 'relance' };
  }
  if (status === 'À préparer') {
    return { label: 'Compléter', icon: FileText, variant: 'secondary' as const, kind: 'open' };
  }
  return null;
}

export function DevisStudioView({
  devisList,
  onOpenNewDevis,
  canCreate,
  onSelectDevis,
  onConvertDevis,
  onExportExcel,
  ouvrirDevisId,
  onDevisOuvert,
}: DevisStudioViewProps) {
  const isMobile = useIsMobile();
  const [status, setStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [respFilter, setRespFilter] = useState('all');
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [selectedItem, setSelectedItem] = useState<Devis | null>(null);
  const [envoiOuvert, setEnvoiOuvert] = useState(false);

  useEffect(() => {
    if (!ouvrirDevisId) return;
    const d = devisList.find((x) => x.id === ouvrirDevisId);
    if (d) {
      setSelectedItem(d);
      onDevisOuvert?.();
    }
  }, [ouvrirDevisId, devisList]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    return devisList.filter((d) => {
      const matchStatus = status === 'all' || statutNormalise(d.statutCommercial) === status;
      const matchResp = respFilter === 'all' || d.responsable === respFilter;
      const text = `${d.reference || ''} ${d.numeroDI || ''} ${d.client || ''} ${d.objet || ''} ${d.site || ''} ${d.corpsEtat || ''}`.toLowerCase();
      const matchSearch = !searchQuery || text.includes(searchQuery.toLowerCase());
      return matchStatus && matchResp && matchSearch;
    });
  }, [devisList, status, respFilter, searchQuery]);

  const countByStatus = (s: string) => devisList.filter((d) => statutNormalise(d.statutCommercial) === s).length;
  const totalPortefeuille = devisList.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
  const signedDevis = devisList.filter((d) => d.statutCommercial === 'Accepté');
  const signedVolume = signedDevis.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
  const conversionRate = devisList.length > 0 ? Math.round((signedDevis.length / devisList.length) * 100) : 0;
  const visitesAPlanifier = devisList.filter((d) => d.visiteNecessaire && (!d.visiteDate || d.visiteStatut === 'A_PLANIFIER')).length;

  const handleAction = (d: Devis, pa: ReturnType<typeof primaryAction>) => {
    if (!pa) return;
    if (pa.kind === 'convert') {
      if (onConvertDevis) onConvertDevis(d);
      else toast.success(`Conversion du devis ${d.reference} en cours...`);
    } else {
      if (onSelectDevis) onSelectDevis(d);
      else setSelectedItem(d);
    }
  };

  const columns = [
    {
      key: 'reference',
      label: 'Référence',
      width: 150,
      render: (d: Devis) => (
        <div className="m-cell-ref">
          <span className="m-mono m-strong">{d.reference || `DEV-${d.id}`}</span>
          {d.numeroDI && (
            <span className="m-linked" title={`Dossier ${[d.client, d.numeroDI].filter(Boolean).join(' · ')}`}>
              DI {d.numeroDI}
            </span>
          )}
          {d.refInterventionTexte && (
            <span className="m-linked">
              <Link2 size={11} /> {d.refInterventionTexte}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'client',
      label: 'Client & site',
      render: (d: Devis) => (
        <div className="m-cell-2">
          <strong>{d.client}</strong>
          <span className="m-ellipsis">{d.site || 'Site principal'}</span>
        </div>
      ),
    },
    {
      key: 'objet',
      label: 'Corps d’état & objet',
      render: (d: Devis) => (
        <div className="m-cell-2">
          <strong>{d.corpsEtat || 'TCE'}</strong>
          <span className="m-ellipsis">{d.objet || 'Chantier TCE'}</span>
        </div>
      ),
    },
    {
      key: 'responsable',
      label: 'Responsable',
      width: 140,
      render: (d: Devis) => (
        <span className="m-cell-user">
          <Avatar name={d.responsable || '—'} size={22} />
          <span>{d.responsable || '—'}</span>
        </span>
      ),
    },
    {
      key: 'montant',
      label: 'Montant HT',
      align: 'right' as const,
      width: 120,
      render: (d: Devis) => <span className="m-mono m-strong">{eur(Number(d.amount) || 0)}</span>,
    },
    {
      key: 'status',
      label: 'Statut',
      width: 150,
      render: (d: Devis) => <StatusPill status={d.statutCommercial || 'À préparer'} />,
    },
    {
      key: 'visite',
      label: 'Visite technique',
      width: 130,
      render: (d: Devis) => (
        <span className={`m-small ${d.visiteNecessaire && !d.visiteDate ? 'm-warn-text m-strong' : 'm-muted'}`}>
          {d.visiteNecessaire ? (d.visiteDate ? `Planifiée ${d.visiteDate}` : 'À affecter') : 'Non requise'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      width: 150,
      align: 'right' as const,
      render: (d: Devis) => {
        const pa = primaryAction(d);
        return (
          <div className="m-row-actions" onClick={(e) => e.stopPropagation()}>
            {pa && (
              <Btn size="sm" variant={pa.variant} icon={pa.icon} onClick={() => handleAction(d, pa)}>
                {pa.label}
              </Btn>
            )}
            <IconBtn
              icon={Eye}
              label="Ouvrir la fiche"
              onClick={() => {
                if (onSelectDevis) onSelectDevis(d);
                else setSelectedItem(d);
              }}
            />
          </div>
        );
      },
    },
  ];

  return (
    <Page
      testid="screen-devis"
      title="Devis"
      subtitle="Pipeline chiffrages, visites techniques et conversion en interventions Tout Corps d'État."
      actions={
        <>
          {onExportExcel && (
            <Btn icon={Sheet} onClick={onExportExcel}>
              Exporter
            </Btn>
          )}
          {canCreate !== false && (
            <Btn variant="primary" icon={Plus} onClick={onOpenNewDevis}>
              Nouveau devis
            </Btn>
          )}
        </>
      }
      subnav={
        <SubNav
          value={status}
          onChange={setStatus}
          items={[
            { id: 'all', label: 'Tous les devis', count: devisList.length },
            ...STATUSES.map((s) => ({ id: s, label: s, count: countByStatus(s) })),
          ]}
        />
      }
    >
      {/* 4 KPIs compacts de pilotage commercial */}
      <div className="m-kpis m-kpis--4 m-kpis--compact">
        <Kpi
          label="Portefeuille actif"
          value={`${devisList.length} devis`}
          hint={`${countByStatus('À préparer')} à préparer`}
          icon={FileText}
          tone="blue"
        />
        <Kpi
          label="Volume chiffré HT"
          value={eur(totalPortefeuille)}
          hint="Potentiel commercial brut"
          icon={Euro}
          tone="indigo"
        />
        <Kpi
          label="Devis signés"
          value={eur(signedVolume)}
          delta={`${conversionRate} % transfo`}
          hint={`${signedDevis.length} acceptés`}
          icon={CheckCircle2}
          tone="green"
        />
        <Kpi
          label="Visites à planifier"
          value={String(visitesAPlanifier)}
          hint="Dont métrés terrain"
          icon={CalendarCheck}
          tone="amber"
        />
      </div>

      {/* Barre d'outils, filtres & bascule Tableau / Kanban */}
      <div className="m-toolbar">
        <SearchInput
          placeholder="Rechercher une référence, un client, un site, un objet..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Dropdown
          value={respFilter}
          onChange={setRespFilter}
          options={[
            { id: 'all', label: 'Tous les responsables' },
            ...Array.from(new Set(devisList.map((d) => d.responsable).filter(Boolean))).map(
              (r) => ({ id: r as string, label: r as string })
            ),
          ]}
        />
        {!isMobile && (
          <Segmented
            value={view}
            onChange={(v) => setView(v as 'table' | 'kanban')}
            options={[
              { id: 'table', label: 'Tableau', icon: LayoutList },
              { id: 'kanban', label: 'Kanban', icon: Columns3 },
            ]}
          />
        )}
      </div>

      {/* Vue Tableau ou Kanban */}
      {view === 'table' || isMobile ? (
        <div className="m-card m-card--table">
          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(d) => d.id || d.reference || String(Math.random())}
            onRowClick={(d) => {
              if (onSelectDevis) onSelectDevis(d);
              else setSelectedItem(d);
            }}
            empty={
              <span>
                <Search size={16} /> Aucun devis ne correspond à ces critères.
              </span>
            }
            mobileCard={(d) => (
              <>
                <div className="m-mcard-top">
                  <span className="m-mono m-strong">{d.reference || `DEV-${d.id}`}</span>
                  <StatusPill status={d.statutCommercial || 'À préparer'} />
                </div>
                <strong>{d.client}</strong>
                <span className="m-muted m-small">
                  {d.corpsEtat} · {d.objet}
                </span>
                <div className="m-mcard-foot">
                  <span className="m-mono m-strong">{eur(Number(d.amount) || 0)}</span>
                  <span className="m-small m-muted">Éch. {d.echeance || '—'}</span>
                </div>
              </>
            )}
          />
        </div>
      ) : (
        <div className="m-kanban">
          {STATUSES.map((s) => {
            const list = filtered.filter((d) => statutNormalise(d.statutCommercial) === s);
            const sumCol = list.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
            return (
              <div key={s} className="m-kcol">
                <header>
                  <StatusPill status={s} />
                  <em>{list.length}</em>
                  <span className="m-mono m-small m-muted">{eur(sumCol)}</span>
                </header>
                {list.map((d) => (
                  <button
                    key={d.id || d.reference || String(Math.random())}
                    type="button"
                    className="m-kcard"
                    onClick={() => {
                      if (onSelectDevis) onSelectDevis(d);
                      else setSelectedItem(d);
                    }}
                  >
                    <span className="m-mono m-small">
                      {d.reference || `DEV-${d.id}`}
                      {d.numeroDI ? ` · DI ${d.numeroDI}` : ''}
                    </span>
                    <strong>{d.client}</strong>
                    <span className="m-small m-muted m-ellipsis">{d.objet}</span>
                    <div className="m-kcard-foot">
                      <span className="m-mono m-strong">{eur(Number(d.amount) || 0)}</span>
                      <Avatar name={d.responsable || '—'} size={20} />
                    </div>
                  </button>
                ))}
                {!list.length && <div className="m-kempty">Aucun devis</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Tiroir d'inspection latérale Atlas Clarity */}
      {selectedItem && (
        <Drawer
          key={selectedItem.id}
          open={!!selectedItem}
          onClose={() => {
            setSelectedItem(null);
            setEnvoiOuvert(false);
          }}
          head={
            <div className="m-drawer-tags">
              <span className="m-mono m-strong">{selectedItem.reference || `DEV-${selectedItem.id}`}</span>
              <StatusPill status={selectedItem.statutCommercial || 'À préparer'} />
            </div>
          }
          title={selectedItem.client}
          subtitle={`${selectedItem.corpsEtat || 'TCE'} · ${selectedItem.objet}`}
          footer={
            <>
              {canCreate !== false && selectedItem.id && (
                <Btn icon={Send} onClick={() => setEnvoiOuvert(true)} data-testid="devis-footer-envoyer">
                  Envoyer au client
                </Btn>
              )}
              {selectedItem.statutCommercial === 'Accepté' && !selectedItem.refInterventionTexte && (
                <Btn
                  variant="primary"
                  icon={ArrowRightLeft}
                  onClick={() => {
                    if (onConvertDevis) onConvertDevis(selectedItem);
                    setSelectedItem(null);
                  }}
                >
                  Convertir en intervention
                </Btn>
              )}
            </>
          }
        >
          <div className="m-amounts">
            <div>
              <span>Montant HT</span>
              <strong className="m-mono">{eur(Number(selectedItem.amount) || 0)}</strong>
            </div>
            <div>
              <span>TVA (20 %)</span>
              <strong className="m-mono">{eur((Number(selectedItem.amount) || 0) * 0.2)}</strong>
            </div>
            <div>
              <span>Total TTC</span>
              <strong className="m-mono">{eur((Number(selectedItem.amount) || 0) * 1.2)}</strong>
            </div>
          </div>

          <dl className="m-dl">
            <div>
              <dt>Site</dt>
              <dd>{selectedItem.site || 'Site principal'}</dd>
            </div>
            <div>
              <dt>Responsable</dt>
              <dd>
                <User size={14} /> {selectedItem.responsable || '—'}
              </dd>
            </div>
            <div>
              <dt>Visite technique</dt>
              <dd>
                {selectedItem.visiteNecessaire
                  ? selectedItem.visiteDate
                    ? `Planifiée le ${selectedItem.visiteDate}`
                    : 'Visite à affecter'
                  : 'Non requise'}
              </dd>
            </div>
            <div>
              <dt>Échéance</dt>
              <dd>{selectedItem.echeance || 'À convenir'}</dd>
            </div>
            {selectedItem.refInterventionTexte && (
              <div>
                <dt>Intervention liée</dt>
                <dd>
                  <Pill tone="green">{selectedItem.refInterventionTexte}</Pill>
                </dd>
              </div>
            )}
          </dl>

          {selectedItem.id && (
            <DevisClientPanel
              devisId={selectedItem.id}
              statutCommercial={selectedItem.statutCommercial}
              canManage={canCreate !== false}
              envoiOuvert={envoiOuvert}
              onEnvoiOuvert={setEnvoiOuvert}
            />
          )}

          <h4 className="m-h4">
            <History size={15} /> Historique du dossier
          </h4>
          <ol className="m-timeline">
            <li>
              <time>{selectedItem.dateCreated || 'Récemment'}</time>
              <span>Devis initié par {selectedItem.responsable || '—'}</span>
            </li>
            {selectedItem.visiteDate && (
              <li>
                <time>{selectedItem.visiteDate}</time>
                <span>Visite technique enregistrée</span>
              </li>
            )}
            {selectedItem.statutCommercial === 'Accepté' && (
              <li className="is-ok">
                <time>Validé</time>
                <span>Bon pour accord reçu du donneur d'ordre</span>
              </li>
            )}
          </ol>
        </Drawer>
      )}
    </Page>
  );
}
