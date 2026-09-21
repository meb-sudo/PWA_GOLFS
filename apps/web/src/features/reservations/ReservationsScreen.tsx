import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useReservations } from '@/lib/queries';
import {
  Card, Badge, Button, EmptyState, ErrorState, SkeletonList, SectionTitle,
} from '@/components/ui';
import { Screen } from '@/components/layout';
import { IconClock, IconChevron, IconCalendar } from '@/components/icons';
import { dateParts, formatTime, statusLabel, formatDayRelative } from '@/lib/format';
import { useT } from '@/i18n';

export function ReservationsScreen() {
  const t = useT();
  const navigate = useNavigate();
  const { data, isPending, isError, error, refetch } = useReservations();
  const reservations = data?.reservations ?? [];

  return (
    <Screen className="flex flex-col gap-5 pt-safe">
      <header className="pt-2">
        <SectionTitle eyebrow={t('home.agenda')} title={t('home.myBookings')} />
      </header>

      {isPending ? (
        <SkeletonList rows={3} height="h-[104px]" />
      ) : isError ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : reservations.length === 0 ? (
        <EmptyState
          title={t('resa.noneTitle')}
          description={t('resa.noneDesc')}
          icon={<IconCalendar width={30} height={30} />}
          action={
            <Button variant="accent" onClick={() => navigate('/reserver')}>
              {t('home.bookDeparture')}
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {reservations.map((r, i) => {
            const d = dateParts(r.date);
            const status = statusLabel(r.status);
            return (
              <motion.li
                key={`${r.id}-${r.clubId}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.25), duration: 0.25 }}
              >
                <Card
                  onClick={() => navigate(`/reservations/${r.id}?club=${r.clubId}`)}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-3 p-3.5">
                    <div className="grid w-14 shrink-0 place-items-center rounded-xl bg-[var(--color-accent)]/22 py-2">
                      <span className="text-[0.58rem] font-semibold tracking-wider text-[var(--color-ink-soft)]">
                        {d.weekday}
                      </span>
                      <span className="text-xl leading-none font-semibold tabular">{d.day}</span>
                      <span className="text-[0.58rem] font-semibold tracking-wider text-[var(--color-ink-soft)]">
                        {d.month}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[var(--color-ink-soft)]">
                        <IconClock width={14} height={14} />
                        <span className="text-sm font-medium tabular">{formatTime(r.time)}</span>
                        <span className="text-xs">· {formatDayRelative(r.date)}</span>
                      </div>
                      <p className="mt-0.5 truncate font-medium">{r.clubName}</p>
                      <p className="truncate text-sm text-[var(--color-ink-faint)]">
                        {r.holes} {t('home.holes')} · {r.players} {r.players > 1 ? t('home.players') : t('home.player')}
                        {r.courseName ? ` · ${r.courseName}` : ''}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <IconChevron width={18} height={18} className="text-[var(--color-ink-faint)]" />
                    </div>
                  </div>

                  {r.awaitingPayment && r.paymentUrl && (
                    <div className="flex items-center gap-3 border-t border-[var(--color-line)] bg-[var(--color-warning)]/8 px-3.5 py-2.5">
                      <p className="flex-1 text-sm">{t('resa.paymentPending')}</p>
                      <Button
                        variant="accent"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/paiement', {
                            state: {
                              url: r.paymentUrl,
                              label: r.clubName,
                              returnTo: '/reservations',
                            },
                          });
                        }}
                      >
                        {t('resa.pay')}
                      </Button>
                    </div>
                  )}
                </Card>
              </motion.li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}
