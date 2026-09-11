/**
 * Suivi local du "lu / non-lu" des notifications.
 *
 * Transpose NOTIF_EST_VU de WinDev, qui est un etat local a l appareil (et non
 * une donnee serveur) : on retient les identifiants deja vus dans le
 * localStorage. Ouvrir l ecran des notifications marque tout comme vu, et le
 * badge d accueil ne compte que ce qui reste non vu.
 */

const KEY = 'golf-notif-seen';

/** Identifiants de notifications deja vus sur cet appareil. */
export function getSeenNotifs(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/** Marque une liste d identifiants comme vus (union avec l existant). */
export function markNotifsSeen(ids: string[]): void {
  if (ids.length === 0) return;
  try {
    const seen = getSeenNotifs();
    let change = false;
    for (const id of ids) {
      if (!seen.has(id)) { seen.add(id); change = true; }
    }
    if (change) localStorage.setItem(KEY, JSON.stringify([...seen]));
  } catch {
    /* quota / mode prive : le badge restera visible, sans casse. */
  }
}

/** Nombre d identifiants encore non vus (les supprimes ne comptent pas). */
export function countUnseen(ids: string[]): number {
  if (ids.length === 0) return 0;
  const seen = getSeenNotifs();
  const deleted = getDeletedNotifs();
  return ids.reduce(
    (n, id) => (seen.has(id) || deleted.has(id) ? n : n + 1),
    0,
  );
}

/*
 * Suppression : transpose DELETE_NOTIFICATION de WinDev, qui marque
 * NOTIF_EST_INACTIF = Vrai en LOCAL (aucun appel serveur). On retient donc
 * les identifiants supprimes dans le localStorage et on les masque de la liste.
 */
const DELETED_KEY = 'golf-notif-deleted';

/** Identifiants de notifications supprimees (masquees) sur cet appareil. */
export function getDeletedNotifs(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/** Masque une notification (localement, definitivement pour cet appareil). */
export function deleteNotif(id: string): void {
  try {
    const deleted = getDeletedNotifs();
    if (deleted.has(id)) return;
    deleted.add(id);
    localStorage.setItem(DELETED_KEY, JSON.stringify([...deleted]));
  } catch {
    /* quota / mode prive : sans effet, la notif restera visible. */
  }
}
