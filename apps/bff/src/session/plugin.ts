import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { config, resolveGroup } from '../config.js';
import { getSession, refreshSession, type Session } from './store.js';

export const COOKIE_SESSION = 'golf_sid';
export const COOKIE_PENDING = 'golf_pending';
export const COOKIE_DEVICE = 'golf_did';
export const COOKIE_REMEMBER = 'golf_remember';

declare module 'fastify' {
  interface FastifyRequest {
    session: Session | null;
    /** Groupe multi-club resolu depuis l hote appelant. */
    group: string;
  }
  interface FastifyInstance {
    requireSession: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * Cookies de session, tous httpOnly.
 *
 * Aucun identifiant exploitable n atteint le JavaScript de la PWA :
 * contrairement a l application WinDev qui stocke licence et e-mail en
 * clair sur l appareil (SauveParametre), rien n est lisible cote client.
 */
function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.floor(maxAgeMs / 1000),
    signed: true,
  };
}

/**
 * Nom de cookie propre au groupe : chaque groupe garde SA session, son
 * "se souvenir", son appareil de confiance. Sans ce suffixe, tous les groupes
 * partageraient les memes cookies et une connexion en chasserait une autre ;
 * ici, plusieurs groupes (apps installees) restent connectes en meme temps.
 */
export function scoped(base: string, group: string): string {
  const g = (group || '').replace(/[^A-Za-z0-9_]/g, '');
  return g ? `${base}_${g}` : base;
}

export function setSessionCookie(reply: FastifyReply, sessionId: string, group: string): void {
  reply.setCookie(scoped(COOKIE_SESSION, group), sessionId, cookieOptions(config.sessionTtlMs));
}

export function setPendingCookie(reply: FastifyReply, pendingId: string, group: string): void {
  reply.setCookie(scoped(COOKIE_PENDING, group), pendingId, cookieOptions(config.authCodeTtlMs));
}

export function setDeviceCookie(reply: FastifyReply, deviceId: string, group: string): void {
  reply.setCookie(scoped(COOKIE_DEVICE, group), deviceId, cookieOptions(config.deviceTrustTtlMs));
}

/**
 * Cookie "se souvenir" : porte licence + e-mail + groupe (signes, httpOnly)
 * pour rouvrir la session sans redemander les identifiants. Meme duree que
 * l appareil de confiance (90 jours).
 */
export function setRememberCookie(reply: FastifyReply, payload: string, group: string): void {
  reply.setCookie(scoped(COOKIE_REMEMBER, group), payload, cookieOptions(config.deviceTrustTtlMs));
}

export function clearRememberCookie(reply: FastifyReply, group: string): void {
  reply.clearCookie(scoped(COOKIE_REMEMBER, group), { path: '/' });
}

export function clearAuthCookies(reply: FastifyReply, group: string): void {
  reply.clearCookie(scoped(COOKIE_SESSION, group), { path: '/' });
  reply.clearCookie(scoped(COOKIE_PENDING, group), { path: '/' });
  reply.clearCookie(scoped(COOKIE_REMEMBER, group), { path: '/' });
}

export function readSignedCookie(
  req: FastifyRequest, name: string,
): string | undefined {
  const raw = req.cookies[name];
  if (!raw) return undefined;
  const unsigned = req.unsignCookie(raw);
  return unsigned.valid && unsigned.value ? unsigned.value : undefined;
}

export const sessionPlugin = fp(async (app: FastifyInstance) => {
  app.decorateRequest('session', null);
  app.decorateRequest('group', '');

  app.addHook('onRequest', async (req) => {
    // Groupe choisi par le front (en-tete X-Golf-Group depuis ?grp=), sinon
    // resolu par le sous-domaine, sinon defaut.
    const h = req.headers['x-golf-group'];
    const grp = Array.isArray(h) ? h[0] : h;
    req.group = resolveGroup(req.headers.host, grp);
    // Session propre au groupe : chaque groupe (app installee) a la sienne.
    const sid = readSignedCookie(req, scoped(COOKIE_SESSION, req.group));
    const session = getSession(sid);
    if (session) refreshSession(session);
    req.session = session;
  });

  app.decorate(
    'requireSession',
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (!req.session) {
        reply.code(401).send({
          error: 'unauthenticated',
          message: 'Votre session a expire. Reconnectez-vous.',
        });
      }
    },
  );
});

/** Session garantie non nulle apres le garde requireSession. */
export function sessionOf(req: FastifyRequest): Session {
  if (!req.session) throw new Error('Session absente après le garde requireSession');
  return req.session;
}

/**
 * Type de joueur attendu par les API amont : A (abonne) ou V (visiteur).
 * Un licencie FRMG non abonne utilise le parcours abonne en tant que V.
 */
export function avpOf(session: Session): string {
  return session.member.isLicenseeBooking ? 'V' : 'A';
}
