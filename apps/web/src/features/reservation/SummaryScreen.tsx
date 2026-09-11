import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toApiShortTime, type BookingInput, type DeparturePlayerInput } from '@golf/contracts';
import { useClubInfo, useCheckPlayers, useCreateBooking, useMe } from '@/lib/queries';
import { useBooking, type DraftPlayer } from './store';
import { ApiError } from '@/lib/api';
import { Button, Card, SectionTitle, ErrorState } from '@/components/ui';
import { PageHeader, StickyFooter } from '@/components/layout';
import { IconClock, IconCheck } from '@/components/icons';
import {
  formatDayLong, formatTime, formatPrice, isoToApi, initialsOf, formatIndex,
} from '@/lib/format';

/** Etape 5 : recapitulatif et confirmation. */
export function SummaryScreen() {
  const navigate = useNavigate();
  const booking = useBooking();
  const { data: me } = useMe();
  const [error, setError] = useState<string | null>(null);

  const apiDate = booking.date ? isoToApi(booking.date) : '';
  const info = useClubInfo(booking.clubId ?? undefined, apiDate);
  const checkPlayers = useCheckPlayers();
  const createBooking = useCreateBooking();

  const total = booking.total();
  const onlineAvailable = info.data?.rules.onlinePaymentAccepted ?? false;
  const busy = checkPlayers.isPending || createBooking.isPending;

  // Recapitulatif detaille : green-fees par joueur, prestations, total general.
  // Le tarif d un joueur peut etre regle au club (price non renseigne) : on
  // l ecarte du sous-total et on le signale.
  const priceOf = (p: DraftPlayer): number | null =>
    typeof p.price === 'number' && !Number.isNaN(p.price) ? p.price : null;
  const advantageOf = (p: DraftPlayer): string =>
    p.isOwner
      ? (booking.clubPlayerType === 'A' ? 'ABONNÉ' : booking.visitorAdvantage)
      : p.advantage;
  const greenTotal = booking.players.reduce((s, p) => s + (priceOf(p) ?? 0), 0);
  const someAtClub = booking.players.some((p) => priceOf(p) === null);
  const prestationsTotal = total;
  const grandTotal = greenTotal + prestationsTotal;

  /** Convertit un joueur du brouillon vers la structure St_Jr_Depart. */
  function toApiPlayer(p: DraftPlayer, position: number): DeparturePlayerInput {
    return {
      sClub_5X: booking.clubId ?? '',
      sNum_Licence: p.licence,
      sPAX_ID: p.paxId,
      sTitle: p.title,
      sNom: p.lastName,
      sPrenom: p.firstName,
      xIndex: p.index,
      sEmail: p.email,
      /*
        RESERVER_DANS_CLUB : le titulaire porte son statut sur le club vise.
        Abonne du club -> "A", identifiant du club, avantage "ABONNE".
        Sinon -> "V" et l avantage renvoye par GET_TARIF_NON_MEMBRE.
        Les partenaires restent visiteurs.
      */
      sId_Jr_AV: p.isOwner ? booking.clubPlayerId : '',
      sJr_AV: p.isOwner && booking.clubPlayerType === 'A' ? 'A' : 'V',
      sAvantage: p.isOwner
        ? (booking.clubPlayerType === 'A' ? 'ABONNÉ' : booking.visitorAdvantage)
        : p.advantage,
      sAvantage_MultiCriteres: p.multiCriteria,
      // Tarif resolu par joueur (RECHERCHE_TARIF) : sTarif_ID porte
      // l ID_Tarification, comme dans WinDev.
      sTarif_ID: p.tariffId,
      sPrestation_ID: p.prestationId,
      xPrix: p.price,
      sId_Caddet: p.caddie?.id ?? '',
      sNomCadet: p.caddie?.name ?? '',
      sPays: p.nationality,
      nPositionA: position,
      nPositionR: position,
    };
  }

  async function confirm(): Promise<void> {
    setError(null);
    if (!booking.clubId || !booking.date || !booking.slot) {
      setError('Votre réservation est incomplete. Reprenez depuis le debut.');
      return;
    }

    const players = booking.players.map((p, i) => toApiPlayer(p, i + 1));

    try {
      // Controle serveur du droit a jouer, avant tout enregistrement.
      await checkPlayers.mutateAsync({
        sDate: apiDate,
        sClub_5X: booking.clubId,
        TABJoueursDepart: players,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Vérification des joueurs impossible.');
      return;
    }

    const payload: BookingInput = {
      sParam_Club_5X: booking.clubId,
      nBr_Joueur: booking.players.length,
      sTerrain_ID_A: booking.courseOutId,
      sTerrain_ID_R: booking.courseBackId,
      // L amont attend les heures en HHMM ("0730"), pas "07:30"
      // (erreur "INVALID TIME MIN").
      sHeure_Min: toApiShortTime(booking.timeFrom),
      sHeure_Max: toApiShortTime(booking.timeTo),
      nbr_Depart_Show: info.data?.rules.departuresToShow ?? 0,
      sDate_Resa: apiDate,
      nParam_NBTrous: booking.holes,
      hParam_Heure: toApiShortTime(booking.slot.timeOut),
      sParamNote: booking.note,
      sAndroid_Ios: 'WEB',
      UnDepartChoisis: booking.slot.raw,
      tabJoueur_Resa: players,
      TabPrest_Choisis: booking.prestations.map((d) => ({
        sNom_Prestation_FR: d.prestation.name,
        sId_Prestation: d.prestation.id,
        sId_Tarification: d.prestation.pricingId,
        nQte: d.quantity,
        xPrix: d.prestation.price,
        xPrix_TT: d.prestation.price * d.quantity,
      })),
      bEst_Resa_Payer_EnLigne: booking.payOnline && onlineAvailable,
      xMontant_Resa: total,
    };

    try {
      const result = await createBooking.mutateAsync(payload);
      if (result.paymentUrl) {
        // Paiement affiche DANS l app (ecran /paiement), pas en quittant la PWA.
        const clubName = booking.clubName;
        booking.reset();
        navigate('/paiement', {
          replace: true,
          state: { url: result.paymentUrl, label: clubName, returnTo: '/reservations' },
        });
        return;
      }
      booking.reset();
      navigate('/reserver/confirmee', {
        replace: true,
        state: { reference: result.reference },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    }
  }

  if (!booking.slot || !booking.date) {
    return (
      <div>
        <PageHeader title="Recapitulatif" />
        <main className="px-4 py-6">
          <ErrorState
            message="Votre réservation est incomplete."
            onRetry={() => navigate('/reserver')}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="pb-[calc(6.5rem+var(--safe-bottom))]">
      <PageHeader title="Recapitulatif" subtitle="Vérifiez avant de confirmer" />

      <main className="flex flex-col gap-5 px-4 py-5">
        {/* Depart */}
        <Card className="overflow-hidden">
          <div className="bg-[var(--color-brand)] px-4 py-4 text-white">
            <p className="text-[0.68rem] font-medium tracking-[0.14em] text-white/60 uppercase">
              Votre départ
            </p>
            <p className="mt-1.5 text-xl font-semibold">{booking.clubName}</p>
            <p className="mt-0.5 text-sm text-white/75">{formatDayLong(booking.date)}</p>
          </div>
          <dl className="divide-y divide-[var(--color-line)]">
            <Row label="Heure" value={
              <span className="inline-flex items-center gap-1.5">
                <IconClock width={15} height={15} className="opacity-60" />
                <span className="font-semibold tabular">
                  {formatTime(booking.slot.timeOut)}
                </span>
              </span>
            } />
            <Row label="Parcours" value={booking.courseName || '--'} />
            <Row label="Formule" value={`${booking.holes} trous`} />
            <Row label="Joueurs" value={String(booking.players.length)} />
          </dl>
        </Card>

        {/* Joueurs : chacun avec son avantage, son index et son green-fee. */}
        <section>
          <SectionTitle title="Joueurs" />
          <Card className="overflow-hidden">
            <ul className="divide-y divide-[var(--color-line)]">
              {booking.players.map((p) => {
                const av = advantageOf(p);
                const price = priceOf(p);
                return (
                  <li key={p.key} className="flex items-center gap-3 p-3.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-surface-alt)] text-sm font-semibold">
                      {initialsOf(p.fullName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <p className="min-w-0 flex-1 text-sm font-medium leading-snug">{p.fullName}</p>
                        {p.isOwner && (
                          <span className="shrink-0 rounded-full bg-[var(--color-surface-alt)] px-1.5 py-0.5 text-[0.6rem] font-semibold tracking-wide text-[var(--color-ink-soft)] uppercase">
                            Vous
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        {av && (
                          <span className="inline-block rounded-full bg-[var(--color-surface-alt)] px-2 py-0.5 text-[0.64rem] font-semibold tracking-wide text-[var(--color-ink-soft)] uppercase">
                            {av}
                          </span>
                        )}
                        {p.index > 0 && (
                          <span className="text-[0.7rem] font-semibold text-[var(--color-ink-soft)]">
                            Index {formatIndex(p.index)}
                          </span>
                        )}
                        {p.caddie && (
                          <span className="text-[0.7rem] text-[var(--color-ink-faint)]">
                            Cadet : {p.caddie.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-right">
                      {price === null ? (
                        <span className="text-[0.72rem] font-medium text-[var(--color-ink-faint)]">
                          Au club
                        </span>
                      ) : (
                        <span className="text-sm font-semibold tabular">{formatPrice(price)}</span>
                      )}
                    </span>
                  </li>
                );
              })}
              {/* Sous-total des green-fees. */}
              <li className="flex items-center justify-between gap-4 bg-[var(--color-surface-alt)]/40 px-4 py-3">
                <span className="text-sm font-medium">Sous-total green-fees</span>
                <span className="text-sm font-semibold tabular">{formatPrice(greenTotal)}</span>
              </li>
            </ul>
            {someAtClub && (
              <p className="px-4 pb-3 pt-2 text-[0.7rem] text-[var(--color-ink-faint)]">
                Certains tarifs sont réglés directement au club et ne sont pas inclus dans ce sous-total.
              </p>
            )}
          </Card>
        </section>

        {/* Prestations : detail (prix unitaire x quantite) + sous-total. */}
        {booking.prestations.length > 0 && (
          <section>
            <SectionTitle title="Prestations" />
            <Card className="overflow-hidden">
              <div className="divide-y divide-[var(--color-line)]">
                {booking.prestations.map((d) => (
                  <div
                    key={d.prestation.id}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">{d.prestation.name}</p>
                      <p className="text-[0.7rem] text-[var(--color-ink-faint)] tabular">
                        {formatPrice(d.prestation.price)} × {d.quantity}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm tabular">
                      {formatPrice(d.prestation.price * d.quantity)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-4 bg-[var(--color-surface-alt)]/40 px-4 py-3">
                  <span className="text-sm font-medium">Sous-total prestations</span>
                  <span className="text-sm font-semibold tabular">{formatPrice(prestationsTotal)}</span>
                </div>
              </div>
            </Card>
          </section>
        )}

        {/* Total general : green-fees + prestations. */}
        <Card className="overflow-hidden">
          <dl className="divide-y divide-[var(--color-line)]">
            <Row label="Green-fees" value={<span className="tabular">{formatPrice(greenTotal)}</span>} />
            {booking.prestations.length > 0 && (
              <Row
                label="Prestations"
                value={<span className="tabular">{formatPrice(prestationsTotal)}</span>}
              />
            )}
          </dl>
          <div className="flex items-center justify-between gap-4 bg-[var(--color-brand)] px-4 py-4 text-white">
            <span className="text-sm font-semibold tracking-wide uppercase">Total</span>
            <span className="text-lg font-semibold tabular">{formatPrice(grandTotal)}</span>
          </div>
          {someAtClub && (
            <p className="px-4 pb-3 pt-2 text-[0.7rem] text-[var(--color-ink-faint)]">
              Hors tarifs réglés directement au club.
            </p>
          )}
        </Card>

        {booking.note && (
          <section>
            <SectionTitle title="Votre note" />
            <Card className="p-4 text-sm text-[var(--color-ink-soft)]">{booking.note}</Card>
          </section>
        )}

        {me?.member.isLicenseeBooking && (
          <Card className="p-4 text-sm text-[var(--color-ink-soft)]">
            Vous reservez en tant que licencié FRMG : les tarifs visiteur
            s appliquent et seront confirmes par le club.
          </Card>
        )}

        {error && <ErrorState message={error} />}
      </main>

      <StickyFooter>
        <Button
          size="lg" full
          loading={busy}
          onClick={confirm}
          icon={!busy ? <IconCheck width={19} height={19} /> : undefined}
        >
          {booking.payOnline && onlineAvailable ? 'Confirmer et payer' : 'Confirmer la réservation'}
        </Button>
      </StickyFooter>
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
