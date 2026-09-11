import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui';

/**
 * Bandeaux de service : mise a jour disponible et perte de reseau.
 *
 * Une PWA ne se met pas a jour par le store : on previent l utilisateur
 * plutot que de recharger sous ses doigts au milieu d une reservation.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });

  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          key="offline"
          role="status"
          initial={{ y: -60 }} animate={{ y: 0 }} exit={{ y: -60 }}
          className="fixed inset-x-0 top-0 z-50 bg-[var(--color-ink)] px-4 py-2 pt-safe text-center text-sm text-white"
        >
          Hors ligne · les donnees affichees peuvent dater
        </motion.div>
      )}

      {needRefresh && (
        <motion.div
          key="update"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed inset-x-3 bottom-[calc(4.75rem+var(--safe-bottom))] z-50 flex items-center gap-3 rounded-2xl bg-[var(--color-ink)] p-3 pl-4 text-white shadow-lg"
        >
          <p className="flex-1 text-sm">Une nouvelle version est disponible.</p>
          <Button variant="accent" onClick={() => updateServiceWorker(true)}>
            Mettre a jour
          </Button>
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            aria-label="Plus tard"
            className="rounded-full px-2 py-1 text-sm text-white/60"
          >
            Plus tard
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
