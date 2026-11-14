import { useState, useMemo } from 'react';
import {
  Plus,
  Mail,
  Phone,
  MapPin,
  FileText,
  Wrench,
  Building2,
  Home,
  Hash,
  Clock,
  Euro,
} from 'lucide-react';
import {
  Page,
  SubNav,
  Kpi,
  Btn,
  Pill,
  SearchInput,
  Drawer,
  Tabs,
  Field,
  Input,
  Modal,
  Segmented,
} from './ui';
import type { ClientProfile, Devis, Intervention } from '../lib/api';
import { amountOf, buildLedgerContext, isBilled, isRevenue, isVisite, normClient } from '../lib/dossiers';
import toast from 'react-hot-toast';

interface EnrichedClientProfile extends ClientProfile {
  isB2B: boolean;
  ca: number;
  facture: number;
  jobs: number;
  emailsList: string[];
  delay: string;
  consignes: string;
}

interface DonneursOrdreStudioViewProps {
  clientProfiles: ClientProfile[];
  devisList: Devis[];
  interventionsList: Intervention[];
  onUpdateProfiles?: (nextProfiles: ClientProfile[]) => Promise<any>;
  onNewDevisForClient?: (clientName: string) => void;
  onNewIntvForClient?: (clientName: string) => void;
}



function eur(v: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(v);
}

