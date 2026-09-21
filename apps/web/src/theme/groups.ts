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
 * Theme unique applique a TOUTE l app (tous les clubs) : ambiance "Nature".
 * Les clubs gardent leur identite (logo, nom), mais les couleurs de l app sont
 * communes. Seule la personnalisation locale du client peut les changer.
 */
export const appDefaultTheme: GroupTheme = {
  label: 'Nature',
  brand: '#14432E',
  brandSoft: '#215B3E',
  accent: '#C3DC4E',
  accentInk: '#17240C',
};

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

// ---------------------------------------------------------------------------
// Personnalisation locale du theme (cote client uniquement)
//
// Le client peut recolorer l app pour SON appareil : la preference vit dans le
// localStorage (jamais envoyee au serveur, jamais partagee) et se superpose au
// theme du groupe. Un simple retrait de la cle rend le theme par defaut.
// ---------------------------------------------------------------------------

const OVERRIDE_KEY = 'golf_theme_override';

/** Personnalisation stockee : les deux couleurs choisies + leurs derivees. */
export type ThemeOverride = Pick<GroupTheme, 'brand' | 'brandSoft' | 'accent' | 'accentInk'>;

/** #RGB ou #RRGGBB -> {r,g,b}, ou null si invalide. */
function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const toHex = (n: number): string => Math.round(Math.max(0, Math.min(255, n)))
  .toString(16).padStart(2, '0');

/** Eclaircit une couleur vers le blanc (pour deriver brandSoft). */
function lighten(hex: string, amount: number): string {
  const c = parseHex(hex);
  if (!c) return hex;
  const mix = (v: number) => v + (255 - v) * amount;
  return `#${toHex(mix(c.r))}${toHex(mix(c.g))}${toHex(mix(c.b))}`;
}

/** Luminance relative WCAG d une couleur (0 = noir, 1 = blanc). */
function relLuminance(hex: string): number {
  const c = parseHex(hex);
  if (!c) return 0;
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

/** Rapport de contraste WCAG entre deux couleurs (1 = identique, 21 = max). */
function contrastRatio(a: string, b: string): number {
  const hi = Math.max(relLuminance(a), relLuminance(b));
  const lo = Math.min(relLuminance(a), relLuminance(b));
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Variante de l accent LISIBLE sur le fond de marque (le heros).
 *
 * Certains couples marque/accent ont un contraste faible (ex. Al Maaden : vert
 * sur brun) : on eclaircit alors l accent par paliers jusqu a un bon contraste
 * (cible 4.5:1, seuil WCAG AA pour texte normal, confortable a l oeil). Les
 * accents deja vifs sont peu ou pas modifies.
 */
function accentOnBrand(accent: string, brand: string): string {
  let c = accent;
  for (let i = 0; i < 8 && contrastRatio(c, brand) < 4.5; i += 1) {
    c = lighten(c, 0.28);
  }
  return c;
}

/** Encre lisible (blanc ou tres sombre) selon la luminance de la couleur. */
function readableInk(hex: string): string {
  const c = parseHex(hex);
  if (!c) return '#FFFFFF';
  // Luminance perceptive (ITU-R BT.601).
  const l = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
  return l > 0.6 ? '#1A1A1A' : '#FFFFFF';
}

/** Construit une personnalisation complete a partir des 2 couleurs choisies. */
export function buildOverride(input: { brand: string; accent: string }): ThemeOverride {
  return {
    brand: input.brand,
    brandSoft: lighten(input.brand, 0.14),
    accent: input.accent,
    accentInk: readableInk(input.accent),
  };
}

/** Lit la personnalisation locale, ou null. Tolerant a tout probleme de stockage. */
export function readThemeOverride(): ThemeOverride | null {
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<ThemeOverride>;
    if (!o.brand || !o.accent) return null;
    return {
      brand: o.brand,
      brandSoft: o.brandSoft || lighten(o.brand, 0.14),
      accent: o.accent,
      accentInk: o.accentInk || readableInk(o.accent),
    };
  } catch { return null; }
}

export function hasThemeOverride(): boolean {
  return readThemeOverride() !== null;
}

export function saveThemeOverride(override: ThemeOverride): void {
  try { localStorage.setItem(OVERRIDE_KEY, JSON.stringify(override)); } catch { /* quota */ }
}

export function clearThemeOverride(): void {
  try { localStorage.removeItem(OVERRIDE_KEY); } catch { /* ignore */ }
}

/**
 * Ecrit les jetons du theme sur la racine du document.
 *
 * La personnalisation locale du client (si presente) se superpose au theme du
 * groupe : ainsi tous les points d appel (demarrage, resolution de groupe,
 * connexion) la respectent sans changement.
 */
export function applyTheme(_theme?: GroupTheme): void {
  // L app utilise un theme unique (appDefaultTheme, "Nature") pour tous les
  // clubs ; seule la personnalisation locale du client le modifie. Le parametre
  // est conserve pour compatibilite des appels mais n influe plus sur les couleurs.
  const override = readThemeOverride();
  const eff: GroupTheme = override
    ? { ...appDefaultTheme, ...override }
    : appDefaultTheme;

  const root = document.documentElement;
  root.style.setProperty('--color-brand', eff.brand);
  root.style.setProperty('--color-brand-soft', eff.brandSoft);
  root.style.setProperty('--color-accent', eff.accent);
  root.style.setProperty('--color-accent-ink', eff.accentInk);
  // Accent garanti lisible sur le fond de marque (heros) : voir accentOnBrand.
  root.style.setProperty('--color-accent-on-brand', accentOnBrand(eff.accent, eff.brand));

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', eff.brand);
}
