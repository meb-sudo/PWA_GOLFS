import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { IdentifiersInput } from '@golf/contracts';
import { api, ApiError } from '@/lib/api';
import { useGroupClubs } from '@/lib/queries';
import { Button, Field, ErrorState } from '@/components/ui';
import { PageHeader } from '@/components/layout';

/**
 * Renvoi des identifiants (avant connexion, sans session).
 *
 * Le club doit accompagner la demande. Comme peu d adherents connaissent le
 * numero de leur club, on le choisit par son NOM :
 *  - un seul club dans le groupe -> selectionne automatiquement ;
 *  - plusieurs -> menu deroulant par nom.
 * La valeur envoyee reste le numero de club (sClub_5X). Si la liste est
 * indisponible, on retombe sur une saisie manuelle du numero.
 */
export function IdentifiersScreen() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clubsQuery = useGroupClubs();
  const clubs = clubsQuery.data?.clubs ?? [];
  const single = clubs.length === 1;
  // Liste indisponible (erreur/vide apres chargement) -> saisie manuelle.
  const manual = clubsQuery.isError || (clubsQuery.isSuccess && clubs.length === 0);

  const {
    register, handleSubmit, setValue, formState: { errors },
  } = useForm<IdentifiersInput>({
    resolver: zodResolver(IdentifiersInput),
    defaultValues: { clubId: '', email: '' },
  });

  // Un seul club : on le fixe sans demander a l adherent.
  useEffect(() => {
    if (single) setValue('clubId', clubs[0]!.clubId, { shouldValidate: true });
  }, [single, clubs, setValue]);

  const send = useMutation({
    mutationFn: (input: IdentifiersInput) =>
      api<{ status: string; message: string }>('/auth/identifiers', {
        method: 'POST', body: input,
      }),
    onSuccess: () => { setSent(true); setError(null); },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Envoi impossible.');
    },
  });

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg">
      <PageHeader title="Mes identifiants" />

      {sent ? (
        <main className="px-5 py-10 text-center">
          <p className="text-lg font-medium">Demande envoyée</p>
          <p className="mx-auto mt-2 max-w-[36ch] text-sm text-[var(--color-ink-soft)]">
            Si cette adresse est connue de votre club, vos identifiants viennent
            de vous etre envoyes. Pensez a verifier vos indesirables.
          </p>
        </main>
      ) : (
        <form
          onSubmit={handleSubmit((v) => send.mutate(v))}
          className="flex flex-col gap-4 px-5 py-6"
          noValidate
        >
          <p className="text-sm text-[var(--color-ink-soft)]">
            {manual
              ? 'Indiquez le numéro de votre club et votre adresse e-mail : vos identifiants vous seront renvoyés par courriel.'
              : 'Sélectionnez votre club et indiquez votre adresse e-mail : vos identifiants vous seront renvoyés par courriel.'}
          </p>

          {/* Club : auto (1 club), menu (plusieurs), ou saisie (repli). */}
          {clubsQuery.isPending ? (
            <FieldShell label="Club">
              <div className="flex min-h-12 items-center rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-ink-faint)]">
                Chargement des clubs…
              </div>
            </FieldShell>
          ) : manual ? (
            <Field
              label="Numéro de club"
              inputMode="numeric"
              placeholder="Ex. 50034"
              error={errors.clubId?.message}
              {...register('clubId')}
            />
          ) : single ? (
            <FieldShell label="Club">
              <div className="flex min-h-12 items-center rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-alt)] px-4 font-medium">
                {clubs[0]!.name}
              </div>
            </FieldShell>
          ) : (
            <FieldShell label="Club" error={errors.clubId?.message}>
              <select
                {...register('clubId')}
                defaultValue=""
                className="min-h-12 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4"
              >
                <option value="" disabled>Choisissez votre club</option>
                {clubs.map((c) => (
                  <option key={c.clubId} value={c.clubId}>{c.name}</option>
                ))}
              </select>
            </FieldShell>
          )}

          <Field
            label="Adresse e-mail"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="vous@exemple.ma"
            error={errors.email?.message}
            {...register('email')}
          />

          {error && <ErrorState message={error} />}

          <Button
            type="submit"
            size="lg"
            full
            loading={send.isPending}
            disabled={clubsQuery.isPending}
            className="mt-2"
          >
            Envoyer
          </Button>
        </form>
      )}
    </div>
  );
}

/** Enveloppe libelle + champ, alignee sur le style de Field. */
function FieldShell({
  label, error, children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[var(--color-ink-soft)]">{label}</label>
      {children}
      {error && <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
