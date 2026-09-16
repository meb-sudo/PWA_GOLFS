import type { FastifyInstance } from 'fastify';
import {
  LoginInput, VerifyInput, IdentifiersInput, maskEmail,
} from '@golf/contracts';
import { config, fixedCodeFor, isHostMapped } from '../config.js';
import * as golfs from '../upstream/golfs.js';
import {
  startPendingAuth, verifyPendingAuth, getPendingAuth, dropPendingAuth,
  createSession, destroySession, trustDevice, isDeviceTrusted, newDeviceId,
} from '../session/store.js';
import {
  COOKIE_PENDING, COOKIE_DEVICE, COOKIE_SESSION, COOKIE_REMEMBER,
  setSessionCookie, setPendingCookie, setDeviceCookie, clearAuthCookies,
  setRememberCookie, clearRememberCookie, readSignedCookie, scoped,
} from '../session/plugin.js';

/** Contenu du cookie "se souvenir" : de quoi rouvrir une session. */
interface RememberedLogin { licence: string; email: string; group: string; }

function parseRemembered(raw: string | undefined): RememberedLogin | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<RememberedLogin>;
    if (typeof o.licence === 'string' && typeof o.email === 'string'
      && typeof o.group === 'string') {
      return { licence: o.licence, email: o.email, group: o.group };
    }
  } catch { /* cookie illisible : on l ignore */ }
  return null;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Etape 1 : identification.
   *
   * Aucun contournement n est porte depuis WinDev : ni le code maitre
   * 124816 (constat C-01), ni l adresse de test qui saute la validation.
   */
  app.post('/api/auth/login', {
    config: { rateLimit: { max: 10, timeWindow: '5 minutes' } },
  }, async (req, reply) => {
    const parsed = LoginInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        message: parsed.error.issues[0]?.message ?? 'Saisie invalide.',
      });
    }
    const { licence, email, remember } = parsed.data;

    const member = await golfs.login(licence, email, req.group);

    // Appareil deja valide : on ouvre la session sans redemander de code.
    const deviceId = readSignedCookie(req, scoped(COOKIE_DEVICE, req.group));
    if (isDeviceTrusted(deviceId, licence)) {
      const session = createSession({ licence, email, group: req.group, member });
      setSessionCookie(reply, session.id, req.group);
      // "Rester connecte" : on memorise de quoi rouvrir la session plus tard.
      if (remember) {
        setRememberCookie(reply, JSON.stringify({ licence, email, group: req.group }), req.group);
      } else {
        clearRememberCookie(reply, req.group);
      }
      return { status: 'authenticated' as const };
    }

    // Compte de test : ne pas envoyer d e-mail, utiliser le code fixe.
    const fixed = fixedCodeFor(email);
    const code = fixed ?? await golfs.sendAuthCode(email, req.group);
    if (fixed) {
      req.log.warn(`[TEST] Envoi d e-mail ignore pour ${email}, code fixe utilise.`);
    } else if (config.logAuthCode) {
      req.log.warn(`[RECETTE] Code de validation pour ${email} : ${code}`);
    }
    const pendingId = startPendingAuth({
      licence, email, group: req.group, member, code, remember,
    });
    setPendingCookie(reply, pendingId, req.group);

    // Le code reste sur le serveur : le navigateur ne recoit qu un indice.
    return { status: 'code_required' as const, emailHint: maskEmail(email) };
  });

  /** Etape 2 : verification du code, entierement cote serveur. */
  app.post('/api/auth/verify', {
    config: { rateLimit: { max: 10, timeWindow: '5 minutes' } },
  }, async (req, reply) => {
    const parsed = VerifyInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        message: parsed.error.issues[0]?.message ?? 'Code invalide.',
      });
    }

    const pendingId = readSignedCookie(req, scoped(COOKIE_PENDING, req.group));
    const outcome = verifyPendingAuth(pendingId, parsed.data.code);

    if (!outcome.ok) {
      const messages = {
        expired: 'Ce code a expiré. Demandez-en un nouveau.',
        invalid: 'Code incorrect.',
        too_many_attempts: 'Trop de tentatives. Demandez un nouveau code.',
      } as const;
      const status = outcome.reason === 'invalid' ? 401 : 410;
      return reply.code(status).send({
        error: outcome.reason,
        message: messages[outcome.reason],
      });
    }

    const { auth } = outcome;
    const session = createSession({
      licence: auth.licence,
      email: auth.email,
      group: auth.group,
      member: auth.member,
    });
    setSessionCookie(reply, session.id, req.group);
    reply.clearCookie(scoped(COOKIE_PENDING, req.group), { path: '/' });

    // "Rester connecte" (choisi a l etape 1) : cookie de reconnexion silencieuse.
    if (auth.remember) {
      setRememberCookie(reply, JSON.stringify({
        licence: auth.licence, email: auth.email, group: auth.group,
      }), req.group);
    } else {
      clearRememberCookie(reply, req.group);
    }

    if (parsed.data.trustDevice) {
      const deviceId = readSignedCookie(req, scoped(COOKIE_DEVICE, req.group)) ?? newDeviceId();
      trustDevice(deviceId, auth.licence);
      setDeviceCookie(reply, deviceId, req.group);
    }

    return { status: 'authenticated' as const };
  });

  /** Renvoyer un nouveau code pour la meme tentative. */
  app.post('/api/auth/resend', {
    config: { rateLimit: { max: 3, timeWindow: '10 minutes' } },
  }, async (req, reply) => {
    const pendingId = readSignedCookie(req, scoped(COOKIE_PENDING, req.group));
    const auth = getPendingAuth(pendingId);
    if (!auth) {
      return reply.code(410).send({
        error: 'expired',
        message: 'La demande a expire. Reprenez la connexion.',
      });
    }

    dropPendingAuth(pendingId);
    const fixed = fixedCodeFor(auth.email);
    const code = fixed ?? await golfs.sendAuthCode(auth.email, auth.group);
    if (fixed) {
      req.log.warn(`[TEST] Renvoi ignore pour ${auth.email}, code fixe conserve.`);
    } else if (config.logAuthCode) {
      req.log.warn(`[RECETTE] Nouveau code pour ${auth.email} : ${code}`);
    }
    const newId = startPendingAuth({
      licence: auth.licence, email: auth.email, group: auth.group,
      member: auth.member, code, remember: auth.remember,
    });
    setPendingCookie(reply, newId, req.group);
    return { status: 'code_required' as const, emailHint: maskEmail(auth.email) };
  });

  /** Renvoi des identifiants par e-mail. */
  app.post('/api/auth/identifiers', {
    config: { rateLimit: { max: 3, timeWindow: '10 minutes' } },
  }, async (req, reply) => {
    const parsed = IdentifiersInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        message: parsed.error.issues[0]?.message ?? 'Saisie invalide.',
      });
    }
    await golfs.sendIdentifiers(parsed.data.clubId, parsed.data.email);
    // Reponse identique que l adresse existe ou non : pas de fuite.
    return {
      status: 'sent' as const,
      message: 'Si cette adresse est connue, vos identifiants viennent d etre envoyes.',
    };
  });

  /**
   * Contexte de marque, accessible sans session.
   *
   * La page de connexion en a besoin avant toute authentification : elle ne
   * peut pas interroger /auth/me, qui exige une session.
   */
  app.get('/api/context', async (req) => ({
    group: req.group,
    theme: config.theme || req.group,
    // Sous-domaine dedie ? Le front s en sert pour montrer (ou non) le
    // selecteur de groupe sur le domaine nu.
    hostMapped: isHostMapped(req.headers.host),
  }));

  /**
   * Clubs du groupe courant, accessibles SANS session.
   * Sert a l ecran "Mes identifiants" : l adherent choisit son club par son
   * nom (menu deroulant), la valeur envoyee reste le numero de club (sClub_5X)
   * que peu de clients connaissent. GET_CLUBS_TEL_GROUPE.
   */
  app.get('/api/group-clubs', async (req) => {
    const clubs = await golfs.groupClubs(req.group).catch(() => []);
    return { clubs };
  });

  /**
   * Profil de la session en cours.
   *
   * Si la session a disparu (expiree, ou serveur redemarre) mais qu un cookie
   * "se souvenir" valide est present pour le meme groupe, on rouvre la session
   * silencieusement : l adherent reste connecte jusqu a "Se deconnecter".
   */
  app.get('/api/auth/me', async (req, reply) => {
    let session = req.session;

    if (!session) {
      const remembered = parseRemembered(
        readSignedCookie(req, scoped(COOKIE_REMEMBER, req.group)),
      );
      // On ne rouvre que sur le groupe memorise (respecte un lien ?grp= autre).
      if (remembered && remembered.group === req.group) {
        try {
          const member = await golfs.login(
            remembered.licence, remembered.email, remembered.group,
          );
          session = createSession({
            licence: remembered.licence,
            email: remembered.email,
            group: remembered.group,
            member,
          });
          setSessionCookie(reply, session.id, req.group);
        } catch {
          // Reconnexion impossible (amont, compte modifie) : on oublie.
          clearRememberCookie(reply, req.group);
        }
      }
    }

    if (!session) {
      return reply.code(401).send({
        error: 'unauthenticated',
        message: 'Votre session a expire. Reconnectez-vous.',
      });
    }

    return {
      member: session.member,
      group: session.group,
      theme: config.theme || session.group,
    };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    // Deconnexion du SEUL groupe courant : les autres groupes restent connectes.
    destroySession(readSignedCookie(req, scoped(COOKIE_SESSION, req.group)));
    clearAuthCookies(reply, req.group);
    return { status: 'logged_out' as const };
  });
}
