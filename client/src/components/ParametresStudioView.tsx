import { useState, useMemo } from 'react';
import {
  Users,
  Wrench,
  BanknoteArrowUp,
  FileText,
  Plus,
  Check,
  Edit3,
} from 'lucide-react';
import {
  Page,
  Tabs,
  Card,
  Btn,
  Avatar,
  SearchInput,
  DataTable,
} from './ui';
import toast from 'react-hot-toast';

interface ParametresStudioViewProps {
  /** Références réelles, pour afficher la dernière émise au lieu d'un exemple */
  referencesDevis?: string[];
  referencesInterventions?: string[];
  techniciens: string[];
  corpsEtatList: string[];
  technicienCompetences: Record<string, string[]>;
  onUpdateCompetences?: (nextMap: Record<string, string[]>) => Promise<any>;
  onAddCorpsEtat?: (val: string) => Promise<any>;
  onUpdateCorpsEtat?: (nextList: string[]) => Promise<any>;
  baremes?: { corps: string; ht: number; min: number; deplacement: number }[];
  onUpdateBaremes?: (nextList: { corps: string; ht: number; min: number; deplacement: number }[]) => Promise<any>;
  onGoAdminUsers?: () => void;
}

const DEFAULT_BAREMES = [
  { corps: 'Électricité', ht: 55, min: 1, deplacement: 35 },
  { corps: 'Plomberie', ht: 58, min: 1, deplacement: 35 },
  { corps: 'CVC / Climatisation', ht: 62, min: 1.5, deplacement: 40 },
  { corps: 'Chauffage', ht: 60, min: 1.5, deplacement: 40 },
  { corps: 'Serrurerie', ht: 65, min: 0.5, deplacement: 30 },
  { corps: 'Menuiserie', ht: 54, min: 1, deplacement: 35 },
  { corps: 'Peinture', ht: 42, min: 2, deplacement: 30 },
  { corps: 'Plâtrerie', ht: 44, min: 2, deplacement: 30 },
  { corps: 'Faux plafond', ht: 46, min: 1.5, deplacement: 30 },
  { corps: 'Revêtement de sol', ht: 48, min: 2, deplacement: 30 },
  { corps: 'Maçonnerie', ht: 52, min: 2, deplacement: 35 },
  { corps: 'Tous corps d’état', ht: 60, min: 1, deplacement: 40 },
];

const TVA_REGIMES = [
  { label: 'Autoliquidation B2B', rate: '0 %', usage: 'Chantiers de sous-traitance BTP (Art. 283-2 nonies du CGI)' },
  { label: 'TVA 10 % réduite', rate: '10 %', usage: 'Rénovation de locaux achevés > 2 ans (locatif & copropriété)' },
  { label: 'TVA 20 % standard', rate: '20 %', usage: 'Neuf, bureaux pro, fournitures non incorporées' },
  { label: 'TVA 5,5 %', rate: '5,5 %', usage: 'Rénovation énergétique et amélioration de l’habitat' },
];

/**
 * Masques de numérotation. La dernière référence émise est LUE dans les données :
 * elle était auparavant écrite en dur (« F-2026-0187 »), donc fausse en permanence.
 */
const NUMBERS_MASKS = [
  { kind: 'Devis de travaux', mask: 'DEV-AAAA-###', prefixe: 'DEV-' },
  { kind: 'Intervention TCE', mask: 'INT-AAAA-###', prefixe: 'INT-' },
  { kind: 'Visite de chiffrage', mask: 'VIS-AAAA-###', prefixe: 'VIS-' },
];

function eur(v: number): string {
  return `${v} €`;
}

