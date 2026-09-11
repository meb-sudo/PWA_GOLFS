import { z } from 'zod';

/**
 * Numero de licence : 10 chiffres, toujours commence par 5.
 *
 * Les espaces sont retires avant validation : un adherent qui colle
 * "5121 124 381" depuis un courriel ne doit pas etre bloque.
 */
export const LICENCE_PATTERN = /^5\d{9}$/;
export const LICENCE_LENGTH = 10;

export const Licence = z.preprocess(
  (v) => (typeof v === 'string' ? v.replace(/[\s.-]/g, '') : v),
  z.string().regex(
    LICENCE_PATTERN,
    'Le numéro de licence comporte 10 chiffres et commence par 5.',
  ),
);

/** Etape 1 : identification par licence + e-mail. */
export const LoginInput = z.object({
  licence: Licence,
  email: z.string().trim().email('Adresse e-mail invalide'),
});
export type LoginInput = z.infer<typeof LoginInput>;

/**
 * Reponse de connexion.
 *  - "authenticated" : appareil déjà validé, session ouverte.
 *  - "code_required" : un code a ete envoye par e-mail.
 */
export const LoginResult = z.object({
  status: z.enum(['authenticated', 'code_required']),
  emailHint: z.string().optional(),
});
export type LoginResult = z.infer<typeof LoginResult>;

/**
 * Etape 2 : verification du code.
 * Le code est compare cote serveur (constat C-02) : il n est jamais
 * transmis au navigateur, contrairement a l application WinDev.
 */
export const VerifyInput = z.object({
  code: z.string().trim().regex(/^\d{4,8}$/, 'Code invalide'),
  /** Memoriser cet appareil pour eviter de redemander le code. */
  trustDevice: z.boolean().default(true),
});
export type VerifyInput = z.infer<typeof VerifyInput>;

/** Renvoi des identifiants par e-mail. */
export const IdentifiersInput = z.object({
  clubId: z.string().trim().min(1),
  email: z.string().trim().email('Adresse e-mail invalide'),
});
export type IdentifiersInput = z.infer<typeof IdentifiersInput>;

export const ChangeEmailInput = z.object({
  email: z.string().trim().email('Adresse e-mail invalide'),
});
export type ChangeEmailInput = z.infer<typeof ChangeEmailInput>;

export const ChangeMobileInput = z.object({
  mobile: z.string().trim().min(6, 'Numéro trop court').max(24),
});
export type ChangeMobileInput = z.infer<typeof ChangeMobileInput>;

/** Masque une adresse e-mail pour l affichage : j***n@exemple.ma */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '';
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 5))}${local.at(-1)}@${domain}`;
}
