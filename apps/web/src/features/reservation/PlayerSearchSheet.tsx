import { useState } from 'react';
import { clsx } from 'clsx';
import { usePlayerSearch } from '@/lib/queries';
import { useBooking, nameKey } from './store';
import {
  Button, Card, Field, Segmented, EmptyState, ErrorState, Skeleton,
} from '@/components/ui';
import { Sheet } from '@/components/layout';
import { IconSearch, IconUser, IconCheck } from '@/components/icons';
import { formatIndex, initialsOf } from '@/lib/format';

type Mode = 'club' | 'licensees' | 'guest';

/** Pays proposes pour un invite (COMBO_INVITE_PAYS, defaut Maroc). */
const COUNTRIES: Array<{ code: string; label: string }> = [
  { code: 'MAR', label: 'Maroc' },
  { code: 'FRA', label: 'France' },
  { code: 'ESP', label: 'Espagne' },
  { code: 'DZA', label: 'Algérie' },
  { code: 'TUN', label: 'Tunisie' },
  { code: 'BEL', label: 'Belgique' },
  { code: 'CHE', label: 'Suisse' },
  { code: 'DEU', label: 'Allemagne' },
  { code: 'GBR', label: 'Royaume-Uni' },
  { code: 'ITA', label: 'Italie' },
  { code: 'NLD', label: 'Pays-Bas' },
  { code: 'USA', label: 'États-Unis' },
  { code: 'CAN', label: 'Canada' },
];

const EMAIL_RE = /^[-.a-zA-Z0-9]+@[-.a-zA-Z0-9]+\.[a-zA-Z]{2,4}$/;

/**
 * Recherche et ajout d un partenaire de jeu (FEN_AJOUT_JOUEUR).
 *
 * Trois modes, comme l application WinDev :
 *   - Membres du club   (plan 1, GET_JOUEURS_CLUB)
 *   - Licencies FRMG    (plan 2, GET_JOUEURS_LICENCIE)
 *   - Renseigner invite (plan 3, saisie manuelle -> joueur visiteur)
 *
 * L invite n est propose que sur un club dont le titulaire est abonne :
 * WinDev masque le bouton d invitation ("Cacher le bouton d invitation sur
 * les clubs non membre").
 */
export function PlayerSearchSheet({
  open, onClose, maxPlayers,
}: {
  open: boolean; onClose: () => void; maxPlayers: number;
}) {
  const booking = useBooking();
  const search = usePlayerSearch(booking.clubId ?? undefined);
  const [mode, setMode] = useState<Mode>('club');

  // Abonne du club vise -> invitation autorisee (sinon l onglet n apparait pas).
  const canInvite = booking.clubPlayerType === 'A';

  const options: Array<{ value: Mode; label: string }> = [
    { value: 'club', label: 'Membre' },
    { value: 'licensees', label: 'Licencié FRMG' },
    ...(canInvite ? [{ value: 'guest' as Mode, label: 'Invité' }] : []),
  ];

  return (
    <Sheet open={open} onClose={onClose} title="Ajouter un joueur">
      <div className="flex flex-col gap-3">
        <Segmented
          label="Type de joueur"
          value={mode}
          onChange={(m) => setMode(m)}
          options={options}
        />

        {mode === 'guest'
          ? <GuestForm onClose={onClose} maxPlayers={maxPlayers} />
          : <SearchMode scope={mode} onClose={onClose} search={search} maxPlayers={maxPlayers} />}
      </div>
    </Sheet>
  );
}

