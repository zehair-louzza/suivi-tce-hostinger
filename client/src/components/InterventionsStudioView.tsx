import { useMemo, useState } from 'react';
import {
  Plus,
  Sheet,
  Mail,
  Eye,
  CheckCircle2,
  CalendarPlus,
  Image as ImageIcon,
  Camera,
  LayoutList,
  Columns3,
  Wrench,
  Clock,
  MapPin,
  FileCheck2,
  Users,
  AlertTriangle,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Intervention } from '../lib/api';
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
  Tabs,
  useIsMobile,
} from './ui';

export interface InterventionsStudioViewProps {
  interventionsList: Intervention[];
  onOpenNewIntv?: () => void;
  onSelectIntv?: (intv: Intervention) => void;
  onValidateIntv?: (intv: Intervention) => void;
  onSendReport?: (intv: Intervention) => void;
  onExportExcel?: () => void;
  techniciens?: string[];
}

const STATUSES = [
  'À planifier',
  'Planifiée',
  'En cours',
  'Non terminée',
  'Terminée — à valider',
  'Clôturée',
];

const SHORT_STATUS: Record<string, string> = {
  'Terminée — à valider': 'À valider',
  'A_PLANIFIER': 'À planifier',
  'PLANIFIEE': 'Planifiée',
  'EN_COURS': 'En cours',
  'TERMINEE_A_VALIDER': 'À valider',
  'CLOTUREE': 'Clôturée',
  'NON_TERMINEE': 'Non terminée',
};

function normalizeStatus(s?: string): string {
  if (!s) return 'Planifiée';
  if (s === 'A_PLANIFIER') return 'À planifier';
  if (s === 'PLANIFIEE') return 'Planifiée';
  if (s === 'EN_COURS') return 'En cours';
  if (s === 'TERMINEE_A_VALIDER' || s === 'Terminée — à valider') return 'Terminée — à valider';
  if (s === 'CLOTUREE') return 'Clôturée';
  if (s === 'NON_TERMINEE') return 'Non terminée';
  return s;
}

function eur(val: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
}

