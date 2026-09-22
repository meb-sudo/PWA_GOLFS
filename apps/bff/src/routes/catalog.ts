import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AvailabilityQuery, todayApiDate } from '@golf/contracts';
import * as golfs from '../upstream/golfs.js';
import { sessionOf, avpOf } from '../session/plugin.js';
import { cached } from '../lib/cache.js';
import { dailyForecast } from '../weather/openMeteo.js';

/**
 * Identifiant de club.
 * Les clubs hors groupe portent un suffixe lettre ("50006M", "50006A") :
 * restreindre aux chiffres les rendait inaccessibles.
 */
const CLUB_ID = z.string().regex(/^[0-9A-Za-z]{4,8}$/);
const ClubParam = z.object({ club: CLUB_ID });

/**
 * TERRAINS_IMAGE -> data URI affichable.
 *
 * Une fois le champ passe en `buffer` cote amont, WinDev le serialise en
 * base64 (comme les images d actualites). On detecte PNG / JPEG par le prefixe
 * base64 et on prefixe l en-tete data:. Renvoie null si vide ou si ce n est
 * pas une image base64 reconnue (ex. ancien binaire brut, avant deploiement).
 */
function clubImageDataUri(s: string): string | null {
  if (!s || s.length < 16) return null;
  if (s.startsWith('data:image')) return s;
  const b64 = s.replace(/\s+/g, '');
  if (/^iVBORw0KGgo/.test(b64)) return `data:image/png;base64,${b64}`;
  if (/^\/9j\//.test(b64)) return `data:image/jpeg;base64,${b64}`;
  return null;
}
const DateQuery = z.object({
  date: z.string().regex(/^\d{8}$/).optional(),
});

/**
 * Referentiel et catalogue.
 * Les donnees stables (clubs, pays, mentions legales, config club) sont
 * mises en cache : l application WinDev les rappelle a chaque ecran.
 */
export async function catalogRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', app.requireSession);

  /**
   * Clubs ou l adherent peut reserver.
   *
   * La source de verite est la reponse de connexion, pas
   * GET_CLUBS_TEL_GROUPE : c est ce que fait AFFICHER_LIST_CLUB cote WinDev.
   * Croiser les deux ferait disparaitre les clubs hors groupe, dont les
   * identifiants portent un suffixe ("50006M") absent de la liste du groupe.
   */
  app.get('/api/clubs', async (req) => {
    const session = sessionOf(req);

    /*
      La fiche adherent ne porte pas toujours le libelle du club : selon le
      groupe, sClubNom revient vide. On complete alors depuis la liste du
      groupe, qui elle est toujours nommee. La fiche reste la source de
      verite sur *quels* clubs sont reservables ; le nom n est qu un affichage.
    */
    const named = await cached(
      `clubs:${session.group}`, 10 * 60_000,
      () => golfs.groupClubs(session.group),
    ).catch(() => []);
    const nameById = new Map(named.map((c) => [c.clubId, c.name]));

    const toRow = (
      c: {
        clubId: string; name: string; region: string;
        playerType: string; playerId: string;
      },
      scope: 'group' | 'other',
    ) => ({
      clubId: c.clubId,
      name: c.name || nameById.get(c.clubId) || `Club ${c.clubId}`,
      region: c.region,
      /** sJoueur_A_V : A = abonne du club, sinon visiteur. */
      playerType: c.playerType,
      /** sJoueur_ID_AV : identifiant du joueur dans ce club. */
      playerId: c.playerId,
      /** Abonne du club : la reservation est couverte par l abonnement. */
      isMember: c.playerType === 'A',
      bookable: true,
      scope,
    });

    const clubs = [
      ...session.member.bookableClubs.map((c) => toRow(c, 'group')),
      ...session.member.otherBookableClubs.map((c) => toRow(c, 'other')),
      // Une entree sans identifiant n est pas selectionnable : elle
      // produirait une ligne vide et fausserait le club par defaut.
    ].filter((c) => c.clubId !== '' && c.clubId !== '0');

    if (clubs.length !== session.member.bookableClubs.length
      + session.member.otherBookableClubs.length) {
      req.log.warn('fiche adhérent : entrees de club sans identifiant, ignorees');
    }

    return { clubs, homeClubId: session.member.clubId };
  });

  /**
   * Coordonnees GPS des clubs reservables (pour la carte de l accueil).
   * Reutilise clubInfo (deja mis en cache) ; ne renvoie que nom + lat/lng.
   */
  app.get('/api/clubs/geo', async (req) => {
    const session = sessionOf(req);
    const m = session.member;
    const clubList = [...m.bookableClubs, ...m.otherBookableClubs]
      .filter((c) => c.clubId && c.clubId !== '0');
    const named = await golfs.groupClubs(session.group).catch(() => []);
    const nameById = new Map(named.map((c) => [c.clubId, c.name]));

    const results = await Promise.all(clubList.map(async (c) => {
      const info = await cached(
        `clubinfo:${c.clubId}:${todayApiDate()}:${avpOf(session)}`, 5 * 60_000,
        () => golfs.clubInfo(c.clubId, todayApiDate(), avpOf(session)),
      ).catch(() => null);
      if (!info?.geo) return null;
      return {
        clubId: c.clubId,
        name: c.name || nameById.get(c.clubId) || `Club ${c.clubId}`,
        lat: info.geo.lat,
        lng: info.geo.lng,
        // Club principal de l adherent : mis en avant sur la carte.
        home: c.clubId === m.clubId,
      };
    }));

    return { clubs: results.filter((x): x is NonNullable<typeof x> => x !== null) };
  });

  /** Configuration complete d un club : regles, parcours, pays. */
  app.get('/api/clubs/:club/info', async (req, reply) => {
    const params = ClubParam.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_club', message: 'Club inconnu.' });
    }
    const query = DateQuery.parse(req.query);
    const session = sessionOf(req);
    const date = query.date ?? todayApiDate();

    return cached(
      `clubinfo:${params.data.club}:${date}:${avpOf(session)}`, 5 * 60_000,
      () => golfs.clubInfo(params.data.club, date, avpOf(session)),
    );
  });

  /**
   * Photo du club (fond de banniere) — pour la page "Les clubs" UNIQUEMENT.
   *
   * L amont ne renvoie l image du parcours (TERRAINS_IMAGE) qu en mode V/P
   * (vide pour A). On appelle donc ICI en "V", SANS toucher a l appel principal
   * clubInfo (A) utilise partout ailleurs : aucun changement de logique pour
   * l existant. L image arrive en base64 (champ buffer amont) et devient un
   * data URI ; null si indisponible.
   */
  app.get('/api/clubs/:club/photo', async (req, reply) => {
    const params = ClubParam.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_club', message: 'Club inconnu.' });
    }
    const info = await cached(
      `clubphoto:${params.data.club}`, 30 * 60_000,
      () => golfs.clubInfo(params.data.club, todayApiDate(), 'V'),
    ).catch(() => null);
    const raw = (info?.courses ?? []).map((c) => c.image).find(Boolean) ?? '';
    return { image: clubImageDataUri(raw) };
  });

  /**
   * Avantage tarifaire d un joueur non membre du club vise.
   *
   * Transposition de FEN_DEMANDE_RESA_CLUB_NON_ADHERE : avant de reserver
   * dans un club dont on n est pas abonne, WinDev interroge
   * GET_TARIF_NON_MEMBRE pour savoir si l adherent beneficie malgre tout
   * d un avantage au titre de son groupe.
   */
  app.get('/api/clubs/:club/visitor-advantage', async (req, reply) => {
    const params = ClubParam.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_club', message: 'Club inconnu.' });
    }
    const session = sessionOf(req);
    // Le repli est gere par nonMemberAdvantage : on ne renvoie jamais vide.
    const advantage = await golfs.nonMemberAdvantage(
      params.data.club,
      session.licence,
      session.member.isLicenseeBooking,
    );
    return { advantage };
  });

  /**
   * Meteo du jour de jeu (prevision) pour un club a une date ISO.
   *
   * Ne vient PAS des API golf : on la deduit du GPS du club (ClubInfo.geo) via
   * Open-Meteo, cote serveur. Renvoie { weather: null } si le club n a pas de
   * coordonnees ou si la date est hors portee de prevision.
   */
  app.get('/api/clubs/:club/weather', async (req, reply) => {
    const params = ClubParam.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_club', message: 'Club inconnu.' });
    }
    const q = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse(req.query);
    if (!q.success) {
      return reply.code(400).send({ error: 'invalid_input', message: 'Date invalide.' });
    }

    const session = sessionOf(req);
    const info = await cached(
      `clubinfo:${params.data.club}:${todayApiDate()}:${avpOf(session)}`, 5 * 60_000,
      () => golfs.clubInfo(params.data.club, todayApiDate(), avpOf(session)),
    ).catch(() => null);
    if (!info?.geo) return { weather: null };

    const weather = await dailyForecast(info.geo.lat, info.geo.lng, q.data.date);
    return { weather };
  });

  app.get('/api/reference/countries', async () =>
    cached('countries', 24 * 60 * 60_000, () => golfs.countries()),
  );

  app.get('/api/legal', async (req) => {
    const session = sessionOf(req);
    return cached(
      `legal:${session.group}`, 60 * 60_000,
      () => golfs.legal(session.group),
    );
  });

  /** Creneaux disponibles. Jamais mis en cache : la donnee bouge en continu. */
  app.get('/api/clubs/:club/availability', async (req, reply) => {
    const params = ClubParam.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_club', message: 'Club inconnu.' });
    }
    const query = AvailabilityQuery.safeParse(req.query);
    if (!query.success) {
      // On ne relaie pas le message brut de Zod (parfois en anglais, "Invalid
      // input") : ces criteres sont poses par l application, pas saisis par
      // l utilisateur, donc une erreur ici signale un defaut, pas une faute.
      req.log.warn({ issues: query.error.issues }, 'criteres de disponibilite invalides');
      return reply.code(400).send({
        error: 'invalid_input',
        message: 'Impossible de rechercher les departs pour ces criteres.',
      });
    }
    const session = sessionOf(req);

    return golfs.availability({
      clubId: params.data.club,
      date: query.data.date,
      courseOutId: query.data.courseOutId,
      courseBackId: query.data.courseBackId,
      players: query.data.players,
      holes: query.data.holes,
      timeFrom: query.data.timeFrom,
      timeTo: query.data.timeTo,
      departuresToShow: query.data.departuresToShow,
      avp: avpOf(session),
    });
  });

  app.get('/api/clubs/:club/prestations', async (req, reply) => {
    const params = ClubParam.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_club', message: 'Club inconnu.' });
    }
    // WinDev appelle toujours avec "A" (AFFICHAGE_PRESTATION), quel que soit
    // le statut du joueur. La liste des prestations depend du club, pas de
    // l abonnement ; le tarif, lui, est resolu ailleurs.
    return cached(
      `prestations:${params.data.club}:A`, 5 * 60_000,
      () => golfs.prestations(params.data.club, 'A'),
    );
  });

  app.get('/api/clubs/:club/caddies', async (req, reply) => {
    const params = ClubParam.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_club', message: 'Club inconnu.' });
    }
    const query = DateQuery.parse(req.query);
    return golfs.caddies(params.data.club, query.date ?? todayApiDate());
  });

  /**
   * Tarif d un joueur pour un depart donne.
   *
   * En POST : plusieurs criteres, dont un libelle d avantage qui peut
   * contenir des espaces et des accents ("MEMBRE GROUPE", "LICENCIÉ FRMG").
   */
  app.post('/api/clubs/:club/player-tariff', async (req, reply) => {
    const params = ClubParam.safeParse(req.params);
    const body = z.object({
      holes: z.union([z.literal(9), z.literal(18)]),
      date: z.string().regex(/^\d{8}$/),
      advantage: z.string().default(''),
      courseNumber: z.string().default(''),
    }).safeParse(req.body);

    if (!params.success || !body.success) {
      return reply.code(400).send({ error: 'invalid_input', message: 'Critères invalides.' });
    }

    const tariff = await golfs.playerTariff({
      clubId: params.data.club,
      prestation: body.data.holes === 9 ? 'GF 9 TROUS' : 'GF 18 TROUS',
      date: body.data.date,
      advantage: body.data.advantage,
      courseNumber: body.data.courseNumber,
    });
    return tariff;
  });

  app.post('/api/clubs/:club/tariffs', async (req, reply) => {
    const params = ClubParam.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_club', message: 'Club inconnu.' });
    }
    const body = z.object({
      prestation: z.string().min(1),
      date: z.string().regex(/^\d{8}$/),
    }).safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({
        error: 'invalid_input',
        message: body.error.issues[0]?.message ?? 'Saisie invalide.',
      });
    }
    return golfs.tariffs(params.data.club, body.data.prestation, body.data.date);
  });

  /**
   * Recherche de partenaires.
   * En POST : les noms circulent dans le corps, jamais dans l URL du
   * navigateur (constat E-07).
   */
  app.post('/api/clubs/:club/players/search', async (req, reply) => {
    const params = ClubParam.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_club', message: 'Club inconnu.' });
    }
    const body = z.object({
      lastName: z.string().trim().max(60).default(''),
      firstName: z.string().trim().max(60).default(''),
      // Recherche par code licence (onglet Licencie FRMG uniquement).
      licence: z.string().trim().max(20).default(''),
      scope: z.enum(['club', 'licensees']).default('club'),
    }).safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'invalid_input', message: 'Recherche invalide.' });
    }
    const { lastName, firstName, licence, scope } = body.data;
    // Licencie FRMG : au moins l un de licence / nom / prenom. Club : nom ou prenom.
    const critere = scope === 'licensees' ? (licence || lastName || firstName) : (lastName || firstName);
    if (!critere) {
      return reply.code(400).send({
        error: 'invalid_input',
        message: scope === 'licensees'
          ? 'Saisissez une licence, un nom ou un prenom.'
          : 'Saisissez au moins un nom ou un prenom.',
      });
    }

    const players = scope === 'licensees'
      ? await golfs.searchLicensees(params.data.club, licence, lastName, firstName)
      : await golfs.searchClubPlayers(params.data.club, lastName, firstName);

    return { players };
  });
}
