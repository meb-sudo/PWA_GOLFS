import DOMPurify from 'dompurify';

/**
 * Assainissement du HTML des actualites.
 *
 * Les articles sont saisis dans le back-office du club, souvent colles depuis
 * Word ou un courriel : ils arrivent charges de <span style="font-family:
 * Segoe UI; color: rgb(8,8,9); font-size: 14px">. Deux problemes distincts :
 *
 *  1. securite : du HTML tiers ne doit jamais etre injecte tel quel ;
 *  2. mise en forme : ces styles en dur imposeraient une autre police, une
 *     autre couleur et une autre taille que celles de l application.
 *
 * On garde donc la structure (paragraphes, listes, liens, emphase) et on
 * jette tout le reste, y compris les attributs style et class.
 */

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u',
  'ul', 'ol', 'li', 'a',
  'h2', 'h3', 'h4', 'blockquote',
];

const ALLOWED_ATTR = ['href', 'target', 'rel'];

/** HTML pret a etre injecte, ou chaine vide si rien d exploitable. */
export function sanitizeArticle(html: string | null | undefined): string {
  if (!html) return '';

  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Les liens externes ne doivent pas pouvoir manipuler la fenetre parente.
    ADD_ATTR: ['target'],
    FORBID_ATTR: ['style', 'class', 'id'],
    // Pas de contenu hors du corps : ni <style>, ni <script>, ni commentaires.
    KEEP_CONTENT: true,
  });

  return clean.trim();
}

/**
 * Texte brut, pour les apercus et les listes.
 * On passe par le DOM plutot que par une expression reguliere : &amp; et les
 * entites sont ainsi decodees correctement.
 */
export function toPlainText(html: string | null | undefined): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(
    DOMPurify.sanitize(html, { ALLOWED_TAGS: ['br', 'p', 'li'], ALLOWED_ATTR: [] }),
    'text/html',
  );
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Ouvre les liens externes dans un nouvel onglet, sans acces a l opener. */
export function hardenLinks(root: HTMLElement | null): void {
  if (!root) return;
  for (const a of root.querySelectorAll('a[href]')) {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  }
}
