/**
 * Themes par groupe.
 *
 * Reprend les couleurs compilees en dur dans les neuf configurations
 * WinDev (gsColor_BTN_Fond et gsColor_TITLE_Fond) et les transforme en
 * jetons appliques a l execution. Une seule application, neuf marques.
 */

export interface GroupTheme {
  label: string;
  /** Fond des surfaces de marque (heros, barres). */
  brand: string;
  brandSoft: string;
  /** Couleur d action, utilisee avec parcimonie. */
  accent: string;
  /** Texte pose sur la couleur d action. */
  accentInk: string;
  /**
   * Logo de la marque, servi depuis /brands/.
   * Absent quand aucun logo n a ete fourni pour ce groupe : l ecran de
   * connexion retombe alors sur l icone generique.
   */
  logo?: string;
}

const themes: Record<string, GroupTheme> = {
  CLUBS_GRP_PRESTIGIA: {
    label: 'Prestigia Golf',
    brand: '#0F2A1D', brandSoft: '#1B4230',
    accent: '#C3DC4E', accentInk: '#17240C',
    logo: '/brands/CLUBS_GRP_PRESTIGIA.png',
  },
  CLUBS_GRP_MADAEF: {
    label: 'Madaef Golfs',
    brand: '#384751', brandSoft: '#4C5F6B',
    accent: '#6D9319', accentInk: '#FFFFFF',
    logo: '/brands/CLUBS_GRP_MADAEF.png',
  },
  CLUBS_GRP_RGAM: {
    label: 'Royal Golf Anfa Mohammedia',
    brand: '#3253A6', brandSoft: '#4467C4',
    accent: '#BA9313', accentInk: '#241C00',
    logo: '/brands/CLUBS_GRP_RGAM.png',
  },
  CLUBS_GRP_ALMAADEN: {
    label: 'Al Maaden',
    brand: '#5D4429', brandSoft: '#75573A',
    accent: '#46744C', accentInk: '#FFFFFF',
    logo: '/brands/CLUBS_GRP_ALMAADEN.png',
  },
  CLUBS_GRP_RGDES: {
    label: 'Royal Golf Dar Es Salam',
    brand: '#2B2B2B', brandSoft: '#3D3D3D',
    accent: '#D6B673', accentInk: '#241C0C',
    logo: '/brands/CLUBS_GRP_RGDES.png',
  },
  CLUBS_GRP_OCEAN: {
    label: 'Ocean Golf',
    brand: '#4674B8', brandSoft: '#5A87C9',
    accent: '#8AA746', accentInk: '#16200A',
    logo: '/brands/CLUBS_GRP_OCEAN.png',
  },
  CLUBS_GRP_RGM: {
    label: 'Royal Golf Marrakech',
    brand: '#0F4102', brandSoft: '#1C5A0C',
    accent: '#7C4D27', accentInk: '#FFFFFF',
    logo: '/brands/CLUBS_GRP_RGM.png',
  },
  CLUBS_GRP_MAROGOLF: {
    label: 'Maroc Golf',
    brand: '#641A1C', brandSoft: '#7D2A2C',
    accent: '#B0891F', accentInk: '#241B00',
    logo: '/brands/CLUBS_GRP_MAROGOLF.png',
  },
};

export const defaultTheme: GroupTheme = themes.CLUBS_GRP_PRESTIGIA!;

/**
 * Liste ordonnee des groupes, pour le selecteur du portail multi-groupes.
 * L ordre suit la declaration de `themes`.
 */
export function groupList(): Array<{ id: string; label: string; logo?: string }> {
  return Object.entries(themes).map(([id, t]) => ({ id, label: t.label, logo: t.logo }));
}

export function isKnownGroup(id: string | null | undefined): boolean {
  if (!id) return false;
  return Object.prototype.hasOwnProperty.call(themes, id.trim().toUpperCase());
}

export function themeForGroup(group: string | undefined): GroupTheme {
  if (!group) return defaultTheme;
  return themes[group.trim().toUpperCase()] ?? defaultTheme;
}

/** Ecrit les jetons du groupe sur la racine du document. */
export function applyTheme(theme: GroupTheme): void {
  const root = document.documentElement;
  root.style.setProperty('--color-brand', theme.brand);
  root.style.setProperty('--color-brand-soft', theme.brandSoft);
  root.style.setProperty('--color-accent', theme.accent);
  root.style.setProperty('--color-accent-ink', theme.accentInk);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.brand);
}
