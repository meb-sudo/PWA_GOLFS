import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { earliestBookableTime, type DepartureSlot } from '@golf/contracts';
import { useAvailability, useClubInfo } from '@/lib/queries';
import { useBooking } from './store';
import { Button, Card, EmptyState, ErrorState, SkeletonList } from '@/components/ui';
import { PageHeader, StickyFooter } from '@/components/layout';
import { IconClock, IconWarning } from '@/components/icons';
import { formatDayLong, formatTime, isoToApi } from '@/lib/format';

/** Etape 2 : choix du creneau parmi les departs disponibles. */
export function SlotsScreen() {
  const navigate = useNavigate();
  const booking = useBooking();

  const info = useClubInfo(
    booking.clubId ?? undefined,
    booking.date ? isoToApi(booking.date) : '',
  );

  const params = useMemo(() => {
    if (!booking.date || !booking.courseOutId) return null;
    return {
      date: isoToApi(booking.date),
      courseOutId: booking.courseOutId,
      courseBackId: booking.courseBackId,
      players: booking.playerCount,
      holes: booking.holes,
      timeFrom: booking.timeFrom,
      timeTo: booking.timeTo,
      departuresToShow: info.data?.rules.departuresToShow ?? 0,
    };
  }, [booking, info.data]);

  const availability = useAvailability(booking.clubId ?? undefined, params);

  const slots = useMemo(() => {
    const all = availability.data?.slots ?? [];
    // Heure minimum reservable aujourd hui : filet de securite si l amont
    // renvoyait malgre tout des departs deja passes.
    const earliest = booking.date
      ? earliestBookableTime(booking.date, info.data?.rules.minHoursBefore ?? 0)
      : null;
    return all.filter((s) =>
      s.freeOut >= booking.playerCount
      && (!earliest || s.timeOut >= earliest),
    );
  }, [availability.data, booking.playerCount, booking.date, info.data]);

  function pick(slot: DepartureSlot): void {
    booking.selectSlot(slot);
    navigate('/reserver/prestations');
  }

  return (
    <div className="pb-[calc(5.5rem+var(--safe-bottom))]">
      <PageHeader
        title="Choisir un départ"
        subtitle={booking.date ? formatDayLong(booking.date) : undefined}
      />

      <main className="flex flex-col gap-5 px-4 py-5">
        <Card className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-[var(--color-surface-alt)] p-3 text-sm">
          <span className="font-medium">{booking.clubName}</span>
          <span className="text-[var(--color-ink-soft)]">{booking.holes} trous</span>
          <span className="text-[var(--color-ink-soft)]">
            {booking.playerCount} joueur{booking.playerCount > 1 ? 's' : ''}
          </span>
          {booking.courseName && (
            <span className="text-[var(--color-ink-soft)]">{booking.courseName}</span>
          )}
        </Card>

        {availability.data?.dayNote && (
          <Card className="flex items-start gap-2.5 border-[var(--color-warning)]/30 bg-[var(--color-warning)]/8 p-3">
            <IconWarning width={18} height={18} className="mt-0.5 shrink-0 text-[var(--color-warning)]" />
            <p className="text-sm">{availability.data.dayNote}</p>
          </Card>
        )}

        {availability.isPending ? (
          <SkeletonList rows={5} height="h-14" />
        ) : availability.isError ? (
          <ErrorState
            message={(availability.error as Error).message}
            onRetry={() => availability.refetch()}
          />
        ) : slots.length === 0 ? (
          <EmptyState
            title="Aucun départ disponible"
            description="Essayez une autre date, une autre plage horaire ou réduisez le nombre de joueurs."
            action={
              <Button variant="outline" onClick={() => navigate('/reserver')}>
                Modifier les criteres
              </Button>
            }
          />
        ) : (
          <div>
            <p className="mb-3 text-sm text-[var(--color-ink-soft)]">
              {slots.length} départ{slots.length > 1 ? 's' : ''} disponible
              {slots.length > 1 ? 's' : ''}
            </p>
            <ul className="grid grid-cols-2 gap-2.5">
              {slots.map((slot, i) => {
                const selected = booking.slot?.timeOut === slot.timeOut;
                return (
                  <motion.li
                    key={`${slot.timeOut}-${i}`}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.2 }}
                  >
                    <button
                      type="button"
                      onClick={() => pick(slot)}
                      aria-pressed={selected}
                      className={clsx(
                        'flex w-full flex-col items-start gap-1 rounded-[var(--radius-card)] border p-3.5',
                        'transition-transform active:scale-[0.98]',
                        selected
                          ? 'border-transparent bg-[var(--color-brand)] text-white'
                          : 'border-[var(--color-line)] bg-[var(--color-surface)]',
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <IconClock width={15} height={15} className="opacity-60" />
                        <span className="text-lg font-semibold tabular">
                          {formatTime(slot.timeOut)}
                        </span>
                      </span>
                      <span className={clsx(
                        'text-xs',
                        selected ? 'text-white/70' : 'text-[var(--color-ink-faint)]',
                      )}>
                        {slot.freeOut} place{slot.freeOut > 1 ? 's' : ''} libre
                        {slot.freeOut > 1 ? 's' : ''}
                      </span>
                      {booking.holes === 18 && slot.timeBack && (
                        <span className={clsx(
                          'text-xs',
                          selected ? 'text-white/60' : 'text-[var(--color-ink-faint)]',
                        )}>
                          Retour {formatTime(slot.timeBack)}
                        </span>
                      )}
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        )}
      </main>

      {booking.slot && (
        <StickyFooter>
          <Button size="lg" full onClick={() => navigate('/reserver/prestations')}>
            Continuer avec {formatTime(booking.slot.timeOut)}
          </Button>
        </StickyFooter>
      )}
    </div>
  );
}
