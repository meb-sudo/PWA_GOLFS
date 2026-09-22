import { Link } from 'react-router-dom';
import { useClubs, useClubPhoto, type ClubRow } from '@/lib/queries';
import { ClubLogo } from '@/components/ui';
import { IconChevron } from '@/components/icons';
import { useT } from '@/i18n';

/**
 * Bande horizontale "Nos golfs" sur l accueil : cartes photo + logo + nom,
 * defilement horizontal, un tap ouvre la page Les clubs. Reutilise l endpoint
 * photo (mode V) et le fallback degrade. Fonctionnalite ISOLEE.
 */
export function ClubsStrip() {
  const t = useT();
  const clubs = useClubs();
  const list = clubs.data?.clubs ?? [];

  if (clubs.isPending || list.length === 0) return null;

  // Cas d un seul club : libelles au singulier, carte pleine largeur, pas de
  // "Tout voir" (rien de plus a voir) ni de defilement.
  const single = list.length === 1;

  return (
    <section>
      {/* Meme style que les autres sections : eyebrow + grand titre. */}
      <div className="mb-3">
        <p className="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">
          {single ? t('menu.club') : t('menu.clubs')}
        </p>
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-[1.35rem] font-semibold leading-tight tracking-tight">
            {single ? t('home.ourClubSub') : t('home.ourClubsSub')}
          </h2>
          {!single && (
            <Link
              to="/clubs"
              className="mb-1 flex shrink-0 items-center gap-0.5 text-sm font-medium text-[var(--color-ink-soft)]"
            >
              {t('home.seeAll')} <IconChevron width={16} height={16} />
            </Link>
          )}
        </div>
      </div>
      {single ? (
        <ClubStripCard club={list[0]!} full />
      ) : (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {list.map((c) => <ClubStripCard key={c.clubId} club={c} />)}
        </div>
      )}
    </section>
  );
}

function ClubStripCard({ club, full }: { club: ClubRow; full?: boolean }) {
  const photo = useClubPhoto(club.clubId).data?.image ?? null;

  return (
    <Link
      to="/clubs"
      aria-label={club.name}
      className={[
        'relative flex h-32 flex-col justify-end overflow-hidden rounded-2xl active:scale-[0.98]',
        full ? 'w-full' : 'w-44 shrink-0 snap-start',
      ].join(' ')}
      style={photo
        ? {
          backgroundImage:
            `linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.68)), url("${photo}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
        : { background: 'linear-gradient(135deg, var(--color-brand), var(--color-brand-soft))' }}
    >
      <ClubLogo
        clubId={club.clubId}
        name={club.name}
        className="absolute left-2 top-2 size-8 ring-1 ring-white/60"
      />
      <div className="relative p-2.5">
        <p className="line-clamp-2 text-sm font-semibold leading-tight text-white">
          {club.name}
        </p>
        {club.region && (
          <p className="truncate text-xs text-white/75">{club.region}</p>
        )}
      </div>
    </Link>
  );
}
