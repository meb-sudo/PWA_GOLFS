import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  CompetitionRegisterInput, CompetitionUnregisterInput,
  ChangeEmailInput, ChangeMobileInput, todayApiDate,
} from '@golf/contracts';
import * as golfs from '../upstream/golfs.js';
import * as frmg from '../upstream/frmg.js';
import { sessionOf, avpOf } from '../session/plugin.js';
import { updateSessionMember } from '../session/store.js';
import { businessError } from '../upstream/http.js';
import { cached } from '../lib/cache.js';

const ClubQuery = z.object({ club: z.string().regex(/^[0-9A-Za-z]{4,8}$/).optional() });

export async function competitionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', app.requireSession);

  app.get('/api/competitions', async (req) => {
    const session = sessionOf(req);
    const date = z.object({ date: z.string().regex(/^\d{8}$/).optional() })
      .parse(req.query).date ?? todayApiDate();

    const clubs = await golfs.competitions(session.licence, session.group, date);
    return { clubs };
  });

  app.post('/api/competitions/register', async (req, reply) => {
    const body = CompetitionRegisterInput.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'invalid_input', message: 'Saisie invalide.' });
    }
    const session = sessionOf(req);

    const result = await golfs.registerCompetition({
      competitionClubId: body.data.competitionClubId,
      playerClubId: session.member.clubId,
      licence: session.licence,
      competitionId: body.data.competitionId,
      serieId: body.data.serieId,
      avp: avpOf(session),
    });

    const err = businessError(result.message);
    if (err) return reply.code(409).send({ error: 'rejected', message: err });
    return {
      status: 'registered' as const,
      paymentUrl: result.paymentUrl || null,
    };
  });

  app.post('/api/competitions/unregister', async (req, reply) => {
    const body = CompetitionUnregisterInput.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        message: body.error.issues[0]?.message ?? 'Motif requis.',
      });
    }
    const session = sessionOf(req);

    const message = await golfs.unregisterCompetition({
      clubId: body.data.competitionClubId,
      licence: session.licence,
      competitionId: body.data.competitionId,
      serieId: body.data.serieId,
      reason: body.data.reason,
    });

    const err = businessError(message);
    if (err) return reply.code(409).send({ error: 'rejected', message: err });
    return { status: 'unregistered' as const };
  });
}

export async function contentRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', app.requireSession);

  /** Actualites du club. since permet une synchro incrementale. */
  app.get('/api/news', async (req) => {
    const session = sessionOf(req);
    const query = z.object({
      club: z.string().regex(/^[0-9A-Za-z]{4,8}$/).optional(),
      since: z.string().max(32).optional(),
    }).parse(req.query);

    const clubId = query.club ?? session.member.clubId;
    const since = query.since ?? '19700101000000';
    const news = await golfs.news(clubId, since);
    return { news };
  });

  app.get('/api/notifications', async (req) => {
    const session = sessionOf(req);
    // 3e param amont = plateforme (ANDROID | IOS). "WEB" ne renvoie rien, on
    // lit donc le canal ANDROID (meme contenu qu IOS).
    const notifications = await golfs.notifications(
      session.licence, session.group, 'ANDROID',
    );
    return { notifications };
  });

  app.get('/api/carnets', async (req) => {
    const session = sessionOf(req);
    const query = ClubQuery.parse(req.query);
    const carnets = await golfs.carnets(
      query.club ?? session.member.clubId, session.licence,
    );
    return { carnets };
  });
}

export async function profileRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', app.requireSession);

  app.post('/api/profile/email', async (req, reply) => {
    const body = ChangeEmailInput.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        message: body.error.issues[0]?.message ?? 'Adresse invalide.',
      });
    }
    const session = sessionOf(req);

    const message = await golfs.changeEmail({
      memberId: session.member.id,
      clubId: session.member.clubId,
      registrationNumber: session.member.registrationNumber,
      email: body.data.email,
    });
    const err = businessError(message);
    if (err) return reply.code(409).send({ error: 'rejected', message: err });

    updateSessionMember(session.id, { ...session.member, email: body.data.email });
    return { status: 'updated' as const, email: body.data.email };
  });

  app.post('/api/profile/mobile', async (req, reply) => {
    const body = ChangeMobileInput.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        message: body.error.issues[0]?.message ?? 'Numero invalide.',
      });
    }
    const session = sessionOf(req);

    const message = await golfs.updateMobile(
      session.member.id, session.member.clubId, body.data.mobile,
    );
    const err = businessError(message);
    if (err) return reply.code(409).send({ error: 'rejected', message: err });

    updateSessionMember(session.id, { ...session.member, mobile: body.data.mobile });
    return { status: 'updated' as const, mobile: body.data.mobile };
  });
}

/**
 * Images : cartes, badges et logos.
 * Proxifiees et mises en cache plutot que retelechargees a chaque affichage
 * comme le fait l application actuelle.
 */
export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', app.requireSession);

  app.get('/api/media/member-card', async (req, reply) => {
    const session = sessionOf(req);
    const query = ClubQuery.parse(req.query);
    const clubId = query.club ?? session.member.clubId;

    // Pas de cache memoire : ces visuels pesent plusieurs centaines de Ko
    // et sont propres a chaque adherent. Les garder en RAM ferait grossir le
    // BFF proportionnellement au nombre d utilisateurs. On s appuie sur
    // Cache-Control et sur le service worker de la PWA.
    const image = await golfs.memberBadge(clubId, session.licence);
    if (!image) {
      return reply.code(404).send({
        error: 'not_found',
        message: 'Carte de membre indisponible.',
      });
    }
    return reply
      .header('Content-Type', image.contentType)
      .header('Cache-Control', 'private, max-age=3600')
      .send(image.body);
  });

  app.get('/api/media/licence-photo', async (req, reply) => {
    const session = sessionOf(req);
    const image = await frmg.licenceBadge(session.licence);
    if (!image) {
      return reply.code(404).send({
        error: 'not_found',
        message: 'Carte de licence indisponible.',
      });
    }
    return reply
      .header('Content-Type', image.contentType)
      .header('Cache-Control', 'private, max-age=86400')
      .send(image.body);
  });

  app.get('/api/media/club-logo/:club', async (req, reply) => {
    const params = z.object({ club: z.string().regex(/^[0-9A-Za-z]{4,8}$/) })
      .safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_club', message: 'Club inconnu.' });
    }
    const image = await cached(
      `logo:${params.data.club}`, 24 * 60 * 60_000,
      () => golfs.clubLogo(params.data.club),
    );
    if (!image) {
      return reply.code(404).send({ error: 'not_found', message: 'Logo indisponible.' });
    }
    return reply
      .header('Content-Type', image.contentType)
      .header('Cache-Control', 'public, max-age=86400')
      .send(image.body);
  });
}
