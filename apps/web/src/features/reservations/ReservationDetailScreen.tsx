import { clsx } from 'clsx';
import { useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { canCancel } from '@golf/contracts';
import {
  useReservation, useClubInfo, useCancelReservation, useRemovePlayer,
} from '@/lib/queries';
import { ApiError } from '@/lib/api';
import {
  Card, Button, ErrorState, SkeletonList, SectionTitle,
} from '@/components/ui';
import { PageHeader, Sheet } from '@/components/layout';
import { IconClock, IconTrash, IconWarning } from '@/components/icons';
import { AddToCalendar } from '@/components/AddToCalendar';
import {
  formatDayLong, formatTime, formatPrice, statusLabel, initialsOf,
  formatIndex, isoToApi,
} from '@/lib/format';
import { useT } from '@/i18n';

export function ReservationDetailScreen() {
  const t = useT();
  const { id = '' } = useParams();
  const [search] = useSearchParams();
  const clubId = search.get('club') ?? '';
  const navigate = useNavigate();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const query = useReservation(id, clubId);
  const reservation = query.data?.reservation;
  const info = useClubInfo(clubId, reservation ? isoToApi(reservation.date) : '');

  const cancel = useCancelReservation(id);
  const removePlayer = useRemovePlayer(id, clubId);

  const cancellable = reservation && info.data
    ? canCancel(
        reservation.date,
        info.data.rules.cancellationAllowed,
        info.data.rules.cancellationDays,
      )
    : false;

  async function submitCancel(): Promise<void> {
    setError(null);
    try {
      await cancel.mutateAsync({ note: reason.trim() });
      setCancelOpen(false);
      navigate('/reservations', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('resa.cancelFailed'));
    }
  }

  if (query.isPending) {
    return (
      <div>
        <PageHeader title={t('resa.reservation')} />
        <main className="px-4 py-5"><SkeletonList rows={4} height="h-20" /></main>
      </div>
    );
  }

  if (query.isError || !reservation) {
    return (
      <div>
        <PageHeader title={t('resa.reservation')} />
        <main className="px-4 py-5">
          <ErrorState
            message={(query.error as Error)?.message ?? t('resa.notFound')}
            onRetry={() => query.refetch()}
          />
        </main>
      </div>
    );
  }

  const status = statusLabel(reservation.status);
  // Depart en Date (heure locale) pour l ajout au calendrier.
  const [y, mo, da] = reservation.date.split('-').map(Number);
  const [hh, mi] = reservation.time.split(':').map(Number);
  const startAt = new Date(y ?? 0, (mo ?? 1) - 1, da ?? 1, hh ?? 0, mi ?? 0);
  const endAt = new Date(startAt.getTime() + (reservation.holes === 18 ? 240 : 130) * 60_000);
  const players = query.data?.detail.players ?? [];
  const prestations = query.data?.detail.prestations ?? [];
  const prestationTotal = prestations.reduce((s, p) => s + p.price * p.quantity, 0);

  return (
    <div className="pb-10">
      <PageHeader title={t('common.yourTeeTime')} subtitle={reservation.clubName} />

      <main className="flex flex-col gap-5 px-4 py-5">
        <Card className="overflow-hidden">
          <div className="bg-[var(--color-brand)] px-4 py-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.68rem] font-medium tracking-[0.14em] text-white/60 uppercase">
                  {formatDayLong(reservation.date)}
                </p>
                <p className="mt-1.5 flex items-center gap-2 text-2xl font-semibold tabular">
                  <IconClock width={20} height={20} className="opacity-70" />
                  {formatTime(reservation.time)}
                </p>
                <p className="mt-1 text-sm text-white/75">{reservation.clubName}</p>
              </div>
              {/*
                Pastille adaptee au fond vert fonce : le Badge "positive"
                (vert sur vert) y etait illisible. Fond blanc translucide,
                texte blanc, et un point colore qui porte le statut.
              */}
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[0.7rem] font-semibold tracking-wide text-white uppercase">
                <span
                  className={clsx(
                    'size-1.5 rounded-full',
                    status.tone === 'positive' && 'bg-[var(--color-accent)]',
                    status.tone === 'warning' && 'bg-[#F7B43F]',
                    status.tone === 'neutral' && 'bg-white/70',
                  )}
                />
                {status.label}
              </span>
            </div>
          </div>

          <dl className="divide-y divide-[var(--color-line)]">
            <Row label={t('book.course')} value={reservation.courseName || '--'} />
            <Row label={t('recap.formula')} value={`${reservation.holes} ${t('home.holes')}`} />
            <Row label={t('players.title')} value={String(reservation.players)} />
            <Row label={t('resa.folder')} value={<span className="tabular">{reservation.id}</span>} />
            {reservation.bookedByLabel && (
              <Row label={t('resa.bookedBy')} value={reservation.bookedByLabel} />
            )}
            {reservation.total && (
              <Row label={t('recap.total')} value={<span className="tabular">{reservation.total}</span>} />
            )}
          </dl>
        </Card>

        <AddToCalendar
          title={t('cal.eventTitle', { club: reservation.clubName })}
          start={startAt}
          end={endAt}
          location={reservation.clubName}
          details={t('cal.eventDetailsFolder', {
            course: reservation.courseName || '—',
            holes: reservation.holes,
            players: reservation.players,
            folder: reservation.id,
          })}
        />

        {reservation.note && (
          <section>
            <SectionTitle title={t('resa.note')} />
            <Card className="p-4 text-sm text-[var(--color-ink-soft)]">
              {reservation.note}
            </Card>
          </section>
        )}

        <section>
          <SectionTitle title={t('resa.playersCount', { n: players.length })} />
          <ul className="flex flex-col gap-2">
            {players.map((p, i) => (
              <li key={`${p.departureIdName}-${i}`}>
                <Card className="flex items-center gap-3 p-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-surface-alt)] text-sm font-semibold">
                    {initialsOf(p.fullName) || String(i + 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.fullName}</p>
                    <p className="truncate text-sm text-[var(--color-ink-faint)]">
                      {p.prestationName || t('resa.greenFee')}
                      {p.index > 0 ? ` · ${t('common.index', { n: formatIndex(p.index) })}` : ''}
                      {p.caddieName ? ` · ${t('resa.caddieInline', { name: p.caddieName })}` : ''}
                    </p>
                  </div>
                  {p.price > 0 && (
                    <span className="shrink-0 text-sm font-medium tabular">
                      {formatPrice(p.price)}
                    </span>
                  )}
                  {reservation.isOwner && players.length > 1 && i > 0 && (
                    <button
                      type="button"
                      onClick={() => removePlayer.mutate(p.departureIdName)}
                      aria-label={t('common.remove', { name: p.fullName })}
                      disabled={removePlayer.isPending}
                      className="grid size-9 shrink-0 place-items-center rounded-full text-[var(--color-ink-faint)] active:bg-[var(--color-surface-alt)] disabled:opacity-40"
                    >
                      <IconTrash width={17} height={17} />
                    </button>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </section>

        {prestations.length > 0 && (
          <section>
            <SectionTitle title={t('presta.services')} />
            <Card>
              <dl className="divide-y divide-[var(--color-line)]">
                {prestations.map((p) => (
                  <Row
                    key={p.id}
                    label={`${p.name} × ${p.quantity}`}
                    value={<span className="tabular">{formatPrice(p.price * p.quantity)}</span>}
                  />
                ))}
                <Row
                  label={<span className="font-semibold">{t('resa.totalServices')}</span>}
                  value={
                    <span className="font-semibold tabular">{formatPrice(prestationTotal)}</span>
                  }
                />
              </dl>
            </Card>
          </section>
        )}

        {error && <ErrorState message={error} />}

        {reservation.isOwner && (
          <section className="flex flex-col gap-2.5">
            {cancellable ? (
              <Button
                variant="outline"
                size="lg"
                full
                onClick={() => setCancelOpen(true)}
                className="text-[var(--color-danger)]"
              >
                {t('resa.cancel')}
              </Button>
            ) : (
              <Card className="flex items-start gap-2.5 border-[var(--color-line)] p-3.5">
                <IconWarning width={18} height={18} className="mt-0.5 shrink-0 text-[var(--color-ink-faint)]" />
                <p className="text-sm text-[var(--color-ink-soft)]">
                  {info.data?.rules.cancellationAllowed
                    ? t('resa.cancelTooLate', { phone: info.data.phone || t('resa.phoneFallback') })
                    : t('resa.cancelNotAllowed')}
                </p>
              </Card>
            )}
          </section>
        )}
      </main>

      <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} title={t('resa.cancel')}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--color-ink-soft)]">
            {t('resa.cancelConfirmBody')}
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 300))}
            rows={3}
            placeholder={t('resa.cancelReasonPlaceholder')}
            className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 placeholder:text-[var(--color-ink-faint)]"
          />
          <div className="flex gap-2.5">
            <Button variant="outline" full onClick={() => setCancelOpen(false)}>
              {t('book.back')}
            </Button>
            <Button
              variant="danger"
              full
              loading={cancel.isPending}
              disabled={reason.trim().length === 0}
              onClick={submitCancel}
            >
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-sm text-[var(--color-ink-soft)]">{label}</dt>
      <dd className="text-right text-sm">{value}</dd>
    </div>
  );
}
