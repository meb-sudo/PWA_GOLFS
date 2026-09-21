import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { config } from './config.js';
import { sessionPlugin } from './session/plugin.js';
import { UpstreamError, ReadOnlyError } from './upstream/http.js';
import { authRoutes } from './routes/auth.js';
import { catalogRoutes } from './routes/catalog.js';
import { reservationRoutes } from './routes/reservations.js';
import { competitionRoutes, contentRoutes, profileRoutes, mediaRoutes } from './routes/misc.js';
import { assistantRoutes } from './routes/assistant.js';

// Deploiement combine : le BFF sert aussi la PWA buildee, sur le meme domaine
// que /api. Actif des que le build du front est present (prod / une seule app).
const webDist = process.env.WEB_DIST || path.resolve(process.cwd(), 'apps/web/dist');
const serveFront = existsSync(path.join(webDist, 'index.html'));

const app = Fastify({
  logger: {
    level: config.isProd ? 'info' : 'debug',
    // Les chemins amont portent des donnees personnelles (constat E-07) :
    // on ne journalise jamais l URL complete.
    redact: ['req.headers.cookie', 'req.headers.authorization'],
    serializers: {
      req: (req) => ({ method: req.method, url: req.url.split('?')[0] }),
    },
  },
  trustProxy: true,
});

await app.register(helmet, {
  contentSecurityPolicy: false, // servie par la PWA, pas par l API
  hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
});

await app.register(cors, {
  origin: config.webOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'DELETE'],
  // X-Golf-Group : groupe choisi par le front (portail multi-groupes).
  allowedHeaders: ['Content-Type', 'X-Golf-Group'],
});

await app.register(cookie, { secret: config.sessionSecret });
await app.register(rateLimit, { global: false, max: 300, timeWindow: '1 minute' });
await app.register(sessionPlugin);

/**
 * Gestion d erreurs centralisee.
 *
 * Enregistree AVANT les routes : Fastify encapsule chaque plugin, et un
 * gestionnaire pose apres coup ne s applique pas aux contextes deja crees.
 *
 * Les messages amont ne sont jamais relayes tels quels : ils exposent le
 * moteur WebDev et les noms de requetes internes (constat M-08).
 */
app.setErrorHandler((error, req, reply) => {
  if (error instanceof ReadOnlyError) {
    req.log.warn({ endpoint: error.endpoint }, 'appel ecrivant bloque (READ_ONLY)');
    return reply.code(503).send({ error: 'read_only', message: error.message });
  }

  if (error instanceof UpstreamError) {
    req.log.error(
      { endpoint: error.endpoint, upstream: error.upstreamMessage },
      'erreur amont',
    );
    return reply.code(error.statusCode).send({
      error: 'upstream',
      message: error.message,
    });
  }

  const status = (error as { statusCode?: number }).statusCode;
  if (status === 429) {
    return reply.code(429).send({
      error: 'rate_limited',
      message: 'Trop de tentatives. Patientez quelques minutes.',
    });
  }

  req.log.error({ err: error }, 'erreur non geree');
  return reply.code(500).send({
    error: 'internal',
    message: 'Une erreur est survenue. Reessayez dans un instant.',
  });
});

app.setNotFoundHandler((req, reply) => {
  // Front combine : une route cote client (non /api) renvoie l app (SPA).
  if (serveFront && req.method === 'GET' && !req.url.startsWith('/api')) {
    return reply.sendFile('index.html');
  }
  reply.code(404).send({ error: 'not_found', message: 'Ressource inconnue.' });
});

await app.register(authRoutes);
await app.register(catalogRoutes);
await app.register(reservationRoutes);
await app.register(competitionRoutes);
await app.register(contentRoutes);
await app.register(profileRoutes);
await app.register(mediaRoutes);
await app.register(assistantRoutes);

app.get('/api/health', async () => ({
  status: 'ok',
  readOnly: config.readOnly,
  group: config.defaultGroup,
}));

// Sert la PWA buildee (memes fichiers, meme domaine que /api). wildcard:false
// pour laisser les routes SPA passer par le notFoundHandler ci-dessus.
if (serveFront) {
  await app.register(fastifyStatic, { root: webDist, prefix: '/', wildcard: false });
}

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
  app.log.info(
    `BFF demarre sur ${config.port} | groupe par defaut ${config.defaultGroup} | ` +
    `lecture seule ${config.readOnly ? 'ACTIVE' : 'desactivee'}`,
  );
  if (config.logAuthCode) {
    app.log.warn(
      'DEV_LOG_AUTH_CODE actif : les codes de validation sont ecrits dans ce ' +
      'journal. Reservez ce mode a la recette locale.',
    );
  }
  if (config.testSkipEmailFor) {
    app.log.warn(
      `TEST_SKIP_EMAIL_FOR actif ("${config.testSkipEmailFor}") : aucun e-mail ` +
      'de validation n est envoye a ces adresses, un code fixe est utilise. ' +
      'A RETIRER avant la mise en ligne.',
    );
  }
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
