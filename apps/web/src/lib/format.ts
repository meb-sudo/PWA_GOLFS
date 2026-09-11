import { format, parseISO, isValid, addDays, differenceInCalendarDays } from 'date-fns';
import { fr } from 'date-fns/locale';

/** Fuseau des clubs : les regles de fenetre de reservation en dependent. */
export const CLUB_TZ = 'Africa/Casablanca';

export function parseDate(iso: string): Date | null {
  if (!iso) return null;
  const d = parseISO(iso);
  return isValid(d) ? d : null;
}

/** "2026-09-14" -> "sam. 14 sept." */
export function formatDayShort(iso: string): string {
  const d = parseDate(iso);
  return d ? format(d, 'EEE d MMM', { locale: fr }) : iso;
}

/** "2026-09-14" -> "samedi 14 septembre 2026" */
export function formatDayLong(iso: string): string {
  const d = parseDate(iso);
  return d ? format(d, 'EEEE d MMMM yyyy', { locale: fr }) : iso;
}

/** Etiquette relative : Aujourd hui / Demain / date courte. */
export function formatDayRelative(iso: string, now = new Date()): string {
  const d = parseDate(iso);
  if (!d) return iso;
  const diff = differenceInCalendarDays(d, now);
  if (diff === 0) return 'Aujourd’hui';
  if (diff === 1) return 'Demain';
  return formatDayShort(iso);
}

/** Bloc de date compact pour les cartes : { SAM, 14, SEP }. */
export function dateParts(iso: string): { weekday: string; day: string; month: string } {
  const d = parseDate(iso);
  if (!d) return { weekday: '', day: '--', month: '' };
  return {
    weekday: format(d, 'EEE', { locale: fr }).replace('.', '').toUpperCase(),
    day: format(d, 'd'),
    month: format(d, 'MMM', { locale: fr }).replace('.', '').toUpperCase(),
  };
}

/** Date au format attendu par les API : AAAAMMJJ. */
export function toApi(d: Date): string {
  return format(d, 'yyyyMMdd');
}

/** "AAAAMMJJ" -> "AAAA-MM-JJ" */
export function apiToIso(s: string): string {
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` : s;
}

/** "AAAA-MM-JJ" -> "AAAAMMJJ" */
export function isoToApi(s: string): string {
  return s.replace(/-/g, '');
}

/** Liste de dates entre deux bornes ISO, pour le selecteur horizontal. */
export function dateRange(minIso: string, maxIso: string): string[] {
  const start = parseDate(minIso);
  const end = parseDate(maxIso);
  if (!start || !end) return [];
  const days: string[] = [];
  const span = Math.min(differenceInCalendarDays(end, start), 60);
  for (let i = 0; i <= span; i += 1) {
    days.push(format(addDays(start, i), 'yyyy-MM-dd'));
  }
  return days;
}

/** Prix en dirhams, sans decimale inutile. */
export function formatPrice(value: number): string {
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency', currency: 'MAD',
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Index de jeu : 12,4 */
export function formatIndex(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 1, maximumFractionDigits: 1,
  }).format(value);
}

/** Libelle lisible d un statut de reservation. */
export function statusLabel(code: string): { label: string; tone: 'positive' | 'warning' | 'neutral' } {
  const c = code.trim().toUpperCase();
  if (c.startsWith('CA') || c === 'C') return { label: 'Confirmee', tone: 'positive' };
  if (c === 'OP') return { label: 'En option', tone: 'warning' };
  if (c === 'AN') return { label: 'Annulee', tone: 'neutral' };
  return { label: code || 'Enregistrée', tone: 'neutral' };
}

/** "10:30" -> "10h30" */
export function formatTime(hhmm: string): string {
  return hhmm.replace(':', 'h');
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '').join('');
}

/** Salutation selon l heure locale. */
export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

/**
 * Affiche une date normalisee par les contrats.
 *
 * Renvoie un tiret si le champ est vide, et la valeur brute si elle n a pas
 * pu etre convertie : mieux vaut montrer une donnee inhabituelle que rien.
 */
export function formatDateSafe(value: string | null | undefined): string {
  if (!value) return '—';
  const d = parseDate(value.slice(0, 10));
  return d ? format(d, 'd MMMM yyyy', { locale: fr }) : value;
}

/** Idem, avec l heure quand elle est presente. */
export function formatDateTimeSafe(value: string | null | undefined): string {
  if (!value) return '—';
  const d = parseDate(value);
  if (!d) return value;
  return value.includes('T')
    ? format(d, "d MMMM yyyy 'à' HH'h'mm", { locale: fr })
    : format(d, 'd MMMM yyyy', { locale: fr });
}

/**
 * Met en forme le champ trous d une prestation ("9;", "18;", "9;18;27").
 * -> "9 trous", "18 trous", "9, 18 ou 27 trous".
 */
export function formatPrestationHoles(field: string): string {
  const parts = field.split(';').map((t) => t.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  const nombres = parts.length === 1
    ? parts[0]
    : `${parts.slice(0, -1).join(', ')} ou ${parts.at(-1)}`;
  return `${nombres} trous`;
}