/** Recherche d un membre du club ou d un licencie FRMG. */
function SearchMode({
  scope, onClose, search, maxPlayers,
}: {
  scope: 'club' | 'licensees';
  onClose: () => void;
  search: ReturnType<typeof usePlayerSearch>;
  maxPlayers: number;
}) {
  const booking = useBooking();
  const isLicensees = scope === 'licensees';
  const [licence, setLicence] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');

  const players = search.data?.players ?? [];
  // Deja present : par licence, ou par nom (couvre un invite homonyme).
  const licencesPresentes = new Set(booking.players.map((p) => p.licence).filter(Boolean));
  const nomsPresents = new Set(booking.players.map((p) => nameKey(p.fullName)));

  function submit(e: React.FormEvent): void {
    e.preventDefault();
    const nom = lastName.trim();
    const prenom = firstName.trim();
    const lic = licence.trim();
    // Licencie FRMG : licence OU nom OU prenom. Club : nom OU prenom.
    if (isLicensees ? (!lic && !nom && !prenom) : (!nom && !prenom)) return;
    search.mutate({
      lastName: nom, firstName: prenom,
      licence: isLicensees ? lic : undefined, scope,
    });
  }

  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {isLicensees && (
          <Field
            label="Code licence"
            value={licence}
            onChange={(e) => setLicence(e.target.value)}
            placeholder="Ex. 5123456789"
            inputMode="numeric"
            autoComplete="off"
          />
        )}
        <Field
          label="Nom"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Nom de famille"
          autoComplete="off"
        />
        <Field
          label="Prénom"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Facultatif"
          autoComplete="off"
        />
        <Button
          type="submit"
          full
          loading={search.isPending}
          icon={<IconSearch width={18} height={18} />}
          disabled={isLicensees
            ? (!licence.trim() && !lastName.trim() && !firstName.trim())
            : (!lastName.trim() && !firstName.trim())}
        >
          Rechercher
        </Button>
      </form>

      <div className="mt-2">
        {search.isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : search.isError ? (
          <ErrorState message={(search.error as Error).message} />
        ) : search.isSuccess && players.length === 0 ? (
          <EmptyState
            title="Aucun joueur trouvé"
            description="Vérifiez l’orthographe ou essayez l’autre type de recherche."
            icon={<IconUser width={28} height={28} />}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {players.map((p) => {
              const added = (!!p.licence && licencesPresentes.has(p.licence))
                || nomsPresents.has(nameKey(p.fullName));
              const full = booking.players.length >= maxPlayers;
              return (
                <li key={`${p.licence}-${p.id}`}>
                  <Card
                    onClick={added || full ? undefined : () => {
                      booking.addPlayer(p);
                      onClose();
                    }}
                    className={clsx(
                      'flex items-center gap-3 p-3.5',
                      (added || full) && 'opacity-50',
                    )}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--color-surface-alt)] text-sm font-semibold">
                      {initialsOf(p.fullName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.fullName}</p>
                      <p className="truncate text-sm text-[var(--color-ink-faint)]">
                        {p.clubName || `Licence ${p.licence}`}
                        {p.index > 0 ? ` · Index ${formatIndex(p.index)}` : ''}
                      </p>
                    </div>
                    {added && <span className="shrink-0 text-xs font-medium">Déjà ajouté</span>}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

/** Saisie manuelle d un invite (CELL_INVITE / AJOUT_JOUEUR_INVITE). */
function GuestForm({ onClose, maxPlayers }: { onClose: () => void; maxPlayers: number }) {
  const booking = useBooking();
  const [civility, setCivility] = useState<'MR' | 'MME'>('MR');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [index, setIndex] = useState('');
  const [country, setCountry] = useState('MAR');
  const [error, setError] = useState<string | null>(null);

  const full = booking.players.length >= maxPlayers;

  function submit(e: React.FormEvent): void {
    e.preventDefault();
    setError(null);

    if (lastName.trim().length < 2) {
      setError('Le nom doit comporter au moins 2 lettres.'); return;
    }
    if (firstName.trim().length < 2) {
      setError('Le prénom doit comporter au moins 2 lettres.'); return;
    }
    if (email.trim() && !EMAIL_RE.test(email.trim())) {
      setError('E-mail « ' + email.trim() + ' » non valide.'); return;
    }
    const idx = index.trim() ? Number(index.trim().replace(',', '.')) : 0;
    if (Number.isNaN(idx) || idx < 0) { setError('Index invalide.'); return; }
    if (idx > 54) { setError('Index maximum 54.0.'); return; }
    if (full) { setError('Le nombre de joueurs est déjà atteint.'); return; }

    // Un invite n a pas de licence : on evite le doublon en comparant le nom.
    const nomComplet = `${lastName.trim()} ${firstName.trim()}`;
    const dejaPresent = booking.players.some((p) => nameKey(p.fullName) === nameKey(nomComplet));
    if (dejaPresent) { setError('Ce joueur est déjà dans la liste.'); return; }

    booking.addGuest({
      civility,
      lastName: lastName.trim(),
      firstName: firstName.trim(),
      email: email.trim(),
      index: idx,
      country,
      // Titulaire abonne du club (onglet visible seulement dans ce cas) :
      // l invite beneficie du tarif "INVITÉ ABONNÉ".
      advantage: 'INVITÉ ABONNÉ',
    });
    onClose();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[var(--color-ink-soft)]">Civilité</label>
        <Segmented
          label="Civilité"
          value={civility}
          onChange={(v) => setCivility(v)}
          options={[
            { value: 'MR', label: 'Monsieur' },
            { value: 'MME', label: 'Madame' },
          ]}
        />
      </div>

      <Field
        label="Nom"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        placeholder="Nom de l’invité"
        autoComplete="off"
      />
      <Field
        label="Prénom"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        placeholder="Prénom de l’invité"
        autoComplete="off"
      />
      <Field
        label="E-mail (facultatif)"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="nom@exemple.ma"
        autoComplete="off"
      />

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Index (facultatif)"
          inputMode="decimal"
          value={index}
          onChange={(e) => setIndex(e.target.value)}
          placeholder="Ex. 24.5"
          autoComplete="off"
        />
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="guest-country"
            className="text-sm font-medium text-[var(--color-ink-soft)]"
          >
            Pays
          </label>
          <select
            id="guest-country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="min-h-12 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <ErrorState message={error} />}

      <Button
        type="submit"
        full
        icon={<IconCheck width={18} height={18} />}
        disabled={full}
      >
        Ajouter l’invité
      </Button>
    </form>
  );
}
