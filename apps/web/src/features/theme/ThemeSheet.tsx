import { useState } from 'react';
import { Sheet } from '@/components/layout';
import { Button } from '@/components/ui';
import {
  appDefaultTheme, applyTheme, buildOverride, saveThemeOverride,
  clearThemeOverride, readThemeOverride,
} from '@/theme/groups';
import { useT } from '@/i18n';
import type { TKey } from '@/i18n/dict';

/**
 * Personnalisation LOCALE du theme (couleurs de l app) pour l appareil du
 * client. La preference vit dans le localStorage (voir theme/groups) : elle
 * n est jamais envoyee au serveur et n affecte pas les autres membres. Le
 * bouton de reinitialisation efface la preference et rend le theme du groupe.
 *
 * Fonctionnalite volontairement ISOLEE : la retirer = enlever ce fichier, son
 * entree de menu, et le bloc "override" de theme/groups.
 */

/** Quelques ambiances pretes a l emploi (couleur principale + couleur d action). */
const PRESETS: { labelKey: TKey; brand: string; accent: string }[] = [
  { labelKey: 'theme.presetNature', brand: '#14432E', accent: '#C3DC4E' },
  { labelKey: 'theme.presetOcean', brand: '#1E3A5F', accent: '#4F9BD1' },
  { labelKey: 'theme.presetBordeaux', brand: '#5A1E2A', accent: '#D8A24A' },
  { labelKey: 'theme.presetSlate', brand: '#2B2B2B', accent: '#D6B673' },
  { labelKey: 'theme.presetPlum', brand: '#3B2A5A', accent: '#B49BE0' },
  { labelKey: 'theme.presetSand', brand: '#5D4429', accent: '#46744C' },
];

export function ThemeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  // Base = theme par defaut de l app (Nature), commun a tous les clubs.
  const base = appDefaultTheme;
  const existing = readThemeOverride();

  const [brand, setBrand] = useState(existing?.brand ?? base.brand);
  const [accent, setAccent] = useState(existing?.accent ?? base.accent);
  const [customized, setCustomized] = useState(existing !== null);

  /** Applique en direct un couple (principale, action). */
  function apply(nextBrand: string, nextAccent: string): void {
    setBrand(nextBrand);
    setAccent(nextAccent);
    saveThemeOverride(buildOverride({ brand: nextBrand, accent: nextAccent }));
    applyTheme(base); // relit l override et le superpose au theme du groupe
    setCustomized(true);
  }

  /** Retour au theme d origine du groupe. */
  function reset(): void {
    clearThemeOverride();
    applyTheme(base);
    setBrand(base.brand);
    setAccent(base.accent);
    setCustomized(false);
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('menu.theme')}>
      <div className="flex flex-col gap-5">
        <p className="text-sm text-[var(--color-ink-soft)]">
          {t('theme.desc')}
        </p>

        <section className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">
            {t('theme.presets')}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((p) => {
              const active = customized
                && brand.toLowerCase() === p.brand.toLowerCase()
                && accent.toLowerCase() === p.accent.toLowerCase();
              return (
                <button
                  key={p.labelKey}
                  type="button"
                  onClick={() => apply(p.brand, p.accent)}
                  className={[
                    'flex flex-col items-center gap-1.5 rounded-xl border p-2 active:scale-[0.98]',
                    active
                      ? 'border-[var(--color-brand)] ring-2 ring-[var(--color-brand)]/30'
                      : 'border-[var(--color-line)]',
                  ].join(' ')}
                >
                  <span className="flex">
                    <span className="size-6 rounded-l-full" style={{ background: p.brand }} />
                    <span className="size-6 rounded-r-full" style={{ background: p.accent }} />
                  </span>
                  <span className="text-xs font-medium">{t(p.labelKey)}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">
            {t('theme.custom')}
          </p>
          <ColorRow
            label={t('theme.primary')}
            value={brand}
            onChange={(v) => apply(v, accent)}
          />
          <ColorRow
            label={t('theme.action')}
            value={accent}
            onChange={(v) => apply(brand, v)}
          />
        </section>

        <Button variant="outline" full onClick={reset} disabled={!customized}>
          {t('theme.reset')}
        </Button>
      </div>
    </Sheet>
  );
}

function ColorRow({
  label, value, onChange,
}: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
      <span
        className="size-9 shrink-0 rounded-full border border-[var(--color-line)]"
        style={{ background: value }}
      />
      <span className="flex-1 text-sm font-medium">{label}</span>
      <span className="text-xs uppercase tabular text-[var(--color-ink-faint)]">{value}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="size-9 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0"
      />
    </label>
  );
}
