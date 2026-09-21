import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui';
import { useT } from '@/i18n';

/**
 * Bandeaux de service : mise a jour disponible et perte de reseau.
 *
 * Mise a jour PWA : une nouvelle version publiee doit etre appliquee tout de
 * suite. On la detecte automatiquement, meme quand l app reste ouverte
 * (verification periodique + au retour sur l app), et on impose la mise a jour
 * par une fenetre bloquante -- pas de "Plus tard", pour eviter qu un ancien
 * front continue de tourner contre une API qui a evolue.
 */
export function UpdatePrompt() {
  const t = useT();
  const registration = useRef<ServiceWorkerRegistration | undefined>(undefined);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, r) {
      registration.current = r;
      // Verifie regulierement s il existe une nouvelle version : l utilisateur
      // n a pas besoin de rafraichir, le popup apparaitra de lui-meme.
      if (r) {
        setInterval(() => { r.update().catch(() => {}); }, 60_000);
      }
    },
  });

  // Verifie aussi des que l app revient au premier plan (reouverture, retour
  // depuis une autre appli) : la mise a jour est proposee sans delai.
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === 'visible') {
        registration.current?.update().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);

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
          {t('update.offline')}
        </motion.div>
      )}

      {needRefresh && (
        // Fenetre bloquante : fond flou, aucune action pour reporter. L app
        // ne repart qu une fois la nouvelle version installee.
        <motion.div
          key="update"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-6 backdrop-blur-md"
          role="alertdialog"
          aria-modal="true"
          aria-label={t('update.requiredAria')}
        >
          <motion.div
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            className="w-full max-w-sm rounded-3xl bg-[var(--color-surface)] p-6 text-center shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
          >
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--color-accent)]/22">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4h-4"
                  stroke="var(--color-brand)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <h2 className="mt-4 text-lg font-semibold">{t('update.availableTitle')}</h2>
            <p className="mt-1.5 text-sm text-[var(--color-ink-soft)]">
              {t('update.availableBody')}
            </p>
            <Button
              variant="accent"
              full
              className="mt-5"
              onClick={() => updateServiceWorker(true)}
            >
              {t('update.updateButton')}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