export function InterventionsStudioView({
  interventionsList,
  onOpenNewIntv,
  onSelectIntv,
  onValidateIntv,
  onSendReport,
  onExportExcel,
  techniciens = [],
}: InterventionsStudioViewProps) {
  const isMobile = useIsMobile();
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [techFilter, setTechFilter] = useState('all');
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [selectedItem, setSelectedItem] = useState<Intervention | null>(null);
  const [drawerTab, setDrawerTab] = useState<'resume' | 'photos' | 'historique'>('resume');

  const filtered = useMemo(() => {
    return interventionsList.filter((i) => {
      const norm = normalizeStatus(i.statutOperationnel);
      const matchStatus = statusFilter === 'all' || norm === statusFilter;
      const matchTech = techFilter === 'all' || i.entreprise === techFilter;
      const text = `${i.reference || ''} ${i.client || ''} ${i.objet || ''} ${i.chantier || ''} ${i.typeIntervention || ''} ${i.corpsEtat || ''}`.toLowerCase();
      const matchSearch = !searchQuery || text.includes(searchQuery.toLowerCase());
      return matchStatus && matchTech && matchSearch;
    });
  }, [interventionsList, statusFilter, techFilter, searchQuery]);

  const countByStatus = (s: string) => interventionsList.filter((i) => normalizeStatus(i.statutOperationnel) === s).length;
  const onSiteCount = countByStatus('En cours');
  const planifiedCount = countByStatus('Planifiée');
  const toValidateCount = countByStatus('Terminée — à valider');
  const toPlanCount = countByStatus('À planifier') + countByStatus('Non terminée');

  const actionFor = (i: Intervention) => {
    const norm = normalizeStatus(i.statutOperationnel);
    if (norm === 'Terminée — à valider') {
      return {
        label: 'Valider',
        icon: CheckCircle2,
        variant: 'primary' as const,
        run: () => {
          if (onValidateIntv) onValidateIntv(i);
          else toast.success(`Rapport ${i.reference} validé — prêt à facturer`);
        },
      };
    }
    if (norm === 'À planifier') {
      return {
        label: 'Planifier',
        icon: CalendarPlus,
        variant: 'secondary' as const,
        run: () => toast.success(`${i.reference} ajoutée à la bourse de dispatch`),
      };
    }
    if (norm === 'Non terminée') {
      return {
        label: 'Replanifier',
        icon: CalendarPlus,
        variant: 'secondary' as const,
        run: () => toast.success(`${i.reference} replanifiée`),
      };
    }
    return {
      label: 'Fiche',
      icon: Eye,
      variant: 'ghost' as const,
      run: () => {
        if (onSelectIntv) onSelectIntv(i);
        else setSelectedItem(i);
      },
    };
  };

  const columns = [
    {
      key: 'reference',
      label: 'Référence',
      width: 140,
      render: (i: Intervention) => {
        const isUrgent = i.priorite === 'URGENT' || i.typeIntervention?.toLowerCase().includes('urgence');
        return (
          <div className="m-cell-ref">
            <span className="m-mono m-strong">{i.reference || `INT-${i.id}`}</span>
            {isUrgent && (
              <span className="m-urgent">
                <AlertTriangle size={11} /> urgent
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'client',
      label: 'Client & chantier',
      render: (i: Intervention) => (
        <div className="m-cell-2">
          <strong>{i.client || 'Client'}</strong>
          <span className="m-ellipsis">{i.chantier || 'Chantier TCE'}</span>
        </div>
      ),
    },
    {
      key: 'objet',
      label: 'Corps d’état & objet',
      render: (i: Intervention) => (
        <div className="m-cell-2">
          <strong>{i.corpsEtat || i.typeIntervention || 'TCE'}</strong>
          <span className="m-ellipsis">{i.objet || 'Travaux TCE'}</span>
        </div>
      ),
    },
    {
      key: 'tech',
      label: 'Technicien',
      width: 140,
      render: (i: Intervention) => {
        const techName = i.entreprise;
        return techName ? (
          <span className="m-cell-user">
            <Avatar name={techName} size={22} />
            <span>{techName}</span>
          </span>
        ) : (
          <span className="m-warn-text m-small m-strong">À affecter</span>
        );
      },
    },
    {
      key: 'creneau',
      label: 'Créneau',
      width: 130,
      render: (i: Intervention) => (
        <div className="m-cell-2">
          <strong className="m-mono m-small">{i.datePlanifiee || 'À planifier'}</strong>
          <span className="m-mono">
            {i.heureDebut && i.heureFin ? `${i.heureDebut}–${i.heureFin}` : '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Statut',
      width: 150,
      render: (i: Intervention) => {
        const norm = normalizeStatus(i.statutOperationnel);
        return <StatusPill status={norm}>{SHORT_STATUS[norm] || norm}</StatusPill>;
      },
    },
    {
      key: 'rapport',
      label: 'Rapport & photos',
      width: 130,
      render: (i: Intervention) => {
        const photoCount = Array.isArray(i.photos) ? i.photos.length : 0;
        return (
          <span className="m-cell-photos">
            <Camera size={14} /> {photoCount} <em>{photoCount > 0 ? 'Photos jointes' : 'En attente'}</em>
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: '',
      width: 140,
      align: 'right' as const,
      render: (i: Intervention) => {
        const a = actionFor(i);
        return (
          <div className="m-row-actions" onClick={(e) => e.stopPropagation()}>
            <Btn size="sm" variant={a.variant} icon={a.icon} onClick={a.run}>
              {a.label}
            </Btn>
            <IconBtn
              icon={Eye}
              label="Ouvrir la fiche"
              onClick={() => {
                if (onSelectIntv) onSelectIntv(i);
                else setSelectedItem(i);
              }}
            />
          </div>
        );
      },
    },
  ];

  return (
    <Page
      testid="screen-interventions"
      title="Interventions"
      subtitle="Suivi opérationnel des chantiers Tout Corps d'État, comptes-rendus terrain et rapports officiels."
      actions={
        <>
          {onExportExcel && (
            <Btn icon={Sheet} onClick={onExportExcel}>
              Exporter
            </Btn>
          )}
          <Btn variant="primary" icon={Plus} onClick={onOpenNewIntv}>
            Nouvelle intervention
          </Btn>
        </>
      }
      subnav={
        <SubNav
          value={statusFilter}
          onChange={setStatusFilter}
          items={[
            { id: 'all', label: 'Toutes les interventions', count: interventionsList.length },
            ...STATUSES.map((s) => ({
              id: s,
              label: SHORT_STATUS[s] || s,
              count: countByStatus(s),
              alert: s === 'Terminée — à valider',
            })),
          ]}
        />
      }
    >
      {/* 4 KPIs compacts de pilotage terrain */}
      <div className="m-kpis m-kpis--4 m-kpis--compact">
        <Kpi
          label="Sur site maintenant"
          value={String(onSiteCount)}
          hint="En direct sur le terrain"
          icon={Wrench}
          tone="indigo"
        />
        <Kpi
          label="Planifiées"
          value={String(planifiedCount)}
          hint="Aujourd'hui & semaine"
          icon={Clock}
          tone="blue"
        />
        <Kpi
          label="Rapports à valider"
          value={String(toValidateCount)}
          hint="Avec photos terrain"
          icon={FileCheck2}
          tone="teal"
        />
        <Kpi
          label="À planifier"
          value={String(toPlanCount)}
          hint="Bourse de dispatch"
          icon={CalendarPlus}
          tone="amber"
        />
      </div>

      {/* Barre d'outils, filtres & bascule Tableau / Kanban */}
      <div className="m-toolbar">
        <SearchInput
          placeholder="Rechercher une référence, un client, un site, une adresse..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Dropdown
          icon={Users}
          value={techFilter}
          onChange={setTechFilter}
          options={[
            { id: 'all', label: 'Tous les techniciens' },
            ...techniciens.map((t) => ({ id: t, label: t })),
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
            rowKey={(i) => i.id || i.reference || String(Math.random())}
            onRowClick={(i) => {
              if (onSelectIntv) onSelectIntv(i);
              else setSelectedItem(i);
            }}
            rowClass={(i) => (i.priorite === 'URGENT' ? 'is-urgent' : '')}
            empty={
              <span>
                <Search size={16} /> Aucune intervention ne correspond à ces critères.
              </span>
            }
            mobileCard={(i) => {
              const norm = normalizeStatus(i.statutOperationnel);
              const techName = i.entreprise;
              return (
                <>
                  <div className="m-mcard-top">
                    <span className="m-mono m-strong">{i.reference || `INT-${i.id}`}</span>
                    <StatusPill status={norm}>{SHORT_STATUS[norm] || norm}</StatusPill>
                  </div>
                  <strong>{i.client}</strong>
                  <span className="m-muted m-small">
                    {i.corpsEtat || i.typeIntervention} · {i.objet}
                  </span>
                  <div className="m-mcard-foot">
                    {techName ? (
                      <span className="m-cell-user">
                        <Avatar name={techName} size={20} />
                        <span>{techName}</span>
                      </span>
                    ) : (
                      <span className="m-warn-text m-small">À affecter</span>
                    )}
                    <span className="m-mono m-small">{i.datePlanifiee || '—'}</span>
                  </div>
                </>
              );
            }}
          />
        </div>
      ) : (
        <div className="m-kanban m-kanban--6">
          {STATUSES.map((s) => {
            const list = filtered.filter((i) => normalizeStatus(i.statutOperationnel) === s);
            return (
              <div key={s} className="m-kcol">
                <header>
                  <StatusPill status={s}>{SHORT_STATUS[s] || s}</StatusPill>
                  <em>{list.length}</em>
                </header>
                {list.map((i) => {
                  const techName = i.entreprise;
                  return (
                    <button
                      key={i.id || i.reference || String(Math.random())}
                      type="button"
                      className="m-kcard"
                      onClick={() => {
                        if (onSelectIntv) onSelectIntv(i);
                        else setSelectedItem(i);
                      }}
                    >
                      <span className="m-mono m-small">{i.reference || `INT-${i.id}`}</span>
                      <strong>{i.client}</strong>
                      <span className="m-small m-muted m-ellipsis">{i.objet}</span>
                      <div className="m-kcard-foot">
                        <span className="m-mono m-small">{i.heureDebut || '—'}</span>
                        {techName ? (
                          <Avatar name={techName} size={20} />
                        ) : (
                          <Pill tone="amber">À affecter</Pill>
                        )}
                      </div>
                    </button>
                  );
                })}
                {!list.length && <div className="m-kempty">Aucune</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Tiroir d'intervention latérale Atlas Clarity */}
      {selectedItem && (
        <Drawer
          open={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          head={
            <div className="m-drawer-tags">
              <span className="m-mono m-strong">{selectedItem.reference || `INT-${selectedItem.id}`}</span>
              <StatusPill status={normalizeStatus(selectedItem.statutOperationnel)} />
            </div>
          }
          title={selectedItem.client}
          subtitle={`${selectedItem.corpsEtat || selectedItem.typeIntervention || 'TCE'} · ${selectedItem.objet}`}
          footer={
            <>
              <Btn
                icon={Mail}
                onClick={() => {
                  if (onSendReport) onSendReport(selectedItem);
                  else toast.success(`Rapport ${selectedItem.reference} prêt à l'envoi`);
                  setSelectedItem(null);
                }}
              >
                Envoyer le rapport
              </Btn>
              {normalizeStatus(selectedItem.statutOperationnel) === 'Terminée — à valider' && (
                <Btn
                  variant="primary"
                  icon={CheckCircle2}
                  onClick={() => {
                    if (onValidateIntv) onValidateIntv(selectedItem);
                    else toast.success(`Rapport ${selectedItem.reference} validé !`);
                    setSelectedItem(null);
                  }}
                >
                  Valider le rapport
                </Btn>
              )}
            </>
          }
        >
          <Tabs
            items={[
              { id: 'resume', label: 'Résumé' },
              {
                id: 'photos',
                label: 'Photos',
                count: Array.isArray(selectedItem.photos) ? selectedItem.photos.length : 0,
              },
              { id: 'historique', label: 'Historique' },
            ]}
            value={drawerTab}
            onChange={(t) => setDrawerTab(t as any)}
          />

          {drawerTab === 'resume' && (
            <>
              <div className="m-amounts">
                <div>
                  <span>Montant HT</span>
                  <strong className="m-mono">{eur(Number(selectedItem.amount) || 0)}</strong>
                </div>
                <div>
                  <span>Créneau</span>
                  <strong className="m-mono">
                    {selectedItem.heureDebut && selectedItem.heureFin
                      ? `${selectedItem.heureDebut}–${selectedItem.heureFin}`
                      : 'Non fixé'}
                  </strong>
                </div>
                <div>
                  <span>Rapport</span>
                  <strong>{selectedItem.compteRendu ? 'Transmis' : 'En attente'}</strong>
                </div>
              </div>

              <dl className="m-dl">
                <div>
                  <dt>Chantier</dt>
                  <dd>
                    <MapPin size={14} /> {selectedItem.chantier || 'Site principal'}
                  </dd>
                </div>
                <div>
                  <dt>Technicien</dt>
                  <dd>
                    {selectedItem.entreprise ? (
                      <>
                        <Avatar name={selectedItem.entreprise} size={20} />
                        <span>{selectedItem.entreprise}</span>
                      </>
                    ) : (
                      <Pill tone="amber">À affecter</Pill>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Date prévue</dt>
                  <dd>{selectedItem.datePlanifiee || 'À planifier'}</dd>
                </div>
                <div>
                  <dt>Statut facturation</dt>
                  <dd>{selectedItem.statutFacture || 'Non facturée'}</dd>
                </div>
              </dl>

              {selectedItem.compteRendu && (
                <div className="m-callout">
                  <strong>Compte-rendu d'intervention</strong>
                  <p>{selectedItem.compteRendu}</p>
                </div>
              )}
            </>
          )}

          {drawerTab === 'photos' && (
            <div className="m-photos">
              {Array.isArray(selectedItem.photos) && selectedItem.photos.length > 0 ? (
                selectedItem.photos.map((ph, idx) => (
                  <figure key={idx} className={`m-photo m-photo--${idx % 3}`}>
                    <ImageIcon size={22} />
                    <figcaption>{typeof ph === 'string' ? ph : `Photo chantier ${idx + 1}`}</figcaption>
                  </figure>
                ))
              ) : (
                <div className="m-empty m-empty--rich">
                  <span className="m-empty-icon">
                    <Camera size={22} />
                  </span>
                  <strong>Aucune photo transmise</strong>
                  <p>Le technicien téléverse les photos avant/après directement depuis l'application mobile.</p>
                </div>
              )}
            </div>
          )}

          {drawerTab === 'historique' && (
            <ol className="m-timeline">
              <li>
                <time>{selectedItem.dateDemande || 'Récemment'}</time>
                <span>Intervention enregistrée dans le système</span>
              </li>
              {selectedItem.datePlanifiee && (
                <li>
                  <time>{selectedItem.datePlanifiee}</time>
                  <span>Créneau planifié avec le donneur d'ordre</span>
                </li>
              )}
              {selectedItem.statutOperationnel === 'CLOTUREE' && (
                <li className="is-ok">
                  <time>Clôturée</time>
                  <span>Rapport validé et transmis au donneur d'ordre</span>
                </li>
              )}
            </ol>
          )}
        </Drawer>
      )}
    </Page>
  );
}
