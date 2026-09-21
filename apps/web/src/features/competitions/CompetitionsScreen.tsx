import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import type { Competition } from '@golf/contracts';
import {
  useCompetitions, useRegisterCompetition, useUnregisterCompetition,
} from '@/lib/queries';
import { ApiError } from '@/lib/api';
import {
  Card, Badge, Button, EmptyState, ErrorState, SkeletonList, SectionTitle,
} from '@/components/ui';
import { PageHeader, Sheet } from '@/components/layout';
import { IconTrophy, IconChevron, IconWarning } from '@/components/icons';
import { toApi, formatDateSafe, formatDateTimeSafe } from '@/lib/format';
import { useT } from '@/i18n';

export function CompetitionsScreen() {
  const t = useT();
  const today = toApi(new Date());
  const { data, isPending, isError, error, refetch } = useCompetitions(today);
  const [open, setOpen] = useState<{ clubId: string; competition: Competition } | null>(null);

  const clubs = data?.clubs ?? [];
  const count = clubs.reduce((n, c) => n + c.competitions.length, 0);

  return (
    <div className="pb-10">
      <PageHeader title={t('menu.competitions')} subtitle={count > 0 ? t(count > 1 ? 'compet.openCountMany' : 'compet.openCountOne', { n: count }) : undefined} />

      <main className="flex flex-col gap-6 px-4 py-5">
        {isPending ? (
          <SkeletonList rows={3} height="h-24" />
        ) : isError ? (
          <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        ) : count === 0 ? (
          <EmptyState
            title={t('compet.noneTitle')}
            description={t('compet.noneDesc')}
            icon={<IconTrophy width={30} height={30} />}
          />
        ) : (
          clubs.map((club) => (
            <section key={club.clubId}>
              <SectionTitle eyebrow={club.region || undefined} title={club.clubName} />
              <ul className="flex flex-col gap-2.5">
                {club.competitions.map((comp) => {
                  const registered = comp.series.some((s) => s.registered);
                  const eligible = comp.series.some((s) => s.eligible);
                  // Prepaiement obligatoire, inscrit mais pas encore paye :
                  // il reste un paiement a finaliser.
                  const awaitingPayment = comp.prepaymentRequired
                    && comp.series.some((s) => s.registered && !s.paid);
                  return (
                    <li key={comp.id}>
                      <Card
                        onClick={() => setOpen({ clubId: club.clubId, competition: comp })}
                        className="flex items-center gap-3 p-4"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{comp.name}</p>
                          <p className="truncate text-sm text-[var(--color-ink-faint)]">
                            {formatDateSafe(comp.startDate)}
                            {comp.rounds ? ` · ${t('compet.rounds', { n: comp.rounds })}` : ''}
                            {comp.series.length ? ` · ${t('compet.seriesCount', { n: comp.series.length })}` : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          {awaitingPayment ? (
                            <Badge tone="warning">{t('home.toPay')}</Badge>
                          ) : registered ? (
                            <Badge tone="positive">{t('compet.registered')}</Badge>
                          ) : !eligible ? (
                            <Badge>{t('compet.notEligible')}</Badge>
                          ) : comp.prepaymentRequired ? (
                            <Badge tone="warning">{t('compet.prepayment')}</Badge>
                          ) : null}
                          <IconChevron width={18} height={18} className="text-[var(--color-ink-faint)]" />
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </main>

      {open && (
        <CompetitionSheet
          clubId={open.clubId}
          competition={open.competition}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function CompetitionSheet({
  clubId, competition, onClose,
}: {
  clubId: string; competition: Competition; onClose: () => void;
}) {
  const t = useT();
  const navigate = useNavigate();
  const register = useRegisterCompetition();
  const unregister = useUnregisterCompetition();
  // Regle WinDev : inscription / desinscription / paiement uniquement tant
  // que dDH_Fin_Inscription > maintenant. Passe ce cap, on masque les actions.
  const registrationOpen = isRegistrationOpen(competition.registrationClosesAt);
  const [error, setError] = useState<string | null>(null);
  const [unregisterFor, setUnregisterFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  async function doRegister(serieId: string): Promise<void> {
    setError(null);
    try {
      const result = await register.mutateAsync({
        competitionClubId: clubId,
        competitionId: competition.id,
        serieId,
      });
      if (result.paymentUrl) {
        // Prepaiement affiche dans l app (ecran /paiement).
        onClose();
        navigate('/paiement', {
          state: {
            url: result.paymentUrl,
            label: competition.name,
            returnTo: '/competitions',
          },
        });
        return;
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('compet.registerFailed'));
    }
  }

  async function doUnregister(serieId: string): Promise<void> {
    setError(null);
    try {
      await unregister.mutateAsync({
        competitionClubId: clubId,
        competitionId: competition.id,
        serieId,
        reason: reason.trim(),
      });
      setUnregisterFor(null);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('compet.unregisterFailed'));
    }
  }

  return (
    <Sheet open onClose={onClose} title={competition.name}>
      <div className="flex flex-col gap-4">
        <dl className="divide-y divide-[var(--color-line)] rounded-xl border border-[var(--color-line)]">
          <Row label={t('compet.start')} value={formatDateSafe(competition.startDate)} />
          {competition.endDate && <Row label={t('compet.end')} value={formatDateSafe(competition.endDate)} />}
          {competition.registrationClosesAt && (
            <Row label={t('compet.registrationCloses')} value={formatDateTimeSafe(competition.registrationClosesAt)} />
          )}
          {competition.type && <Row label={t('compet.type')} value={competition.type} />}
        </dl>

        {competition.prepaymentRequired && (
          <Card className="flex items-start gap-2.5 border-[var(--color-warning)]/30 bg-[var(--color-warning)]/8 p-3">
            <IconWarning width={18} height={18} className="mt-0.5 shrink-0 text-[var(--color-warning)]" />
            <p className="text-sm">
              {t('compet.prepayNote')}
            </p>
          </Card>
        )}

        <section>
          <p className="mb-2 text-sm font-medium text-[var(--color-ink-soft)]">{t('compet.series')}</p>
          <ul className="flex flex-col gap-2">
            {competition.series.map((s) => {
              const prepay = competition.prepaymentRequired;
              // Prepaiement : le paiement reste a finaliser tant que non paye,
              // qu on soit deja inscrit ou non (regle WinDev :
              // bouton visible tant que NON bEst_Inscription_Paye).
              const needsPayment = prepay && !s.paid && (s.registered || s.eligible);
              const payLabel = s.registered ? t('compet.goToPayment') : t('compet.registerAndPay');
              return (
              <li key={s.id}>
                <Card className={clsx('p-3.5', !s.eligible && !s.registered && 'opacity-60')}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.name}</p>
                      <p className="truncate text-sm text-[var(--color-ink-faint)]">
                        {[s.formula, s.courseName, s.holes ? `${s.holes} ${t('home.holes')}` : '', s.tee]
                          .filter(Boolean).join(' · ')}
                      </p>
                      {s.registered && s.paid && (
                        <p className="mt-1 text-sm text-[var(--color-positive)]">
                          {t('compet.registeredPaid')}
                          {s.paymentFolder ? t('compet.folderSuffix', { n: s.paymentFolder }) : ''}
                        </p>
                      )}
                      {s.registered && !s.paid && prepay && (
                        <p className="mt-1 text-sm text-[var(--color-warning)]">
                          {t('compet.notPaidWarn')}
                        </p>
                      )}
                    </div>
                    {s.registered && (
                      <Badge tone={s.paid || !prepay ? 'positive' : 'warning'}>
                        {s.paid || !prepay ? t('compet.registered') : t('home.toPay')}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-3">
                    {!registrationOpen ? (
                      // Cloture passee : plus aucune action (regle WinDev).
                      // On garde une trace visible pour l inscrit deja paye.
                      !(s.registered && s.paid) && (
                        <p className="py-1 text-center text-sm text-[var(--color-ink-faint)]">
                          {t('compet.registrationClosed')}
                        </p>
                      )
                    ) : prepay ? (
                      // Prepaiement : un seul bouton, aucune desinscription
                      // possible cote app (comme WinDev). Masque une fois paye.
                      needsPayment && (
                        <Button
                          variant="accent" full
                          disabled={!s.eligible && !s.registered}
                          loading={register.isPending}
                          onClick={() => doRegister(s.id)}
                        >
                          {payLabel}
                        </Button>
                      )
                    ) : s.registered ? (
                      <Button
                        variant="outline" full
                        onClick={() => setUnregisterFor(s.id)}
                        className="text-[var(--color-danger)]"
                      >
                        {t('compet.unregister')}
                      </Button>
                    ) : (
                      <Button
                        variant="accent" full
                        disabled={!s.eligible}
                        loading={register.isPending}
                        onClick={() => doRegister(s.id)}
                      >
                        {s.eligible ? t('compet.register') : t('compet.notEligible')}
                      </Button>
                    )}
                  </div>

                  {unregisterFor === s.id && (
                    <div className="mt-3 flex flex-col gap-2.5 border-t border-[var(--color-line)] pt-3">
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value.slice(0, 300))}
                        rows={2}
                        placeholder={t('compet.unregisterReason')}
                        className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3 text-sm"
                      />
                      <div className="flex gap-2">
                        <Button variant="ghost" full onClick={() => setUnregisterFor(null)}>
                          {t('book.back')}
                        </Button>
                        <Button
                          variant="danger" full
                          loading={unregister.isPending}
                          disabled={reason.trim().length === 0}
                          onClick={() => doUnregister(s.id)}
                        >
                          {t('common.confirm')}
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              </li>
              );
            })}
          </ul>
        </section>

        {competition.documents.length > 0 && (
          <section>
            <p className="mb-2 text-sm font-medium text-[var(--color-ink-soft)]">{t('compet.documents')}</p>
            <ul className="flex flex-col gap-2">
              {competition.documents.map((d) => (
                <li key={d.url}>
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-3.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.name}</span>
                    <IconChevron width={17} height={17} className="shrink-0 text-[var(--color-ink-faint)]" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {error && <ErrorState message={error} />}
      </div>
    </Sheet>
  );
}

/**
 * Inscription encore ouverte ? (dDH_Fin_Inscription > maintenant).
 * `closesAt` est une heure murale locale ("2026-09-10T23:59"), sans fuseau :
 * les adherents marocains sont deja sur l heure de Casablanca. Date seule ->
 * on tolere jusqu a la fin du jour. Vide ou illisible -> on n empeche rien.
 */
function isRegistrationOpen(closesAt: string): boolean {
  if (!closesAt) return true;
  const iso = closesAt.length <= 10 ? `${closesAt}T23:59` : closesAt;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? true : t >= Date.now();
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <dt className="text-sm text-[var(--color-ink-soft)]">{label}</dt>
      <dd className="text-right text-sm">{value}</dd>
    </div>
  );
}
