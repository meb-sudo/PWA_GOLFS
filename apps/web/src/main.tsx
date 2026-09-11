import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouter } from './app/router';
import { UpdatePrompt } from './app/UpdatePrompt';
import { ApiError } from './lib/api';
import { applyTheme, defaultTheme } from './theme/groups';
import './theme/index.css';
// Capte l evenement d installation le plus tot possible.
import './lib/install';

/**
 * Cache et reprise reseau.
 *
 * Remplace la base HFSQL locale de l application WinDev : les donnees
 * restent consultables quelques minutes hors ligne, et les requetes
 * reprennent d elles-memes au retour du reseau.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        // Inutile de reessayer une session expiree ou une saisie refusee.
        if (error instanceof ApiError) {
          if (error.isUnauthenticated || error.status === 400 || error.status === 409) {
            return false;
          }
        }
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
    mutations: { retry: false },
  },
});

// Theme par defaut avant la reponse du BFF, pour eviter un flash de couleur.
applyTheme(defaultTheme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppRouter />
      <UpdatePrompt />
    </QueryClientProvider>
  </StrictMode>,
);
