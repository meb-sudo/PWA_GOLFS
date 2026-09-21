import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Chemin du .env trouve au demarrage, memorise pour la surveillance. */
let envPath: string | null = null;

/**
 * Charge le .env a la racine du monorepo.
 *
 * On remonte depuis ce module plutot que de partir de process.cwd() :
 * npm lance le BFF depuis apps/bff, jamais depuis la racine.
 * Les variables deja presentes dans l environnement gagnent, pour que
 * la configuration d un hebergeur ne soit jamais ecrasee par un .env
 * oublie dans l image.
 */
function loadDotEnv(): void {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = join(dir, '.env');
    if (existsSync(candidate)) {
      envPath = candidate;
      try {
        process.loadEnvFile(candidate);
      } catch {
        // Fichier illisible ou Node trop ancien : on garde l environnement tel quel.
      }
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}
loadDotEnv();

/**
 * Valeurs relues a chaud depuis le .env : groupe par defaut, theme et
 * mapping d hotes. Elles peuvent changer sans redemarrer le BFF, alors que
 * le reste de la config (ports, secrets) est fige au demarrage.
 */
const runtime = {
  defaultGroup: process.env.DEFAULT_GROUP || 'CLUBS_GRP_PRESTIGIA',
  theme: process.env.THEME || '',
  hostMap: new Map<string, string>(),
};

/** Lit une variable directement dans le texte du .env (dev uniquement). */
function readFromEnvFile(text: string, name: string): string | undefined {
  for (const ligne of text.split('\n')) {
    const t = ligne.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    if (t.slice(0, eq).trim() === name) {
      return t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  return undefined;
}

function refreshRuntime(): void {
  // En dev, le fichier fait autorite : on le relit directement, sans dependre
  // de process.env fige au demarrage. En prod, on s en tient a l environnement.
  let source: (name: string) => string | undefined = (n) => process.env[n];
  if (!isProdEnv() && envPath) {
    try {
      const text = readFileSync(envPath, 'utf8');
      source = (n) => readFromEnvFile(text, n) ?? process.env[n];
    } catch {
      // Fichier momentanement illisible : on garde process.env.
    }
  }
  runtime.defaultGroup = source('DEFAULT_GROUP') || 'CLUBS_GRP_PRESTIGIA';
  runtime.theme = source('THEME') || '';
  runtime.hostMap = parseHostMap(source('GROUP_HOST_MAP') ?? '');
}

function isProdEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Relit le .env si sa date de modification a change, au plus une fois par
 * seconde. Independant de fs.watch (peu fiable selon le systeme de fichiers) :
 * editer le fichier suffit, le prochain acces au groupe voit la nouvelle valeur.
 *
 * Une session deja ouverte conserve le groupe fixe a sa connexion : il faut
 * se reconnecter pour qu un changement de DEFAULT_GROUP s y applique.
 */
let dernierMtime = 0;
let dernierControle = 0;
function maybeReload(): void {
  if (isProdEnv() || !envPath) return;
  const maintenant = Date.now();
  if (maintenant - dernierControle < 1000) return;
  dernierControle = maintenant;
  try {
    const mtime = statSync(envPath).mtimeMs;
    if (mtime !== dernierMtime) {
      dernierMtime = mtime;
      refreshRuntime();
    }
  } catch {
    // Fichier absent ou illisible : on garde les dernieres valeurs connues.
  }
}

function env(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v == null || v === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Variable d environnement manquante : ${name}`);
  }
  return v;
}

const isProd = process.env.NODE_ENV === 'production';

/**
 * Resolution du groupe multi-club.
 *
 * Le groupe n est jamais une constante de compilation : il est lu au
 * demarrage. Cela permet de basculer entre sous-domaines et domaine
 * unique par simple configuration, sans toucher au code.
 */
function parseHostMap(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of raw.split(',')) {
    const [host, group] = entry.split(':').map((s) => s.trim());
    if (host && group) map.set(host.toLowerCase(), group);
  }
  return map;
}

// Premiere lecture des valeurs a chaud (parseHostMap est desormais defini).
refreshRuntime();

/**
 * Surveillance du .env en developpement : editer le fichier suffit, le
 * groupe et le theme sont relus sans redemarrer le BFF. On ne recharge que
 * ces valeurs ; les ports et secrets restent figes au demarrage.
 *
 * Une session deja ouverte conserve le groupe fixe a sa connexion : il faut
 * se reconnecter pour qu un changement de DEFAULT_GROUP s y applique.
 */
export const config = {
  isProd,
  port: Number(env('PORT', '3001')),
  webOrigin: env('WEB_ORIGIN', 'http://localhost:5173'),

  sessionSecret: (() => {
    const s = process.env.SESSION_SECRET;
    if (s && s.length >= 32) return s;
    if (isProd) {
      throw new Error(
        'SESSION_SECRET doit faire au moins 32 caracteres en production.',
      );
    }
    // Developpement : secret ephemere, les sessions ne survivent pas au redemarrage.
    return randomBytes(32).toString('hex');
  })(),

  /** Relu a chaud depuis le .env (voir maybeReload / refreshRuntime). */
  get defaultGroup(): string { maybeReload(); return runtime.defaultGroup; },

  /**
   * Palette de l interface, independante du groupe.
   *
   * Le groupe determine ce que renvoie l API ; le theme determine
   * l apparence. Les lier obligerait a changer de couleurs des qu on change
   * de groupe, ce qui n est pas toujours voulu.
   * Vide = le theme suit le groupe.
   */
  /** Relu a chaud depuis le .env. Vide = le theme suit le groupe. */
  get theme(): string { maybeReload(); return runtime.theme; },
  get groupHostMap(): Map<string, string> { maybeReload(); return runtime.hostMap; },

  /**
   * Compte de test : ne pas envoyer d e-mail de validation.
   *
   * Chaque connexion declenche un vrai e-mail via SEND_AUTH_CODE. Pour le
   * compte de test, l adresse appartient au proprietaire reel, qui recoit
   * donc ces messages a repetition pendant le developpement. Quand l e-mail
   * saisi contient le motif ci-dessous, aucun e-mail n est envoye et le code
   * fixe ci-dessous est utilise a la place.
   *
   * TEMPORAIRE, a retirer avant la mise en ligne. Double verrou, comme
   * DEV_LOG_AUTH_CODE : opt-in explicite ET jamais actif en production, pour
   * qu un NODE_ENV oublie ne suffise pas a le laisser passer.
   */
  testSkipEmailFor: (process.env.TEST_SKIP_EMAIL_FOR && !isProd)
    ? process.env.TEST_SKIP_EMAIL_FOR.toLowerCase() : '',
  testFixedCode: env('TEST_FIXED_CODE', ''),

  upstream: {
    golfs: env('API_GOLFS', 'https://rest-lg-mg.golfs.ma/MG_LG_REST'),
    logigolf: env('API_LOGIGOLF', 'https://rest.logigolf.com/LOGIGOLF'),
    frmg: env('API_FRMG', 'https://rest.frmg.ma/FRMG_REST'),
    images: env('API_IMAGES', 'https://images.golfs.ma'),
  },

  /**
   * Mode lecture seule : bloque tout appel amont qui ecrit.
   * A laisser actif tant qu aucun environnement de recette n est confirme,
   * pour ne pas creer de vraies reservations en production.
   */
  readOnly: env('READ_ONLY', 'true') === 'true',

  /**
   * Affiche le code de double authentification dans le journal du serveur,
   * pour pouvoir se connecter en recette sans acceder a la boite mail.
   *
   * Ce n est PAS un contournement : le code affiche est le vrai code, il
   * reste verifie cote serveur et expire normalement. Rien ne change pour
   * le navigateur, qui ne le recoit toujours pas.
   *
   * Double verrou : opt-in explicite ET impossible en production. Un
   * NODE_ENV oublie au deploiement ne suffit donc pas a l activer.
   */
  logAuthCode: env('DEV_LOG_AUTH_CODE', 'false') === 'true' && !isProd,

  /** Duree de vie de la session applicative. */
  sessionTtlMs: 12 * 60 * 60 * 1000,
  /** Duree de validite du code de double authentification. */
  authCodeTtlMs: 10 * 60 * 1000,
  /** Duree de memorisation d un appareil valide. */
  deviceTrustTtlMs: 90 * 24 * 60 * 60 * 1000,
  /** Nombre de tentatives de code avant invalidation. */
  authCodeMaxAttempts: 5,

  upstreamTimeoutMs: 60_000,

  /**
   * Assistant IA (Gemini). La cle reste STRICTEMENT cote serveur : le front ne
   * la voit jamais. Vide -> l assistant est desactive (bouton masque).
   */
  gemini: {
    apiKey: env('GEMINI_API_KEY', ''),
    model: env('GEMINI_MODEL', 'gemini-3.5-flash-lite'),
  },
} as const;

/**
 * Pour un e-mail de test, renvoie le code fixe a utiliser sans envoi d
 * e-mail ; sinon null (envoi normal). Actif uniquement hors production et
 * si les deux variables TEST_* sont renseignees.
 */
export function fixedCodeFor(email: string): string | null {
  if (!config.testSkipEmailFor || !config.testFixedCode) return null;
  return email.toLowerCase().includes(config.testSkipEmailFor)
    ? config.testFixedCode : null;
}

/** Format attendu d un identifiant de groupe (garde-fou anti-valeur libre). */
const GROUP_ID_RE = /^CLUBS_GRP_[A-Z0-9_]+$/;

/**
 * Groupe effectif d une requete.
 * Priorite : parametre explicite (?grp= / en-tete X-Golf-Group) >
 * sous-domaine mappe > groupe par defaut.
 */
export function resolveGroup(host: string | undefined, grp?: string): string {
  const explicit = (grp ?? '').trim().toUpperCase();
  if (GROUP_ID_RE.test(explicit)) return explicit;
  if (host) {
    const clean = host.split(':')[0]!.toLowerCase();
    const mapped = config.groupHostMap.get(clean);
    if (mapped) return mapped;
  }
  return config.defaultGroup;
}

/**
 * Le host pointe-t-il vers un groupe explicitement mappe (sous-domaine dedie) ?
 * Sert au front a decider s il montre le selecteur (domaine nu) ou entre
 * directement (sous-domaine).
 */
export function isHostMapped(host: string | undefined): boolean {
  if (!host) return false;
  const clean = host.split(':')[0]!.toLowerCase();
  return config.groupHostMap.has(clean);
}
