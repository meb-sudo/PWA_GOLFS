/**
 * Transposition de PROC_GLOBAL.Date_Heure_Valide_Resa.
 *
 * Seule regle metier calculee dans le client WinDev : elle borne les dates
 * de reservation selon la configuration du club. Tout le reste est decide
 * par le serveur.
 */

export interface BookingWindowRules {
  /** nNBJours_Avance : horizon maximum en jours. */
  maxDaysAhead: number;
  /** nMinJour : nombre de jours minimum avant de pouvoir reserver (J+n). */
  minDaysBefore: number;
  /** nNBHeureAvant : delai minimum en heures avant le depart. */
  minHoursBefore: number;
  /** h_STANDARD_COURSE_FIRST_START, format "HH:MM". */
  firstStart: string;
  /** h_STANDARD_COURSE_LAST_START, format "HH:MM". */
  lastStart: string;
  /** n_STANDARD_COURSE_RUN_TIME : temps de parcours 9 trous, en minutes. */
  courseRunTimeMinutes: number;
}

export interface BookingWindow {
  /** Premiere date reservable, "AAAA-MM-JJ". */
  minDate: string;
  /** Derniere date reservable, "AAAA-MM-JJ". */
  maxDate: string;
  /** Vrai si la journee en cours est deja passee et a ete decalee a demain. */
  shiftedToNextDay: boolean;
}

function minutesOf(time: string): number {
  const [h, m] = time.split(':');
  return Number(h ?? 0) * 60 + Number(m ?? 0);
}

function isoOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/**
 * Calcule la fenetre de reservation ouverte pour un club.
 *
 * Reprend la logique WinDev : l heure du dernier depart est reculee du
 * temps de parcours pour un 18 trous, puis du delai minimum. Si l heure
 * courante depasse ce seuil, la journee en cours n est plus reservable.
 */
export function bookingWindow(
  rules: BookingWindowRules,
  holes: 9 | 18,
  now: Date = new Date(),
): BookingWindow {
  let lastStart = minutesOf(rules.lastStart || '18:00');
  if (holes === 18) lastStart -= rules.courseRunTimeMinutes;
  lastStart -= rules.minHoursBefore * 60;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let minDate: Date;
  let shifted = false;

  if (rules.minDaysBefore === 0) {
    if (nowMinutes >= lastStart) {
      minDate = addDays(now, 1);
      shifted = true;
    } else {
      minDate = new Date(now);
    }
  } else {
    minDate = addDays(now, rules.minDaysBefore);
  }

  const maxDate = addDays(now, rules.maxDaysAhead);

  return {
    minDate: isoOf(minDate),
    maxDate: isoOf(maxDate < minDate ? minDate : maxDate),
    shiftedToNextDay: shifted,
  };
}

/** Ramene une date demandee dans la fenetre, avec le message correspondant. */
export function clampToWindow(
  requested: string,
  window: BookingWindow,
): { date: string; message: string | null } {
  if (requested < window.minDate) {
    return {
      date: window.minDate,
      message: `La date demandee est anterieure a la premiere date reservable (${formatFr(window.minDate)}).`,
    };
  }
  if (requested > window.maxDate) {
    return {
      date: window.maxDate,
      message: `La date demandee depasse l horizon de reservation (${formatFr(window.maxDate)}).`,
    };
  }
  return { date: requested, message: null };
}

function formatFr(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Une reservation est-elle encore annulable ?
 * Combine bEst_Annuler_Resa et nNBJoursAnnulation du club.
 */
export function canCancel(
  reservationDate: string,
  cancellationAllowed: boolean,
  cancellationDays: number,
  now: Date = new Date(),
): boolean {
  if (!cancellationAllowed) return false;
  const limit = addDays(now, cancellationDays);
  return reservationDate >= isoOf(limit);
}

/** Le jour de la semaine est-il autorise pour cet adherent ? */
export function isDayAllowed(iso: string, allowedDays: string[]): boolean {
  if (allowedDays.length === 0) return true;
  const parts = iso.split('-').map(Number);
  const day = new Date(parts[0]!, (parts[1] ?? 1) - 1, parts[2] ?? 1).getDay();
  // WinDev : 1 = lundi ... 7 = dimanche
  const windevDay = day === 0 ? 7 : day;
  return allowedDays.includes(String(windevDay));
}

/**
 * Heure minimum reservable pour une date donnee, en "HH:MM".
 *
 * Transpose sPremiereHeure_Dispo de RECHERCHE_DEPART : pour aujourd hui, on
 * ne peut pas reserver un depart deja passe, ni dans le delai minimum du club
 * (nNBHeureAvant). Renvoie null pour une date future : aucune borne basse, la
 * journee entiere est ouverte.
 */
export function earliestBookableTime(
  dateIso: string,
  minHoursBefore: number,
  now: Date = new Date(),
  timeZone = 'Africa/Casablanca',
): string | null {
  const jour = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  // Date future : pas de borne basse. Date passee : ne devrait pas arriver
  // (la fenetre l interdit), mais par prudence tout est deja passe.
  if (dateIso > jour) return null;
  if (dateIso < jour) return '23:59';

  const hhmm = new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(now);
  const [h, m] = hhmm.split(':').map(Number);
  const total = Math.min((h ?? 0) * 60 + (m ?? 0) + minHoursBefore * 60, 24 * 60 - 1);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
