import { useWeather } from '@/lib/queries';
import { useT } from '@/i18n';

/**
 * Bandeau meteo (prevision) du jour de jeu, affiche sur l ecran de reservation
 * et le recapitulatif. Discret et NON bloquant : s efface s il n y a pas de
 * donnee (club sans GPS, date hors portee, reseau). La meteo est une prevision
 * -- on le precise pour rester honnete.
 *
 * Fonctionnalite ISOLEE : la retirer = enlever ce fichier + ses deux usages.
 */
export function WeatherStrip({
  clubId, date,
}: {
  clubId: string | null | undefined;
  date: string | null;
}) {
  const t = useT();
  const { data, isPending } = useWeather(clubId, date);

  if (!clubId || !date) return null;

  if (isPending) {
    return (
      <div
        aria-hidden="true"
        className="h-[62px] animate-pulse rounded-2xl bg-[var(--color-surface-alt)]"
      />
    );
  }

  const w = data?.weather;
  if (!w) return null; // meteo indisponible : on n affiche rien

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
      <span className="text-3xl leading-none" aria-hidden="true">{w.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {w.condition} · <span className="tabular">{w.tempMax}°</span>
          <span className="text-[var(--color-ink-faint)]"> / {w.tempMin}°</span>
        </p>
        <p className="text-xs text-[var(--color-ink-faint)]">
          {t('weather.line', { rain: w.rainProbability, wind: w.windMax })}
        </p>
      </div>
    </div>
  );
}
