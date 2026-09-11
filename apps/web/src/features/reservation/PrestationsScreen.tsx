import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { prestationMatchesHoles, type Caddie } from '@golf/contracts';
import { usePrestations, useCaddies, useClubInfo } from '@/lib/queries';
import { useBooking } from './store';
import {
  Button, Card, SectionTitle, EmptyState, SkeletonList, Badge,
} from '@/components/ui';
import { PageHeader, StickyFooter, Sheet } from '@/components/layout';
import { IconUser, IconChevron } from '@/components/icons';
import { formatPrice, formatPrestationHoles, isoToApi } from '@/lib/format';

/** Etape 4 : prestations et cadets. */
export function PrestationsScreen() {
  const navigate = useNavigate();
  const booking = useBooking();
  const [caddieFor, setCaddieFor] = useState<string | null>(null);

  const apiDate = booking.date ? isoToApi(booking.date) : '';
  const info = useClubInfo(booking.clubId ?? undefined, apiDate);
  const prestations = usePrestations(booking.clubId ?? undefined);

  /** "0" non utilise, "1" anonyme, "2" nominatif. */
  const caddieMode = info.data?.caddies.mode ?? '0';
  const caddiesEnabled = caddieMode !== '0';
  const caddiesNamed = caddieMode === '2';

  const caddies = useCaddies(booking.clubId ?? undefined, apiDate, caddiesNamed);

  /*
    Ne garder que les prestations couvrant le nombre de trous choisi
    (AFFICHAGE_PRESTATION : Contient(s9_18Trous, nbTrous)). Sans ce filtre,
    une prestation "9 trous" apparaitrait sur une reservation 18 trous.
  */
  const prestationsFiltrees = useMemo(
    () => (prestations.data ?? []).filter(
      (p) => prestationMatchesHoles(p.holes, booking.holes),
    ),
    [prestations.data, booking.holes],
  );

  const total = booking.total();

  return (
    <div className="pb-[calc(6.5rem+var(--safe-bottom))]">
      <PageHeader title="Options" subtitle={booking.clubName} />

      <main className="flex flex-col gap-6 px-4 py-5">
        <section>
          <SectionTitle eyebrow="Étape 3 sur 4" title="Prestations" />
          {prestations.isPending ? (
            <SkeletonList rows={3} height="h-16" />
          ) : prestationsFiltrees.length === 0 ? (
            <EmptyState
              title="Aucune prestation disponible"
              description={`Ce club ne propose pas de prestation réservable pour ${booking.holes} trous.`}
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {prestationsFiltrees.map((p) => {
                const chosen = booking.prestations.find(
                  (d) => d.prestation.id === p.id,
                );
                const quantity = chosen?.quantity ?? 0;
                const max = p.maxPerBooking > 0 ? p.maxPerBooking : booking.playerCount;

                return (
                  <li key={p.id}>
                    <Card className="flex items-center gap-3 p-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="text-sm text-[var(--color-ink-faint)]">
                          {formatPrice(p.price)}
                          {p.holes ? ` · ${formatPrestationHoles(p.holes)}` : ''}
                        </p>
                      </div>
                      <Stepper
                        value={quantity}
                        max={max}
                        onChange={(q) => booking.setPrestationQuantity(p, q)}
                        label={p.name}
                      />
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {caddiesEnabled && (
          <section>
            <SectionTitle title="Cadets" />
            {info.data?.caddies.note && (
              <p className="mb-3 text-sm text-[var(--color-ink-soft)]">
                {info.data.caddies.note}
              </p>
            )}

            {caddiesNamed ? (
              <ul className="flex flex-col gap-2.5">
                {booking.players.map((p) => (
                  <li key={p.key}>
                    <Card
                      onClick={() => setCaddieFor(p.key)}
                      className="flex items-center gap-3 p-3.5"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-surface-alt)]">
                        <IconUser width={17} height={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.fullName}</p>
                        <p className="truncate text-sm text-[var(--color-ink-faint)]">
                          {p.caddie ? p.caddie.name : 'Aucun cadet'}
                        </p>
                      </div>
                      <IconChevron width={17} height={17} className="shrink-0 text-[var(--color-ink-faint)]" />
                    </Card>
                  </li>
                ))}
              </ul>
            ) : (
              <Card className="p-4 text-sm text-[var(--color-ink-soft)]">
                Les cadets sont geres a l’accueil du club, sans affectation nominative.
              </Card>
            )}
          </section>
        )}

        <section>
          <SectionTitle title="Note pour le club" />
          <textarea
            value={booking.note}
            onChange={(e) => booking.setNote(e.target.value.slice(0, 500))}
            rows={3}
            maxLength={500}
            placeholder="Demande particuliere, voiturette, horaire souhaité..."
            className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 placeholder:text-[var(--color-ink-faint)]"
          />
        </section>
      </main>

      <StickyFooter>
        <div className="flex flex-1 flex-col justify-center">
          <span className="text-xs text-[var(--color-ink-faint)]">Total options</span>
          <span className="text-lg leading-tight font-semibold tabular">
            {formatPrice(total)}
          </span>
        </div>
        <Button size="lg" onClick={() => navigate('/reserver/recapitulatif')}>
          Recapitulatif
        </Button>
      </StickyFooter>

      <Sheet
        open={caddieFor !== null}
        onClose={() => setCaddieFor(null)}
        title="Choisir un cadet"
      >
        {caddies.isPending ? (
          <SkeletonList rows={4} height="h-14" />
        ) : (
          <ul className="flex flex-col gap-2">
            <li>
              <Card
                onClick={() => {
                  if (caddieFor) booking.setCaddie(caddieFor, null);
                  setCaddieFor(null);
                }}
                className="p-3.5 text-sm font-medium"
              >
                Aucun cadet
              </Card>
            </li>
            {(caddies.data ?? []).map((c: Caddie) => (
              <li key={c.id}>
                <Card
                  onClick={() => {
                    if (caddieFor) booking.setCaddie(caddieFor, c);
                    setCaddieFor(null);
                  }}
                  className="flex items-center gap-3 p-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    {c.badge && (
                      <p className="text-sm text-[var(--color-ink-faint)]">
                        Matricule {c.badge}
                      </p>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </div>
  );
}

function Stepper({
  value, max, onChange, label,
}: {
  value: number; max: number; onChange: (v: number) => void; label: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value === 0}
        aria-label={`Retirer ${label}`}
        className={clsx(
          'grid size-9 place-items-center rounded-full border border-[var(--color-line)]',
          'text-lg leading-none disabled:opacity-30',
        )}
      >
        &minus;
      </button>
      <span className="w-7 text-center font-semibold tabular" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`Ajouter ${label}`}
        className={clsx(
          'grid size-9 place-items-center rounded-full border border-[var(--color-line)]',
          'text-lg leading-none disabled:opacity-30',
        )}
      >
        +
      </button>
    </div>
  );
}

export { Badge };
