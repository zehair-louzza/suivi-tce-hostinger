import React, { useState, useMemo } from 'react';
import { ClientProfile, ClientProfileType } from '../lib/api';
import toast from 'react-hot-toast';

interface ClientsDirectoryViewProps {
  clientProfiles: ClientProfile[];
  onUpdateProfiles: (nextProfiles: ClientProfile[]) => Promise<void>;
  onNewDevisForClient?: (clientName: string) => void;
  onNewIntvForClient?: (clientName: string) => void;
}

export function ClientsDirectoryView({
  clientProfiles,
  onUpdateProfiles,
  onNewDevisForClient,
  onNewIntvForClient,
}: ClientsDirectoryViewProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | ClientProfileType>('ALL');
  const [editingProfile, setEditingProfile] = useState<Partial<ClientProfile> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Filtrage et recherche
  const filteredProfiles = useMemo(() => {
    return clientProfiles.filter((p) => {
      if (typeFilter !== 'ALL' && p.type !== typeFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        p.nom.toLowerCase().includes(q) ||
        (p.contactNom && p.contactNom.toLowerCase().includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        (p.ville && p.ville.toLowerCase().includes(q)) ||
        (p.telephone && p.telephone.includes(q))
      );
    });
  }, [clientProfiles, typeFilter, search]);

  // Statistiques synthétiques
  const stats = useMemo(() => {
    const total = clientProfiles.length;
    const donneursOrdre = clientProfiles.filter((p) => p.type === 'DONNEUR_ORDRE').length;
    const entreprises = clientProfiles.filter((p) => p.type === 'ENTREPRISE').length;
    const particuliers = clientProfiles.filter((p) => p.type === 'PARTICULIER').length;
    const withEmail = clientProfiles.filter((p) => p.email && p.email.includes('@')).length;
    return { total, donneursOrdre, entreprises, particuliers, withEmail };
  }, [clientProfiles]);

  const handleOpenCreate = () => {
    setIsCreating(true);
    setEditingProfile({
      id: `client-${Date.now()}`,
      nom: '',
      type: 'DONNEUR_ORDRE',
      email: '',
      telephone: '',
      contactNom: '',
      contactRole: '',
      adresse: '',
      codePostal: '',
      ville: '',
      siret: '',
      delaiPaiement: '30 jours',
      tauxHoraireNegocie: 60,
      consignesParticulieres: '',
      notesInternes: '',
      active: true,
    });
  };

  const handleOpenEdit = (profile: ClientProfile) => {
    setIsCreating(false);
    setEditingProfile({ ...profile });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile || !editingProfile.nom?.trim()) {
      toast.error('Le nom ou raison sociale est obligatoire');
      return;
    }

    try {
      setIsSaving(true);
      const cleanNom = editingProfile.nom.trim();
      const nextProfile: ClientProfile = {
        id: editingProfile.id || cleanNom.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        nom: cleanNom,
        type: editingProfile.type || 'DONNEUR_ORDRE',
        email: (editingProfile.email || '').trim().toLowerCase(),
        telephone: (editingProfile.telephone || '').trim(),
        contactNom: (editingProfile.contactNom || '').trim(),
        contactRole: (editingProfile.contactRole || '').trim(),
        adresse: (editingProfile.adresse || '').trim(),
        codePostal: (editingProfile.codePostal || '').trim(),
        ville: (editingProfile.ville || '').trim(),
        siret: (editingProfile.siret || '').trim(),
        delaiPaiement: (editingProfile.delaiPaiement || '').trim(),
        tauxHoraireNegocie: editingProfile.tauxHoraireNegocie ? Number(editingProfile.tauxHoraireNegocie) : undefined,
        consignesParticulieres: (editingProfile.consignesParticulieres || '').trim(),
        notesInternes: (editingProfile.notesInternes || '').trim(),
        active: editingProfile.active !== false,
        updatedAt: new Date().toISOString(),
      };

      let nextList: ClientProfile[];
      if (isCreating) {
        nextList = [...clientProfiles, nextProfile];
      } else {
        nextList = clientProfiles.map((p) => (p.id === nextProfile.id ? nextProfile : p));
      }

      await onUpdateProfiles(nextList);
      toast.success(
        isCreating
          ? `Fiche technique « ${nextProfile.nom} » créée avec succès`
          : `Fiche technique « ${nextProfile.nom} » mise à jour`
      );
      setEditingProfile(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err.message || "Erreur lors de l'enregistrement");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProfile = async (id: string, nom: string) => {
    if (!window.confirm(`Supprimer la fiche technique du client « ${nom} » ?`)) return;
    try {
      const nextList = clientProfiles.filter((p) => p.id !== id);
      await onUpdateProfiles(nextList);
      toast.success(`Fiche de « ${nom} » supprimée`);
      if (editingProfile?.id === id) setEditingProfile(null);
    } catch (err: any) {
      toast.error("Erreur lors de la suppression");
    }
  };

  const getTypeBadge = (type: ClientProfileType) => {
    switch (type) {
      case 'DONNEUR_ORDRE':
        return { label: "Donneur d'Ordre B2B", bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
      case 'ENTREPRISE':
        return { label: 'Entreprise Partenaire', bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' };
      case 'PARTICULIER':
        return { label: 'Client Particulier B2C', bg: '#fefce8', color: '#a16207', border: '#fef08a' };
      case 'SOUS_TRAITANT':
        return { label: 'Sous-traitant / Cotraitant', bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' };
      default:
        return { label: 'Client', bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Profils Entreprises & Donneurs d'Ordre
            </h1>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                background: '#e6f9f0',
                color: '#00bf63',
                padding: '3px 10px',
                borderRadius: '999px',
              }}
            >
              {clientProfiles.length} fiches techniques
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
            Fiches techniques de chaque entreprise partenaire ou particulier pour faciliter l'échange direct et l'envoi automatisé des rapports par e-mail.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleOpenCreate}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          + Nouvelle Fiche Donneur d'Ordre
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
            Donneurs d'Ordre B2B
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#1d4ed8', marginTop: '4px' }}>
            {stats.donneursOrdre}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Grands comptes & gestionnaires</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
            Particuliers B2C
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#a16207', marginTop: '4px' }}>
            {stats.particuliers}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Copropriétés & particuliers</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
            Emails d'envoi configurés
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#00bf63', marginTop: '4px' }}>
            {stats.withEmail} / {stats.total}
          </div>
          <div style={{ fontSize: '11px', color: '#00bf63', fontWeight: 600, marginTop: '2px' }}>
            Prêt pour l'envoi 1-clic de rapports
          </div>
        </div>
      </div>

      {/* Barre de Recherche et Filtres */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '12px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '420px' }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="input"
            style={{ paddingLeft: '36px' }}
            placeholder="Rechercher par donneur d'ordre, contact, email, ville..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Boutons segmented de filtrage */}
        <div className="segmented-group" style={{ display: 'flex', gap: '4px' }}>
          <button
            type="button"
            className={`segmented-btn ${typeFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setTypeFilter('ALL')}
          >
            Tous ({clientProfiles.length})
          </button>
          <button
            type="button"
            className={`segmented-btn ${typeFilter === 'DONNEUR_ORDRE' ? 'active' : ''}`}
            onClick={() => setTypeFilter('DONNEUR_ORDRE')}
          >
            Donneurs d'ordre ({stats.donneursOrdre})
          </button>
          <button
            type="button"
            className={`segmented-btn ${typeFilter === 'PARTICULIER' ? 'active' : ''}`}
            onClick={() => setTypeFilter('PARTICULIER')}
          >
            Particuliers ({stats.particuliers})
          </button>
        </div>
      </div>

      {/* Grille des Fiches Techniques */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
        {filteredProfiles.map((p) => {
          const badge = getTypeBadge(p.type);
          return (
            <div
              key={p.id}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              <div>
                {/* Header Carte */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                        marginBottom: '6px',
                      }}
                    >
                      {badge.label}
                    </span>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      {p.nom}
                    </h3>
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenEdit(p)}
                    title="Modifier la fiche technique"
                    style={{ fontSize: '11.5px', padding: '4px 10px' }}
                  >
                    ✏️ Modifier
                  </button>
                </div>

                {/* Coordonnées & Interlocuteur */}
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px' }}>
                  {p.contactNom && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
                      <span style={{ color: '#64748b' }}>👤 Interlocuteur :</span>
                      <strong>{p.contactNom}</strong>
                      {p.contactRole && <span style={{ color: '#94a3b8', fontSize: '11px' }}>({p.contactRole})</span>}
                    </div>
                  )}

                  {/* Email officiel d'envoi des rapports */}
                  <div
                    style={{
                      background: p.email ? '#f0fdf4' : '#fffbeb',
                      border: `1px solid ${p.email ? '#bbf7d0' : '#fef08a'}`,
                      borderRadius: '8px',
                      padding: '8px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      <span>✉️</span>
                      {p.email ? (
                        <a
                          href={`mailto:${p.email}`}
                          style={{
                            fontWeight: 700,
                            color: '#15803d',
                            textDecoration: 'none',
                            fontSize: '12px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {p.email}
                        </a>
                      ) : (
                        <span style={{ color: '#b45309', fontSize: '11.5px', fontStyle: 'italic' }}>
                          Aucun email d'envoi renseigné
                        </span>
                      )}
                    </div>
                    {p.email && (
                      <span style={{ fontSize: '10px', color: '#166534', fontWeight: 700, background: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>
                        Envoi Rapports
                      </span>
                    )}
                  </div>

                  {p.telephone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155', marginTop: '2px' }}>
                      <span style={{ color: '#64748b' }}>📞 Téléphone :</span>
                      <a href={`tel:${p.telephone}`} style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                        {p.telephone}
                      </a>
                    </div>
                  )}

                  {(p.adresse || p.ville) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}>
                      <span>📍 Adresse :</span>
                      <span>
                        {p.adresse ? `${p.adresse}, ` : ''}
                        {p.codePostal ? `${p.codePostal} ` : ''}
                        {p.ville || ''}
                      </span>
                    </div>
                  )}

                  {p.siret && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '11.5px' }}>
                      <span>SIRET :</span>
                      <span className="font-mono">{p.siret}</span>
                    </div>
                  )}
                </div>

                {/* Consignes particulières */}
                {p.consignesParticulieres && (
                  <div
                    style={{
                      marginTop: '12px',
                      background: '#f8fafc',
                      borderLeft: '3px solid #00bf63',
                      padding: '8px 12px',
                      borderRadius: '0 8px 8px 0',
                      fontSize: '11.5px',
                      color: '#334155',
                      lineHeight: 1.5,
                    }}
                  >
                    <strong style={{ color: '#0f172a', display: 'block', fontSize: '11px', textTransform: 'uppercase', marginBottom: '2px' }}>
                      Consignes Particulières d'Intervention :
                    </strong>
                    {p.consignesParticulieres}
                  </div>
                )}
              </div>

              {/* Actions Rapides en bas de carte */}
              <div
                style={{
                  paddingTop: '12px',
                  borderTop: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', gap: '6px' }}>
                  {onNewDevisForClient && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '4px 8px' }}
                      onClick={() => onNewDevisForClient(p.nom)}
                    >
                      + Devis
                    </button>
                  )}
                  {onNewIntvForClient && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '4px 8px' }}
                      onClick={() => onNewIntvForClient(p.nom)}
                    >
                      + Intervention
                    </button>
                  )}
                </div>

                {p.email && (
                  <a
                    href={`mailto:${p.email}?subject=ANELEC GROUPE - Suivi Technique`}
                    className="btn btn-sm"
                    style={{
                      fontSize: '11px',
                      padding: '4px 10px',
                      background: '#e6f9f0',
                      color: '#00bf63',
                      border: '1px solid #bbf7d0',
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    ✉️ Écrire
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modale de Création / Modification de Fiche Technique */}
      {editingProfile && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
          onClick={() => setEditingProfile(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '640px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc',
              }}
            >
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  {isCreating
                    ? "Nouvelle Fiche Donneur d'Ordre / Entreprise"
                    : `Fiche Technique • ${editingProfile.nom}`}
                </h2>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                  Renseignez les coordonnées, interlocuteurs et adresses e-mail d'envoi officiel.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProfile(null)}
                className="btn btn-secondary btn-sm"
                style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0 }}
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveProfile} style={{ overflowY: 'auto', padding: '20px 24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '4px', display: 'block' }}>
                    Nom de l'Entreprise / Raison Sociale / Particulier *
                  </label>
                  <input
                    required
                    className="input"
                    placeholder="ex: Presta maintenance, M. Martin..."
                    value={editingProfile.nom || ''}
                    onChange={(e) => setEditingProfile({ ...editingProfile, nom: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '4px', display: 'block' }}>
                    Type de Partenaire
                  </label>
                  <select
                    className="select"
                    value={editingProfile.type || 'DONNEUR_ORDRE'}
                    onChange={(e) => setEditingProfile({ ...editingProfile, type: e.target.value as any })}
                  >
                    <option value="DONNEUR_ORDRE">Donneur d'Ordre B2B</option>
                    <option value="ENTREPRISE">Entreprise</option>
                    <option value="PARTICULIER">Particulier B2C</option>
                    <option value="SOUS_TRAITANT">Sous-traitant</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '4px', display: 'block' }}>
                    Email d'Envoi Officiel des Rapports *
                  </label>
                  <input
                    type="email"
                    className="input"
                    placeholder="ex: travaux@prestamaintenance.fr"
                    value={editingProfile.email || ''}
                    onChange={(e) => setEditingProfile({ ...editingProfile, email: e.target.value })}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'block' }}>
                    Sera pré-rempli automatiquement lors de l'envoi de rapport par email
                  </span>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '4px', display: 'block' }}>
                    Téléphone Direct
                  </label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="ex: 01 42 68 55 00"
                    value={editingProfile.telephone || ''}
                    onChange={(e) => setEditingProfile({ ...editingProfile, telephone: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '4px', display: 'block' }}>
                    Interlocuteur Privilégié / Contact
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="ex: M. Jean Dupont"
                    value={editingProfile.contactNom || ''}
                    onChange={(e) => setEditingProfile({ ...editingProfile, contactNom: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '4px', display: 'block' }}>
                    Fonction / Rôle du contact
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="ex: Responsable Maintenance, Conducteur..."
                    value={editingProfile.contactRole || ''}
                    onChange={(e) => setEditingProfile({ ...editingProfile, contactRole: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '4px', display: 'block' }}>
                    Adresse / Siège / Agence
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="ex: 15 Rue de Berri"
                    value={editingProfile.adresse || ''}
                    onChange={(e) => setEditingProfile({ ...editingProfile, adresse: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '4px', display: 'block' }}>
                    Code Postal
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="ex: 75008"
                    value={editingProfile.codePostal || ''}
                    onChange={(e) => setEditingProfile({ ...editingProfile, codePostal: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '4px', display: 'block' }}>
                    Ville
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="ex: Paris"
                    value={editingProfile.ville || ''}
                    onChange={(e) => setEditingProfile({ ...editingProfile, ville: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '4px', display: 'block' }}>
                  Consignes Particulières d'Intervention & Règles Rapports
                </label>
                <textarea
                  rows={3}
                  className="input"
                  style={{ resize: 'vertical', fontSize: '12.5px', lineHeight: 1.5 }}
                  placeholder="ex: Rapport avec photos Avant/Après obligatoire sous 24h, bon d'attachement signé sur site..."
                  value={editingProfile.consignesParticulieres || ''}
                  onChange={(e) => setEditingProfile({ ...editingProfile, consignesParticulieres: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '4px', display: 'block' }}>
                    SIRET / SIREN
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="ex: 812 345 678 00012"
                    value={editingProfile.siret || ''}
                    onChange={(e) => setEditingProfile({ ...editingProfile, siret: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '4px', display: 'block' }}>
                    Délai de Paiement
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="ex: 30 jours fin de mois"
                    value={editingProfile.delaiPaiement || ''}
                    onChange={(e) => setEditingProfile({ ...editingProfile, delaiPaiement: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '4px', display: 'block' }}>
                    Taux Horaire (€ HT/h)
                  </label>
                  <input
                    type="number"
                    className="input"
                    placeholder="ex: 58"
                    value={editingProfile.tauxHoraireNegocie || ''}
                    onChange={(e) => setEditingProfile({ ...editingProfile, tauxHoraireNegocie: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* Footer Actions */}
              <div
                style={{
                  paddingTop: '14px',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                {!isCreating && editingProfile.id && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                    onClick={() => handleDeleteProfile(editingProfile.id!, editingProfile.nom!)}
                  >
                    🗑️ Supprimer cette fiche
                  </button>
                )}
                <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditingProfile(null)} disabled={isSaving}>
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isSaving}>
                    {isSaving ? 'Enregistrement...' : 'Enregistrer la Fiche Technique'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