export function ParametresStudioView({
  referencesDevis = [],
  referencesInterventions = [],
  techniciens,
  corpsEtatList,
  technicienCompetences,
  onUpdateCompetences,
  onUpdateCorpsEtat,
  baremes,
  onUpdateBaremes,
  onGoAdminUsers,
}: ParametresStudioViewProps) {
  const [activeTab, setActiveTab] = useState('competences');
  const [newCorps, setNewCorps] = useState('');
  const [editingBaremeCorps, setEditingBaremeCorps] = useState<string | null>(null);
  const [baremeDraft, setBaremeDraft] = useState<{ ht: number; min: number; deplacement: number }>({ ht: 55, min: 1, deplacement: 35 });
  const baremesList = baremes && baremes.length > 0 ? baremes : DEFAULT_BAREMES;

  const numbersRows = useMemo(() => {
    const toutes = [...referencesDevis, ...referencesInterventions].filter(Boolean);
    return NUMBERS_MASKS.map((n) => {
      const correspondantes = toutes.filter((r) => String(r).toUpperCase().startsWith(n.prefixe)).sort();
      return { ...n, last: correspondantes.length ? correspondantes[correspondantes.length - 1] : 'aucune émise' };
    });
  }, [referencesDevis, referencesInterventions]);
  const [searchTech, setSearchTech] = useState('');

  const filteredTechs = useMemo(() => {
    return techniciens.filter((t) =>
      t.toLowerCase().includes(searchTech.toLowerCase())
    );
  }, [techniciens, searchTech]);

  const handleToggleSkill = async (tech: string, trade: string) => {
    const currentSkills = technicienCompetences[tech] || [];
    const exists = currentSkills.includes(trade);
    const nextSkills = exists
      ? currentSkills.filter((s) => s !== trade)
      : [...currentSkills, trade];

    if (onUpdateCompetences) {
      await onUpdateCompetences({
        ...technicienCompetences,
        [tech]: nextSkills,
      });
      toast.success(
        exists
          ? `Compétence « ${trade} » retirée à ${tech}`
          : `Compétence « ${trade} » affectée à ${tech}`
      );
    }
  };

  return (
    <Page
      testid="screen-parametres"
      title="Paramètres métier"
      subtitle="Configuration des compétences techniciens, barèmes horaires, corps d’état et numérotation."
    >
      <Tabs
        testid="param-tabs"
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { id: 'competences', label: 'Matrice des compétences' },
          { id: 'baremes', label: 'Barèmes horaires & déplacements' },
          { id: 'corps', label: 'Corps d’état' },
          { id: 'tva', label: 'Numérotation & TVA' },
        ]}
      />

      {/* ONGLET 1 : MATRICE DES COMPÉTENCES */}
      {activeTab === 'competences' && (
        <Card
          title="Matrice des compétences"
          subtitle="Qui peut intervenir sur quel corps d’état (utilisé pour les suggestions de dispatch automatique)."
          icon={Users}
          actions={
            <Btn
              size="sm"
              icon={Plus}
              onClick={() => {
                if (onGoAdminUsers) onGoAdminUsers();
                else toast('Les collaborateurs se créent dans Administration · Utilisateurs');
              }}
            >
              Ajouter un technicien
            </Btn>
          }
        >
          <div className="m-toolbar" style={{ margin: '4px 0 14px' }}>
            <SearchInput
              value={searchTech}
              onChange={(e) => setSearchTech(e.target.value)}
              placeholder="Rechercher un technicien…"
            />
          </div>

          <div className="m-table-wrap" style={{ overflowX: 'auto' }}>
            <table className="m-table m-table--compact">
              <thead>
                <tr>
                  <th style={{ width: 180 }}>Technicien</th>
                  {corpsEtatList.slice(0, 10).map((c) => (
                    <th key={c} style={{ textAlign: 'center' }}>
                      {c.split(' / ')[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTechs.map((techName) => {
                  const skills = technicienCompetences[techName] || [];
                  return (
                    <tr key={techName}>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <Avatar name={techName} size={22} />
                          <strong>{techName}</strong>
                        </span>
                      </td>
                      {corpsEtatList.slice(0, 10).map((trade) => {
                        const hasSkill = skills.includes(trade);
                        return (
                          <td key={trade} style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleToggleSkill(techName, trade)}
                              style={{
                                all: 'unset',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                width: 24,
                                height: 24,
                                borderRadius: 6,
                                background: hasSkill
                                  ? 'rgba(22, 163, 74, .12)'
                                  : 'var(--surface-2)',
                                color: hasSkill ? 'var(--ok)' : 'var(--muted)',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 100ms ease',
                              }}
                              title={
                                hasSkill
                                  ? `Retirer ${trade} pour ${techName}`
                                  : `Activer ${trade} pour ${techName}`
                              }
                            >
                              {hasSkill ? <Check size={14} /> : <span style={{ fontSize: '11px' }}>—</span>}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ONGLET 2 : BARÈMES HORAIRES */}
      {activeTab === 'baremes' && (
        <Card
          title="Barèmes horaires & déplacements"
          subtitle="Appliqués par défaut lors de la création d’un devis chiffrage ou d’une intervention."
          icon={BanknoteArrowUp}
        >
          <DataTable
            columns={[
              {
                key: 'corps',
                label: 'Corps d’état',
                render: (b: any) => <strong>{b.corps}</strong>,
              },
              {
                key: 'ht',
                label: 'Taux horaire HT',
                align: 'right' as const,
                render: (b: any) =>
                  editingBaremeCorps === b.corps ? (
                    <input
                      type="number"
                      className="input"
                      style={{ width: 80, textAlign: 'right' }}
                      value={baremeDraft.ht}
                      onChange={(e) => setBaremeDraft((d) => ({ ...d, ht: Number(e.target.value) || 0 }))}
                    />
                  ) : (
                    <span className="m-mono">{eur(b.ht)} / h</span>
                  ),
              },
              {
                key: 'min',
                label: 'Durée minimum',
                align: 'right' as const,
                render: (b: any) =>
                  editingBaremeCorps === b.corps ? (
                    <input
                      type="number"
                      step="0.5"
                      className="input"
                      style={{ width: 70, textAlign: 'right' }}
                      value={baremeDraft.min}
                      onChange={(e) => setBaremeDraft((d) => ({ ...d, min: Number(e.target.value) || 0 }))}
                    />
                  ) : (
                    <span className="m-mono">{b.min} h</span>
                  ),
              },
              {
                key: 'deplacement',
                label: 'Forfait déplacement',
                align: 'right' as const,
                render: (b: any) =>
                  editingBaremeCorps === b.corps ? (
                    <input
                      type="number"
                      className="input"
                      style={{ width: 80, textAlign: 'right' }}
                      value={baremeDraft.deplacement}
                      onChange={(e) => setBaremeDraft((d) => ({ ...d, deplacement: Number(e.target.value) || 0 }))}
                    />
                  ) : (
                    <span className="m-mono">{eur(b.deplacement)}</span>
                  ),
              },
              {
                key: 'actions',
                label: '',
                width: 120,
                align: 'right' as const,
                render: (b: any) => editingBaremeCorps === b.corps ? (
                  <div style={{ display: "inline-flex", gap: 6 }}>
                    <Btn size="sm" variant="primary" icon={Check} onClick={async () => { const next = baremesList.map((item) => item.corps === b.corps ? { ...item, ...baremeDraft } : item); if (onUpdateBaremes) await onUpdateBaremes(next); setEditingBaremeCorps(null); toast.success("Barème enregistré"); }}>OK</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setEditingBaremeCorps(null)}>Annuler</Btn>
                  </div>
                ) : (
                  <Btn size="sm" variant="ghost" icon={Edit3} onClick={() => { setEditingBaremeCorps(b.corps); setBaremeDraft({ ht: b.ht, min: b.min, deplacement: b.deplacement }); }}>Modifier</Btn>
                ),
              },
            ]}
            rows={baremesList}
            rowKey={(b) => b.corps}
          />
        </Card>
      )}

      {/* ONGLET 3 : CORPS D’ÉTAT */}
      {activeTab === 'corps' && (
        <Card
          title="Corps d’état"
          subtitle="Référentiel des spécialités mobilisées dans les devis, plannings et calculs de rentabilité."
          icon={Wrench}
          actions={
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input className="input" placeholder="Nouveau corps d’état…" value={newCorps} onChange={(e) => setNewCorps(e.target.value)} style={{ width: 190 }} /><Btn size="sm" icon={Plus} onClick={async () => { const val = newCorps.trim(); if (!val) return; if (corpsEtatList.includes(val)) { toast('Ce corps d’état existe déjà'); return; } if (onUpdateCorpsEtat) await onUpdateCorpsEtat([...corpsEtatList, val]); setNewCorps(''); toast.success(`Corps d’état « ${val} » ajouté`); }}>Ajouter</Btn></div>


          }
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '6px 0' }}>
            {corpsEtatList.map((c) => (
              <span
                key={c}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  background: 'var(--primary-soft)',
                  color: 'var(--primary)',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  border: '1px solid rgba(29, 78, 216, .2)',
                }}
              >
                {c}
                {onUpdateCorpsEtat && (
                  <button
                    type="button"
                    aria-label={`Supprimer ${c}`}
                    onClick={async () => {
                      await onUpdateCorpsEtat(corpsEtatList.filter((x) => x !== c));
                      toast.success(`Corps d’état « ${c} » retiré`);
                    }}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      fontWeight: 700,
                      marginLeft: 2,
                      opacity: 0.7,
                    }}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* ONGLET 4 : NUMÉROTATION & TVA */}
      {activeTab === 'tva' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card title="Régimes de TVA applicables" icon={BanknoteArrowUp}>
            <DataTable
              columns={[
                { key: 'label', label: 'Régime TVA', render: (r: any) => <strong>{r.label}</strong> },
                { key: 'rate', label: 'Taux', align: 'right' as const, width: 100, render: (r: any) => <span className="m-mono" style={{ fontWeight: 700 }}>{r.rate}</span> },
                { key: 'usage', label: 'Cadre fiscal d’application', render: (r: any) => <span className="m-small m-muted">{r.usage}</span> },
              ]}
              rows={TVA_REGIMES}
              rowKey={(r) => r.label}
            />
          </Card>

          <Card title="Masques de numérotation automatique" icon={FileText}>
            <DataTable
              columns={[
                { key: 'kind', label: 'Type de document', render: (n: any) => <strong>{n.kind}</strong> },
                { key: 'mask', label: 'Format de référence', render: (n: any) => <span className="m-mono">{n.mask}</span> },
                { key: 'last', label: 'Dernière référence émise', align: 'right' as const, render: (n: any) => <span className="m-mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>{n.last}</span> },
              ]}
              rows={numbersRows}
              rowKey={(n) => n.kind}
            />
          </Card>
        </div>
      )}
    </Page>
  );
}
