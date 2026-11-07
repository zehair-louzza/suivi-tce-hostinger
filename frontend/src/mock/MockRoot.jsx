import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { DIR_BY_ID } from '../data/directions';
import { MockCtx, ToastProvider, useIsMobile } from './ui';
import { Shell } from './Shell';
import { CommandPalette, ExcelModal } from './Overlays';
import Login from './screens/Login';
import Dashboard from './screens/Dashboard';
import Planning from './screens/Planning';
import Devis from './screens/Devis';
import Interventions from './screens/Interventions';
import Carte from './screens/Carte';
import Facturation from './screens/Facturation';
import Comptabilite from './screens/Comptabilite';
import DonneursOrdre from './screens/DonneursOrdre';
import Parametres from './screens/Parametres';
import Utilisateurs from './screens/Utilisateurs';
import Terrain from './screens/Terrain';
import Vitrine from './screens/Vitrine';

const SCREENS = {
  connexion: Login,
  'tableau-de-bord': Dashboard,
  planning: Planning,
  devis: Devis,
  interventions: Interventions,
  carte: Carte,
  facturation: Facturation,
  comptabilite: Comptabilite,
  'donneurs-ordre': DonneursOrdre,
  parametres: Parametres,
  utilisateurs: Utilisateurs,
  terrain: Terrain,
  vitrine: Vitrine,
};
const PUBLIC = ['connexion', 'vitrine'];

export default function MockRoot() {
  const { dir: dirId, screen: rawScreen } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const dir = DIR_BY_ID[dirId] || DIR_BY_ID.atlas;
  const screen = SCREENS[rawScreen] ? rawScreen : 'tableau-de-bord';
  const modal = sp.get('modal');
  const isMobile = useIsMobile();
  const [excelOpen, setExcelOpen] = useState(modal === 'excel');
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-dir', dir.id);
    document.body.classList.add('m-body');
    document.title = `${dir.name} — maquette`;
    try { window.parent.postMessage({ type: 'anelec-mock-nav', dir: dir.id, screen }, '*'); } catch { /* hors iframe */ }
    return () => { document.documentElement.removeAttribute('data-dir'); document.body.classList.remove('m-body'); };
  }, [dir.id, screen, dir.name]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmdOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = useCallback((id, query = '') => navigate(`/m/${dir.id}/${id}${query}`), [navigate, dir.id]);
  const ctx = useMemo(() => ({
    dir, screen, isMobile, go, modal,
    openExcel: () => setExcelOpen(true),
    openCommand: () => setCmdOpen(true),
  }), [dir, screen, isMobile, go, modal]);

  const Screen = SCREENS[screen];
  const isPublic = PUBLIC.includes(screen);
  const bareMobileTech = screen === 'terrain' && isMobile;

  return (
    <MockCtx.Provider value={ctx}>
      <ToastProvider>
        <div className={`m-root m-root--${dir.id}`} data-testid={`mock-root-${dir.id}`}>
          {isPublic || bareMobileTech ? (
            <Screen key={screen} />
          ) : (
            <Shell screen={screen}>
              <Screen key={screen} />
            </Shell>
          )}
          <ExcelModal open={excelOpen} onClose={() => setExcelOpen(false)} />
          <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
        </div>
      </ToastProvider>
    </MockCtx.Provider>
  );
}
