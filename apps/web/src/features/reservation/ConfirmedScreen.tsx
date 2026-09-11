import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Button, Card } from '@/components/ui';
import { Screen } from '@/components/layout';
import { IconCheck } from '@/components/icons';

/** Ecran final : reservation enregistree. */
export function ConfirmedScreen() {
  const navigate = useNavigate();
  const reference = (useLocation().state as { reference?: string } | null)?.reference;

  return (
    <Screen className="flex min-h-dvh flex-col items-center justify-center gap-6 text-center">
      <motion.span
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 20 }}
        className="grid size-20 place-items-center rounded-full bg-[var(--color-accent)]"
      >
        <IconCheck width={38} height={38} className="text-[var(--color-accent-ink)]" />
      </motion.span>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Réservation confirmée</h1>
        <p className="mx-auto mt-2 max-w-[34ch] text-sm text-[var(--color-ink-soft)]">
          Votre départ est enregistre. Un e-mail de confirmation vous a ete envoyé.
        </p>
      </div>

      {reference && (
        <Card className="px-5 py-4">
          <p className="text-xs text-[var(--color-ink-faint)]">Reference</p>
          <p className="mt-0.5 font-semibold tabular">{reference}</p>
        </Card>
      )}

      <div className="flex w-full max-w-xs flex-col gap-2.5">
        <Button size="lg" full onClick={() => navigate('/reservations', { replace: true })}>
          Voir mes réservations
        </Button>
        <Button variant="ghost" full onClick={() => navigate('/', { replace: true })}>
          Retour a l’accueil
        </Button>
      </div>
    </Screen>
  );
}
