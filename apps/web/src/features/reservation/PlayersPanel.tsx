import { useEffect, useMemo, useState } from 'react';
import type { Tariff } from '@golf/contracts';
import { useMe } from '@/lib/queries';
import { api } from '@/lib/api';
import { useBooking } from './store';
import { PlayerSearchSheet } from './PlayerSearchSheet';
import { Card, Button, SectionTitle } from '@/components/ui';
import { IconPlus, IconTrash } from '@/components/icons';
import { formatIndex, formatPrice, initialsOf, isoToApi } from '@/lib/format';

/**
 * Joueurs du depart, avec leur tarif.
 *
 * Remplace le selecteur "combien de joueurs ?" : le nombre se deduit de la
 * liste. C est aussi ce que fait WinDev, ou FEN_RESERVATION affiche les
 * joueurs et leurs prix, et ouvre FEN_AJOUT_JOUEUR sur le bouton d ajout.
 *
 * Le tarif est demande par joueur : il depend de l avantage propre a chacun
 * (RECHERCHE_TARIF), donc deux joueurs d un meme depart peuvent payer des
 * prix differents.
 */
export function PlayersPanel({
  maxPlayers, courseNumber,
}: {
  maxPlayers: number;
  /** TERRAIN_NUMERO du parcours retenu, attendu par GET_TARIF_TEL_JOUEUR. */
  courseNumber: string;
}) {
  const { data: me } = useMe();
  const booking = useBooking();
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [tarifs, setTarifs] = useState<Record<string, number | null>>({});

  // Le titulaire occupe toujours la premiere place du depart.
  useEffect(() => {
    if (!me?.member) return;
    booking.addOwner({
      licence: me.member.licence,
      paxId: me.member.paxId,
      title: me.member.title,
      lastName: me.member.lastName,
      firstName: me.member.firstName,
      fullName: me.member.fullName,
      email: me.member.email,
      index: me.member.index,
      nationality: me.member.nationality,
      advantage: me.member.advantage,
      clubId: me.member.clubId,
    });
  }, [me?.member, booking]);

  const { clubId, date, holes, players, clubPlayerType, visitorAdvantage } = booking;

  /** Avantage retenu pour le titulaire : abonne du club, ou avantage visiteur. */
  const avantageTitulaire = clubPlayerType === 'A' ? 'ABONNÉ' : visitorAdvantage;

  const signature = useMemo(
    () => JSON.stringify({
      clubId, date, holes, courseNumber, avantageTitulaire,
      joueurs: players.map((p) => `${p.key}:${p.isOwner ? avantageTitulaire : p.advantage}`),
    }),
    [clubId, date, holes, courseNumber, avantageTitulaire, players],
  );

  useEffect(() => {
    if (!clubId || !date || players.length === 0) return;
    let annule = false;

    (async () => {
      const resultats: Record<string, number | null> = {};
      for (const joueur of players) {
        const advantage = joueur.isOwner ? avantageTitulaire : joueur.advantage;
        try {
          const tarif = await api<Tariff>(
            `/clubs/${encodeURIComponent(clubId)}/player-tariff`,
            {
              method: 'POST',
              body: { holes, date: isoToApi(date), advantage, courseNumber },
            },
          );
          resultats[joueur.key] = tarif.price;
          // Le prix et ses identifiants partent avec la reservation.
          booking.setPlayerTariff(joueur.key, {
            price: tarif.price,
            tariffId: tarif.pricingId,
            prestationId: tarif.prestationId,
            multiCriteria: tarif.isMultiCriteria ? tarif.label : '',
          });
        } catch {
          resultats[joueur.key] = null;
        }
      }
      if (!annule) setTarifs(resultats);
    })();

    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const placesLibres = Math.max(maxPlayers - players.length, 0);

  return (
    <section>
      <SectionTitle
        title="Joueurs"
        action={
          <span className="shrink-0 text-sm text-[var(--color-ink-faint)] tabular">
            {players.length} / {maxPlayers}
          </span>
        }
      />

      <ul className="flex flex-col gap-2.5">
        {players.map((joueur) => {
          const prix = tarifs[joueur.key];
          // Avantage effectivement applique au tarif de ce joueur.
          const avantage = joueur.isOwner ? avantageTitulaire : joueur.advantage;
          return (
            <li key={joueur.key}>
              <Card className="flex items-center gap-3 p-3.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--color-surface-alt)] text-sm font-semibold">
                  {initialsOf(joueur.fullName)}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{joueur.fullName}</p>
                  <p className="truncate text-sm text-[var(--color-ink-faint)]">
                    {joueur.licence ? `Licence ${joueur.licence}` : 'Invité'}
                  </p>
                  {/* Avantage tarifaire + index de jeu sur une meme ligne : le
                      badge d avantage, puis l index a cote, entierement lisible.
                      Avant, l index etait accole a la licence et se retrouvait
                      tronque faute de place. */}
                  {(avantage || joueur.index > 0) && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      {avantage && (
                        <span className="inline-block rounded-full bg-[var(--color-surface-alt)] px-2 py-0.5 text-[0.68rem] font-semibold tracking-wide text-[var(--color-ink-soft)] uppercase">
                          {avantage}
                        </span>
                      )}
                      {joueur.index > 0 && (
                        <span className="text-[0.72rem] font-semibold text-[var(--color-ink-soft)]">
                          Index {formatIndex(joueur.index)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  {prix === undefined ? (
                    <span className="text-sm text-[var(--color-ink-faint)]">…</span>
                  ) : prix === null ? (
                    <span className="text-sm text-[var(--color-ink-faint)]">Tarif au club</span>
                  ) : (
                    <span className="font-semibold tabular">{formatPrice(prix)}</span>
                  )}
                  {joueur.isOwner ? (
                    <span className="text-[0.68rem] text-[var(--color-ink-faint)]">Vous</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => booking.removePlayer(joueur.key)}
                      aria-label={`Retirer ${joueur.fullName}`}
                      className="text-[var(--color-ink-faint)]"
                    >
                      <IconTrash width={17} height={17} />
                    </button>
                  )}
                </div>
              </Card>
            </li>
          );
        })}

        {placesLibres > 0 && (
          <li>
            <Card
              onClick={() => setRechercheOuverte(true)}
              className="flex items-center gap-3 border-dashed p-3.5 text-[var(--color-ink-soft)]"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--color-surface-alt)]">
                <IconPlus width={18} height={18} />
              </span>
              <span className="flex-1 text-left text-sm font-medium">
                Ajouter un joueur
              </span>
              <span className="shrink-0 text-sm text-[var(--color-ink-faint)]">
                {placesLibres} place{placesLibres > 1 ? 's' : ''} libre{placesLibres > 1 ? 's' : ''}
              </span>
            </Card>
          </li>
        )}
      </ul>

      {players.length > 1 && (
        <p className="mt-2 text-sm text-[var(--color-ink-faint)]">
          Total green fees :{' '}
          <span className="font-medium text-[var(--color-ink)] tabular">
            {formatPrice(
              players.reduce((somme, j) => somme + (tarifs[j.key] ?? 0), 0),
            )}
          </span>
        </p>
      )}

      <PlayerSearchSheet
        open={rechercheOuverte}
        onClose={() => setRechercheOuverte(false)}
        maxPlayers={maxPlayers}
      />
    </section>
  );
}

export { Button };
