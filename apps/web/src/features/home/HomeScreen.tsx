import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useMe, useReservations, useNews, useNotifications } from '@/lib/queries';
import { countUnseen } from '@/lib/notifs';
import {
  Card, Badge, SectionTitle, SkeletonList, EmptyState, Button, Avatar,
} from '@/components/ui';
import { Screen } from '@/components/layout';
import { HelpButton } from '@/components/HelpButton';
import { themeForGroup } from '@/theme/groups';
import {
  IconPlus, IconCalendar, IconUser, IconNews, IconChevron,
  IconClock, IconBell, IconFlag,
} from '@/components/icons';
import {
  greeting, formatDayLong, dateParts, formatTime, statusLabel,
} from '@/lib/format';

export function HomeScreen() {
  const navigate = useNavigate();
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
    <Screen className="flex flex-col gap-7 pt-0">
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
                  Espace membres
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
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
          <div aria-hidden="true" className="absolute -top-10 -right-8 size-40 rounded-full bg-[var(--color-accent)]/20" />
          <div aria-hidden="true" className="absolute top-8 right-2 size-32 rounded-full border border-white/12" />
          <div className="relative">
            <p className="text-[0.7rem] font-medium tracking-[0.14em] text-white/60 uppercase">
              {formatDayLong(new Date().toISOString().slice(0, 10))}
            </p>
            <h1 className="mt-3 text-[1.9rem] leading-tight font-semibold tracking-tight">
              {greeting()},
              <br />
              <span className="text-[var(--color-accent)]">
                {member?.firstName || 'bienvenue'}.
              </span>
            </h1>
            <p className="mt-3 max-w-[30ch] text-sm text-white/70">
              {upcoming.length > 0
                ? 'Votre prochain départ vous attend.'
                : 'Reservez votre prochain départ en quelques touches.'}
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
        <SectionTitle eyebrow="Espace membre" title="Que souhaitez-vous faire ?" />
        <div className="grid grid-cols-2 gap-3">
          <QuickAction
            to="/reserver" label="Nouvelle réservation"
            icon={<IconPlus width={20} height={20} />} highlight fresh
          />
          <QuickAction
            to="/reservations" label="Mes réservations"
            icon={<IconCalendar width={20} height={20} />}
          />
          <QuickAction
            to="/profil" label="Mes informations"
            icon={<IconUser width={20} height={20} />}
          />
          <QuickAction
            to="/actualites" label="Actualités"
            icon={<IconNews width={20} height={20} />}
          />
        </div>
      </section>

      {/* Prochains departs */}
      <section>
        <SectionTitle
          eyebrow="Votre agenda"
          title="Prochains départs"
          action={
            upcoming.length > 0 ? (
              <Link
                to="/reservations"
                className="flex shrink-0 items-center gap-0.5 text-sm font-medium text-[var(--color-ink-soft)]"
              >
                Tout voir <IconChevron width={16} height={16} />
              </Link>
            ) : undefined
          }
        />

        {reservations.isPending ? (
          <SkeletonList rows={2} height="h-[86px]" />
        ) : upcoming.length === 0 ? (
          <EmptyState
            title="Aucun départ prévu"
            description="Reservez votre prochain parcours des maintenant."
            action={
              <Button
                variant="accent"
                onClick={() => navigate('/reserver', { state: { fresh: true } })}
              >
                Réserver un départ
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
                        {r.holes} trous · {r.players} joueur{r.players > 1 ? 's' : ''}
                        {r.courseName ? ` · ${r.courseName}` : ''}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {r.awaitingPayment
                        ? <Badge tone="warning">A payer</Badge>
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

      {/* Actualite a la une */}
      {headline && (
        <section>
          <SectionTitle eyebrow="A ne pas manquer" title="Actualités" />
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
                En savoir plus <IconChevron width={15} height={15} />
              </span>
            </div>
          </Card>
        </section>
      )}

      <HelpButton />
    </Screen>
  );
}

function QuickAction({
  to, label, icon, highlight, fresh,
}: {
  to: string; label: string; icon: React.ReactNode;
  highlight?: boolean;
  /** Repart d un brouillon vierge plutot que de reprendre le precedent. */
  fresh?: boolean;
}) {
  return (
    <Link
      to={to}
      state={fresh ? { fresh: true } : undefined}
      className={[
        'flex items-center gap-2 rounded-[var(--radius-card)] border p-3',
        'transition-transform active:scale-[0.98]',
        highlight
          ? 'border-transparent bg-[var(--color-accent)] text-[var(--color-accent-ink)]'
          : 'border-[var(--color-line)] bg-[var(--color-surface)]',
      ].join(' ')}
    >
      <span className={[
        'grid size-8 shrink-0 place-items-center rounded-lg',
        highlight ? 'bg-black/8' : 'bg-[var(--color-surface-alt)]',
      ].join(' ')}>
        {icon}
      </span>
      {/* Tuiles etroites (grille 2 colonnes) : on garde le libelle sur une
          seule ligne. Pas de chevron ici, la tuile entiere est cliquable. */}
      <span className="min-w-0 flex-1 truncate text-[0.82rem] leading-tight font-medium tracking-tight">
        {label}
      </span>
    </Link>
  );
}