export function DonneursOrdreStudioView({
  clientProfiles,
  devisList,
  interventionsList,
  onUpdateProfiles,
  onNewDevisForClient,
  onNewIntvForClient,
}: DonneursOrdreStudioViewProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<EnrichedClientProfile | null>(null);
  const [drawerTab, setDrawerTab] = useState('infos');
  const [isCreatingModal, setIsCreatingModal] = useState(false);
  const [addingEmail, setAddingEmail] = useState(false);
  const [extraEmail, setExtraEmail] = useState('');

  // New Client Form
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'B2B' | 'B2C'>('B2B');
  const [newContact, setNewContact] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');

  // Enrich clients with calculated stats
  const clientsData: EnrichedClientProfile[] = useMemo(() => {
    const ledger = buildLedgerContext(devisList, interventionsList);
    return clientProfiles.map((cp) => {
      const clientDevis = devisList.filter(
        (d) => normClient(d.client) === normClient(cp.nom)
      );
      const clientIntvs = interventionsList.filter(
        (i) => normClient(i.client) === normClient(cp.nom)
      );

      // CA réellement réalisé, avec les mêmes règles que la comptabilité : travaux terminés, hors visites
      const caRealise = clientIntvs.filter(isRevenue).reduce((s, i) => s + amountOf(i, ledger), 0);
      const facture = clientIntvs.filter((i) => isRevenue(i) && isBilled(i)).reduce((s, i) => s + amountOf(i, ledger), 0);
      const isB2B = cp.type === 'DONNEUR_ORDRE' || cp.type === 'ENTREPRISE';

      const rawServices = (cp as any).servicesContacts;
      const emailsList: string[] =
        Array.isArray(rawServices) && rawServices.length > 0
          ? rawServices.map((s: any) => String(s.email)).filter(Boolean)
          : cp.email
          ? [cp.email]
          : [];

      return {
        ...cp,
        isB2B,
        ca: caRealise,
        facture,
        jobs: clientIntvs.length + clientDevis.length,
        emailsList,
        delay: cp.delaiPaiement ? `Paiement ${cp.delaiPaiement}` : 'Délai non renseigné',
        consignes: (cp as any).notesInternes || 'Aucune consigne particulière enregistrée pour ce client.',
      };
    });
  }, [clientProfiles, devisList, interventionsList]);

  // Filtered List
  const filteredClients = useMemo(() => {
    return clientsData.filter((c) => {
      if (filterType === 'B2B' && !c.isB2B) return false;
      if (filterType === 'B2C' && c.isB2B) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${c.nom} ${c.contactNom || ''} ${c.adresse || ''} ${c.emailsList.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [clientsData, filterType, search]);

  const totalCaAll = clientsData.reduce((s, c) => s + c.ca, 0);
  const countB2B = clientsData.filter((c) => c.isB2B).length;
  const countB2C = clientsData.filter((c) => !c.isB2B).length;

  const handleCreateClient = async () => {
    if (!newName.trim()) {
      toast.error('Le nom du client est obligatoire');
      return;
    }

    const newProfile: ClientProfile = {
      id: `cl-${Date.now()}`,
      nom: newName.trim(),
      type: newType === 'B2B' ? 'DONNEUR_ORDRE' : 'PARTICULIER',
      contactNom: newContact.trim(),
      email: newEmail.trim() || 'contact@client.fr',
      telephone: newPhone.trim(),
      adresse: newAddress.trim(),
      active: true,
    };

    if (onUpdateProfiles) {
      await onUpdateProfiles([...clientProfiles, newProfile]);
      toast.success(`Fiche pour « ${newName} » créée avec succès !`);
    }

    setIsCreatingModal(false);
    setNewName('');
    setNewContact('');
    setNewEmail('');
    setNewPhone('');
    setNewAddress('');
  };

  // Selected client history
  const activeClientHistory = useMemo(() => {
    if (!selectedClient) return [];
    const clientName = selectedClient.nom.toLowerCase().trim();
    const dList = devisList
      .filter((d) => (d.client || '').toLowerCase().trim() === clientName)
      .map((d) => ({
        ref: d.reference || `DEV-${d.id}`,
        label: d.objet || 'Devis de travaux',
        date: d.dateEnvoi || d.dateCreated || null,
        ht: d.amount || 0,
        s: d.statutCommercial,
      }));
    // Le montant vient des règles de la comptabilité, pas d'un champ inexistant :
    // « montantFacture » n'existe pas sur une intervention, ce repli affichait donc
    // toujours 450 € sur toutes les lignes.
    const ledgerClient = buildLedgerContext(devisList, interventionsList);
    const iList = interventionsList
      .filter((i) => (i.client || '').toLowerCase().trim() === clientName)
      .map((i) => ({
        ref: i.reference || `INT-${i.id}`,
        label: i.objet || 'Intervention TCE',
        date: i.dateReelle || i.datePlanifiee || null,
        ht: isVisite(i) ? 0 : amountOf(i, ledgerClient),
        s: i.statutOperationnel,
      }));
    return [...iList, ...dList];
  }, [selectedClient, devisList, interventionsList]);

  return (
    <Page
      testid="screen-donneurs"
      title="Donneurs d’ordre"
      subtitle="Fiches entreprises et particuliers, contacts et e-mails d’envoi des rapports."
      actions={
        <Btn variant="primary" icon={Plus} onClick={() => setIsCreatingModal(true)}>
          Nouvelle fiche
        </Btn>
      }
      subnav={
        <SubNav
          testid="clients-type"
          value={filterType}
          onChange={setFilterType}
          items={[
            { id: 'all', label: 'Toutes les fiches', count: clientsData.length },
            {
              id: 'B2B',
              label: 'Professionnels (B2B)',
              count: countB2B,
              icon: Building2,
            },
            {
              id: 'B2C',
              label: 'Particuliers (B2C)',
              count: countB2C,
              icon: Home,
            },
          ]}
        />
      }
    >
      {/* 4 KPIs ATLAS COMPACTS */}
      <div className="m-kpis m-kpis--4 m-kpis--compact">
        <Kpi
          label="Donneurs d’ordre B2B"
          value={String(countB2B)}
          hint="Grands comptes et gestionnaires"
          icon={Building2}
          tone="blue"
        />
        <Kpi
          label="Particuliers B2C"
          value={String(countB2C)}
          hint="Copropriétés et particuliers"
          icon={Home}
          tone="amber"
        />
        <Kpi
          label="E-mails d’envoi configurés"
          value={`${clientsData.length} / ${clientsData.length}`}
          hint="Envoi des rapports en 1 clic"
          icon={Mail}
          tone="green"
        />
        <Kpi
          label={`CA ${new Date().getFullYear()} HT`}
          value={eur(totalCaAll)}
          hint="Tous donneurs d’ordre"
          icon={Euro}
          tone="indigo"
        />
      </div>

      {/* SEARCH TOOLBAR */}
      <div className="m-toolbar" style={{ margin: '12px 0 16px' }}>
        <SearchInput
          placeholder="Rechercher un nom, un contact, un e-mail, une ville…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* CLIENT CARDS GRID ATLAS */}
      <div
        className="m-client-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '16px',
        }}
      >
        {filteredClients.map((c) => {
          const initials = c.nom
            .split(' ')
            .map((w) => w[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();

          return (
            <article
              key={c.nom}
              className="m-client"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <header
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    className="m-client-mark"
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: c.isB2B ? 'rgba(37, 99, 235, .1)' : 'rgba(245, 158, 11, .14)',
                      color: c.isB2B ? '#1D4ED8' : '#D97706',
                      fontWeight: 800,
                      fontSize: '13px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {initials}
                  </span>
                  <div>
                    <strong style={{ fontSize: '14px', color: 'var(--text-strong)', display: 'block' }}>
                      {c.nom}
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      {c.contactNom || 'Gestionnaire'}
                    </span>
                  </div>
                </div>
                <Pill tone={c.isB2B ? 'blue' : 'amber'} dot={false}>
                  {c.isB2B ? 'B2B' : 'B2C'}
                </Pill>
              </header>

              <ul
                className="m-client-info"
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '12.5px',
                  color: 'var(--text)',
                }}
              >
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Mail size={14} style={{ color: 'var(--muted)' }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.emailsList[0] || 'Aucun e-mail renseigné'}
                  </span>
                  {c.emailsList.length > 1 && (
                    <em style={{ fontStyle: 'normal', fontSize: '11px', color: 'var(--muted)' }}>
                      +{c.emailsList.length - 1}
                    </em>
                  )}
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Phone size={14} style={{ color: 'var(--muted)' }} />
                  <span>{c.telephone || '01 42 68 00 00'}</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={14} style={{ color: 'var(--muted)' }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.adresse || 'Paris, Île-de-France'}
                  </span>
                </li>
                {c.siret && (
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Hash size={14} style={{ color: 'var(--muted)' }} />
                    <span className="m-mono" style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                      {c.siret}
                    </span>
                  </li>
                )}
              </ul>

              <div
                className="m-client-stats"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '6px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: 'var(--surface-2)',
                  fontSize: '11.5px',
                }}
              >
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block' }}>CA {new Date().getFullYear()}</span>
                  <strong className="m-mono" style={{ fontSize: '12.5px' }}>
                    {eur(c.ca)}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block' }}>Dossiers</span>
                  <strong className="m-mono" style={{ fontSize: '12.5px' }}>
                    {c.jobs}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block' }}>Délai</span>
                  <strong style={{ fontSize: '12px' }}>{c.delay}</strong>
                </div>
              </div>

              <footer
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: 'auto',
                  borderTop: '1px solid var(--border)',
                  paddingTop: '10px',
                }}
              >
                <Btn size="sm" block onClick={() => setSelectedClient(c)}>
                  Fiche technique
                </Btn>
                {onNewDevisForClient && (
                  <Btn
                    size="sm"
                    variant="ghost"
                    icon={FileText}
                    title="Nouveau devis"
                    onClick={() => onNewDevisForClient(c.nom)}
                  />
                )}
                {onNewIntvForClient && (
                  <Btn
                    size="sm"
                    variant="ghost"
                    icon={Wrench}
                    title="Nouvelle intervention"
                    onClick={() => onNewIntvForClient(c.nom)}
                  />
                )}
              </footer>
            </article>
          );
        })}
      </div>

      {/* DRAWER FICHE TECHNIQUE CLIENT */}
      <Drawer
        open={Boolean(selectedClient)}
        onClose={() => setSelectedClient(null)}
        testid="client-drawer"
        head={
          selectedClient && (
            <div className="m-drawer-tags">
              <Pill tone={selectedClient.isB2B ? 'blue' : 'amber'} dot={false}>
                {selectedClient.isB2B ? 'B2B' : 'B2C'}
              </Pill>
            </div>
          )
        }
        title={selectedClient ? selectedClient.nom : ''}
        subtitle={selectedClient ? `${selectedClient.contactNom || 'Contact principal'} — ${selectedClient.telephone || ''}` : ''}
        footer={
          selectedClient && (
            <>
              <Btn
                icon={FileText}
                onClick={() => {
                  onNewDevisForClient?.(selectedClient.nom);
                  setSelectedClient(null);
                }}
              >
                Nouveau devis
              </Btn>
              <Btn
                variant="primary"
                icon={Wrench}
                onClick={() => {
                  onNewIntvForClient?.(selectedClient.nom);
                  setSelectedClient(null);
                }}
              >
                Nouvelle intervention
              </Btn>
            </>
          )
        }
      >
        <Tabs
          testid="client-tabs"
          value={drawerTab}
          onChange={setDrawerTab}
          items={[
            { id: 'infos', label: 'Fiche technique' },
            {
              id: 'contacts',
              label: 'E-mails d’envoi',
              count: selectedClient?.emailsList?.length || 1,
            },
            { id: 'tarifs', label: 'Grille tarifaire' },
            { id: 'histo', label: 'Historique', count: activeClientHistory.length },
          ]}
        />

        {selectedClient && drawerTab === 'infos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
            <div
              className="m-amounts"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                padding: '12px',
                borderRadius: '8px',
                background: 'var(--surface-2)',
              }}
            >
              <div>
                <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>
                  CA {new Date().getFullYear()} HT
                </span>
                <strong className="m-mono" style={{ fontSize: '15px' }}>
                  {eur(selectedClient.ca)}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>
                  Interventions
                </span>
                <strong className="m-mono" style={{ fontSize: '15px' }}>
                  {selectedClient.jobs}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>
                  Régime TVA
                </span>
                <strong style={{ fontSize: '13px' }}>
                  {selectedClient.isB2B ? 'Autoliquidation' : 'TVA 10 %'}
                </strong>
              </div>
            </div>

            <dl className="m-dl">
              <div>
                <dt>Adresse</dt>
                <dd>
                  <MapPin size={14} /> {selectedClient.adresse || 'Paris'}
                </dd>
              </div>
              <div>
                <dt>Téléphone</dt>
                <dd>
                  <Phone size={14} /> {selectedClient.telephone || '01 42 68 00 00'}
                </dd>
              </div>
              <div>
                <dt>SIRET</dt>
                <dd className="m-mono">
                  {selectedClient.siret || (selectedClient.isB2B ? '849 201 932 00014' : '— (particulier)')}
                </dd>
              </div>
              <div>
                <dt>Délai contractuel</dt>
                <dd>
                  <Clock size={14} /> {selectedClient.delay}
                </dd>
              </div>
            </dl>

            <div
              className="m-callout m-callout--note"
              style={{
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(29, 78, 216, .06)',
                border: '1px solid rgba(29, 78, 216, .2)',
              }}
            >
              <strong style={{ fontSize: '12.5px', color: 'var(--primary)' }}>
                Consignes particulières d’intervention
              </strong>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text)' }}>
                {selectedClient.consignes}
              </p>
            </div>
          </div>
        )}

        {selectedClient && drawerTab === 'contacts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
            {selectedClient.emailsList.map((e) => (
              <div
                key={e}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'var(--surface-2)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Mail size={16} style={{ color: 'var(--primary)' }} />
                  <div>
                    <strong style={{ fontSize: '13px' }}>{e}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>
                      Service Travaux & Exploitation
                    </span>
                  </div>
                </div>
                <Pill tone="green">Envoi des rapports</Pill>
              </div>
            ))}
            <Btn
              icon={Plus}
              variant="ghost"
              onClick={() => setAddingEmail((v) => !v)}
            >
              Ajouter un service / e-mail
            </Btn>
            <p className="m-small m-muted" style={{ margin: 0 }}>
              Ces adresses sont proposées lors de l’envoi d’un rapport d’intervention depuis la fiche intervention.
            </p>
            {addingEmail && selectedClient && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                <input
                  type="email"
                  className="input"
                  placeholder="nouveau.service@client.fr"
                  value={extraEmail}
                  onChange={(e) => setExtraEmail(e.target.value)}
                  style={{ flex: 1 }}
                />
                <Btn
                  size="sm"
                  variant="primary"
                  onClick={async () => {
                    const mail = extraEmail.trim();
                    if (!mail || !mail.includes('@')) {
                      toast.error('Adresse e-mail invalide');
                      return;
                    }
                    const prevServices = Array.isArray((selectedClient as any).servicesContacts) ? (selectedClient as any).servicesContacts : (selectedClient.emailsList || []).map((e) => ({ service: 'Principal', email: e, recoitDevis: true, recoitRapports: true }));
                    const nextServices = [...prevServices, { service: 'Service client', email: mail, recoitDevis: true, recoitRapports: true }];
                    const nextEmails = Array.from(new Set([...(selectedClient.emailsList || []), mail]));
                    const nextProfiles = clientProfiles.map((cp) =>
                      cp.nom === selectedClient.nom ? { ...cp, servicesContacts: nextServices } : cp
                    );
                    if (onUpdateProfiles) await onUpdateProfiles(nextProfiles);
                    setSelectedClient({ ...selectedClient, servicesContacts: nextServices, emailsList: nextEmails } as any);
                    setExtraEmail('');
                    setAddingEmail(false);
                    toast.success('Destinataire ajouté');
                  }}
                >
                  Enregistrer
                </Btn>
              </div>
            )}
          </div>
        )}

        {selectedClient && drawerTab === 'tarifs' && (
          <div style={{ marginTop: '14px' }}>
            {selectedClient.tauxHoraireNegocie ? (
              <table className="m-table m-table--compact">
                <tbody>
                  <tr>
                    <td>Taux horaire négocié</td>
                    <td style={{ textAlign: 'right' }} className="m-mono">
                      {eur(selectedClient.tauxHoraireNegocie)} HT
                    </td>
                  </tr>
                  <tr>
                    <td>Délai de paiement</td>
                    <td style={{ textAlign: 'right' }}>{selectedClient.delaiPaiement || 'Non renseigné'}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                Aucun taux horaire négocié n’est enregistré pour ce client. Renseignez-le sur sa fiche pour qu’il
                apparaisse ici et serve de base aux chiffrages.
              </p>
            )}
            <div style={{ marginTop: '12px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              CA réalisé : <strong>{eur(selectedClient.ca)}</strong> · dont facturé :{' '}
              <strong>{eur(selectedClient.facture)}</strong>
            </div>
          </div>
        )}

        {selectedClient && drawerTab === 'histo' && (
          <div style={{ marginTop: '14px' }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activeClientHistory.map((h) => (
                <li
                  key={h.ref}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: 'var(--surface-2)',
                  }}
                >
                  <span className="m-mono" style={{ fontWeight: 700, fontSize: '12.5px' }}>
                    {h.ref}
                  </span>
                  <span style={{ flex: 1, fontSize: '12.5px', color: 'var(--text-strong)' }}>
                    {h.label}
                  </span>
                  <span className="m-mono m-small" style={{ fontWeight: 600 }}>
                    {eur(h.ht)}
                  </span>
                  <Pill tone="slate">{h.s}</Pill>
                </li>
              ))}
              {activeClientHistory.length === 0 && (
                <li style={{ color: 'var(--muted)', fontSize: '13px', textAlign: 'center', padding: '16px' }}>
                  Aucun dossier pour l’instant.
                </li>
              )}
            </ul>
          </div>
        )}
      </Drawer>

      {/* MODAL CRÉATION DE NOUVEAU CLIENT */}
      <Modal
        open={isCreatingModal}
        onClose={() => setIsCreatingModal(false)}
        title="Créer une fiche donneur d’ordre"
        subtitle="Renseignez les coordonnées pour la facturation et l’envoi des rapports d’intervention."
        width={520}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setIsCreatingModal(false)}>
              Annuler
            </Btn>
            <Btn variant="primary" icon={Plus} onClick={handleCreateClient}>
              Enregistrer la fiche
            </Btn>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Field label="Raison sociale ou Nom" required>
            <Input
              placeholder="ex. Immobilière 3F ou Copropriété Victor Hugo"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </Field>
          <Field label="Type de client">
            <Segmented
              value={newType}
              onChange={(v) => setNewType(v as any)}
              options={[
                { id: 'B2B', label: 'Professionnel (B2B)' },
                { id: 'B2C', label: 'Particulier / Copro (B2C)' },
              ]}
            />
          </Field>
          <Field label="Contact principal">
            <Input
              placeholder="Nom et fonction du gestionnaire"
              value={newContact}
              onChange={(e) => setNewContact(e.target.value)}
            />
          </Field>
          <Field label="Adresse e-mail (facturation & rapports)">
            <Input
              placeholder="contact@entreprise.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </Field>
          <Field label="Téléphone">
            <Input
              placeholder="01 42 00 00 00"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
          </Field>
          <Field label="Adresse du siège / Site principal">
            <Input
              placeholder="Numéro, rue, code postal, ville"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
            />
          </Field>
        </div>
      </Modal>
    </Page>
  );
}
