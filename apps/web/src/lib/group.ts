import { isKnownGroup } from '@/theme/groups';

/**
 * Groupe courant du portail multi-groupes.
 *
 * Le `?grp=` de l URL reste prioritaire (lien partageable), mais le dernier
 * groupe choisi est aussi *memorise* (localStorage) : l app y revient toujours,
 * meme apres deconnexion ou reouverture, au lieu de remontrer le selecteur.
 * Le groupe resolu est envoye au BFF via l en-tete `X-Golf-Group` a chaque appel
 * (avant connexion) ; apres connexion, c est la session (cookie httpOnly) qui le
 * porte cote serveur.
 */

let currentGroup: string | null = null;

const GROUP_KEY = 'golf-group';

/** Memorise le groupe choisi, pour y revenir meme apres deconnexion. */
export function rememberGroup(id: string): void {
  try {
    const g = id.trim().toUpperCase();
    if (isKnownGroup(g)) localStorage.setItem(GROUP_KEY, g);
  } catch { /* stockage indispo : sans effet */ }
}

/** Dernier groupe memorise (valide), ou '' s il n y en a pas. */
export function rememberedGroup(): string {
  try {
    const g = (localStorage.getItem(GROUP_KEY) ?? '').trim().toUpperCase();
    return isKnownGroup(g) ? g : '';
  } catch {
    return '';
  }
}


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
  rememberGroup(id);
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
