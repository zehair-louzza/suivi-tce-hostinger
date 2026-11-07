import React, { useState } from 'react';
import { FileText, CalendarRange, ShieldCheck, Eye, EyeOff, MailCheck, ArrowRight, Smartphone, Building2, Lock, Mail, User, Hash } from 'lucide-react';
import { useMock, useToast, Logo, Btn, Field, Input, Checkbox, Segmented } from '../ui';
import { GoogleIcon } from '../Overlays';

export default function Login() {
  const { dir, go } = useMock();
  const toast = useToast();
  const [tab, setTab] = useState('login');
  const [show, setShow] = useState(false);
  const [cgu, setCgu] = useState(false);
  const [done, setDone] = useState(false);
  const [email, setEmail] = useState('zehair@anelecgroupe.com');
  const [siret, setSiret] = useState('933108607');
  const siretOk = /^\d{9}$|^\d{14}$/.test(siret.replace(/\s/g, ''));
  const whiteLogo = ['atlas', 'craft', 'signal'].includes(dir.id);

  return (
    <div className="m-auth" data-testid="mock-auth">
      <section className="m-auth-brand">
        <div className="m-auth-brand-inner">
          <Logo variant={whiteLogo ? 'white' : 'color'} />
          <span className="m-auth-eyebrow">Plateforme Tout Corps d’État</span>
          <h2 className="m-auth-headline">Devis, planning et interventions, enfin réunis.</h2>
          <p className="m-auth-lead">Du chiffrage à la facture, pilotez vos chantiers et vos techniciens en temps réel — au bureau comme sur le terrain.</p>
          <ul className="m-auth-points">
            <li><span className="m-auth-ic"><FileText size={18} /></span><div><strong>Devis → intervention en 1 clic</strong><small>Sans ressaisie ni perte d’historique</small></div></li>
            <li><span className="m-auth-ic"><CalendarRange size={18} /></span><div><strong>Planning et tournées optimisées</strong><small>Affectation selon les compétences</small></div></li>
            <li><span className="m-auth-ic"><ShieldCheck size={18} /></span><div><strong>Données hébergées en France</strong><small>Conforme RGPD, cloisonnées par entreprise</small></div></li>
          </ul>
          <div className="m-auth-foot">© ANELEC GROUPE · 9 rue des Colonnes, 75002 Paris</div>
        </div>
      </section>

      <section className="m-auth-panel">
        <div className="m-auth-card" data-testid="mock-auth-card">
          <Segmented
            testid="mock-auth-tabs"
            value={tab}
            onChange={(t) => { setTab(t); setDone(false); }}
            options={[{ id: 'login', label: 'Se connecter' }, { id: 'register', label: 'Créer un espace entreprise' }]}
          />

          {tab === 'login' && (
            <form className="m-auth-form" onSubmit={(e) => { e.preventDefault(); go('tableau-de-bord'); }}>
              <div className="m-auth-titles">
                <h1>Connexion à votre espace</h1>
                <p>Accédez au pilotage de vos devis, interventions et équipes.</p>
              </div>
              <button type="button" className="m-btn m-btn--google m-btn--md m-btn--block" onClick={() => go('tableau-de-bord')} data-testid="mock-auth-google">
                <GoogleIcon /> <span>Continuer avec Google</span>
              </button>
              <div className="m-divider"><span>ou avec votre e-mail</span></div>
              <Field label="Adresse e-mail professionnelle">
                <Input icon={Mail} type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="mock-auth-email" />
              </Field>
              <Field label="Mot de passe">
                <div className="m-input-row">
                  <Input icon={Lock} type={show ? 'text' : 'password'} defaultValue="motdepasse" data-testid="mock-auth-password" />
                  <button type="button" className="m-input-eye" onClick={() => setShow((s) => !s)} aria-label="Afficher le mot de passe" data-testid="mock-auth-toggle-password">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </Field>
              <div className="m-auth-row">
                <Checkbox checked label="Rester connecté" onChange={() => {}} testid="mock-auth-remember" />
                <button type="button" className="m-link" onClick={() => toast('Lien de réinitialisation envoyé', 'info')} data-testid="mock-auth-forgot">Mot de passe oublié ?</button>
              </div>
              <Btn variant="primary" size="lg" block type="submit" iconRight={ArrowRight} data-testid="mock-auth-submit" onClick={() => go('tableau-de-bord')}>Se connecter</Btn>
              <div className="m-auth-help">
                <Smartphone size={15} />
                <span>Technicien ? Installez l’application terrain depuis cette page sur votre téléphone.</span>
              </div>
              <button type="button" className="m-link m-auth-discover" onClick={() => go('vitrine')} data-testid="mock-auth-discover">Découvrir la plateforme et la vidéo de démonstration <ArrowRight size={14} /></button>
            </form>
          )}

          {tab === 'register' && !done && (
            <form className="m-auth-form" onSubmit={(e) => { e.preventDefault(); if (cgu && siretOk) setDone(true); }}>
              <div className="m-auth-titles">
                <h1>Créez votre espace entreprise</h1>
                <p>Moins d’une minute. Vos données restent isolées de celles des autres entreprises.</p>
              </div>
              <button type="button" className="m-btn m-btn--google m-btn--md m-btn--block" onClick={() => toast('Nom et e-mail pré-remplis depuis Google', 'info')} data-testid="mock-register-google">
                <GoogleIcon /> <span>Pré-remplir avec Google</span>
              </button>
              <div className="m-grid-2">
                <Field label="Nom de l’entreprise" required><Input icon={Building2} defaultValue="ANELEC GROUPE" data-testid="mock-register-company" /></Field>
                <Field label="N° SIRET ou SIREN" required hint={siretOk ? 'Format valide' : '9 chiffres (SIREN) ou 14 (SIRET)'}>
                  <Input icon={Hash} value={siret} onChange={(e) => setSiret(e.target.value)} className={siretOk ? 'is-valid' : 'is-invalid'} data-testid="mock-register-siret" />
                </Field>
              </div>
              <div className="m-grid-2">
                <Field label="Nom et prénom du responsable" required><Input icon={User} defaultValue="Zehair Louzza" data-testid="mock-register-name" /></Field>
                <Field label="E-mail professionnel" required><Input icon={Mail} defaultValue="zehair@anelecgroupe.com" data-testid="mock-register-email" /></Field>
              </div>
              <Field label="Mot de passe" required hint="8 caractères minimum"><Input icon={Lock} type="password" defaultValue="motdepasse" data-testid="mock-register-password" /></Field>
              <Checkbox checked={cgu} onChange={setCgu} testid="mock-register-cgu" label="J’accepte les conditions générales d’utilisation et la politique de confidentialité (RGPD)." />
              <Btn variant="primary" size="lg" block type="submit" disabled={!cgu || !siretOk} data-testid="mock-register-submit" onClick={() => { if (cgu && siretOk) setDone(true); }}>Créer mon espace entreprise</Btn>
            </form>
          )}

          {tab === 'register' && done && (
            <div className="m-auth-success" data-testid="mock-register-success">
              <span className="m-auth-success-ic"><MailCheck size={26} /></span>
              <h1>Vérifiez votre boîte mail</h1>
              <p>Un lien d’activation a été envoyé à <strong>zehair@anelecgroupe.com</strong>. Cliquez dessus pour activer votre espace ANELEC GROUPE.</p>
              <ol className="m-steps">
                <li className="is-done">Espace créé et référentiels initialisés</li>
                <li className="is-current">Activation par e-mail</li>
                <li>Première connexion</li>
              </ol>
              <div className="m-auth-success-actions">
                <Btn onClick={() => toast('E-mail de confirmation renvoyé', 'info')} data-testid="mock-register-resend">Renvoyer l’e-mail</Btn>
                <Btn variant="primary" iconRight={ArrowRight} onClick={() => { setTab('login'); setDone(false); }} data-testid="mock-register-goto-login">J’ai activé mon espace</Btn>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
