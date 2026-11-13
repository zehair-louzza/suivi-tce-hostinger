import { QueryClient } from '@tanstack/react-query';

/**
 * Client de données partagé. Il est vidé dès que l'identité connectée change (déconnexion, autre
 * compte, autre entreprise) : voir authStore. Ainsi aucune donnée d'une entreprise ne peut
 * réapparaître chez un utilisateur d'une autre entreprise qui se connecte ensuite sur le même appareil.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Les changements d'un autre intervenant doivent se voir vite : données périmées
      // au bout d'une minute, et rechargées quand on revient sur l'onglet. Le temps réel
      // (lib/realtime) fait le reste instantanément.
      staleTime: 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});
