import { useState } from 'react';

interface LegalTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
  defaultTab?: 'cgu' | 'rgpd' | 'mentions';
}

export function LegalTermsModal({
  isOpen,
  onClose,
  onAccept,
  defaultTab = 'cgu',
}: LegalTermsModalProps) {
  const [tab, setTab] = useState<'cgu' | 'rgpd' | 'mentions'>(defaultTab);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '780px',
          maxHeight: '90vh',
          background: 'var(--bg-surface, #ffffff)',
          color: 'var(--text-primary, #0f172a)',
          borderRadius: '18px',
          border: '1px solid var(--border-default, #e2e8f0)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* EN-TÊTE MODALE */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-card, #f8fafc)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>§</span>
            <div>
              <h2 style={{ fontSize: '16.5px', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
                Cadre Juridique, CGU & Protection des Données (RGPD)
              </h2>
              <p style={{ fontSize: '11.5px', color: 'var(--text-muted, #64748b)', margin: '2px 0 0 0' }}>
                Plateforme ANELEC TCE • Conforme Règlement Général sur la Protection des Données (UE 2016/679)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '22px',
              cursor: 'pointer',
              color: 'var(--text-muted, #64748b)',
              padding: '4px 8px',
              borderRadius: '6px',
            }}
            title="Fermer"
          >
            ✕
          </button>
        </div>

        {/* ONGLETS NAVIGATION */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
            padding: '8px 24px 0 24px',
            background: 'var(--bg-surface, #ffffff)',
            gap: '8px',
          }}
        >
          {[
            { id: 'cgu', label: 'Conditions Générales (CGU)' },
            { id: 'rgpd', label: 'Politique RGPD & Hébergement' },
            { id: 'mentions', label: 'Mentions Légales & Hébergeurs' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as any)}
              style={{
                padding: '10px 14px',
                border: 'none',
                background: 'transparent',
                borderBottom: tab === t.id ? '2.5px solid var(--accent-primary, #00bf63)' : '2.5px solid transparent',
                color: tab === t.id ? 'var(--accent-primary, #00bf63)' : 'var(--text-secondary, #64748b)',
                fontWeight: tab === t.id ? 700 : 500,
                fontSize: '12.5px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* CONTENU TEXTE DÉFILANT */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            fontSize: '13px',
            lineHeight: 1.65,
            color: 'var(--text-secondary, #334155)',
            maxHeight: 'calc(90vh - 180px)',
          }}
        >
          {tab === 'cgu' && (
            <div>
              <h3 style={{ fontSize: '15px', color: 'var(--text-primary, #0f172a)', marginBottom: '8px' }}>
                1. Objet & Rôle Technique de la Plateforme
              </h3>
              <p>
                La plateforme <strong>ANELEC TCE</strong> est une solution logicielle SaaS de pilotage commercial et opérationnel réservée exclusivement aux entreprises du bâtiment, électriciens et artisans Tous Corps d'État (TCE). Elle fournit des outils numériques pour la gestion des devis, des interventions, du planning et des pointages d'équipes terrain.
              </p>

              <h3 style={{ fontSize: '15px', color: 'var(--text-primary, #0f172a)', marginTop: '16px', marginBottom: '8px' }}>
                2. Qualité de Prestataire Technique Neutre & Absence d'Ingérence
              </h3>
              <p>
                L'éditeur de la plateforme (<strong>ANELEC GROUPE</strong>) ainsi que le <strong>concepteur et architecte logiciel de l'application</strong> interviennent exclusivement en qualité de <strong>fournisseurs d'infrastructure et de moyens techniques</strong>. Ils n'interviennent à aucun moment dans la relation commerciale, contractuelle, juridique ou financière liant l'entreprise utilisatrice (le client) à ses propres clients finaux, sous-traitants ou donneurs d'ordres.
              </p>

              <h3 style={{ fontSize: '15px', color: 'var(--text-primary, #0f172a)', marginTop: '16px', marginBottom: '8px' }}>
                3. Responsabilité Exclusive de l'Entreprise Utilisatrice (Tenant)
              </h3>
              <p>
                Chaque entreprise cliente est seule et unique responsable légale de :
              </p>
              <ul style={{ paddingLeft: '20px', marginTop: '6px', marginBottom: '6px' }}>
                <li>L'exactitude, la véracité et la licéité des devis, mémoires techniques, factures et taux horaires appliqués.</li>
                <li>La bonne exécution technique des interventions, travaux et chantiers sur le terrain.</li>
                <li>Le respect des normes de sécurité électrique (NFC 15-100), du code du travail, des règles de décennale et des obligations d'assurances professionnelles.</li>
                <li>La confidentialité absolue de ses identifiants et mots de passe administrateurs.</li>
              </ul>

              <h3 style={{ fontSize: '15px', color: 'var(--text-primary, #0f172a)', marginTop: '16px', marginBottom: '8px' }}>
                4. Limitation Totale de Responsabilité
              </h3>
              <p>
                En aucun cas l'éditeur de la plateforme ni son concepteur ne pourront être tenus responsables des dommages indirects, des pertes de profits, des pertes de marchés, des interruptions d'activité, des malfaçons sur les chantiers ou des litiges clients survenus dans le cadre de l'activité de l'entreprise utilisatrice. Le service est fourni en l'état avec une obligation de moyens techniques.
              </p>

              <h3 style={{ fontSize: '15px', color: 'var(--text-primary, #0f172a)', marginTop: '16px', marginBottom: '8px' }}>
                5. Propriété Intellectuelle
              </h3>
              <p>
                L'ensemble du code source, de la structure logicielle, de l'architecture de conversion liée, des algorithmes de dispatching, des interfaces graphiques, des logos et des marques associées demeure la propriété intellectuelle exclusive et inaliénable de leur créateur et d'<strong>ANELEC GROUPE</strong>. Toute rétro-ingénierie, décompilation, copie ou exploitation commerciale non autorisée du logiciel est formellement interdite.
              </p>
            </div>
          )}

          {tab === 'rgpd' && (
            <div>
              <div
                style={{
                  background: 'rgba(0, 191, 99, 0.08)',
                  border: '1px solid rgba(0, 191, 99, 0.25)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '16px',
                  fontSize: '12.5px',
                  color: 'var(--text-primary, #0f172a)',
                }}
              >
                <strong>Principe Fondamental d'Absence de Traitement des Données Métier :</strong>
                <br />
                Notre entreprise et le créateur de cette solution logicielle <strong>NE TRAITENT, N'EXPLOITENT, NE CONSULTENT, NE REVENDENT ET NE PROFILENT AUCUNE DONNÉE MÉTIER</strong> saisie sur la plateforme par les entreprises utilisatrices. Toutes les données appartiennent exclusivement et strictement à chaque entreprise cliente (tenant).
              </div>

              <h3 style={{ fontSize: '15px', color: 'var(--text-primary, #0f172a)', marginBottom: '8px' }}>
                1. Rôles au sens du RGPD (Règlement UE 2016/679)
              </h3>
              <p>
                Conformément à la réglementation européenne sur la protection des données personnelles :
              </p>
              <ul style={{ paddingLeft: '20px', marginTop: '6px', marginBottom: '6px' }}>
                <li>
                  <strong>L'Entreprise Utilisatrice (Tenant) est Responsable de Traitement</strong> pour toutes les données personnelles de ses propres clients, contacts, collaborateurs et chantiers qu'elle consigne dans son espace privé.
                </li>
                <li>
                  <strong>La plateforme ANELEC TCE agit exclusivement en tant que Sous-Traitant Technique</strong> (au sens de l'Article 28 du RGPD), fournissant le conteneur logiciel et les moyens de stockage sécurisés sans exploitation des contenus.
                </li>
              </ul>

              <h3 style={{ fontSize: '15px', color: 'var(--text-primary, #0f172a)', marginTop: '16px', marginBottom: '8px' }}>
                2. Hébergement Sécurisé des Données (Supabase & Hostinger)
              </h3>
              <p>
                L'ensemble de l'infrastructure est localisée et protégée selon les standards européens les plus stricts :
              </p>
              <ul style={{ paddingLeft: '20px', marginTop: '6px', marginBottom: '6px' }}>
                <li>
                  <strong>Base de données relationnelle PostgreSQL :</strong> Hébergée chez <strong>Supabase Inc.</strong> sur des serveurs situés dans l'<strong>Union Européenne / France</strong> (région eu-west / Paris). Les données sont protégées par un chiffrement complet des disques au repos (AES-256) et en transit (TLS 1.3/HTTPS).
                </li>
                <li>
                  <strong>Serveur d'application et Web :</strong> Hébergé chez <strong>Hostinger International Ltd.</strong> sur des serveurs localisés en <strong>France / Union Européenne</strong>, certifiés conformes au RGPD avec pare-feu actif, protection anti-DDoS et sauvegardes redondées.
                </li>
              </ul>

              <h3 style={{ fontSize: '15px', color: 'var(--text-primary, #0f172a)', marginTop: '16px', marginBottom: '8px' }}>
                3. Cloisonnement Hermétique Multi-Tenant
              </h3>
              <p>
                L'architecture logicielle applique une isolation stricte par identifiant d'entreprise (<code style={{ background: 'rgba(0,0,0,0.06)', padding: '2px 5px', borderRadius: '4px' }}>companyId</code>). Les devis, chantiers, factures, pointages horaires et fichiers clients d'une société ne peuvent en aucun cas être consultés, indexés ou interceptés par un autre tenant.
              </p>

              <h3 style={{ fontSize: '15px', color: 'var(--text-primary, #0f172a)', marginTop: '16px', marginBottom: '8px' }}>
                4. Droits des Utilisateurs (Articles 15 à 22 RGPD)
              </h3>
              <p>
                Chaque utilisateur dispose d'un droit d'accès, de rectification, de portabilité, de limitation et d'effacement (« droit à l'oubli ») de ses informations de connexion. Ces droits s'exercent directement par demande électronique auprès du délégué à la protection des données à l'adresse légale de contact.
              </p>
            </div>
          )}

          {tab === 'mentions' && (
            <div>
              <h3 style={{ fontSize: '15px', color: 'var(--text-primary, #0f172a)', marginBottom: '8px' }}>
                1. Éditeur de la Plateforme
              </h3>
              <p>
                <strong>Société éditrice :</strong> ANELEC GROUPE<br />
                <strong>Forme juridique :</strong> Société par actions simplifiée (SAS)<br />
                <strong>Numéro SIREN :</strong> 933 108 607<br />
                <strong>Numéro SIRET (Siège social) :</strong> 933 108 607 00021<br />
                <strong>Numéro de TVA intracommunautaire :</strong> FR20933108607<br />
                <strong>Date de création :</strong> 8 novembre 2024<br />
                <strong>Activité principale (Code NAF / APE) :</strong> 4120B — Construction d'autres bâtiments<br />
                <strong>Siège social :</strong> 9 RUE DES COLONNES, 75002 PARIS<br />
                <strong>Dirigeante :</strong> Najoua Boughrara<br />
                <strong>Contact électronique :</strong> contact@anelecgroupe.com
              </p>

              <h3 style={{ fontSize: '15px', color: 'var(--text-primary, #0f172a)', marginTop: '16px', marginBottom: '8px' }}>
                2. Conception, Architecture & Développement Logiciel
              </h3>
              <p>
                <strong>Auteur & Concepteur :</strong> Zehair Louzza<br />
                <strong>Droits réservés :</strong> Tous droits d'auteur, brevets d'application, designs et propriété industrielle réservés © 2026.
              </p>

              <h3 style={{ fontSize: '15px', color: 'var(--text-primary, #0f172a)', marginTop: '16px', marginBottom: '8px' }}>
                3. Hébergement des Données & Infrastructure
              </h3>
              <p>
                <strong>Hébergeur de la base de données :</strong><br />
                Supabase Inc., 970 Toa Payoh North #07-04, Singapore 318992.<br />
                <em>Infrastructure serveur :</em> PostgreSQL infogéré, localisé en datacenter Union Européenne / France (région certifiée RGPD).
              </p>
              <p style={{ marginTop: '10px' }}>
                <strong>Hébergeur web & applicatif :</strong><br />
                Hostinger International Ltd., 61 Lordou Vironos Street, 6023 Larnaca, Chypre.<br />
                <em>Datacenters applicatifs :</em> France / Union Européenne, avec certificats de sécurité SSL/TLS et pare-feu applicatif Cloud.
              </p>
            </div>
          )}
        </div>

        {/* PIED DE MODALE */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle, #f1f5f9)',
            background: 'var(--bg-card, #f8fafc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #64748b)' }}>
            Document juridique certifié • Version en vigueur : Novembre 2026
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {onAccept && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  onAccept();
                  onClose();
                }}
                style={{
                  padding: '8px 16px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                }}
              >
                J'accepte les CGU & le RGPD
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                fontSize: '12.5px',
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
