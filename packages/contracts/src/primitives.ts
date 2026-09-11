import { z } from 'zod';

/**
 * Conversions entre les conventions WinDev et des types exploitables.
 *
 * Formats releves sur l'API reelle (verifies le 01/09/2026) :
 *   - date en parametre d'URL ...... "AAAAMMJJ"        ex "20260910"
 *   - heure dans une reponse ....... "HH:MM:SS.mmm"    ex "08:00:00.000"
 *   - heure de depart d'un joueur .. "HHMM"            ex "1032"
 *   - booleen ...................... true/false, "Y"/"N", "0"/"1"
 *   - nombre ....................... numerique ou chaine
 */

/** Date -> "AAAAMMJJ" (format attendu par l'API dans les chemins d'URL). */
export function toApiDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/** "AAAAMMJJ" -> "AAAA-MM-JJ" (ISO court, sans fuseau). */
export function fromApiDate(s: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(s.trim());
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** "HH:MM:SS.mmm" ou "HH:MM:SS" -> "HH:MM". */
export function fromApiTime(s: string): string | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(s.trim());
  if (!m) return null;
  return `${m[1]!.padStart(2, '0')}:${m[2]}`;
}

/** "HHMM" ou "HMM" -> "HH:MM". Utilise pour sHeure_Start cote joueurs. */
export function fromApiShortTime(s: string): string | null {
  const raw = s.trim();
  if (!/^\d{3,4}$/.test(raw)) return fromApiTime(raw);
  const padded = raw.padStart(4, '0');
  return `${padded.slice(0, 2)}:${padded.slice(2)}`;
}

/** "HH:MM" -> "HHMM" pour les parametres d'URL. */
export function toApiShortTime(s: string): string {
  return s.replace(':', '').padStart(4, '0');
}

/** Date du jour au format API, dans le fuseau du club. */
export function todayApiDate(timeZone = 'Africa/Casablanca'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  return parts.replace(/-/g, '');
}

/** Accepte true/false, "Y"/"N", "O"/"N", "1"/"0", "true"/"false". */
export const wdBool = z.preprocess((v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toUpperCase();
    if (['Y', 'O', '1', 'TRUE', 'VRAI'].includes(s)) return true;
    if (['N', '0', 'FALSE', 'FAUX', ''].includes(s)) return false;
  }
  return false;
}, z.boolean());

/** Nombre tolerant aux chaines et aux virgules decimales. */
export const wdNum = z.preprocess((v) => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const s = v.trim().replace(',', '.');
    if (s === '') return 0;
    const n = Number(s);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}, z.number());

/** Chaine tolerante au null/undefined, toujours trim. */
export const wdStr = z.preprocess(
  (v) => (v == null ? '' : String(v).trim()),
  z.string(),
);

/**
 * Date ou date-heure WinDev -> ISO.
 *
 * L amont melange plusieurs formes selon les champs :
 *   "20301231"           -> "2030-12-31"       (sEOLDate, sDate_Debut...)
 *   "20301231143000"     -> "2030-12-31T14:30"  (14 chiffres)
 *   "20260910235900000"  -> "2026-09-10T23:59"  (17 chiffres, avec ms)
 *   "2030-12-31..."      -> laisse tel quel      (deja ISO)
 * Tout le reste est renvoye inchange plutot que perdu : mieux vaut
 * afficher une valeur brute qu une case vide.
 */
export function fromApiDateTime(s: string): string | null {
  const raw = s.trim();
  if (raw === '') return null;

  const digits = raw.replace(/\D/g, '');
  if (/^\d{8}$/.test(raw)) return fromApiDate(raw);

  // AAAAMMJJ + heure : 12 (HHMM), 14 (HHMMSS) ou 17 (avec millisecondes)
  // chiffres. On garde la date et l heure, on ignore secondes/millisecondes.
  if (digits.length >= 12) {
    const d = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    const t = `${digits.slice(8, 10)}:${digits.slice(10, 12)}`;
    return `${d}T${t}`;
  }

  // Deja ISO (avec ou sans heure) : on normalise juste le separateur.
  const iso = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/.exec(raw);
  if (iso) return iso[2] ? `${iso[1]}T${iso[2]}` : iso[1]!;

  return null;
}

export const wdDate = wdStr.transform((s) => fromApiDate(s) ?? s);
/** Tolerant : accepte date seule, date-heure, ou ISO. */
export const wdDateTime = wdStr.transform((s) => fromApiDateTime(s) ?? s);
export const wdTime = wdStr.transform((s) => fromApiTime(s) ?? s);
export const wdShortTime = wdStr.transform((s) => fromApiShortTime(s) ?? s);

/**
 * Valeurs sentinelles renvoyees par l'API a la place d'une vraie erreur.
 * Verifie : un groupe inexistant renvoie sMessage "OK" avec une ligne
 * { sClub_5X: "0", sNom_Club: "- SANS CLUB -" }.
 */
const SENTINELS = ['- SANS CLUB -', '- SANS CLUB-', 'SANS CLUB'];

export function isSentinelClub(id: string, name: string): boolean {
  return id === '0' || id === '' || SENTINELS.includes(name.trim().toUpperCase());
}

/** L'API place le resultat dans sMessage plutot que dans le code HTTP. */
export function isOkMessage(message: string | undefined | null): boolean {
  if (!message) return true;
  const m = message.trim().toUpperCase();
  return m === '' || m === 'OK';
}
