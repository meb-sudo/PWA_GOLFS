import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  IconHome, IconCalendar, IconFlag, IconNews, IconMenu, IconBack,
} from './icons.js';

/** Barre de navigation basse, cinq destinations. */
const tabs = [
  { to: '/', label: 'Accueil', Icon: IconHome, end: true },
  // fresh : repart d un brouillon vierge, sans club preselectionne.
  { to: '/reserver', label: 'Reserver', Icon: IconFlag, end: false, fresh: true },
  { to: '/reservations', label: 'Mes departs', Icon: IconCalendar, end: false },
  { to: '/actualites', label: 'Actualites', Icon: IconNews, end: false },
  { to: '/menu', label: 'Menu', Icon: IconMenu, end: false },
];

export function TabBar() {
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-line)] bg-[var(--color-surface)]/95 pb-safe backdrop-blur-lg"
    >
      <ul className="mx-auto flex max-w-lg">
        {tabs.map(({ to, label, Icon, end, fresh }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              state={fresh ? { fresh: true } : undefined}
              className={({ isActive }) => clsx(
                'flex min-h-14 flex-col items-center justify-center gap-1 px-1 pt-1.5 pb-1',
                'text-[0.65rem] font-medium transition-colors',
                isActive ? 'text-[var(--color-brand)]' : 'text-[var(--color-ink-faint)]',
              )}
            >
              {({ isActive }) => (
                <>
                  <span className="relative">
                    <Icon width={22} height={22} strokeWidth={isActive ? 2 : 1.6} />
                    {isActive && (
                      <motion.span
                        layoutId="tab-dot"
                        className="absolute -bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-[var(--color-accent)]"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Conteneur des ecrans a onglets : reserve la place de la barre basse. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg pb-[calc(4.5rem+var(--safe-bottom))]">
      {children}
    </div>
  );
}

/** En-tete des ecrans secondaires, avec retour. */
export function PageHeader({
  title, subtitle, action, onBack,
}: {
  title: string; subtitle?: string; action?: ReactNode; onBack?: () => void;
}) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[var(--color-canvas)]/92 pt-safe backdrop-blur-lg">
      <div className="flex items-center gap-2 px-3 py-3">
        <button
          type="button"
          onClick={onBack ?? (() => navigate(-1))}
          aria-label="Revenir à l’ecran precedent"
          className="grid size-11 shrink-0 place-items-center rounded-full text-[var(--color-ink)] transition-colors active:bg-[var(--color-surface-alt)]"
        >
          <IconBack width={22} height={22} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[1.05rem] font-semibold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="truncate text-xs text-[var(--color-ink-faint)]">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
    </header>
  );
}

/** Barre d actions fixe en bas d un ecran de saisie. */
export function StickyFooter({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-line)] bg-[var(--color-surface)]/95 pb-safe backdrop-blur-lg">
      <div className="mx-auto flex max-w-lg gap-3 px-4 py-3">{children}</div>
    </div>
  );
}

/** Transition d entree commune a tous les ecrans. */
export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
      className={clsx('px-4 py-4', className)}
    >
      {children}
    </motion.main>
  );
}

/**
 * Boite de dialogue centree, pour les confirmations.
 *
 * Distincte de Sheet : une feuille qui monte du bas convient a une liste ou
 * a une saisie, ou le pouce reste en bas de l ecran. Une decision a prendre
 * doit au contraire interrompre la lecture et se placer au centre du regard.
 */
export function Dialog({
  open, onClose, title, children,
}: {
  open: boolean; onClose: () => void; title: string; children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
      <motion.button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/40"
      />
      <motion.div
        role="dialog" aria-modal="true" aria-label={title}
        initial={{ opacity: 0, scale: 0.94, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 460, damping: 34 }}
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-[var(--color-surface)] shadow-xl"
      >
        <div className="px-5 pt-5">
          <h2 className="text-lg leading-tight font-semibold tracking-tight text-balance">
            {title}
          </h2>
        </div>
        <div className="max-h-[70dvh] overflow-y-auto px-5 pt-3 pb-5">{children}</div>
      </motion.div>
    </div>
  );
}

/** Feuille glissante : remplace les fenetres modales WinDev. */
export function Sheet({
  open, onClose, title, children,
}: {
  open: boolean; onClose: () => void; title: string; children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <motion.button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/35"
      />
      <motion.div
        role="dialog" aria-modal="true" aria-label={title}
        initial={{ y: '100%' }} animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 38 }}
        className="relative w-full max-w-lg rounded-t-3xl bg-[var(--color-surface)] pb-safe"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button
            type="button" onClick={onClose}
            className="rounded-full px-3 py-1.5 text-sm text-[var(--color-ink-soft)] active:bg-[var(--color-surface-alt)]"
          >
            Fermer
          </button>
        </div>
        <div className="max-h-[70dvh] overflow-y-auto px-4 py-4">{children}</div>
      </motion.div>
    </div>
  );
}
