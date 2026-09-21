import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  bookingWindow, clampToWindow, isDayAllowed, earliestBookableTime,
} from '@golf/contracts';
import { useClubs, useClubInfo, useMe, type ClubRow } from '@/lib/queries';
import { api } from '@/lib/api';
import { useBooking, periodBounds, type TimePeriod } from './store';
import { PlayersPanel } from './PlayersPanel';
import { WeatherStrip } from './WeatherStrip';
import {
  Card, Button, Segmented, SectionTitle, SkeletonList, ErrorState, ClubLogo,
} from '@/components/ui';
import { PageHeader, StickyFooter, Dialog } from '@/components/layout';
import {
  IconWarning, IconCalendar, IconFlag, IconChevron, IconCheck,
} from '@/components/icons';
import { useRef } from 'react';
import { dateParts, dateRange, formatDayLong, isoToApi, apiToIso } from '@/lib/format';
import { useT, useLang } from '@/i18n';

/** Liste vide partagee : evite une nouvelle reference a chaque rendu. */
const EMPTY_CLUBS: ClubRow[] = [];

/** Etape 1 : club, date, joueurs, parcours, plage horaire. */
export function CriteriaScreen() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const navigate = useNavigate();
  const location = useLocation();
  const { data: me } = useMe();
  const clubs = useClubs();
  const booking = useBooking();
  const [changeClub, setChangeClub] = useState(false);
  const [avertissement, setAvertissement] = useState<ClubRow | null>(null);

  /*
    Actions selectionnees une par une : ce sont des references stables, alors
    que l objet complet du magasin change a chaque mise a jour. Le placer en
    dependance d un effet qui ecrit dans ce meme magasin cree une boucle.
  */
  const setClub = useBooking((s) => s.setClub);
  const setDate = useBooking((s) => s.setDate);
  const setCourse = useBooking((s) => s.setCourse);

  // Reference stable tant que la requete ne change pas.
  const bookableClubs = clubs.data?.clubs ?? EMPTY_CLUBS;
  const groupClubs = useMemo(
    () => bookableClubs.filter((c) => c.scope === 'group'),
    [bookableClubs],
  );
  const otherClubs = useMemo(
    () => bookableClubs.filter((c) => c.scope === 'other'),
    [bookableClubs],
  );

  /** Liste visible tant qu aucun club n est choisi, ou sur demande. */
  const choisitClub = !booking.clubId || changeClub;
  const clubSelectionne = bookableClubs.find((c) => c.clubId === booking.clubId);

  /*
    Transposition de RESERVER_DANS_CLUB.

    WinDev regarde sJoueur_A_V dans la fiche adherent : si le joueur n est
    pas "A" sur le club vise, il ouvre FEN_DEMANDE_RESA_CLUB_NON_ADHERE, un
    avertissement a confirmer avant de poursuivre. Sans cette etape,
    l adherent croit sa reservation couverte par son abonnement alors qu il
    devra payer au club.
  */
  function choisir(club: ClubRow): void {
    if (!club.isMember) { setAvertissement(club); return; }
    booking.setClub(club);
    booking.setVisitorAdvantage('');
    setChangeClub(false);
  }

  async function confirmerNonMembre(): Promise<void> {
    const club = avertissement;
    if (!club) return;
    booking.setClub(club);
    setAvertissement(null);
    setChangeClub(false);
    // GET_TARIF_NON_MEMBRE : un avantage de groupe peut s appliquer malgre
    // l absence d abonnement au club.
    try {
      const { advantage } = await api<{ advantage: string }>(
        `/clubs/${encodeURIComponent(club.clubId)}/visitor-advantage`,
      );
      booking.setVisitorAdvantage(advantage);
    } catch {
      // Le BFF injoignable : meme repli que WinDev, plutot qu un avantage vide.
      booking.setVisitorAdvantage(
        me?.member.isLicenseeBooking ? 'LICENCIÉ FRMG' : 'LICENCIÉ APP.M',
      );
    }
  }

  /*
    Aucun club n est preselectionne : le choix doit etre explicite. Un club
    impose par defaut se remarque mal, et l adherent peut reserver dans le
    mauvais club sans s en rendre compte.

    Le brouillon est remis a zero quand on entre dans le parcours depuis
    l exterieur (accueil, barre d onglets), pas en revenant d une etape
    suivante : la saisie en cours doit survivre a un retour arriere.
  */
  const reset = useBooking((s) => s.reset);
  const entreeNeuve = (location.state as { fresh?: boolean } | null)?.fresh;
  useEffect(() => {
    if (entreeNeuve) reset();
  }, [entreeNeuve, reset]);

  const info = useClubInfo(
    booking.clubId ?? undefined,
    booking.date ? isoToApi(booking.date) : isoToApi(new Date().toISOString().slice(0, 10)),
  );

  const rules = info.data?.rules;
  const courses = info.data?.courses ?? [];

  /*
    Les bornes horaires d une tranche dependent de la config du club
    (premier / dernier depart), inconnue avant le chargement. Une fois les
    regles connues, on aligne timeFrom/timeTo sur la tranche choisie, en
    tenant compte de l heure minimum reservable pour aujourd hui.
  */
  const setPeriod = useBooking((s) => s.setPeriod);
  const firstStart = rules?.firstStart;
  const lastStart = rules?.lastStart;
  const minHoursBefore = rules?.minHoursBefore ?? 0;

  // Heure a partir de laquelle on peut reserver ce jour-la (null = date future).
  const earliest = booking.date
    ? earliestBookableTime(booking.date, minHoursBefore)
    : null;

  // Une tranche est passee si toute sa plage est anterieure a cette heure.
  const periodPassed = (p: TimePeriod): boolean => {
    if (!earliest || !firstStart || !lastStart) return false;
    return periodBounds(p, firstStart, lastStart).to <= earliest;
  };
  const firstAvailablePeriod: TimePeriod | null =
    (['matin', 'midi', 'apresmidi'] as const).find((p) => !periodPassed(p)) ?? null;

  useEffect(() => {
    if (!firstStart || !lastStart) return;
    // Si la tranche courante est passee, basculer sur la premiere disponible.
    const courante = useBooking.getState().period;
    const cible = periodPassed(courante) && firstAvailablePeriod
      ? firstAvailablePeriod : courante;
    setPeriod(cible, firstStart, lastStart, earliest ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstStart, lastStart, earliest, setPeriod]);

  // Fenetre de reservation : transposition de Date_Heure_Valide_Resa.
  const window = useMemo(
    () => (rules ? bookingWindow(rules, booking.holes) : null),
    [rules, booking.holes],
  );

  const days = useMemo(
    () => (window ? dateRange(window.minDate, window.maxDate) : []),
    [window],
  );

  // Ramene la date choisie dans la fenetre si les criteres l ont fait sortir.
  useEffect(() => {
    if (!window) return;
    const current = useBooking.getState().date;
    if (!current) { setDate(window.minDate); return; }
    const clamped = clampToWindow(current, window);
    if (clamped.date !== current) setDate(clamped.date);
  }, [window, setDate]);

  /*
    Formats jouables, transposition de PARCOURS_TROUS_PAR_DEFAUT :
    TERRAINS_9_18 est le MAXIMUM du parcours, pas le seul choix.
    - un parcours 18 trous permet de jouer 9 OU 18 ;
    - un parcours 9 trous ne permet que 9 (selecteur grise cote WinDev).
    On agrege sur tous les parcours du club.
  */
  const setHoles = useBooking((s) => s.setHoles);

  // Parcours par defaut : le premier du club. L adherent choisit ensuite dans
  // la liste deroulante -- chaque parcours a son propre calendrier d ouverture.
  useEffect(() => {
    if (courses.length === 0) return;
    const current = useBooking.getState().courseOutId;
    if (courses.some((c) => c.outId === current)) return;
    const first = courses[0]!;
    setCourse(first.outId, first.backId, first.name);
  }, [courses, setCourse]);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.outId === booking.courseOutId) ?? null,
    [courses, booking.courseOutId],
  );

  /** Choix explicite d un parcours dans la liste deroulante. */
  function choisirParcours(outId: string): void {
    const c = courses.find((x) => x.outId === outId);
    if (c) setCourse(c.outId, c.backId, c.name);
  }

  // Trous jouables sur le parcours retenu : un parcours 9 trous n autorise que
  // 9 ; un 18 (ou polyvalent, holes = 0) autorise 9 ou 18, comme WinDev.
  const availableHoles = useMemo<(9 | 18)[]>(() => {
    const max = selectedCourse
      ? (selectedCourse.holes === 0 ? 18 : selectedCourse.holes)
      : 18;
    const opts: (9 | 18)[] = [];
    if (max >= 9) opts.push(9);
    if (max >= 18) opts.push(18);
    return opts;
  }, [selectedCourse]);

  // Le format suit le parcours : si le choix courant n est plus jouable sur le
  // nouveau parcours, on bascule sur le plus long propose.
  useEffect(() => {
    if (availableHoles.length === 0) return;
    if (!availableHoles.includes(useBooking.getState().holes)) {
      setHoles(availableHoles.at(-1)!);
    }
  }, [availableHoles, setHoles]);

  const maxPlayers = rules?.maxPlayers ?? 4;
  // TERRAIN_NUMERO du parcours retenu, attendu par GET_TARIF_TEL_JOUEUR.
  const numeroTerrain = selectedCourse?.number ?? courses[0]?.number ?? '';
  const dayAllowed = booking.date
    ? isDayAllowed(booking.date, me?.member.allowedDays ?? [])
    : true;

  const canContinue = Boolean(
    booking.clubId && booking.date && booking.courseOutId && dayAllowed
    && booking.players.length > 0,
  );

  // La recherche de creneaux a besoin du nombre de joueurs : il se deduit
  // de la liste au lieu d etre choisi separement.
  const nbJoueurs = booking.players.length;
  const setPlayerCount = useBooking((s) => s.setPlayerCount);
  useEffect(() => {
    if (nbJoueurs > 0) setPlayerCount(nbJoueurs);
  }, [nbJoueurs, setPlayerCount]);

  return (
    <div className="pb-[calc(5.5rem+var(--safe-bottom))]">
      <PageHeader title={t('book.title')} onBack={() => navigate('/')} />

      <main className="flex flex-col gap-6 px-4 py-5">
        {/* Club */}
        <section>
          <SectionTitle
            eyebrow={t('book.step1')}
            title={choisitClub ? t('book.whereToPlay') : t('book.yourClub')}
          />

          {clubs.isPending ? (
            <SkeletonList rows={3} height="h-[72px]" />
          ) : clubs.isError ? (
            // Erreur de chargement (reseau/session) : ne pas la confondre avec
            // "aucun club" -- on propose de reessayer.
            <ErrorState
              message={t('book.loadClubsError')}
              onRetry={() => clubs.refetch()}
            />
          ) : bookableClubs.length === 0 ? (
            <ErrorState message={t('book.noClub')} />
          ) : choisitClub ? (
            /*
              La liste est posee directement dans la page plutot que derriere
              une feuille : au demarrage il n y a rien d autre a montrer, et
              un ecran presque vide avec un seul bouton ne dit pas quoi faire.
            */
            <div className="flex flex-col gap-5">
              <ClubGroup clubs={groupClubs} selected={booking.clubId} onPick={choisir} />
              {otherClubs.length > 0 && (
                <ClubGroup
                  title={t('book.otherClubs')}
                  hint={t('book.playAsVisitor')}
                  clubs={otherClubs}
                  selected={booking.clubId}
                  onPick={choisir}
                />
              )}
            </div>
          ) : (
            <Card className="flex items-center gap-3 p-3.5">
              <ClubLogo
                clubId={booking.clubId!}
                name={booking.clubName}
                className="size-11"
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug">{booking.clubName}</p>
                <p className="truncate text-sm text-[var(--color-ink-faint)]">
                  {clubSelectionne?.region || t('book.clubSelected')}
                </p>
                {booking.clubPlayerType !== 'A' && (
                  <p className="mt-0.5 text-sm text-[var(--color-warning)]">
                    {t('book.notMemberHere')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setChangeClub(true)}
                className="shrink-0 rounded-full px-3 py-2 text-sm font-medium text-[var(--color-brand)] active:bg-[var(--color-surface-alt)]"
              >
                {t('book.change')}
              </button>
            </Card>
          )}
        </section>

        {/*
          Le reste des criteres (date, trous, parcours, tranche, joueurs) ne
          s affiche qu une fois le club fige : pendant qu on en change, seule
          la liste des clubs a un sens.
        */}
        {!choisitClub && (
          <>

        {/*
          Parcours : chaque parcours a son propre calendrier d ouverture, donc
          le choix est explicite et place juste apres le club. Le nombre de
          trous en decoule. Affiche des qu il y a au moins un parcours.
        */}
        {courses.length > 0 && (
          <section>
            <SectionTitle title={courses.length > 1 ? t('book.whichCourse') : t('book.course')} />
            {courses.length > 1 ? (
              // Plusieurs parcours : menu sur-mesure aux couleurs de l app.
              <CourseSelect
                courses={courses}
                value={booking.courseOutId}
                onChange={choisirParcours}
              />
            ) : (
              // Un seul parcours : simple information, pas de choix a faire.
              <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-alt)]">
                  <IconFlag width={18} height={18} className="text-[var(--color-brand)]" />
                </span>
                <p className="min-w-0 flex-1 truncate text-sm font-medium">
                  {selectedCourse?.label[lang] || selectedCourse?.label.fr || selectedCourse?.name
                    || courses[0]?.label[lang] || courses[0]?.label.fr || courses[0]?.name}
                </p>
              </div>
            )}
            {(selectedCourse?.shortDescription[lang] || selectedCourse?.shortDescription.fr) && (
              <p className="mt-2 text-sm text-[var(--color-ink-faint)]">
                {selectedCourse?.shortDescription[lang] || selectedCourse?.shortDescription.fr}
              </p>
            )}
          </section>
        )}

        {/* Date */}
        {window && (
          <section>
            <SectionTitle
              title={t('book.whichDay')}
              action={
                <DatePickerButton
                  value={booking.date ?? window.minDate}
                  min={window.minDate}
                  max={window.maxDate}
                  onChange={(iso) => booking.setDate(iso)}
                />
              }
            />
            <DateStrip
              days={days}
              value={booking.date}
              allowedDays={me?.member.allowedDays ?? []}
              onPick={(iso) => booking.setDate(iso)}
            />
            {booking.date && (
              <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
                {formatDayLong(booking.date)}
              </p>
            )}
            {booking.date && dayAllowed && (
              <div className="mt-3">
                <WeatherStrip clubId={booking.clubId} date={booking.date} />
              </div>
            )}
            {!dayAllowed && (
              <Card className="mt-3 flex items-start gap-2.5 border-[var(--color-warning)]/30 bg-[var(--color-warning)]/8 p-3">
                <IconWarning width={18} height={18} className="mt-0.5 shrink-0 text-[var(--color-warning)]" />
                <p className="text-sm">
                  {t('book.formulaNoDay')}
                </p>
              </Card>
            )}
          </section>
        )}

        {/*
          Nombre de trous. Un club 18 trous laisse choisir 9 ou 18 ; un club
          qui n a qu un seul format le montre grise (SEL_9_18..Etat = Grise),
          le choix etant impose.
        */}
        {availableHoles.length > 0 && (
          <section>
            <p className="mb-2 text-sm font-medium text-[var(--color-ink-soft)]">{t('book.holesCount')}</p>
            <Segmented
              label={t('book.holesCount')}
              value={booking.holes}
              onChange={(v) => booking.setHoles(v)}
              disabled={availableHoles.length === 1}
              options={availableHoles.map((h) => ({ value: h, label: `${h} ${t('home.holes')}` }))}
            />
          </section>
        )}

        <PlayersPanel maxPlayers={maxPlayers} courseNumber={numeroTerrain} />

        {/* Tranche horaire */}
        <section>
          <SectionTitle title={t('book.timeOfDay')} />
          <div
            role="radiogroup"
            aria-label={t('book.timeOfDay')}
            className="flex gap-1 rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] p-1"
          >
            {([
              { value: 'matin' as const, label: t('book.morning') },
              { value: 'midi' as const, label: t('book.noon') },
              { value: 'apresmidi' as const, label: t('book.afternoon') },
            ]).map((o) => {
              const passe = periodPassed(o.value);
              const active = booking.period === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={passe}
                  onClick={() => booking.setPeriod(
                    o.value,
                    rules?.firstStart ?? '07:00',
                    rules?.lastStart ?? '18:00',
                    earliest ?? undefined,
                  )}
                  className={clsx(
                    'min-h-10 flex-1 rounded-[var(--radius-pill)] px-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-sm'
                      : 'text-[var(--color-ink-soft)]',
                    passe && 'cursor-not-allowed opacity-35',
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          {rules && (
            <p className="mt-2 text-sm text-[var(--color-ink-faint)]">
              {earliest && periodPassed(booking.period)
                ? t('book.periodPassed')
                : earliest && booking.timeFrom > periodBounds(booking.period, rules.firstStart, rules.lastStart).from
                  ? t('book.departuresFrom', { time: booking.timeFrom })
                  : t('book.departuresFromTo', periodBounds(booking.period, rules.firstStart, rules.lastStart))}
            </p>
          )}
          {earliest && !firstAvailablePeriod && (
            <Card className="mt-3 flex items-start gap-2.5 border-[var(--color-warning)]/30 bg-[var(--color-warning)]/8 p-3">
              <IconWarning width={18} height={18} className="mt-0.5 shrink-0 text-[var(--color-warning)]" />
              <p className="text-sm">
                {t('book.noMoreToday')}
              </p>
            </Card>
          )}
        </section>
          </>
        )}
      </main>

      <Dialog
        open={avertissement !== null}
        onClose={() => setAvertissement(null)}
        title={t('book.notMemberTitle')}
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-warning)]/12">
              <IconWarning width={19} height={19} className="text-[var(--color-warning)]" />
            </span>
            <p className="text-sm text-[var(--color-ink-soft)]">
              {t('book.notMemberBody1')}{' '}
              <strong className="text-[var(--color-ink)]">{avertissement?.name}</strong>
              {t('book.notMemberBody2')}
            </p>
          </div>
          <div className="flex gap-2.5">
            <Button variant="outline" full onClick={() => setAvertissement(null)}>
              {t('book.back')}
            </Button>
            <Button full onClick={confirmerNonMembre}>
              {t('book.continue')}
            </Button>
          </div>
        </div>
      </Dialog>

      <StickyFooter>
        <Button
          size="lg" full
          disabled={!canContinue}
          loading={!choisitClub && info.isPending}
          onClick={() => navigate('/reserver/creneaux')}
        >
          {choisitClub ? t('book.chooseClub') : t('book.seeDepartures')}
        </Button>
      </StickyFooter>

    </div>
  );
}


/** Parcours affichable dans le menu (sous-ensemble du type Course). */
interface CourseOption {
  outId: string;
  number: string;
  name: string;
  label: { fr: string; en: string };
}

/**
 * Menu deroulant des parcours, aux couleurs de l app.
 *
 * Remplace le <select> natif dont la liste systeme (fond bleu) jurait avec
 * le reste de l interface. Fermeture au clic exterieur et a la touche Echap.
 */
function CourseSelect({
  courses, value, onChange,
}: {
  courses: CourseOption[];
  value: string;
  onChange: (outId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = courses.find((c) => c.outId === value) ?? courses[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-3.5 text-left active:scale-[0.995]"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-alt)]">
          <IconFlag width={18} height={18} className="text-[var(--color-brand)]" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {selected?.label.fr || selected?.name}
        </span>
        <IconChevron
          width={18}
          height={18}
          className={clsx(
            'shrink-0 text-[var(--color-ink-faint)] transition-transform',
            open ? '-rotate-90' : 'rotate-90',
          )}
        />
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[0_12px_32px_rgba(19,26,21,0.16)]">
          <ul role="listbox" className="max-h-64 overflow-auto py-1">
            {courses.map((c) => {
              const active = c.outId === value;
              return (
                <li key={`${c.outId}-${c.number}`} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => { onChange(c.outId); setOpen(false); }}
                    className={clsx(
                      'flex w-full items-center gap-2 px-4 py-3 text-left text-sm',
                      active
                        ? 'bg-[var(--color-brand)]/8 font-medium text-[var(--color-brand)]'
                        : 'active:bg-[var(--color-surface-alt)]',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{c.label.fr || c.name}</span>
                    {active && (
                      <IconCheck width={17} height={17} className="shrink-0 text-[var(--color-brand)]" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function ClubGroup({
  clubs, selected, onPick, title, hint,
}: {
  clubs: ClubRow[];
  selected: string | null;
  onPick: (club: ClubRow) => void;
  title?: string;
  hint?: string;
}) {
  return (
    <section>
      {title && (
        <div className="mb-2">
          <p className="text-[0.68rem] font-medium tracking-[0.12em] text-[var(--color-ink-faint)] uppercase">
            {title}
          </p>
          {hint && <p className="text-sm text-[var(--color-ink-soft)]">{hint}</p>}
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {clubs.map((c) => (
          <li key={c.clubId}>
            <Card
              onClick={() => onPick(c)}
              className={clsx(
                'flex items-center gap-3 p-3.5',
                c.clubId === selected && 'border-[var(--color-brand)]',
              )}
            >
              <ClubLogo clubId={c.clubId} name={c.name} className="size-11" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.name}</p>
                {c.region && (
                  <p className="truncate text-sm text-[var(--color-ink-faint)]">{c.region}</p>
                )}
              </div>
              {c.clubId === selected && (
                <span className="size-2.5 shrink-0 rounded-full bg-[var(--color-brand)]" />
              )}
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Bande de dates horizontale.
 *
 * Deux problemes de decouvrabilite regles ici : un degrade sur le bord droit
 * (et gauche) montre qu il reste des dates a faire defiler, et la date
 * selectionnee est ramenee dans le champ de vision a l ouverture. Le bouton
 * calendrier a cote du titre permet d atteindre n importe quelle date d un
 * geste, sans defiler.
 */
function DateStrip({
  days, value, allowedDays, onPick,
}: {
  days: string[];
  value: string | null;
  allowedDays: string[];
  onPick: (iso: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const actif = useRef<HTMLButtonElement>(null);
  const [debut, setDebut] = useState(true);
  const [fin, setFin] = useState(false);

  function majBords(): void {
    const el = scroller.current;
    if (!el) return;
    setDebut(el.scrollLeft <= 2);
    setFin(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }

  useEffect(() => {
    majBords();
    // Amene la date selectionnee dans le champ de vision.
    actif.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [value, days.length]);

  return (
    <div className="relative -mx-4">
      <div
        ref={scroller}
        onScroll={majBords}
        className="scroll-x flex gap-2 px-4 pb-1"
      >
        {days.map((iso) => {
          const d = dateParts(iso);
          const active = iso === value;
          const allowed = isDayAllowed(iso, allowedDays);
          return (
            <button
              key={iso}
              ref={active ? actif : undefined}
              type="button"
              onClick={() => onPick(iso)}
              disabled={!allowed}
              aria-pressed={active}
              className={clsx(
                'snap-item grid w-16 shrink-0 place-items-center rounded-2xl border py-3 transition-colors',
                active
                  ? 'border-transparent bg-[var(--color-brand)] text-white'
                  : 'border-[var(--color-line)] bg-[var(--color-surface)]',
                !allowed && 'opacity-35',
              )}
            >
              <span className="text-[0.6rem] font-semibold tracking-wider opacity-70">
                {d.weekday}
              </span>
              <span className="text-lg leading-tight font-semibold tabular">{d.day}</span>
              <span className="text-[0.6rem] font-semibold tracking-wider opacity-70">
                {d.month}
              </span>
            </button>
          );
        })}
      </div>

      {/* Degrades : indiquent qu il reste des dates a faire defiler. */}
      {!debut && (
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[var(--color-canvas)] to-transparent" />
      )}
      {!fin && (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[var(--color-canvas)] to-transparent" />
      )}
    </div>
  );
}

/** Bouton calendrier : ouvre le selecteur natif, borne a la fenetre de resa. */
function DatePickerButton({
  value, min, max, onChange,
}: {
  value: string; min: string; max: string; onChange: (iso: string) => void;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      onClick={() => {
        const el = input.current;
        if (!el) return;
        // showPicker ouvre le calendrier natif ; sinon on rabat sur le focus.
        if (typeof el.showPicker === 'function') el.showPicker();
        else el.focus();
      }}
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-medium active:bg-[var(--color-surface-alt)]"
    >
      <IconCalendar width={16} height={16} />
      {t('book.calendar')}
      <input
        ref={input}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => { if (e.target.value) onChange(e.target.value); }}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
    </button>
  );
}

/** Libelle de la plage couverte par la tranche choisie. */
export { apiToIso };
