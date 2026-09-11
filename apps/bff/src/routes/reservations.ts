import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  BookingInput, CancelInput, ChangeTimeInput, CheckPlayersInput,
  ReservationPlayerList, DeparturePlayerInput, todayApiDate, canCancel,
} from '@golf/contracts';
import * as golfs from '../upstream/golfs.js';
import * as logigolf from '../upstream/logigolf.js';
import { sessionOf } from '../session/plugin.js';
import { businessError } from '../upstream/http.js';

const IdParam = z.object({ id: z.string().min(1).max(64) });
const ClubQuery = z.object({ club: z.string().regex(/^[0-9A-Za-z]{4,8}$/) });

/**
 * Reservations.
 *
 * Toutes les routes verifient que la reservation visee appartient bien a
 * la session en cours : l amont n a aucun controle d acces (constat C-03)
 * et accepterait n importe quel numero de dossier.
 */
export async function reservationRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', app.requireSession);

  /** Liste des reservations a venir. */
  app.get('/api/reservations', async (req) => {
    const session = sessionOf(req);
    const from = z.object({ from: z.string().regex(/^\d{8}$/).optional() })
      .parse(req.query).from ?? todayApiDate();

    const reservations = await logigolf.reservations({
      licence: session.licence,
      affiliationClubId: session.member.clubId,
      fromDate: from,
    });
    return { reservations };
  });

  /** Detail : joueurs et prestations. */
  app.get('/api/reservations/:id', async (req, reply) => {
    const params = IdParam.safeParse(req.params);
    const query = ClubQuery.safeParse(req.query);
    if (!params.success || !query.success) {
      return reply.code(400).send({ error: 'invalid_input', message: 'Reservation inconnue.' });
    }

    const owned = await assertOwned(req, params.data.id);
    if (!owned) {
      return reply.code(404).send({
        error: 'not_found',
        message: 'Cette reservation est introuvable.',
      });
    }

    const [detail, players] = await Promise.all([
      logigolf.reservationDetail(params.data.id, query.data.club),
      golfs.reservationPlayers(query.data.club, params.data.id)
        .then((rows) => ReservationPlayerList.parse(rows))
        .catch(() => []),
    ]);

    return { reservation: owned, detail, players };
  });

  /** Annulation, avec motif obligatoire. */
  app.post('/api/reservations/:id/cancel', async (req, reply) => {
    const params = IdParam.safeParse(req.params);
    const body = CancelInput.safeParse(req.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        message: body.success ? 'Reservation inconnue.'
          : body.error.issues[0]?.message ?? 'Motif requis.',
      });
    }

    const session = sessionOf(req);
    const reservation = await assertOwned(req, params.data.id);
    if (!reservation) {
      return reply.code(404).send({ error: 'not_found', message: 'Reservation introuvable.' });
    }

    // La regle d annulation est portee par le club, pas par le client.
    const info = await golfs.clubInfo(reservation.clubId, todayApiDate(), 'A');
    if (!canCancel(reservation.date, info.rules.cancellationAllowed, info.rules.cancellationDays)) {
      return reply.code(409).send({
        error: 'cancellation_closed',
        message: info.rules.cancellationAllowed
          ? `Le delai d annulation est depasse (${info.rules.cancellationDays} jour(s) avant le depart).`
          : 'Ce club ne permet pas l’annulation depuis l’application.',
      });
    }

    const message = await golfs.cancelBooking({
      clubId: reservation.clubId,
      reservationId: params.data.id,
      note: body.data.note,
      email: session.member.email,
      players: String(reservation.players),
    });

    const err = businessError(message);
    if (err) return reply.code(409).send({ error: 'rejected', message: err });
    return { status: 'cancelled' as const };
  });

  /** Changement d horaire. */
  app.post('/api/reservations/:id/time', async (req, reply) => {
    const params = IdParam.safeParse(req.params);
    const body = ChangeTimeInput.safeParse(req.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        message: body.success ? 'Reservation inconnue.'
          : body.error.issues[0]?.message ?? 'Saisie invalide.',
      });
    }
    if (!(await assertOwned(req, params.data.id))) {
      return reply.code(404).send({ error: 'not_found', message: 'Reservation introuvable.' });
    }

    const message = await golfs.changeDepartureTime({
      clubId: body.data.clubId,
      reservationId: params.data.id,
      newTime: body.data.newTime,
      oldTime: body.data.oldTime,
      courseOutId: body.data.courseOutId,
      courseBackId: body.data.courseBackId,
      holes: body.data.holes,
      date: body.data.date,
    });

    const err = businessError(message);
    if (err) return reply.code(409).send({ error: 'rejected', message: err });
    return { status: 'updated' as const };
  });

  /** Ajout de joueurs a une reservation existante. */
  app.post('/api/reservations/:id/players', async (req, reply) => {
    const params = IdParam.safeParse(req.params);
    const body = z.object({
      clubId: z.string().regex(/^[0-9A-Za-z]{4,8}$/),
      courseOutId: z.string(),
      courseBackId: z.string().default(''),
      players: z.array(DeparturePlayerInput).min(1).max(3),
    }).safeParse(req.body);

    if (!params.success || !body.success) {
      return reply.code(400).send({ error: 'invalid_input', message: 'Saisie invalide.' });
    }
    if (!(await assertOwned(req, params.data.id))) {
      return reply.code(404).send({ error: 'not_found', message: 'Reservation introuvable.' });
    }

    const message = await golfs.addPlayerToBooking({
      clubId: body.data.clubId,
      reservationId: params.data.id,
      courseOutId: body.data.courseOutId,
      courseBackId: body.data.courseBackId,
      players: body.data.players,
    });

    const err = businessError(message);
    if (err) return reply.code(409).send({ error: 'rejected', message: err });
    return { status: 'added' as const };
  });

  /**
   * Retrait d un joueur.
   * Expose en DELETE ; l amont le fait sur un GET (constat M-09), ce qui
   * l expose aux prechargements de navigateur.
   */
  app.delete('/api/reservations/:id/players/:departure', async (req, reply) => {
    const params = z.object({
      id: z.string().min(1).max(64),
      departure: z.string().min(1).max(128),
    }).safeParse(req.params);
    const query = ClubQuery.safeParse(req.query);

    if (!params.success || !query.success) {
      return reply.code(400).send({ error: 'invalid_input', message: 'Saisie invalide.' });
    }
    if (!(await assertOwned(req, params.data.id))) {
      return reply.code(404).send({ error: 'not_found', message: 'Reservation introuvable.' });
    }

    const message = await golfs.removePlayerFromBooking(
      query.data.club, params.data.departure, params.data.id,
    );
    const err = businessError(message);
    if (err) return reply.code(409).send({ error: 'rejected', message: err });
    return { status: 'removed' as const };
  });

  // -------------------------------------------------------------------------
  // Creation
  // -------------------------------------------------------------------------

  /** Controle serveur du droit a jouer de chaque joueur. */
  app.post('/api/booking/check-players', async (req, reply) => {
    const body = CheckPlayersInput.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        message: body.error.issues[0]?.message ?? 'Saisie invalide.',
      });
    }
    const message = await golfs.checkPlayers(body.data);
    const err = businessError(message);
    if (err) return reply.code(409).send({ error: 'rejected', message: err });
    return { status: 'allowed' as const };
  });

  /** Enregistrement de la reservation. */
  app.post('/api/booking', async (req, reply) => {
    const body = BookingInput.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        message: body.error.issues[0]?.message ?? 'Reservation incomplete.',
      });
    }
    const session = sessionOf(req);

    // Le premier joueur est toujours le titulaire de la session.
    const first = body.data.tabJoueur_Resa[0];
    if (!first || first.sNum_Licence !== session.licence) {
      return reply.code(403).send({
        error: 'forbidden',
        message: 'Le premier joueur doit etre le titulaire du compte.',
      });
    }

    const result = await golfs.createBooking({ ...body.data, sAndroid_Ios: 'WEB' });
    const err = businessError(result.message);
    if (err) return reply.code(409).send({ error: 'rejected', message: err });

    return {
      status: 'created' as const,
      reference: result.info,
      paymentUrl: result.paymentUrl || null,
    };
  });

  /**
   * Verifie que la reservation appartient a la session.
   * L amont ne le fait pas : sans ce controle, changer le numero de
   * dossier dans l URL donnerait acces a la reservation d un autre adherent.
   */
  async function assertOwned(req: Parameters<typeof sessionOf>[0], id: string) {
    const session = sessionOf(req);
    const list = await logigolf.reservations({
      licence: session.licence,
      affiliationClubId: session.member.clubId,
      fromDate: '19700101',
    });
    return list.find((r) => r.id === id) ?? null;
  }
}
