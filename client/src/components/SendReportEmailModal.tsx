import React, { useState, useEffect } from 'react';
import { Intervention, ClientProfile, SendReportEmailPayload } from '../lib/api';
import toast from 'react-hot-toast';

interface SendReportEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  intervention: Intervention | null;
  clientProfiles?: ClientProfile[];
  onSendEmail: (payload: SendReportEmailPayload) => Promise<void>;
}

export function SendReportEmailModal({
  isOpen,
  onClose,
  intervention,
  clientProfiles = [],
  onSendEmail,
}: SendReportEmailModalProps) {
  const [toEmail, setToEmail] = useState('');
  const [ccEmail, setCcEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [rapportFinal, setRapportFinal] = useState('');
  const [includePhotos, setIncludePhotos] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!intervention) return;

    // Chercher la fiche technique correspondant au client pour pré-remplir l'email
    const clientName = (intervention.client || '').trim().toLowerCase();
    const matchedProfile = clientProfiles.find(
      (p) => p.nom.trim().toLowerCase() === clientName
    );

    const defaultEmail = matchedProfile?.email || '';
    setToEmail(defaultEmail);
    setCcEmail('');

    const ref = intervention.reference || `INT-${intervention.id}`;
    setSubject(`[RAPPORT TECHNIQUE] ${ref} • ${intervention.client || 'Client'} • ${intervention.chantier}`);

    setCustomMessage(
      `Bonjour,\n\nVeuillez trouver ci-dessous le rapport officiel d'intervention technique réalisé pour vos services par ANELEC GROUPE sur le site ${intervention.chantier}.\n\nRestant à votre entière disposition pour tout renseignement complémentaire.`
    );

    const baseReport =
      intervention.rapportFinal ||
      intervention.compteRendu ||
      (intervention.actionsRealisees && intervention.actionsRealisees.length > 0
        ? `Travaux exécutés :\n${intervention.actionsRealisees.map((a) => `• ${a}`).join('\n')}`
        : 'Intervention terminée avec succès conformément au cahier des charges.');

    setRapportFinal(baseReport);
    setIncludePhotos(Boolean(intervention.photos && intervention.photos.length > 0));
  }, [intervention, clientProfiles]);

  if (!isOpen || !intervention) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toEmail.trim() || !toEmail.includes('@')) {
      toast.error('Veuillez renseigner une adresse email destinataire valide');
      return;
    }

    try {
      setIsSending(true);
      await onSendEmail({
        toEmail: toEmail.trim(),
        ccEmail: ccEmail.trim() || undefined,
        subject: subject.trim(),
        customMessage: customMessage.trim() || undefined,
        rapportFinal: rapportFinal.trim(),
        includePhotos,
      });
      toast.success(`Rapport envoyé par email à ${toEmail.trim()}`);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err.message || "Erreur lors de l'envoi de l'email");
    } finally {
      setIsSending(false);
    }
  };

  const matchedProfile = clientProfiles.find(
    (p) => p.nom.trim().toLowerCase() === (intervention.client || '').trim().toLowerCase()
  );

  return (
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
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, #f8fafc, #ffffff)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#e6f9f0',
                color: '#00bf63',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Envoyer le Rapport par Email
              </h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                Transmission directe au donneur d'ordre ou client depuis l'application
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Info Donneur d'Ordre & Règle Bureau */}
        <div
          style={{
            padding: '12px 24px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, color: '#334155' }}>Donneur d'ordre :</span>
            <span
              style={{
                padding: '2px 8px',
                background: '#e2e8f0',
                borderRadius: '6px',
                fontWeight: 600,
                color: '#0f172a',
              }}
            >
              {intervention.client || 'Client non précisé'}
            </span>
            {matchedProfile?.email ? (
              <span style={{ color: '#00bf63', fontSize: '11px', fontWeight: 600 }}>
                ✓ Email issu de la fiche technique
              </span>
            ) : (
              <span style={{ color: '#d97706', fontSize: '11px' }}>
                ⚠️ Pas d'email pré-enregistré dans la fiche
              </span>
            )}
          </div>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '999px',
              background: '#f1f5f9',
              color: '#475569',
              fontWeight: 600,
            }}
          >
            🛡️ Réservé Équipe Bureau
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '20px 24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '4px', display: 'block' }}>
                Email Destinataire (Client) *
              </label>
              <input
                required
                type="email"
                className="input"
                placeholder="ex: travaux@prestamaintenance.fr"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '4px', display: 'block' }}>
                Email en Copie (CC)
              </label>
              <input
                type="text"
                className="input"
                placeholder="ex: direction@... ou conducteur@..."
                value={ccEmail}
                onChange={(e) => setCcEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '4px', display: 'block' }}>
              Objet de l'e-mail *
            </label>
            <input
              required
              type="text"
              className="input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '4px', display: 'block' }}>
              Message d'accompagnement
            </label>
            <textarea
              rows={3}
              className="input"
              style={{ resize: 'vertical', fontSize: '12.5px', lineHeight: 1.5 }}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
                Compte Rendu / Rapport Final Officiel *
              </label>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Modifiable avant validation et envoi
              </span>
            </div>
            <textarea
              required
              rows={4}
              className="input"
              style={{ resize: 'vertical', fontSize: '12.5px', lineHeight: 1.5, fontFamily: 'inherit' }}
              value={rapportFinal}
              onChange={(e) => setRapportFinal(e.target.value)}
            />
          </div>

          {/* Photos Option */}
          {intervention.photos && intervention.photos.length > 0 && (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px 14px',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 600, color: '#0f172a' }}>
                <input
                  type="checkbox"
                  checked={includePhotos}
                  onChange={(e) => setIncludePhotos(e.target.checked)}
                />
                Inclure la galerie des {intervention.photos.length} photos prises sur site dans l'e-mail
              </label>
              {includePhotos && (
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginTop: '10px', paddingBottom: '4px' }}>
                  {intervention.photos.map((p, i) => (
                    <div key={p.id || i} style={{ width: '64px', height: '64px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #cbd5e1', flexShrink: 0 }}>
                      <img src={p.url} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions List preview */}
          {intervention.actionsRealisees && intervention.actionsRealisees.length > 0 && (
            <div style={{ fontSize: '12px', color: '#166534', background: '#f0fdf4', padding: '10px 14px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              <strong>✓ Opérations déclarées :</strong> {intervention.actionsRealisees.join(' • ')}
            </div>
          )}

          {/* Footer Actions */}
          <div
            style={{
              paddingTop: '12px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
            }}
          >
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSending}>
              Annuler
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSending}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {isSending ? (
                <>
                  <span className="spinner" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  Confirmer et Envoyer le Rapport par Email
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
