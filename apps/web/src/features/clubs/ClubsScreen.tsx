import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClubs, useClubInfo, useClubPhoto, type ClubRow } from '@/lib/queries';
import { useBooking } from '@/features/reservation/store';
import {
  Card, Badge, Button, ClubLogo, SkeletonList, EmptyState, ErrorState,
} from '@/components/ui';
import { PageHeader } from '@/components/layout';
import { IconFlag, IconUser, IconChevron, IconClose } from '@/components/icons';
import { isoToApi } from '@/lib/format';
import { useT, useLang } from '@/i18n';

/**
 * Page "Les clubs" : toutes les fiches des clubs ou l adherent peut reserver.
 *
 * Combine la liste reservable (/api/clubs) et la fiche detaillee de chaque club
 * (/api/clubs/:id/info) : parcours, trous, joueurs max, fenetre de reservation,
 * horaires, annulation, contact et localisation Google Maps.
 *
 * Fonctionnalite ISOLEE : la retirer = enlever ce fichier, sa route et l entree
 * de menu.
 */
export function ClubsScreen() {
  const t = useT();
  const clubs = useClubs();
  const single = clubs.data?.clubs.length === 1;
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  /** Affiche un message bref (toast), auto-efface apres 2,5 s. */
  const notify = (msg: string): void => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2500);
  };

  return (
    <div className="pb-10">
      <PageHeader title={single ? t('menu.club') : t('menu.clubs')} subtitle={t('clubs.subtitle')} />
      <main className="flex flex-col gap-4 px-4 py-5">
        {clubs.isPending ? (
          <SkeletonList rows={3} height="h-56" />
        ) : clubs.isError ? (
          <ErrorState message={t('clubs.loadError')} onRetry={() => clubs.refetch()} />
        ) : (clubs.data?.clubs.length ?? 0) === 0 ? (
          <EmptyState title={t('clubs.noneTitle')} description={t('clubs.noneDesc')} />
        ) : (
          clubs.data!.clubs.map((c) => <ClubCard key={c.clubId} club={c} notify={notify} />)
        )}
      </main>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 bottom-[calc(1.5rem+var(--safe-bottom))] z-50 flex justify-center px-4"
        >
          <div className="rounded-full bg-[var(--color-brand)] px-4 py-2.5 text-sm font-medium text-white shadow-[0_8px_24px_rgba(19,26,21,0.28)]">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

const TODAY_API = isoToApi(new Date().toISOString().slice(0, 10));

function ClubCard({ club, notify }: { club: ClubRow; notify: (msg: string) => void }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const navigate = useNavigate();
  const [showPhoto, setShowPhoto] = useState(false);
  const setClub = useBooking((s) => s.setClub);
  const info = useClubInfo(club.clubId, TODAY_API);
  const d = info.data;

  // Photo de club : endpoint dedie (appel amont en mode V, page Les clubs
  // uniquement). Sert de fond a la banniere ; sinon degrade decoratif.
  const photo = useClubPhoto(club.clubId).data?.image ?? null;
  // Description du club (portee parcours) : la courte de preference.
  const description = (d?.courses ?? [])
    .map((co) =>
      co.shortDescription?.[lang] || co.shortDescription?.fr
      || co.longDescription?.[lang] || co.longDescription?.fr || '')
    .find(Boolean) ?? '';

  // Trous jouables (union des parcours), comme l ecran de reservation.
  const holes = new Set<number>();
  for (const co of d?.courses ?? []) {
    const max = co.holes === 0 ? 18 : co.holes;
    if (max >= 9) holes.add(9);
    if (max >= 18) holes.add(18);
  }
  const holesLabel = holes.size === 0 ? '--'
    : [...holes].sort((a, b) => a - b).join(` ${t('clubs.holesAnd')} `);

  function reserveHere(): void {
    setClub({
      clubId: club.clubId, name: club.name,
      playerType: club.playerType, playerId: club.playerId,
    });
    navigate('/reserver');
  }

  const maps = d?.geo
    ? `https://www.google.com/maps/search/?api=1&query=${d.geo.lat},${d.geo.lng}`
    : null;
  const website = d?.website
    ? (/^https?:\/\//i.test(d.website) ? d.website : `https://${d.website}`)
    : null;

  return (
    <>
    <Card className="overflow-hidden">
      {/* Banniere : photo du club si dispo, sinon degrade decoratif de marque. */}
      <div
        className="relative flex items-end gap-3 overflow-hidden p-4 pt-9"
        style={photo
          ? {
            backgroundImage:
              `linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.6)), url("${photo}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }
          : { background: 'linear-gradient(135deg, var(--color-brand), var(--color-brand-soft))' }}
      >
        {!photo && (
          <>
            <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-12 size-36 rounded-full bg-white/10" />
            <span aria-hidden="true" className="pointer-events-none absolute right-8 top-3 size-20 rounded-full border border-white/10" />
          </>
        )}
        <ClubLogo clubId={club.clubId} name={club.name} className="relative size-12 shrink-0 ring-2 ring-white/70" />
        <div className="relative min-w-0 flex-1">
          <p className="font-semibold leading-tight text-white">{club.name}</p>
          {club.region && (
            <p className="truncate text-sm text-white/75">{club.region}</p>
          )}
        </div>
        <span
          className={[
            'relative shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
            club.isMember
              ? 'bg-[var(--color-accent)] text-[var(--color-accent-ink)]'
              : 'bg-white/20 text-white',
          ].join(' ')}
        >
          {club.isMember ? t('clubs.member') : t('clubs.visitor')}
        </span>
        {photo && (
          <button
            type="button"
            onClick={() => setShowPhoto(true)}
            aria-label={t('clubs.enlargePhoto')}
            className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-black/35 text-white backdrop-blur-sm active:scale-95"
          >
            <MaximizeIcon />
          </button>
        )}
      </div>

      {info.isPending ? (
        <div className="px-4 pb-4"><SkeletonList rows={1} height="h-20" /></div>
      ) : !d ? (
        <p className="px-4 pb-4 text-sm text-[var(--color-ink-faint)]">
          {t('clubs.detailsUnavailable')}
        </p>
      ) : (
        <>
          {/* Statistiques cles */}
          <div className="grid grid-cols-3 divide-x divide-[var(--color-line)] border-y border-[var(--color-line)] bg-[var(--color-surface-alt)]/40">
            <Stat value={String(d.courses.length)} label={t('clubs.coursesStat')} />
            <Stat value={holesLabel} label={t('home.holes')} />
            <Stat value={String(d.rules.maxPlayers)} label={t('clubs.maxPlayers')} />
          </div>

          <div className="flex flex-col gap-4 p-4">
            {/* Description du club (si l API en fournit une) */}
            {description && <ClubDescription text={description} />}

            {/* Parcours */}
            {d.courses.length > 0 && (
              <section>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">
                  {d.courses.length > 1 ? t('clubs.coursesTitle', { n: d.courses.length }) : t('book.course')}
                </p>
                <ul className="flex flex-col gap-2">
                  {d.courses.map((co, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-alt)]/40 p-2.5"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--color-surface)] text-[var(--color-brand)]">
                        <IconFlag width={17} height={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{co.label[lang] || co.label.fr || co.name}</p>
                        {co.requiredIndex > 0 && (
                          <p className="text-xs text-[var(--color-ink-faint)]">
                            {t('clubs.requiredIndex', { n: co.requiredIndex })}
                          </p>
                        )}
                      </div>
                      <Badge>
                        {co.holes === 0 ? '9 / 18' : co.holes} {t('home.holes')}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Infos pratiques */}
            <section>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">
                {t('clubs.practicalInfo')}
              </p>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                <Info label={t('resa.reservation')} value={t('clubs.upToDays', { n: d.rules.maxDaysAhead })} />
                <Info label={t('clubs.departures')} value={`${d.rules.firstStart} – ${d.rules.lastStart}`} />
              </dl>
            </section>

            {/* Contact & localisation */}
            {(maps || d.phone || website || d.reservationEmail) && (
              <div className="flex flex-wrap gap-2">
                {maps && <LinkChip href={maps} icon={<PinIcon />} label={t('clubs.location')} />}
                {d.phone && <PhoneChip phone={d.phone} notify={notify} />}
                {website && <LinkChip href={website} icon={<GlobeIcon />} label={t('clubs.website')} />}
                {d.reservationEmail && (
                  <LinkChip href={`mailto:${d.reservationEmail}`} icon={<MailIcon />} label={t('clubs.email')} />
                )}
              </div>
            )}

            {club.bookable && (
              <Button full onClick={reserveHere} icon={<IconUser width={17} height={17} />}>
                {t('clubs.bookHere')}
              </Button>
            )}
          </div>
        </>
      )}
    </Card>

    {/* Visionneuse plein ecran de la photo. */}
    {showPhoto && photo && (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('clubs.photoOf', { name: club.name })}
        onClick={() => setShowPhoto(false)}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      >
        {/* Conteneur a la taille de l image : le bouton se colle a son coin. */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <img
            src={photo}
            alt={club.name}
            className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
          />
          <button
            type="button"
            onClick={() => setShowPhoto(false)}
            aria-label={t('common.close')}
            className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm active:scale-95"
          >
            <IconClose width={20} height={20} />
          </button>
        </div>
      </div>
    )}
    </>
  );
}

/** Description repliable : 3 lignes par defaut, "En savoir plus" si trop long. */
function ClubDescription({ text }: { text: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const long = text.length > 140;
  return (
    <div>
      <p
        className={[
          'text-sm leading-relaxed text-[var(--color-ink-soft)]',
          !open && long ? 'line-clamp-3' : '',
        ].join(' ')}
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-1 text-sm font-medium text-[var(--color-brand)] active:opacity-70"
        >
          {open ? t('clubs.showLess') : t('common.readMore')}
        </button>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center py-3">
      <span className="text-lg font-semibold tabular">{value}</span>
      <span className="text-xs text-[var(--color-ink-faint)]">{label}</span>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[var(--color-ink-faint)]">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

/**
 * Pastille telephone. Sur mobile (pointeur tactile), ouvre le clavier d appel ;
 * sur ordinateur (pas d app telephone), COPIE le numero et affiche un toast.
 */
function PhoneChip({ phone, notify }: { phone: string; notify: (msg: string) => void }) {
  const t = useT();
  const clean = phone.replace(/[^\d+]/g, '');

  function onClick(): void {
    const isMobile = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    if (isMobile) {
      window.location.href = `tel:${clean}`;
      return;
    }
    navigator.clipboard?.writeText(phone)
      .then(() => notify(t('clubs.phoneCopied')))
      .catch(() => notify(t('clubs.phoneNumber', { phone })));
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-medium active:scale-[0.98]"
    >
      <PhoneIcon />
      {phone}
    </button>
  );
}

function LinkChip({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  const external = /^https?:/i.test(href);
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-medium active:scale-[0.98]"
    >
      {icon}
      {label}
      <IconChevron width={13} height={13} className="text-[var(--color-ink-faint)]" />
    </a>
  );
}

/* Petites icones inline (localisation, telephone, site, e-mail). */
const iconBase = {
  width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.7,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};
const MaximizeIcon = () => (
  <svg
    width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
  >
    <path d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4" />
  </svg>
);
const PinIcon = () => (
  <svg {...iconBase}><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
);
const PhoneIcon = () => (
  <svg {...iconBase}><path d="M5 4h4l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z" /></svg>
);
const GlobeIcon = () => (
  <svg {...iconBase}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18Z" /></svg>
);
const MailIcon = () => (
  <svg {...iconBase}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>
);
