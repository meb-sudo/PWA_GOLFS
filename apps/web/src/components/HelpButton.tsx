import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet } from '@/components/layout';
import { IconChevron } from '@/components/icons';

/**
 * Bouton d aide flottant + feuille d aide (FAQ).
 *
 * Remplace l ancien assistant : uniquement de l aide statique (comment
 * reserver, annuler, installer), sans IA ni appels API.
 */
export function HelpButton() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  function go(to: string): void {
    setOpen(false);
    navigate(to);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Aide"
        className="fixed right-4 bottom-[calc(5rem+var(--safe-bottom))] z-30 flex items-center gap-2 rounded-full bg-[var(--color-brand)] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(19,26,21,0.28)] active:scale-[0.97]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M9.5 9.2a2.5 2.5 0 0 1 4.8.9c0 1.7-2.3 2-2.3 3.4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="12" cy="17" r="1" fill="currentColor" />
        </svg>
        Aide
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Aide">
        <div className="flex flex-col gap-4">
          <HelpItem
            title="Comment réserver un départ ?"
            text="Depuis l’accueil, « Nouvelle réservation » : choisissez le club, la date, le nombre de joueurs, puis un créneau."
            action="Réserver maintenant"
            onAction={() => go('/reserver')}
          />
          <HelpItem
            title="Comment annuler ?"
            text="Ouvrez « Mes réservations », touchez le départ concerné, puis « Annuler » (si le club l’autorise)."
            action="Mes réservations"
            onAction={() => go('/reservations')}
          />
          <HelpItem
            title="Installer l’application"
            text="Utilisez le bouton « Installer l’application » proposé dans l’app, ou le menu de votre navigateur."
          />
        </div>
      </Sheet>
    </>
  );
}

function HelpItem({
  title, text, action, onAction,
}: {
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div>
      <p className="font-medium">{title}</p>
      <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">{text}</p>
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-brand)]"
        >
          {action} <IconChevron width={15} height={15} />
        </button>
      )}
    </div>
  );
}
