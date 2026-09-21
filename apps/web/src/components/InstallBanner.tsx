import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useInstall, promptInstall, isMobileDevice } from '@/lib/install';
import { currentGroupHeader } from '@/lib/group';
import { Sheet } from '@/components/layout';
import { Button } from '@/components/ui';
import { IconDownload, IconClose, IconCheck } from '@/components/icons';
import { useT } from '@/i18n';

/** Icone du groupe courant, pour personnaliser l invite d installation. */
function groupIcon(): string | null {
  const g = currentGroupHeader();
  return g ? `/icons/groups/${g}-192.png` : null;
}

/**
 * Guide d installation iOS (aucun prompt natif possible chez Apple).
 * Explique : Partager -> Sur l ecran d accueil.
 */
function IosInstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t('install.title')}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--color-ink-soft)]">
          {t('install.iosIntro')}
        </p>
        <ol className="flex flex-col gap-3">
          <li className="flex items-start gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--color-accent)] text-sm font-semibold text-[var(--color-accent-ink)]">1</span>
            <p className="text-sm">
              {t('install.iosStep1a')} <span className="font-medium">{t('install.share')}</span>{' '}
              <span aria-hidden>􀈂</span> {t('install.iosStep1b')}
            </p>
          </li>
          <li className="flex items-start gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--color-accent)] text-sm font-semibold text-[var(--color-accent-ink)]">2</span>
            <p className="text-sm">
              {t('install.iosStep2a')} <span className="font-medium">{t('install.iosOnHome')}</span>,
              {' '}{t('install.iosStep2b')} <span className="font-medium">{t('install.iosAdd')}</span>.
            </p>
          </li>
        </ol>
        <Button full onClick={onClose} icon={<IconCheck width={18} height={18} />}>
          {t('install.gotIt')}
        </Button>
      </div>
    </Sheet>
  );
}

/** Lance l installation : prompt natif Android, ou guide iOS. */
function useInstallFlow() {
  const { canInstall, ios, hasNativePrompt } = useInstall();
  const [iosOpen, setIosOpen] = useState(false);

  async function trigger(): Promise<void> {
    if (hasNativePrompt) {
      await promptInstall();
    } else if (ios) {
      setIosOpen(true);
    }
  }

  return { canInstall, iosOpen, setIosOpen, trigger };
}

/**
 * Rejet memorise PAR GROUPE : fermer l invite pour un groupe ne doit pas la
 * cacher pour un autre. Ainsi, choisir un groupe non installe reaffiche le
 * popup d installation, meme si on l a deja ferme pour un groupe precedent.
 */
const DISMISS_PREFIX = 'golf-install-hint';
function dismissKey(): string {
  const g = currentGroupHeader();
  return g ? `${DISMISS_PREFIX}-${g}` : DISMISS_PREFIX;
}
function dismissed(): boolean {
  try { return sessionStorage.getItem(dismissKey()) === '1'; } catch { return false; }
}
function markDismissed(): void {
  try { sessionStorage.setItem(dismissKey(), '1'); } catch { /* ignore */ }
}

/**
 * Banniere d invitation a installer l app (bas d ecran, animee).
 * Ne s affiche jamais sur le selecteur de groupe (elle vit dans l app, montee
 * apres qu un groupe est choisi) ni si l app est deja installee. Dismissible.
 */
export function InstallBanner() {
  const t = useT();
  const { canInstall, iosOpen, setIosOpen, trigger } = useInstallFlow();
  const [hidden, setHidden] = useState(dismissed());
  const icon = groupIcon();

  const show = canInstall && !hidden;
  function close(): void { setHidden(true); markDismissed(); }

  return (
    <>
      <AnimatePresence>
        {show && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            role="dialog"
            aria-modal="true"
            aria-label={t('install.title')}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-ink)]/45 px-6 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-3xl bg-[var(--color-surface)] p-6 text-center shadow-[0_24px_70px_rgba(19,26,21,0.45)]"
            >
              <button
                type="button"
                aria-label={t('common.close')}
                onClick={close}
                className="absolute right-3 top-3 rounded-full p-1.5 text-[var(--color-ink-faint)] active:bg-[var(--color-surface-alt)]"
              >
                <IconClose width={18} height={18} />
              </button>

              <span className="mx-auto mb-4 grid size-20 place-items-center overflow-hidden rounded-2xl bg-[var(--color-surface-alt)] shadow-sm">
                {icon
                  ? <img src={icon} alt="" className="size-20 object-cover" />
                  : <IconDownload width={30} height={30} />}
              </span>

              <h2 className="text-lg font-semibold">{t('install.title')}</h2>
              <p className="mx-auto mt-1.5 max-w-[30ch] text-sm text-[var(--color-ink-soft)]">
                {isMobileDevice() ? t('install.accessMobile') : t('install.accessDesktop')}
              </p>

              <div className="mt-5 flex flex-col gap-2">
                <Button
                  full
                  size="lg"
                  onClick={() => { void trigger(); }}
                  icon={<IconDownload width={18} height={18} />}
                >
                  {t('install.install')}
                </Button>
                <button
                  type="button"
                  onClick={close}
                  className="py-1 text-sm font-medium text-[var(--color-ink-faint)]"
                >
                  {t('install.later')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <IosInstallSheet open={iosOpen} onClose={() => setIosOpen(false)} />
    </>
  );
}

/**
 * Bouton « Installer l’application » pour le menu.
 * Rendu uniquement si l installation est possible (sinon `null`).
 */
export function InstallMenuButton() {
  const t = useT();
  const { canInstall, iosOpen, setIosOpen, trigger } = useInstallFlow();
  if (!canInstall) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => { void trigger(); }}
        className="flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-left active:scale-[0.99]"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--color-accent)]/18 text-[var(--color-brand)]">
          <IconDownload width={19} height={19} />
        </span>
        <span className="flex-1 font-medium">{t('install.title')}</span>
      </button>
      <IosInstallSheet open={iosOpen} onClose={() => setIosOpen(false)} />
    </>
  );
}
