import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { setFormatLang } from '@/lib/format';
import { dict, type TKey } from './dict';

/**
 * i18n leger, cote front uniquement.
 *
 * La langue vit dans le localStorage (comme le theme) : propre a l appareil,
 * jamais envoyee au serveur. Les appels d API ne dependent PAS de la langue.
 * L arabe (RTL) sera ajoute plus tard.
 */
export type Lang = 'fr' | 'en';

interface LangStore {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const storage = createJSONStorage<{ state: { lang: Lang }; version?: number }>(() => ({
  getItem: (name) => { try { return localStorage.getItem(name); } catch { return null; } },
  setItem: (name, value) => { try { localStorage.setItem(name, value); } catch { /* quota */ } },
  removeItem: (name) => { try { localStorage.removeItem(name); } catch { /* ignore */ } },
}));

/** Applique la langue au document + au formatage des dates/statuts. */
function applyLangAttr(lang: Lang): void {
  setFormatLang(lang);
  try { document.documentElement.lang = lang; } catch { /* SSR / tests */ }
}

export const useLang = create<LangStore>()(
  persist(
    (set) => ({
      lang: 'fr',
      setLang: (lang) => { applyLangAttr(lang); set({ lang }); },
    }),
    {
      name: 'golf-lang',
      storage,
      onRehydrateStorage: () => (s) => { if (s) applyLangAttr(s.lang); },
    },
  ),
);

/** Applique la langue courante au demarrage (appele depuis main). */
export function initLang(): void {
  applyLangAttr(useLang.getState().lang);
}

/**
 * Hook de traduction. Usage : const t = useT(); t('home.newBooking').
 * Interpolation optionnelle : t('x.y', { name: 'Xavier' }) remplace {name}.
 */
export function useT(): (key: TKey, vars?: Record<string, string | number>) => string {
  const lang = useLang((s) => s.lang);
  return (key, vars) => {
    let s: string = dict[lang][key] ?? dict.fr[key] ?? key;
    if (vars) {
      for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
    }
    return s;
  };
}
