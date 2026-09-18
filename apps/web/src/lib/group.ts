import { isKnownGroup } from '@/theme/groups';

/**
 * Groupe courant du portail multi-groupes.
 *
 * Source de verite : le CHEMIN de l URL, `/g/<GROUPE>/`. Chaque groupe a donc
 * son propre `scope` -> plusieurs apps installables separement sur Android (un
 * meme scope `/` empechait Chrome de proposer une 2e install). L ancien lien
 * `?grp=` est encore accepte : on redirige alors vers `/g/<GROUPE>/`.
 * Le groupe resolu est garde en memoire pour l en-tete `X-Golf-Group` (avant
 * connexion) ; apres connexion, la session (cookie httpOnly) le porte.
 */

let currentGroup: string | null = null;

const GROUP_PATH_RE = /^\/g\/(CLUBS_GRP_[A-Z0-9_]+)(?:\/|$)/i;

/** Groupe lu depuis le chemin `/g/<GROUPE>/` (majuscule), ou '' si absent. */
export function readGroupFromPath(): string {
  try {
    const m = GROUP_PATH_RE.exec(window.location.pathname);
    return m?.[1]?.toUpperCase() ?? '';
  } catch {
    return '';
  }
}

/** Chemin de base d un groupe : `/g/<GROUPE>` (basename du routeur). */
export function groupBasePath(id: string): string {
  return `/g/${id.trim().toUpperCase()}`;
}

/** Valeur brute de `?grp=` dans l URL (compat ancien lien ; majuscule). */
export function readGrpParam(): string {
  try {
    return (new URLSearchParams(window.location.search).get('grp') ?? '')
      .trim().toUpperCase();
  } catch {
    return '';
  }
}

/** Groupe a joindre aux appels API (en-tete), ou null s il n est pas choisi. */
export function currentGroupHeader(): string | null {
  return currentGroup;
}

/** Fixe le groupe courant. */
export function setCurrentGroup(id: string): void {
  currentGroup = id.trim().toUpperCase();
}

export type GroupResolution =
  | { kind: 'ready'; group: string }
  | { kind: 'selector' }
  | { kind: 'check' };

/**
 * Decision de demarrage a partir de l URL seule :
 *  - `?grp=CLUBS_GRP_XXX` connu -> on entre (ready)
 *  - `?grp=ALL`                 -> selecteur
 *  - sinon                      -> a verifier cote BFF (sous-domaine dedie ?)
 */
export function resolveGroupFromUrl(): GroupResolution {
  const grp = readGrpParam();
  if (grp === 'ALL') return { kind: 'selector' };
  if (isKnownGroup(grp)) {
    setCurrentGroup(grp);
    return { kind: 'ready', group: grp };
  }
  return { kind: 'check' };
}

/**
 * Choix d un groupe dans le selecteur : fixe le groupe courant et inscrit
 * `?grp=` dans l URL (partageable), en pointant vers l ecran de connexion.
 */
/**
 * Bascule le manifest PWA sur celui du groupe : a l installation, l app prend
 * le NOM et l ICONE du groupe (manifests statiques par groupe). Sans groupe
 * connu, on garde le manifest generique par defaut.
 */
export function setManifestForGroup(group: string): void {
  try {
    const id = group.trim().toUpperCase();
    if (!isKnownGroup(id)) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    link.href = `/manifests/${id}.webmanifest`;
  } catch {
    /* pas de DOM : sans effet. */
  }
}

export function chooseGroup(id: string): void {
  const g = id.trim().toUpperCase();
  setCurrentGroup(g);
  try {
    // Evite d afficher la marque du groupe precedent (cache de /api/context).
    localStorage.removeItem('golf-brand');
    // Navigation PLEINE vers le chemin du groupe : recharge la page pour prendre
    // le bon manifest (scope `/g/<GROUPE>/`) et le bon basename du routeur.
    window.location.assign(`/g/${g}/`);
  } catch {
    /* environnement sans navigation : le groupe reste en memoire. */
  }
}
