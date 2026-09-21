import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  useMe, useCarnets, useUpdateEmail, useUpdateMobile, useLogout, useLegal,
  useClubName, useClubs,
} from '@/lib/queries';
import { mediaUrl, downloadMedia, ApiError } from '@/lib/api';
import {
  Card, Button, Field, Badge, EmptyState, ErrorState, SkeletonList, SectionTitle,
  Avatar,
} from '@/components/ui';
import { PageHeader, Screen, Sheet } from '@/components/layout';
import {
  IconUser, IconMail, IconPhone, IconCard, IconTicket, IconTrophy,
  IconChevron, IconBell, IconDownload, IconFlag,
} from '@/components/icons';
import { initialsOf, formatIndex, formatDateSafe } from '@/lib/format';
import { InstallMenuButton } from '@/components/InstallBanner';
import { ThemeSheet } from '@/features/theme/ThemeSheet';
import { LanguageSheet } from '@/features/language/LanguageSheet';
import { useT } from '@/i18n';

export function ProfileScreen() {
  const t = useT();
  const { data, isPending } = useMe();
  const member = data?.member;
  const clubName = useClubName(member?.clubId);
  const [editing, setEditing] = useState<'email' | 'mobile' | null>(null);

  if (isPending || !member) {
    return (
      <div>
        <PageHeader title={t('menu.myProfile')} />
        <main className="px-4 py-5"><SkeletonList rows={3} height="h-24" /></main>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <PageHeader title={t('menu.myProfile')} />

      <main className="flex flex-col gap-5 px-4 py-5">
        <Card className="flex items-center gap-4 p-5">
          <Avatar name={member.fullName} className="size-16 text-xl" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold">{member.fullName}</p>
            <p className="truncate text-sm text-[var(--color-ink-soft)]">
              {clubName || t('profile.clubFallback', { id: member.clubId })}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {member.index > 0 && <Badge>{t('common.index', { n: formatIndex(member.index) })}</Badge>}
              {member.advantage && <Badge tone="accent">{member.advantage}</Badge>}
            </div>
          </div>
        </Card>

        {member.membershipWarning && (
          <Card className="border-[var(--color-warning)]/30 bg-[var(--color-warning)]/8 p-4 text-sm">
            {member.membershipWarning}
          </Card>
        )}

        <section>
          <SectionTitle title={t('profile.contactDetails')} />
          <Card>
            <dl className="divide-y divide-[var(--color-line)]">
              <EditableRow
                icon={<IconMail width={17} height={17} />}
                label={t('profile.email')} value={member.email}
                onEdit={() => setEditing('email')}
              />
              <EditableRow
                icon={<IconPhone width={17} height={17} />}
                label={t('profile.mobile')} value={member.mobile || t('profile.notProvided')}
                onEdit={() => setEditing('mobile')}
              />
              <StaticRow
                icon={<IconUser width={17} height={17} />}
                label={t('profile.licence')} value={member.licence}
              />
              {member.membershipEndDate && (
                <StaticRow label={t('profile.membershipEnd')} value={formatDateSafe(member.membershipEndDate)} />
              )}
            </dl>
          </Card>
        </section>

        <section>
          <SectionTitle title={t('profile.myDocuments')} />
          <div className="flex flex-col gap-2.5">
            <NavCard to="/profil/carte" icon={<IconCard width={19} height={19} />} label={t('menu.memberCard')} />
            <NavCard to="/profil/carnets" icon={<IconTicket width={19} height={19} />} label={t('menu.myCarnets')} />
            <NavCard to="/competitions" icon={<IconTrophy width={19} height={19} />} label={t('menu.competitions')} />
          </div>
        </section>
      </main>

      <EditSheet field={editing} onClose={() => setEditing(null)} current={member} />
    </div>
  );
}

function EditSheet({
  field, onClose, current,
}: {
  field: 'email' | 'mobile' | null;
  onClose: () => void;
  current: { email: string; mobile: string };
}) {
  const t = useT();
  const updateEmail = useUpdateEmail();
  const updateMobile = useUpdateMobile();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isEmail = field === 'email';
  const pending = isEmail ? updateEmail.isPending : updateMobile.isPending;

  async function submit(): Promise<void> {
    setError(null);
    try {
      if (isEmail) await updateEmail.mutateAsync({ email: value.trim() });
      else await updateMobile.mutateAsync({ mobile: value.trim() });
      onClose();
      setValue('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('profile.updateFailed'));
    }
  }

  return (
    <Sheet
      open={field !== null}
      onClose={onClose}
      title={isEmail ? t('profile.editEmail') : t('profile.editMobile')}
    >
      <div className="flex flex-col gap-4">
        <Field
          label={isEmail ? t('profile.newEmail') : t('profile.newMobile')}
          type={isEmail ? 'email' : 'tel'}
          inputMode={isEmail ? 'email' : 'tel'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={isEmail ? current.email : current.mobile || '+212 6 00 00 00 00'}
        />
        {isEmail && (
          <p className="text-sm text-[var(--color-ink-soft)]">
            {t('profile.emailLoginHint')}
          </p>
        )}
        {error && <ErrorState message={error} />}
        <Button full size="lg" loading={pending} disabled={!value.trim()} onClick={submit}>
          {t('common.save')}
        </Button>
      </div>
    </Sheet>
  );
}

export function MemberCardScreen() {
  const t = useT();
  const { data } = useMe();
  const clubName = useClubName(data?.member.clubId);
  const [cardFailed, setCardFailed] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const member = data?.member;

  return (
    <div className="pb-10">
      <PageHeader title={t('menu.memberCard')} subtitle={clubName || undefined} />
      <main className="flex flex-col gap-5 px-4 py-5">
        <section className="flex flex-col gap-3">
          {!cardFailed ? (
            <>
              <MediaImage
                src={mediaUrl('member-card')}
                alt={t('menu.memberCard')}
                onFail={() => setCardFailed(true)}
              />
              <DownloadButton
                path="member-card"
                filename="carte-membre"
                label={t('card.downloadCard')}
              />
            </>
          ) : (
            <EmptyState
              title={t('card.unavailableTitle')}
              description={t('card.unavailableDesc')}
              icon={<IconCard width={30} height={30} />}
            />
          )}
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle title={t('card.licenceFrmg')} />
          {!photoFailed ? (
            <>
              <MediaImage
                src={mediaUrl('licence-photo')}
                alt={t('card.licenceAlt')}
                onFail={() => setPhotoFailed(true)}
              />
              <DownloadButton
                path="licence-photo"
                filename="licence-frmg"
                label={t('card.downloadLicence')}
              />
            </>
          ) : (
            <EmptyState title={t('card.licenceUnavailable')} />
          )}
        </section>
      </main>
    </div>
  );
}

/**
 * Image du BFF (carte de membre / licence) avec etat de chargement.
 *
 * L amont qui produit ces visuels est lent : sans repere visuel, la carte
 * semble figee. On reserve donc la hauteur et on montre un squelette pulsant
 * jusqu a l arrivee de l image, qui apparait alors en fondu.
 */
function MediaImage({
  src, alt, onFail,
}: {
  src: string; alt: string; onFail: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <Card className="relative overflow-hidden">
      {!loaded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 animate-pulse bg-[var(--color-surface-alt)]"
        />
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={onFail}
        style={{ minHeight: loaded ? undefined : '190px' }}
        className={[
          'relative w-full transition-opacity duration-300',
          loaded ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      />
    </Card>
  );
}

/**
 * Bouton de telechargement d une image du BFF.
 * Isole ici : la carte de membre et la licence FRMG partagent le meme
 * comportement (etat de chargement, message d echec bref).
 */
function DownloadButton({
  path, filename, label,
}: {
  path: string; filename: string; label: string;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onClick(): Promise<void> {
    setBusy(true);
    setFailed(false);
    try {
      await downloadMedia(path, filename);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button variant="outline" full loading={busy} onClick={onClick} icon={<IconDownload width={18} height={18} />}>
        {label}
      </Button>
      {failed && (
        <p role="alert" className="text-center text-sm text-[var(--color-danger)]">
          {t('card.downloadFailed')}
        </p>
      )}
    </div>
  );
}

export function CarnetsScreen() {
  const t = useT();
  const { data, isPending, isError, error, refetch } = useCarnets();
  const carnets = data?.carnets ?? [];

  return (
    <div className="pb-10">
      <PageHeader title={t('menu.myCarnets')} />
      <main className="flex flex-col gap-3 px-4 py-5">
        {isPending ? (
          <SkeletonList rows={3} height="h-28" />
        ) : isError ? (
          <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        ) : carnets.length === 0 ? (
          <EmptyState
            title={t('carnets.noneTitle')}
            description={t('carnets.noneDesc')}
            icon={<IconTicket width={30} height={30} />}
          />
        ) : (
          carnets.map((c) => {
            const ratio = c.total > 0 ? c.remaining / c.total : 0;
            return (
              <Card key={c.number} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="text-sm text-[var(--color-ink-faint)]">{t('carnets.number', { n: c.number })}</p>
                  </div>
                  {c.exhausted
                    ? <Badge>{t('carnets.exhausted')}</Badge>
                    : <Badge tone="positive">{t(c.remaining > 1 ? 'carnets.remainingMany' : 'carnets.remainingOne', { n: c.remaining })}</Badge>}
                </div>

                <div
                  role="progressbar"
                  aria-valuenow={c.remaining}
                  aria-valuemin={0}
                  aria-valuemax={c.total}
                  aria-label={t('carnets.remainingAria', { name: c.name })}
                  className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-surface-alt)]"
                >
                  <div
                    className="h-full rounded-full bg-[var(--color-accent)] transition-[width]"
                    style={{ width: `${Math.round(ratio * 100)}%` }}
                  />
                </div>

                <div className="mt-2 flex justify-between text-sm text-[var(--color-ink-faint)]">
                  <span className="tabular">{t('carnets.usedOfTotal', { used: c.used, total: c.total })}</span>
                  {c.validUntil && <span>{t('carnets.validUntil', { date: formatDateSafe(c.validUntil) })}</span>}
                </div>
              </Card>
            );
          })
        )}
      </main>
    </div>
  );
}

export function MenuScreen() {
  const navigate = useNavigate();
  const t = useT();
  const { data } = useMe();
  const clubName = useClubName(data?.member.clubId);
  const legal = useLegal();
  const logout = useLogout();
  const clubs = useClubs();
  const clubsLabel = clubs.data?.clubs.length === 1 ? t('menu.club') : t('menu.clubs');
  const [themeOpen, setThemeOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  return (
    <Screen className="flex flex-col gap-5 pt-safe">
      <header className="pt-2">
        <SectionTitle eyebrow={clubName || undefined} title={t('menu.title')} />
      </header>

      <div className="flex flex-col gap-2.5">
        <NavCard to="/profil" icon={<IconUser width={19} height={19} />} label={t('menu.myProfile')} />
        <NavCard to="/clubs" icon={<IconFlag width={19} height={19} />} label={clubsLabel} />
        <NavCard to="/profil/carte" icon={<IconCard width={19} height={19} />} label={t('menu.memberCard')} />
        <NavCard to="/profil/carnets" icon={<IconTicket width={19} height={19} />} label={t('menu.myCarnets')} />
        <NavCard to="/competitions" icon={<IconTrophy width={19} height={19} />} label={t('menu.competitions')} />
        <NavCard to="/notifications" icon={<IconBell width={19} height={19} />} label={t('menu.notifications')} />
        <ActionCard
          icon={<SwatchIcon />}
          label={t('menu.theme')}
          onClick={() => setThemeOpen(true)}
        />
        <ActionCard
          icon={<GlobeMenuIcon />}
          label={t('menu.language')}
          onClick={() => setLangOpen(true)}
        />
      </div>

      <ThemeSheet open={themeOpen} onClose={() => setThemeOpen(false)} />
      <LanguageSheet open={langOpen} onClose={() => setLangOpen(false)} />

      <InstallMenuButton />

      {(legal.data?.legalNoticeUrl || legal.data?.termsUrl) && (
        <section>
          <SectionTitle title={t('menu.infoSection')} />
          <div className="flex flex-col gap-2.5">
            {legal.data?.legalNoticeUrl && (
              <ExternalCard href={legal.data.legalNoticeUrl} label={t('menu.legalNotice')} />
            )}
            {legal.data?.termsUrl && (
              <ExternalCard href={legal.data.termsUrl} label={t('menu.terms')} />
            )}
          </div>
        </section>
      )}

      <Button
        variant="outline"
        size="lg"
        full
        loading={logout.isPending}
        onClick={() => logout.mutate(undefined, {
          onSuccess: () => navigate('/connexion', { replace: true }),
        })}
        className="mt-2 text-[var(--color-danger)]"
      >
        {t('menu.logout')}
      </Button>

      <p className="py-4 text-center text-xs text-[var(--color-ink-faint)]">
        {t('menu.version')}
      </p>
    </Screen>
  );
}

// --- fragments partages ----------------------------------------------------

function NavCard({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4 transition-transform active:scale-[0.99]"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-alt)]">
        {icon}
      </span>
      <span className="flex-1 font-medium">{label}</span>
      <IconChevron width={17} height={17} className="shrink-0 text-[var(--color-ink-faint)]" />
    </Link>
  );
}

/** Comme NavCard, mais declenche une action (ex. ouvrir une feuille) au lieu de naviguer. */
function ActionCard({
  icon, label, onClick,
}: {
  icon: React.ReactNode; label: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-left transition-transform active:scale-[0.99]"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-alt)]">
        {icon}
      </span>
      <span className="flex-1 font-medium">{label}</span>
      <IconChevron width={17} height={17} className="shrink-0 text-[var(--color-ink-faint)]" />
    </button>
  );
}

/** Globe pour l entree "Langue". */
function GlobeMenuIcon() {
  return (
    <svg
      width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18Z" />
    </svg>
  );
}

/** Petite palette de couleurs pour l entree "Theme". */
function SwatchIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="8" r="3.4" fill="var(--color-brand)" />
      <circle cx="15.5" cy="8" r="3.4" fill="var(--color-accent)" />
      <circle cx="12" cy="15" r="3.4" fill="var(--color-brand-soft)" />
    </svg>
  );
}

function ExternalCard({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4"
    >
      <span className="flex-1 font-medium">{label}</span>
      <IconChevron width={17} height={17} className="shrink-0 text-[var(--color-ink-faint)]" />
    </a>
  );
}

function EditableRow({
  icon, label, value, onEdit,
}: {
  icon?: React.ReactNode; label: string; value: string; onEdit: () => void;
}) {
  const t = useT();
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {icon && <span className="shrink-0 text-[var(--color-ink-faint)]">{icon}</span>}
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-[var(--color-ink-faint)]">{label}</dt>
        <dd className="truncate text-sm">{value}</dd>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-[var(--color-brand)] active:bg-[var(--color-surface-alt)]"
      >
        {t('common.edit')}
      </button>
    </div>
  );
}

function StaticRow({
  icon, label, value,
}: {
  icon?: React.ReactNode; label: string; value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {icon && <span className="shrink-0 text-[var(--color-ink-faint)]">{icon}</span>}
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-[var(--color-ink-faint)]">{label}</dt>
        <dd className="truncate text-sm tabular">{value}</dd>
      </div>
    </div>
  );
}
