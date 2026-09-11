import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { config, resolveGroup } from '../config.js';
import { getSession, refreshSession, type Session } from './store.js';

export const COOKIE_SESSION = 'golf_sid';
export const COOKIE_PENDING = 'golf_pending';
export const COOKIE_DEVICE = 'golf_did';

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

export function setSessionCookie(reply: FastifyReply, sessionId: string): void {
  reply.setCookie(COOKIE_SESSION, sessionId, cookieOptions(config.sessionTtlMs));
}

export function setPendingCookie(reply: FastifyReply, pendingId: string): void {
  reply.setCookie(COOKIE_PENDING, pendingId, cookieOptions(config.authCodeTtlMs));
}

export function setDeviceCookie(reply: FastifyReply, deviceId: string): void {
  reply.setCookie(COOKIE_DEVICE, deviceId, cookieOptions(config.deviceTrustTtlMs));
}

export function clearAuthCookies(reply: FastifyReply): void {
  reply.clearCookie(COOKIE_SESSION, { path: '/' });
  reply.clearCookie(COOKIE_PENDING, { path: '/' });
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
    const sid = readSignedCookie(req, COOKIE_SESSION);
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
