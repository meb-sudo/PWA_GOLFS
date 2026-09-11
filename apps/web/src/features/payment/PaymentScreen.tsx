import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { PageHeader } from '@/components/layout';
import { Button, EmptyState } from '@/components/ui';
import { IconWarning, IconChevron } from '@/components/icons';

interface PaymentState {
  url: string;
  /** Titre affiche en en-tete (nom de la competition ou de la reservation). */
  label?: string;
  /** Ou revenir apres "J ai termine". */
  returnTo?: string;
}

/**
 * Paiement en ligne, affiche DANS l application.
 *
 * La page du club (golf.logitec.ma) est embarquee dans un cadre : l adherent
 * reste dans l app, il ne bascule pas vers un autre site ni un nouvel onglet.
 * C est l equivalent PWA du webview de FEN_PAIEMENT_ENLIGNE.
 *
 * Reserve : l ultime page bancaire (CMI) interdit souvent l embarquement.
 * Le bouton "Ouvrir dans le navigateur" prend alors le relais.
 */
export function PaymentScreen() {
  const navigate = useNavigate();
  const state = useLocation().state as PaymentState | null;
  const [blocked, setBlocked] = useState(false);

  const url = state?.url;
  const retour = state?.returnTo ?? '/reservations';

  if (!url) {
    return (
      <div className="mx-auto min-h-dvh w-full max-w-lg">
        <PageHeader title="Paiement" onBack={() => navigate(retour, { replace: true })} />
        <main className="px-4 py-6">
          <EmptyState
            title="Aucun paiement en cours"
            description="Reprenez depuis votre réservation ou votre inscription."
          />
        </main>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <PageHeader
        title="Paiement"
        subtitle={state?.label}
        onBack={() => navigate(retour, { replace: true })}
      />

      {blocked ? (
        // L embarquement a echoue (page bancaire qui refuse le cadre) :
        // on bascule proprement vers le navigateur.
        <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-[var(--color-warning)]/12">
            <IconWarning width={26} height={26} className="text-[var(--color-warning)]" />
          </span>
          <div>
            <p className="font-medium">Paiement à ouvrir dans le navigateur</p>
            <p className="mx-auto mt-1 max-w-[36ch] text-sm text-[var(--color-ink-soft)]">
              La page de paiement de la banque ne peut pas s’afficher dans
              l’application. Ouvrez-la dans votre navigateur pour finaliser.
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => window.location.assign(url)}
            icon={<IconChevron width={18} height={18} />}
          >
            Ouvrir le paiement
          </Button>
        </main>
      ) : (
        <>
          <div className="relative flex-1">
            <iframe
              src={url}
              title="Paiement en ligne"
              className="absolute inset-0 size-full border-0"
              allow="payment"
              referrerPolicy="no-referrer-when-downgrade"
              /*
                Cadre cadenasse : la page garde sa session (same-origin), ses
                scripts et son formulaire, mais ne peut PAS naviguer la fenetre
                principale toute seule (pas d allow-top-navigation) -- elle ne
                peut donc pas sortir de l app au chargement. Elle ne redirige
                vers la banque que sur le clic de l utilisateur
                (allow-top-navigation-by-user-activation).
              */
              sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
              onError={() => setBlocked(true)}
            />
          </div>
          <footer className="border-t border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 pb-safe">
            <Button
              variant="outline"
              full
              onClick={() => navigate(retour, { replace: true })}
            >
              J’ai terminé le paiement
            </Button>
            <button
              type="button"
              onClick={() => setBlocked(true)}
              className="mt-2 w-full py-1 text-center text-sm text-[var(--color-ink-faint)] underline underline-offset-4"
            >
              La page ne s’affiche pas ?
            </button>
          </footer>
        </>
      )}
    </div>
  );
}

/** Ouvre le paiement dans l app. A appeler apres une reponse avec paymentUrl. */
export function goToPayment(
  navigate: (to: string, opts: { state: PaymentState }) => void,
  payment: PaymentState,
): void {
  navigate('/paiement', { state: payment });
}
