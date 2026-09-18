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

const GROUP_PATH_RE = /^\/g\/([A-Za-z0-9_]+)(?:\/|$)/;

/**
 * Slug d URL <-> code complet du groupe. L URL reste courte (`/g/ALMAADEN/`)
 * tandis que le reste de l app (en-tete X-Golf-Group, appels API) utilise le
 * code complet `CLUBS_GRP_ALMAADEN`.
 */
export function fullGroup(slug: string): string {
  const s = slug.trim().toUpperCase();
  return s.startsWith('CLUBS_GRP_') ? s : `CLUBS_GRP_${s}`;
}

/** Code complet -> slug d URL : CLUBS_GRP_ALMAADEN -> ALMAADEN. */
export function groupSlug(id: string): string {
  return id.trim().toUpperCase().replace(/^CLUBS_GRP_/, '');
}

/** Groupe (code complet) lu depuis le chemin `/g/<slug>/`, ou '' si absent. */
export function readGroupFromPath(): string {
  try {
    const m = GROUP_PATH_RE.exec(window.location.pathname);
    return m?.[1] ? fullGroup(m[1]) : '';
  } catch {
    return '';
  }
}

/** Chemin de base d un groupe : `/g/<slug>` (basename du routeur). */
export function groupBasePath(id: string): string {
  return `/g/${groupSlug(id)}`;
}

/**
 * Basename du routeur = segment `/g/<...>` reel de l URL (slug court comme
 * `/g/ALMAADEN` ou ancien `/g/CLUBS_GRP_ALMAADEN`), pour qu il colle toujours au
 * chemin affiche. Vide si l URL n a pas de groupe.
 */
export function currentGroupBasePath(): string {
  try {
    const m = /^(\/g\/[A-Za-z0-9_]+)/.exec(window.location.pathname);
    return m?.[1] ?? '';
  } catch {
    return '';
  }
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
  const g = fullGroup(id);
  setCurrentGroup(g);
  try {
    // Evite d afficher la marque du groupe precedent (cache de /api/context).
    localStorage.removeItem('golf-brand');
    // Navigation PLEINE vers le chemin du groupe : recharge la page pour prendre
    // le bon manifest (scope `/g/<slug>/`) et le bon basename du routeur.
    window.location.assign(`/g/${groupSlug(g)}/`);
  } catch {
    /* environnement sans navigation : le groupe reste en memoire. */
  }
}
