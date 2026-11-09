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
  techniciens: string[];
  corpsEtatList: string[];
  technicienCompetences: Record<string, string[]>;
  onUpdateCompetences?: (nextMap: Record<string, string[]>) => Promise<any>;
  onAddCorpsEtat?: (val: string) => Promise<any>;
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

const NUMBERS_CONFIG = [
  { kind: 'Devis de travaux', mask: 'DEV-AAAA-###', last: 'DEV-2026-008' },
  { kind: 'Intervention TCE', mask: 'INT-AAAA-###', last: 'INT-2026-014' },
  { kind: 'Facture client', mask: 'F-AAAA-####', last: 'F-2026-0187' },
];

function eur(v: number): string {
  return `${v} €`;
}

export function ParametresStudioView({
  techniciens,
  corpsEtatList,
  technicienCompetences,
  onUpdateCompetences,
}: ParametresStudioViewProps) {
  const [activeTab, setActiveTab] = useState('competences');
  const [searchTech, setSearchTech] = useState('');

  const filteredTechs = useMemo(() => {
    return techniciens.filter((t) =>
      t.toLowerCase().includes(searchTech.toLowerCase())
    );
  }, [techniciens, searchTech]);

  const handleToggleSkill = async (tech: string, trade: string) => {
    const currentSkills = technicienCompetences[tech] || ['Électricité'];
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
              onClick={() => toast('Ajout d’un nouveau profil collaborateur dans l’équipe')}
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
                  const skills = technicienCompetences[techName] || ['Électricité'];
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
                render: (b: any) => <span className="m-mono">{eur(b.ht)} / h</span>,
              },
              {
                key: 'min',
                label: 'Durée minimum',
                align: 'right' as const,
                render: (b: any) => <span className="m-mono">{b.min} h</span>,
              },
              {
                key: 'deplacement',
                label: 'Forfait déplacement',
                align: 'right' as const,
                render: (b: any) => <span className="m-mono">{eur(b.deplacement)}</span>,
              },
              {
                key: 'actions',
                label: '',
                width: 120,
                align: 'right' as const,
                render: (b: any) => (
                  <Btn
                    size="sm"
                    variant="ghost"
                    icon={Edit3}
                    onClick={() => toast(`Édition du barème ${b.corps}`)}
                  >
                    Modifier
                  </Btn>
                ),
              },
            ]}
            rows={DEFAULT_BAREMES}
            rowKey={(b) => b.corps}
          />
        </Card>
      )}

      {/* ONGLET 3 : CORPS D’ÉTAT */}
      {activeTab === 'corps' && (
        <Card
          title="Corps d’état ANELEC TCE"
          subtitle="Référentiel des spécialités mobilisées dans les devis, plannings et calculs de rentabilité."
          icon={Wrench}
          actions={
            <Btn size="sm" icon={Plus} onClick={() => toast('Ajout d’une nouvelle spécialité métier')}>
              Ajouter
            </Btn>
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
              rows={NUMBERS_CONFIG}
              rowKey={(n) => n.kind}
            />
          </Card>
        </div>
      )}
    </Page>
  );
}
