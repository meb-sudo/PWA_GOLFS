import { isKnownGroup } from '@/theme/groups';

/**
 * Groupe courant du portail multi-groupes.
 *
 * Source de verite : le parametre `?grp=` de l URL — le groupe est "lie au
 * lien", il n est pas memorise. Chaque app installee garde ainsi son groupe via
 * son start_url (`/?grp=...`), et le site ouvert sans groupe montre le selecteur.
 * Une fois resolu, il est garde en memoire pour etre envoye au BFF via l en-tete
 * `X-Golf-Group` a chaque appel (avant connexion). Apres connexion, c est la
 * session (cookie httpOnly) qui porte le groupe cote serveur.
 */

let currentGroup: string | null = null;


/** Valeur brute de `?grp=` dans l URL (majuscule, sans espaces). */
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
  setCurrentGroup(id);
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('grp', id);
    url.pathname = '/';
    window.history.replaceState(null, '', url.toString());
    // Evite d afficher la marque du groupe precedent (cache de /api/context).
    localStorage.removeItem('golf-brand');
  } catch {
    /* environnement sans history : le groupe reste en memoire, ce qui suffit. */
  }
}
