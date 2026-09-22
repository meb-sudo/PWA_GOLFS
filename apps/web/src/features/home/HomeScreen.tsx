import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useMe, useReservations, useNews, useNotifications } from '@/lib/queries';
import { countUnseen } from '@/lib/notifs';
import {
  Card, Badge, SectionTitle, SkeletonList, EmptyState, Button, Avatar,
} from '@/components/ui';
import { Screen } from '@/components/layout';
import { AssistantButton } from '@/components/AssistantButton';
import { ClubsStrip } from '@/features/clubs/ClubsStrip';
import { ClubsMap } from '@/features/clubs/ClubsMap';
import { themeForGroup } from '@/theme/groups';
import {
  IconPlus, IconCalendar, IconUser, IconNews, IconChevron,
  IconClock, IconBell, IconFlag,
} from '@/components/icons';
import {
  formatDayLong, dateParts, formatTime, statusLabel,
} from '@/lib/format';
import { useT, useLang } from '@/i18n';

export function HomeScreen() {
  const navigate = useNavigate();
  const t = useT();
  const { data: me } = useMe();
  const reservations = useReservations();
  const news = useNews();
  const notifications = useNotifications();

  const member = me?.member;
  // Logo du groupe : meme source que l ecran de connexion.
  const brand = me?.group ? themeForGroup(me.group) : null;
  const upcoming = (reservations.data?.reservations ?? []).slice(0, 3);
  const headline = news.data?.news[0];
  const unread = notifications.data
    ? countUnseen(notifications.data.notifications.map((n) => n.id))
    : 0;

  return (
    <Screen className="flex flex-col gap-5 pt-0">
      {/* Bandeau de marque : reprend la hierarchie de la maquette. */}
      {/*
        Le retrait horizontal fait deborder l en-tete de la gouttiere de
        Screen ; le retrait vertical, lui, avait ete ajoute pour compenser
        un padding desormais nul et remontait le logo hors de l’écran.
      */}
      <header className="-mx-4 px-4 pt-[calc(0.75rem+var(--safe-top))]">
        <div className="flex items-center justify-between py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {brand?.logo ? (
              // Pastille blanche sans filet : une bordure faisait ressembler
              // le bloc a un champ de saisie. L ombre douce suffit a poser le
              // logo sur le fond clair, y compris pour un logo opaque.
              <span className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center rounded-2xl bg-white px-2.5 shadow-[0_1px_3px_rgba(19,26,21,0.10)]">
                <img
                  src={brand.logo}
                  alt=""
                  className="h-7 w-auto max-w-24 object-contain"
                />
              </span>
            ) : (
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--color-brand)]">
                <IconFlag width={20} height={20} className="text-[var(--color-accent)]" />
              </span>
            )}
            {brand && (
              // Deux niveaux : la marque en encre pleine, sa fonction en
              // dessous. Une seule ligne en capitales grises faisait
              // administratif plutot qu identitaire.
              <div className="min-w-0">
                <p className="truncate text-[0.9rem] leading-tight font-semibold tracking-tight">
                  {brand.label}
                </p>
                <p className="truncate text-[0.68rem] leading-tight text-[var(--color-ink-faint)]">
                  {t('home.memberSpace')}
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <Link
              to="/notifications"
              aria-label={`Notifications${unread ? `, ${unread} non lues` : ''}`}
              className="relative grid size-11 place-items-center rounded-full active:bg-[var(--color-surface-alt)]"
            >
              <IconBell width={22} height={22} />
              {unread > 0 && (
                <span className="absolute top-2 right-2 size-2 rounded-full bg-[var(--color-accent)] ring-2 ring-[var(--color-canvas)]" />
              )}
            </Link>
            <Link to="/profil" aria-label="Mon profil" className="rounded-full">
              <Avatar name={member?.fullName ?? ''} className="size-10 text-sm" />
            </Link>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative overflow-hidden rounded-[1.5rem] bg-[var(--color-brand)] px-5 py-6 text-white"
        >
          {/* Fond : carte des clubs du groupe (decorative), sous un voile vert
              plus fort a gauche pour garder le texte parfaitement lisible.
              isolate + z-0 contient les z-index internes de Leaflet ; le voile
              (z-10) et le texte (z-20) restent au-dessus. */}
          <ClubsMap className="absolute inset-0 isolate z-0" />
          <div
            aria-hidden="true"
            className="absolute inset-0 z-10 bg-gradient-to-r from-[var(--color-brand)] via-[var(--color-brand)]/80 to-[var(--color-brand)]/35"
          />
          {/* Cercles decoratifs, par-dessus la carte et le voile. */}
          <div aria-hidden="true" className="absolute -top-10 -right-8 z-10 size-40 rounded-full bg-[var(--color-accent)]/20" />
          <div aria-hidden="true" className="absolute top-8 right-2 z-10 size-32 rounded-full border border-white/12" />
          <div className="relative z-20">
            <p className="text-[0.7rem] font-medium tracking-[0.14em] text-white/60 uppercase">
              {formatDayLong(new Date().toISOString().slice(0, 10))}
            </p>
            <h1 className="mt-3 text-[1.9rem] leading-tight font-semibold tracking-tight">
              {new Date().getHours() < 18
                ? t('home.greetingMorning')
                : t('home.greetingEvening')},
              <br />
              <span className="text-[var(--color-accent-on-brand)]">
                {member?.firstName || t('home.welcome')}.
              </span>
            </h1>
            <p className="mt-3 max-w-[30ch] text-sm text-white/70">
              {upcoming.length > 0 ? t('home.heroNext') : t('home.heroHint')}
            </p>
          </div>
        </motion.div>
      </header>

      {member?.membershipWarning && (
        <Card className="flex items-start gap-3 border-[var(--color-warning)]/30 bg-[var(--color-warning)]/8 p-4">
          <IconClock width={20} height={20} className="mt-0.5 shrink-0 text-[var(--color-warning)]" />
          <p className="text-sm text-[var(--color-ink)]">{member.membershipWarning}</p>
        </Card>
      )}

      {/* Actions rapides */}
      <section>
        <SectionTitle eyebrow={t('home.eyebrow')} title={t('home.whatToDo')} />
        <div className="grid grid-cols-2 gap-2.5">
          <QuickAction
            to="/reserver" label={t('home.newBooking')}
            icon={<IconPlus width={17} height={17} />} highlight fresh
          />
          <QuickAction
            to="/reservations" label={t('home.myBookings')}
            icon={<IconCalendar width={17} height={17} />}
          />
          <QuickAction
            to="/profil" label={t('home.myInfo')}
            icon={<IconUser width={17} height={17} />}
          />
          <QuickAction
            to="/actualites" label={t('home.news')}
            icon={<IconNews width={17} height={17} />}
          />
        </div>
      </section>

      {/* Prochains departs */}
      <section>
        <SectionTitle
          eyebrow={t('home.agenda')}
          title={t('home.nextDepartures')}
          action={
            upcoming.length > 0 ? (
              <Link
                to="/reservations"
                className="flex shrink-0 items-center gap-0.5 text-sm font-medium text-[var(--color-ink-soft)]"
              >
                {t('home.seeAll')} <IconChevron width={16} height={16} />
              </Link>
            ) : undefined
          }
        />

        {reservations.isPending ? (
          <SkeletonList rows={2} height="h-[86px]" />
        ) : upcoming.length === 0 ? (
          <EmptyState
            title={t('home.noDeparture')}
            description={t('home.noDepartureHint')}
            action={
              <Button
                variant="accent"
                onClick={() => navigate('/reserver', { state: { fresh: true } })}
              >
                {t('home.bookDeparture')}
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {upcoming.map((r, i) => {
              const d = dateParts(r.date);
              const status = statusLabel(r.status);
              return (
                <motion.li
                  key={r.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.25 }}
                >
                  <Card
                    onClick={() => navigate(`/reservations/${r.id}?club=${r.clubId}`)}
                    className="flex items-center gap-3 p-3"
                  >
                    <div className="grid w-14 shrink-0 place-items-center rounded-xl bg-[var(--color-accent)]/22 py-2">
                      <span className="text-[0.6rem] font-semibold tracking-wider text-[var(--color-ink-soft)]">
                        {d.weekday}
                      </span>
                      <span className="text-xl leading-none font-semibold tabular">{d.day}</span>
                      <span className="text-[0.6rem] font-semibold tracking-wider text-[var(--color-ink-soft)]">
                        {d.month}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[var(--color-ink-soft)]">
                        <IconClock width={14} height={14} />
                        <span className="text-sm font-medium tabular">{formatTime(r.time)}</span>
                      </div>
                      <p className="mt-0.5 truncate font-medium">{r.clubName}</p>
                      <p className="truncate text-sm text-[var(--color-ink-faint)]">
                        {r.holes} {t('home.holes')} · {r.players}{' '}
                        {r.players > 1 ? t('home.players') : t('home.player')}
                        {r.courseName ? ` · ${r.courseName}` : ''}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {r.awaitingPayment
                        ? <Badge tone="warning">{t('home.toPay')}</Badge>
                        : <Badge tone={status.tone}>{status.label}</Badge>}
                      <IconChevron width={18} height={18} className="text-[var(--color-ink-faint)]" />
                    </div>
                  </Card>
                </motion.li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Nos golfs : acces rapide et visuel aux clubs */}
      <ClubsStrip />

      {/* Actualite a la une */}
      {headline && (
        <section>
          <SectionTitle eyebrow={t('home.dontMiss')} title={t('home.news')} />
          <Card
            onClick={() => navigate(`/actualites/${headline.id}`)}
            className="overflow-hidden"
          >
            {headline.image && (
              <img
                src={headline.image}
                alt=""
                loading="lazy"
                className="h-40 w-full object-cover"
              />
            )}
            <div className="p-4">
              <p className="font-medium">{headline.title}</p>
              {headline.excerpt && (
                <p className="mt-1 line-clamp-2 text-sm text-[var(--color-ink-soft)]">
                  {headline.excerpt}
                </p>
              )}
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-brand)]">
                {t('common.readMore')} <IconChevron width={15} height={15} />
              </span>
            </div>
          </Card>
        </section>
      )}

      <AssistantButton />
    </Screen>
  );
}

/** Bascule rapide de langue (FR ↔ EN) dans l en-tete. */
function LanguageToggle() {
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  const next = lang === 'fr' ? 'en' : 'fr';
  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      aria-label={`Passer en ${next === 'en' ? 'anglais' : 'français'}`}
      className="flex h-11 items-center gap-1 rounded-full px-2.5 active:bg-[var(--color-surface-alt)]"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {/* On affiche la langue CIBLE (celle vers laquelle on bascule). */}
      <span className="text-sm font-semibold uppercase text-[var(--color-ink-soft)]">{next}</span>
    </button>
  );
}

function QuickAction({
  to, label, icon, highlight, fresh, wide,
}: {
  to: string; label: string; icon: React.ReactNode;
  highlight?: boolean;
  /** Repart d un brouillon vierge plutot que de reprendre le precedent. */
  fresh?: boolean;
  /** Occupe toute la largeur (les deux colonnes de la grille). */
  wide?: boolean;
}) {
  return (
    <Link
      to={to}
      state={fresh ? { fresh: true } : undefined}
      className={[
        'flex items-center gap-2.5 rounded-[var(--radius-card)] border p-3',
        'transition-transform active:scale-[0.98]',
        wide ? 'col-span-2' : '',
        highlight
          ? 'border-transparent bg-[var(--color-accent)] text-[var(--color-accent-ink)]'
          : 'border-[var(--color-line)] bg-[var(--color-surface)]',
      ].join(' ')}
    >
      <span className={[
        'grid size-7 shrink-0 place-items-center rounded-lg',
        highlight ? 'bg-black/8' : 'bg-[var(--color-surface-alt)]',
      ].join(' ')}>
        {icon}
      </span>
      {/* Disposition compacte : icone a gauche, libelle a droite. Le texte
          peut passer sur deux lignes sans etre tronque -> tuiles basses,
          libelles entiers, et "Prochains departs" visible sans scroller. */}
      <span className="min-w-0 flex-1 text-[0.8rem] leading-tight font-medium tracking-tight">
        {label}
      </span>
    </Link>
  );
}
