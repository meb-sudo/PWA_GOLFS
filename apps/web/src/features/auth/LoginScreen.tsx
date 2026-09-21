import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LoginInput, LICENCE_LENGTH, type LoginResult } from '@golf/contracts';
import { api, ApiError } from '@/lib/api';
import { useAppContext } from '@/lib/queries';
import { applyTheme, themeForGroup } from '@/theme/groups';
import { Button, Field, ErrorState } from '@/components/ui';
import { IconFlag } from '@/components/icons';
import { useT } from '@/i18n';

export function LoginScreen() {
  const t = useT();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const context = useAppContext();

  // La palette est connue avant toute connexion : evite que la marque
  // n apparaisse seulement une fois l adherent authentifie.
  useEffect(() => {
    if (context.data?.theme) applyTheme(themeForGroup(context.data.theme));
  }, [context.data?.theme]);

  const brand = context.data ? themeForGroup(context.data.group) : null;
  const groupLabel = brand?.label ?? '';

  const {
    register, handleSubmit, formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginInput),
    // "Rester connecte" coche par defaut : c est le comportement le plus
    // pratique sur un telephone personnel ; decochable pour un appareil partage.
    defaultValues: { licence: '', email: '', remember: true },
  });

  const login = useMutation({
    mutationFn: (input: LoginInput) =>
      api<LoginResult>('/auth/login', { method: 'POST', body: input }),
    onSuccess: (result) => {
      setFormError(null);
      if (result.status === 'authenticated') {
        navigate('/', { replace: true });
      } else {
        navigate('/connexion/code', {
          replace: true,
          state: { emailHint: result.emailHint },
        });
      }
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.message : t('auth.loginFailed'));
    },
  });

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <div className="relative overflow-hidden bg-[var(--color-brand)] px-6 pt-[calc(1.75rem+var(--safe-top))] pb-9 text-white">
        <div
          aria-hidden="true"
          className="absolute -top-16 -right-16 size-64 rounded-full bg-[var(--color-accent)]/18"
        />
        <div
          aria-hidden="true"
          className="absolute top-20 -right-24 size-56 rounded-full border border-white/12"
        />
        <div className="relative">
          {brand?.logo ? (
            // Fond clair : les logos sont concus pour un fond blanc et
            // deviendraient illisibles sur le vert de marque.
            <span className="inline-flex min-w-24 items-center justify-center rounded-2xl bg-white p-3">
              <img
                src={brand.logo}
                alt={brand.label}
                className="max-h-14 w-auto max-w-52 object-contain"
              />
            </span>
          ) : (
            <span className="grid size-12 place-items-center rounded-2xl bg-white/10">
              <IconFlag width={26} height={26} className="text-[var(--color-accent)]" />
            </span>
          )}
          {/*
            Nom du groupe : filet fin puis libelle en capitales espacees.
            Le filet ancre le nom au logo au lieu de le laisser flotter, et
            la hauteur est reservee pour que le titre ne saute pas à l’arrivee
            de la reponse reseau.
          */}
          <div className="mt-4 flex h-4 items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-px w-6 shrink-0 bg-[var(--color-accent)]/50"
            />
            <p className="truncate text-[0.7rem] font-semibold tracking-[0.16em] text-[var(--color-accent)] uppercase">
              {groupLabel}
            </p>
          </div>
          <h1 className="mt-2.5 text-[1.75rem] leading-tight font-semibold tracking-tight">
            {t('auth.bookingTitle1')}
            <br />
            <span className="text-[var(--color-accent)]">{t('auth.bookingTitle2')}</span>
          </h1>
          <p className="mt-2 max-w-[32ch] text-sm text-white/75">
            {t('auth.loginTagline')}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit((v) => login.mutate(v))}
        // relative : sans cela le bandeau, lui-meme positionne, se peindrait
        // au-dessus du formulaire et masquerait l arrondi de la jonction.
        className="relative -mt-8 flex flex-1 flex-col gap-3.5 rounded-t-3xl bg-[var(--color-canvas)] px-5 pt-6 pb-safe"
        noValidate
      >
        <Field
          label={t('auth.licenceNumber')}
          inputMode="numeric"
          autoComplete="username"
          placeholder={t('auth.licencePlaceholder')}
          maxLength={LICENCE_LENGTH}
          hint={t('auth.licenceHint')}
          error={errors.licence?.message}
          {...register('licence')}
        />
        <Field
          label={t('auth.email')}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t('auth.emailPlaceholder')}
          error={errors.email?.message}
          {...register('email')}
        />

        <label className="flex cursor-pointer items-center gap-3 py-1">
          <input
            type="checkbox"
            className="size-5 shrink-0 accent-[var(--color-brand)]"
            {...register('remember')}
          />
          <span className="text-sm">
            <span className="block font-medium">{t('auth.stayConnected')}</span>
            <span className="text-[var(--color-ink-faint)]">
              {t('auth.stayConnectedHint')}
            </span>
          </span>
        </label>

        {formError && <ErrorState message={formError} />}

        <Button type="submit" size="lg" full loading={login.isPending} className="mt-2">
          {t('auth.login')}
        </Button>

        <Link
          to="/connexion/identifiants"
          className="mt-1 py-2 text-center text-sm font-medium text-[var(--color-ink-soft)] underline underline-offset-4"
        >
          {t('auth.forgot')}
        </Link>

        <p className="mt-auto py-6 text-center text-xs text-[var(--color-ink-faint)]">
          {t('auth.codeNotice1')}
          <br />
          {t('auth.codeNotice2')}
        </p>
      </form>
    </div>
  );
}
