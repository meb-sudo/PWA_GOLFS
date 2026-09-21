import { Sheet } from '@/components/layout';
import { IconCheck } from '@/components/icons';
import { useLang, useT, type Lang } from '@/i18n';

/**
 * Choix de la langue de l interface (FR / EN). Reglage LOCAL a l appareil
 * (localStorage) ; n affecte ni le serveur ni les appels d API. L arabe sera
 * ajoute plus tard (avec le RTL). Fonctionnalite isolee.
 */
const LANGS: { code: Lang; label: string }[] = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
];

export function LanguageSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);

  return (
    <Sheet open={open} onClose={onClose} title={t('lang.title')}>
      <div className="flex flex-col gap-2">
        {LANGS.map((l) => {
          const active = l.code === lang;
          return (
            <button
              key={l.code}
              type="button"
              onClick={() => { setLang(l.code); onClose(); }}
              className={[
                'flex items-center gap-3 rounded-xl border p-3.5 text-left',
                active
                  ? 'border-[var(--color-brand)] bg-[var(--color-surface-alt)]/50'
                  : 'border-[var(--color-line)] bg-[var(--color-surface)]',
              ].join(' ')}
            >
              <span className="flex-1 font-medium">{l.label}</span>
              {active && <IconCheck width={18} height={18} className="text-[var(--color-brand)]" />}
            </button>
          );
        })}
        <p className="pt-1 text-center text-xs text-[var(--color-ink-faint)]">
          {t('lang.hint')}
        </p>
      </div>
    </Sheet>
  );
}
