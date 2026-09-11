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
import {
  formatDayLong, formatTime, formatPrice, statusLabel, initialsOf,
  formatIndex, isoToApi,
} from '@/lib/format';

export function ReservationDetailScreen() {
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
      setError(err instanceof ApiError ? err.message : 'Annulation impossible.');
    }
  }

  if (query.isPending) {
    return (
      <div>
        <PageHeader title="Réservation" />
        <main className="px-4 py-5"><SkeletonList rows={4} height="h-20" /></main>
      </div>
    );
  }

  if (query.isError || !reservation) {
    return (
      <div>
        <PageHeader title="Réservation" />
        <main className="px-4 py-5">
          <ErrorState
            message={(query.error as Error)?.message ?? 'Réservation introuvable.'}
            onRetry={() => query.refetch()}
          />
        </main>
      </div>
    );
  }

  const status = statusLabel(reservation.status);
  const players = query.data?.detail.players ?? [];
  const prestations = query.data?.detail.prestations ?? [];
  const prestationTotal = prestations.reduce((s, p) => s + p.price * p.quantity, 0);

  return (
    <div className="pb-10">
      <PageHeader title="Votre départ" subtitle={reservation.clubName} />

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
            <Row label="Parcours" value={reservation.courseName || '--'} />
            <Row label="Formule" value={`${reservation.holes} trous`} />
            <Row label="Joueurs" value={String(reservation.players)} />
            <Row label="Dossier" value={<span className="tabular">{reservation.id}</span>} />
            {reservation.bookedByLabel && (
              <Row label="Réservé par" value={reservation.bookedByLabel} />
            )}
            {reservation.total && (
              <Row label="Total" value={<span className="tabular">{reservation.total}</span>} />
            )}
          </dl>
        </Card>

        {reservation.note && (
          <section>
            <SectionTitle title="Note" />
            <Card className="p-4 text-sm text-[var(--color-ink-soft)]">
              {reservation.note}
            </Card>
          </section>
        )}

        <section>
          <SectionTitle title={`Joueurs (${players.length})`} />
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
                      {p.prestationName || 'Green fee'}
                      {p.index > 0 ? ` · Index ${formatIndex(p.index)}` : ''}
                      {p.caddieName ? ` · Cadet ${p.caddieName}` : ''}
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
                      aria-label={`Retirer ${p.fullName}`}
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
            <SectionTitle title="Prestations" />
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
                  label={<span className="font-semibold">Total prestations</span>}
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
                Annuler la réservation
              </Button>
            ) : (
              <Card className="flex items-start gap-2.5 border-[var(--color-line)] p-3.5">
                <IconWarning width={18} height={18} className="mt-0.5 shrink-0 text-[var(--color-ink-faint)]" />
                <p className="text-sm text-[var(--color-ink-soft)]">
                  {info.data?.rules.cancellationAllowed
                    ? `Le délai d’annulation est dépassé. Contactez le club au ${info.data.phone || 'numéro indiqué sur son site'}.`
                    : 'Ce club ne permet pas l’annulation depuis l’application. Contactez-le directement.'}
                </p>
              </Card>
            )}
          </section>
        )}
      </main>

      <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} title="Annuler la réservation">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--color-ink-soft)]">
            Cette action est définitive. Indiquez le motif de votre annulation :
            il sera transmis au club.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 300))}
            rows={3}
            placeholder="Motif de l’annulation"
            className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 placeholder:text-[var(--color-ink-faint)]"
          />
          <div className="flex gap-2.5">
            <Button variant="outline" full onClick={() => setCancelOpen(false)}>
              Revenir
            </Button>
            <Button
              variant="danger"
              full
              loading={cancel.isPending}
              disabled={reason.trim().length === 0}
              onClick={submitCancel}
            >
              Confirmer
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
