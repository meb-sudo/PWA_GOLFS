import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Button, Card } from '@/components/ui';
import { Screen } from '@/components/layout';
import { IconCheck } from '@/components/icons';
import { AddToCalendar } from '@/components/AddToCalendar';
import { useT } from '@/i18n';

interface Depart {
  clubName: string;
  date: string;
  time: string;
  holes: 9 | 18;
  players: number;
  courseName: string;
}

/** Ecran final : reservation enregistree. */
export function ConfirmedScreen() {
  const t = useT();
  const navigate = useNavigate();
  const state = useLocation().state as { reference?: string; depart?: Depart } | null;
  const reference = state?.reference;
  const depart = state?.depart;

  // Depart -> Date (heure locale) pour l ajout au calendrier.
  let calStart: Date | null = null;
  let calEnd: Date | null = null;
  if (depart?.date && depart.time) {
    const [y, mo, da] = depart.date.split('-').map(Number);
    const [hh, mi] = depart.time.split(':').map(Number);
    calStart = new Date(y ?? 0, (mo ?? 1) - 1, da ?? 1, hh ?? 0, mi ?? 0);
    calEnd = new Date(calStart.getTime() + (depart.holes === 18 ? 240 : 130) * 60_000);
  }

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
        <h1 className="text-2xl font-semibold tracking-tight">{t('confirm.title')}</h1>
        <p className="mx-auto mt-2 max-w-[34ch] text-sm text-[var(--color-ink-soft)]">
          {t('confirm.body')}
        </p>
      </div>

      {reference && (
        <Card className="px-5 py-4">
          <p className="text-xs text-[var(--color-ink-faint)]">{t('confirm.reference')}</p>
          <p className="mt-0.5 font-semibold tabular">{reference}</p>
        </Card>
      )}

      <div className="flex w-full max-w-xs flex-col gap-2.5">
        {depart && calStart && calEnd && (
          <AddToCalendar
            title={t('cal.eventTitle', { club: depart.clubName })}
            start={calStart}
            end={calEnd}
            location={depart.clubName}
            details={t('cal.eventDetails', {
              course: depart.courseName || '—',
              holes: depart.holes,
              players: depart.players,
            })}
          />
        )}
        <Button size="lg" full onClick={() => navigate('/reservations', { replace: true })}>
          {t('confirm.seeBookings')}
        </Button>
        <Button variant="ghost" full onClick={() => navigate('/', { replace: true })}>
          {t('confirm.backHome')}
        </Button>
      </div>
    </Screen>
  );
}
