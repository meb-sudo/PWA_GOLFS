import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { Button, ErrorState } from '@/components/ui';
import { PageHeader } from '@/components/layout';
import { IconMail } from '@/components/icons';
import { useT } from '@/i18n';

/**
 * Saisie du code de validation.
 *
 * Le code n est jamais present cote client : il est verifie par le BFF.
 * L application WinDev le recevait dans la reponse HTTP et le comparait
 * elle-meme, avec en plus un code maitre en dur - rien de tout cela ici.
 *
 * Champ unique plutot qu une grille de cases : l amont renvoie un nombre,
 * pas une chaine de longueur fixe (un code a 5 chiffres a ete observe).
 * Une grille de N cases rendrait tout code plus court impossible a valider.
 */
const MIN_LENGTH = 4;
const MAX_LENGTH = 8;

export function CodeScreen() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const emailHint = (location.state as { emailHint?: string } | null)?.emailHint;

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const verify = useMutation({
    mutationFn: () =>
      api<{ status: string }>('/auth/verify', {
        method: 'POST',
        body: { code, trustDevice: true },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries();
      navigate('/', { replace: true });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : t('auth.verifyFailed'));
      setCode('');
    },
  });

  const resend = useMutation({
    mutationFn: () => api<{ status: string }>('/auth/resend', { method: 'POST' }),
    onSuccess: () => { setError(null); setCode(''); },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : t('auth.sendFailed'));
    },
  });

  const canSubmit = code.length >= MIN_LENGTH && !verify.isPending;

  function submit(e: React.FormEvent): void {
    e.preventDefault();
    if (canSubmit) verify.mutate();
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg">
      <PageHeader title={t('auth.verification')} onBack={() => navigate('/connexion', { replace: true })} />

      <main className="flex flex-col gap-6 px-5 py-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-[var(--color-surface-alt)]">
            <IconMail width={26} height={26} className="text-[var(--color-brand)]" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">{t('auth.enterCode')}</h1>
          <p className="max-w-[34ch] text-sm text-[var(--color-ink-soft)]">
            {t('auth.codeSentTo')}
            {emailHint ? <> {t('auth.to')} <strong className="text-[var(--color-ink)]">{emailHint}</strong></> : null}.
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <label htmlFor="code" className="sr-only">{t('auth.validationCode')}</label>
          <input
            id="code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, '').slice(0, MAX_LENGTH));
              if (error) setError(null);
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="- - - - -"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'code-err' : undefined}
            disabled={verify.isPending}
            className={[
              'min-h-16 rounded-2xl border bg-[var(--color-surface)] text-center',
              'text-3xl font-semibold tracking-[0.35em] tabular',
              'placeholder:tracking-[0.2em] placeholder:text-[var(--color-ink-faint)]',
              'disabled:opacity-60',
              error ? 'border-[var(--color-danger)]' : 'border-[var(--color-line)]',
            ].join(' ')}
          />

          {error && (
            <div id="code-err">
              <ErrorState message={error} />
            </div>
          )}

          <Button type="submit" size="lg" full loading={verify.isPending} disabled={!canSubmit}>
            {t('auth.validate')}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => resend.mutate()}
          disabled={resend.isPending}
          className="py-2 text-center text-sm font-medium text-[var(--color-ink-soft)] underline underline-offset-4 disabled:opacity-50"
        >
          {resend.isPending ? t('auth.sending') : t('auth.resendCode')}
        </button>

        {resend.isSuccess && !error && (
          <p role="status" className="text-center text-sm text-[var(--color-positive)]">
            {t('auth.codeResent')}
          </p>
        )}

        <Link
          to="/connexion"
          className="py-2 text-center text-sm text-[var(--color-ink-faint)] underline underline-offset-4"
        >
          {t('auth.switchAccount')}
        </Link>
      </main>
    </div>
  );
}
