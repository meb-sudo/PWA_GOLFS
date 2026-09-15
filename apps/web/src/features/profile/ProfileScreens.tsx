import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  useMe, useCarnets, useUpdateEmail, useUpdateMobile, useLogout, useLegal,
  useClubName,
} from '@/lib/queries';
import { mediaUrl, downloadMedia, ApiError } from '@/lib/api';
import {
  Card, Button, Field, Badge, EmptyState, ErrorState, SkeletonList, SectionTitle,
  Avatar,
} from '@/components/ui';
import { PageHeader, Screen, Sheet } from '@/components/layout';
import {
  IconUser, IconMail, IconPhone, IconCard, IconTicket, IconTrophy,
  IconChevron, IconBell, IconDownload,
} from '@/components/icons';
import { initialsOf, formatIndex, formatDateSafe } from '@/lib/format';
import { InstallMenuButton } from '@/components/InstallBanner';

export function ProfileScreen() {
  const { data, isPending } = useMe();
  const member = data?.member;
  const clubName = useClubName(member?.clubId);
  const [editing, setEditing] = useState<'email' | 'mobile' | null>(null);

  if (isPending || !member) {
    return (
      <div>
        <PageHeader title="Mon profil" />
        <main className="px-4 py-5"><SkeletonList rows={3} height="h-24" /></main>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <PageHeader title="Mon profil" />

      <main className="flex flex-col gap-5 px-4 py-5">
        <Card className="flex items-center gap-4 p-5">
          <Avatar name={member.fullName} className="size-16 text-xl" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold">{member.fullName}</p>
            <p className="truncate text-sm text-[var(--color-ink-soft)]">
              {clubName || `Club ${member.clubId}`}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {member.index > 0 && <Badge>Index {formatIndex(member.index)}</Badge>}
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
          <SectionTitle title="Mes coordonnees" />
          <Card>
            <dl className="divide-y divide-[var(--color-line)]">
              <EditableRow
                icon={<IconMail width={17} height={17} />}
                label="E-mail" value={member.email}
                onEdit={() => setEditing('email')}
              />
              <EditableRow
                icon={<IconPhone width={17} height={17} />}
                label="Mobile" value={member.mobile || 'Non renseigne'}
                onEdit={() => setEditing('mobile')}
              />
              <StaticRow
                icon={<IconUser width={17} height={17} />}
                label="Licence" value={member.licence}
              />
              {member.membershipEndDate && (
                <StaticRow label="Fin d’abonnement" value={formatDateSafe(member.membershipEndDate)} />
              )}
            </dl>
          </Card>
        </section>

        <section>
          <SectionTitle title="Mes documents" />
          <div className="flex flex-col gap-2.5">
            <NavCard to="/profil/carte" icon={<IconCard width={19} height={19} />} label="Carte de membre" />
            <NavCard to="/profil/carnets" icon={<IconTicket width={19} height={19} />} label="Mes carnets" />
            <NavCard to="/competitions" icon={<IconTrophy width={19} height={19} />} label="Compétitions" />
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
      setError(err instanceof ApiError ? err.message : 'Mise a jour impossible.');
    }
  }

  return (
    <Sheet
      open={field !== null}
      onClose={onClose}
      title={isEmail ? 'Modifier mon e-mail' : 'Modifier mon mobile'}
    >
      <div className="flex flex-col gap-4">
        <Field
          label={isEmail ? 'Nouvelle adresse e-mail' : 'Nouveau numéro de mobile'}
          type={isEmail ? 'email' : 'tel'}
          inputMode={isEmail ? 'email' : 'tel'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={isEmail ? current.email : current.mobile || '+212 6 00 00 00 00'}
        />
        {isEmail && (
          <p className="text-sm text-[var(--color-ink-soft)]">
            Cette adresse sert aussi a vous connecter : elle vous sera demandee
            a votre prochaine connexion.
          </p>
        )}
        {error && <ErrorState message={error} />}
        <Button full size="lg" loading={pending} disabled={!value.trim()} onClick={submit}>
          Enregistrer
        </Button>
      </div>
    </Sheet>
  );
}

export function MemberCardScreen() {
  const { data } = useMe();
  const clubName = useClubName(data?.member.clubId);
  const [cardFailed, setCardFailed] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const member = data?.member;

  return (
    <div className="pb-10">
      <PageHeader title="Carte de membre" subtitle={clubName || undefined} />
      <main className="flex flex-col gap-5 px-4 py-5">
        <section className="flex flex-col gap-3">
          {!cardFailed ? (
            <>
              <MediaImage
                src={mediaUrl('member-card')}
                alt="Carte de membre"
                onFail={() => setCardFailed(true)}
              />
              <DownloadButton
                path="member-card"
                filename="carte-membre"
                label="Télécharger la carte de membre"
              />
            </>
          ) : (
            <EmptyState
              title="Carte indisponible"
              description="Votre club n a pas encore publie votre carte de membre."
              icon={<IconCard width={30} height={30} />}
            />
          )}
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle title="Licence FRMG" />
          {!photoFailed ? (
            <>
              <MediaImage
                src={mediaUrl('licence-photo')}
                alt="Carte de licence"
                onFail={() => setPhotoFailed(true)}
              />
              <DownloadButton
                path="licence-photo"
                filename="licence-frmg"
                label="Télécharger la licence FRMG"
              />
            </>
          ) : (
            <EmptyState title="Licence indisponible" />
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
          Téléchargement impossible. Réessayez.
        </p>
      )}
    </div>
  );
}

export function CarnetsScreen() {
  const { data, isPending, isError, error, refetch } = useCarnets();
  const carnets = data?.carnets ?? [];

  return (
    <div className="pb-10">
      <PageHeader title="Mes carnets" />
      <main className="flex flex-col gap-3 px-4 py-5">
        {isPending ? (
          <SkeletonList rows={3} height="h-28" />
        ) : isError ? (
          <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        ) : carnets.length === 0 ? (
          <EmptyState
            title="Aucun carnet"
            description="Vos carnets de tickets apparaîtront ici."
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
                    <p className="text-sm text-[var(--color-ink-faint)]">N° {c.number}</p>
                  </div>
                  {c.exhausted
                    ? <Badge>Épuisé</Badge>
                    : <Badge tone="positive">{c.remaining} restant{c.remaining > 1 ? 's' : ''}</Badge>}
                </div>

                <div
                  role="progressbar"
                  aria-valuenow={c.remaining}
                  aria-valuemin={0}
                  aria-valuemax={c.total}
                  aria-label={`Tickets restants sur ${c.name}`}
                  className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-surface-alt)]"
                >
                  <div
                    className="h-full rounded-full bg-[var(--color-accent)] transition-[width]"
                    style={{ width: `${Math.round(ratio * 100)}%` }}
                  />
                </div>

                <div className="mt-2 flex justify-between text-sm text-[var(--color-ink-faint)]">
                  <span className="tabular">{c.used} utilisé(s) sur {c.total}</span>
                  {c.validUntil && <span>Valide jusqu’au {formatDateSafe(c.validUntil)}</span>}
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
  const { data } = useMe();
  const clubName = useClubName(data?.member.clubId);
  const legal = useLegal();
  const logout = useLogout();

  return (
    <Screen className="flex flex-col gap-5 pt-safe">
      <header className="pt-2">
        <SectionTitle eyebrow={clubName || undefined} title="Menu" />
      </header>

      <div className="flex flex-col gap-2.5">
        <NavCard to="/profil" icon={<IconUser width={19} height={19} />} label="Mon profil" />
        <NavCard to="/profil/carte" icon={<IconCard width={19} height={19} />} label="Carte de membre" />
        <NavCard to="/profil/carnets" icon={<IconTicket width={19} height={19} />} label="Mes carnets" />
        <NavCard to="/competitions" icon={<IconTrophy width={19} height={19} />} label="Compétitions" />
        <NavCard to="/notifications" icon={<IconBell width={19} height={19} />} label="Notifications" />
      </div>

      <InstallMenuButton />

      {(legal.data?.legalNoticeUrl || legal.data?.termsUrl) && (
        <section>
          <SectionTitle title="Informations" />
          <div className="flex flex-col gap-2.5">
            {legal.data?.legalNoticeUrl && (
              <ExternalCard href={legal.data.legalNoticeUrl} label="Mentions légales" />
            )}
            {legal.data?.termsUrl && (
              <ExternalCard href={legal.data.termsUrl} label="Conditions générales" />
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
        Se déconnecter
      </Button>

      <p className="py-4 text-center text-xs text-[var(--color-ink-faint)]">
        Réservation Membres · version 1.0
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
        Modifier
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
