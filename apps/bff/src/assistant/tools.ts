import { todayApiDate, toApiDate, bookingWindow, isDayAllowed } from '@golf/contracts';
import type { Session } from '../session/store.js';
import { avpOf } from '../session/plugin.js';
import * as golfs from '../upstream/golfs.js';
import * as logigolf from '../upstream/logigolf.js';
import type { FunctionDeclaration } from './gemini.js';

/**
 * Outils de l assistant, TOUS en lecture seule sauf `preparer_reservation` qui
 * ne fait qu ouvrir un brouillon cote front (aucune reservation reelle : c est
 * l adherent qui confirme a l ecran). Chaque outil travaille sur la SESSION
 * courante : l assistant ne voit que les donnees de l adherent connecte.
 */

const JOURS = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/** Libelles des formules d abonnement (sMembre_type) pour un rendu lisible. */
const FORMULES: Record<string, string> = {
  MA: 'Académie',
  MC: 'Temps complet',
  MS: 'Semainier',
};

/** Clubs REELLEMENT reservables par l adherent (fiche adherent). */
function reservableClubs(m: Session['member']) {
  return [...m.bookableClubs, ...m.otherBookableClubs]
    .filter((c) => c.clubId && c.clubId !== '0');
}

/**
 * Resout le club demande (par nom, ou par identifiant si le modele en passe un)
 * parmi les clubs reservables ; club principal par defaut. Renvoie null quand
 * le club n est pas reservable par l adherent.
 */
async function resolveClub(
  session: Session, requested: string,
): Promise<{ clubId: string; name: string; abonne: boolean } | null> {
  const m = session.member;
  const list = reservableClubs(m);
  let target;
  if (!requested) {
    target = list.find((c) => c.clubId === m.clubId) ?? list[0];
  } else {
    const w = requested.toLowerCase();
    target = list.find((c) => {
      const n = (c.name || '').toLowerCase();
      return n !== '' && (n.includes(w) || w.includes(n));
    }) ?? list.find((c) => c.clubId === requested);
  }
  if (!target) return null;
  let name = target.name;
  if (!name) {
    const named = await golfs.groupClubs(session.group).catch(() => []);
    name = named.find((c) => c.clubId === target!.clubId)?.name ?? `Club ${target.clubId}`;
  }
  return { clubId: target.clubId, name, abonne: target.playerType === 'A' };
}

/** Trous jouables sur un club (union des parcours), comme l ecran de resa. */
function playableHoles(courses: { holes: number }[]): Set<number> {
  const trous = new Set<number>();
  for (const co of courses) {
    const max = co.holes === 0 ? 18 : co.holes;
    if (max >= 9) trous.add(9);
    if (max >= 18) trous.add(18);
  }
  return trous;
}

/** Declarations envoyees a Gemini (function calling). */
export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'infos_membre',
    description:
      'Renvoie les informations du compte de l adherent connecte : nom, licence, '
      + 'index, club, formule d abonnement, jours autorises, avantage, ainsi que '
      + 'ses COORDONNEES (telephone, email), sa nationalite, sa date de naissance '
      + 'et la date de fin d abonnement. A utiliser pour toute question sur son '
      + 'profil ou ses coordonnees (ex. "quel est mon numero de telephone ?").',
  },
  {
    name: 'mes_reservations',
    description: 'Liste les reservations (departs) a venir de l adherent.',
  },
  {
    name: 'mes_carnets',
    description:
      'Liste les carnets de l adherent (green-fees prepayes) et ce qu il reste.',
  },
  {
    name: 'actualites',
    description: 'Dernieres actualites du club de l adherent.',
  },
  {
    name: 'mes_clubs',
    description: 'Liste les clubs ou l adherent peut reserver (nom, region, '
      + 'et s il y est abonne ou visiteur).',
  },
  {
    name: 'infos_club',
    description:
      'Renvoie les informations pratiques d un club reservable par l adherent : '
      + 'trous jouables (9 et/ou 18), fenetre de reservation (premiere et derniere '
      + 'date ouvertes), nombre de joueurs maximum, statut et avantage de '
      + 'l adherent sur ce club, delai et politique d annulation, et prix '
      + 'indicatifs par parcours. A utiliser des que l adherent pose une question '
      + 'sur un club (trous, dates, tarif, joueurs, avantage...).',
    parameters: {
      type: 'object',
      properties: {
        club: {
          type: 'string',
          description: 'Nom du club (ex. "Akenza"). Optionnel : club principal par defaut.',
        },
      },
    },
  },
  {
    name: 'disponibilites',
    description:
      'Verifie les DEPARTS reellement libres dans un club a une date donnee '
      + '(creneaux avec des places disponibles, en live). A utiliser quand '
      + "l adherent demande s il reste de la place, des horaires libres ou des "
      + 'departs disponibles un jour precis. Renvoie les heures libres, filtrables '
      + 'par moment de la journee.',
    parameters: {
      type: 'object',
      properties: {
        club: {
          type: 'string',
          description: 'Nom du club (ex. "Akenza"). Optionnel : club principal par defaut.',
        },
        date: { type: 'string', description: 'Date au format AAAA-MM-JJ.' },
        trous: { type: 'integer', description: 'Nombre de trous : 9 ou 18 (18 par defaut).' },
        joueurs: {
          type: 'integer',
          description: 'Nombre de places recherchees (1 a 4, defaut 1).',
        },
        moment: {
          type: 'string',
          enum: ['matin', 'midi', 'apresmidi'],
          description: 'Filtre optionnel du moment de la journee.',
        },
      },
      required: ['date'],
    },
  },
  {
    name: 'preparer_reservation',
    description:
      'Ouvre un BROUILLON de reservation cote application (l adherent devra '
      + 'confirmer lui-meme a l ecran ; rien n est reserve automatiquement). '
      + 'A utiliser quand l adherent veut commencer une reservation. Le nombre '
      + 'de joueurs n est PAS demande ici : l adherent ajoute ses joueurs a '
      + 'l ecran.',
    parameters: {
      type: 'object',
      properties: {
        club: { type: 'string', description: 'Nom du club souhaite (ex. "Al Maaden").' },
        date: { type: 'string', description: 'Date au format AAAA-MM-JJ.' },
        trous: { type: 'integer', description: 'Nombre de trous : 9 ou 18.' },
      },
    },
  },
];

/** Execute un outil et renvoie un resultat JSON compact pour le modele. */
export async function runTool(
  session: Session,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const m = session.member;

  switch (name) {
    case 'infos_membre': {
      // Ce sont les donnees du compte de l adherent CONNECTE (sa propre session) :
      // on peut donc lui restituer ses coordonnees. Les champs vides sont
      // renvoyes a null pour que le modele dise "non renseigne" sans inventer.
      // Nom du club principal : la fiche porte parfois l ID au lieu du libelle,
      // on le resout comme l ecran de reservation.
      let clubName = m.clubName;
      if (!clubName || clubName === m.clubId) {
        clubName = reservableClubs(m).find((c) => c.clubId === m.clubId)?.name || '';
        if (!clubName) {
          const named = await golfs.groupClubs(session.group).catch(() => []);
          clubName = named.find((c) => c.clubId === m.clubId)?.name
            || m.clubName || `Club ${m.clubId}`;
        }
      }
      return {
        nom: m.fullName,
        licence: m.licence,
        index: m.index,
        club: clubName,
        telephone: m.mobile || null,
        email: m.email || null,
        nationalite: m.nationality || null,
        date_naissance: m.birthDate || null,
        avantage: m.advantage,
        formule: FORMULES[m.memberType]
          ? `${FORMULES[m.memberType]} (${m.memberType})`
          : m.memberType,
        jours_autorises: m.allowedDays.length
          ? m.allowedDays.map((d) => JOURS[Number(d)] ?? d)
          : 'tous les jours',
        fin_abonnement: m.membershipEndDate || null,
        avertissement: m.membershipWarning || null,
      };
    }

    case 'mes_reservations': {
      // On distingue un echec amont d une liste vide : sinon le modele
      // annoncerait "aucune reservation" alors que l appel a juste rate.
      try {
        const list = await logigolf.reservations({
          licence: session.licence,
          affiliationClubId: m.clubId,
          fromDate: todayApiDate(),
        });
        return {
          reservations: list.slice(0, 10).map((r) => ({
            date: r.date, heure: r.time, club: r.clubName, trous: r.holes,
            joueurs: r.players, statut: r.status, a_payer: r.awaitingPayment,
          })),
        };
      } catch {
        return { erreur: 'Impossible de recuperer les reservations pour le moment.' };
      }
    }

    case 'mes_carnets': {
      try {
        const carnets = await golfs.carnets(m.clubId, session.licence);
        return { carnets };
      } catch {
        return { erreur: 'Impossible de recuperer les carnets pour le moment.' };
      }
    }

    case 'actualites': {
      try {
        const news = await golfs.news(m.clubId, '19700101000000');
        const items = (news as { news?: unknown[] }).news ?? [];
        return {
          actualites: items.slice(0, 5).map((n) => {
            const x = n as { title?: string; excerpt?: string; date?: string };
            return { titre: x.title, resume: x.excerpt, date: x.date };
          }),
        };
      } catch {
        return { erreur: 'Impossible de recuperer les actualites pour le moment.' };
      }
    }

    case 'mes_clubs': {
      // Meme source que l ecran de reservation (/api/clubs) : les clubs
      // reservables viennent de la FICHE ADHERENT (clubs du groupe + autres
      // clubs autorises), pas seulement de la liste du groupe. Cette derniere
      // ne sert qu a nommer les clubs dont la fiche ne porte pas le libelle.
      const named = await golfs.groupClubs(session.group).catch(() => []);
      const nameById = new Map(named.map((c) => [c.clubId, c.name]));
      const entries = [
        ...m.bookableClubs.map((c) => ({ c, portee: 'groupe' as const })),
        ...m.otherBookableClubs.map((c) => ({ c, portee: 'autre' as const })),
      ].filter((e) => e.c.clubId !== '' && e.c.clubId !== '0');
      return {
        clubs: entries.map(({ c, portee }) => ({
          club: c.name || nameById.get(c.clubId) || `Club ${c.clubId}`,
          region: c.region || undefined,
          // A = abonne du club (reservation couverte par l abonnement),
          // sinon l adherent y joue en visiteur.
          abonne: c.playerType === 'A',
          portee, // "groupe" = club du groupe, "autre" = club hors groupe autorise
        })),
      };
    }

    case 'infos_club': {
      const club = await resolveClub(session, String(args.club ?? '').trim());
      if (!club) {
        return {
          erreur: 'Ce club ne fait pas partie de tes clubs reservables. '
            + 'Utilise mes_clubs pour la liste exacte.',
        };
      }
      const { name, abonne } = club;
      let info;
      try {
        // MEME appel que l ecran de reservation : avpOf(session) (lie au statut
        // licencie de la session), et NON le statut abonne/visiteur du club --
        // sinon l amont renvoie une fenetre de reservation differente (bug).
        info = await golfs.clubInfo(club.clubId, todayApiDate(), avpOf(session));
      } catch {
        return { erreur: `Impossible de recuperer les infos du club ${name} pour le moment.` };
      }

      // Trous jouables (union des parcours), comme l ecran de reservation.
      const trous = playableHoles(info.courses);

      // Fenetre de reservation : memes regles que l ecran (WinDev).
      const win = bookingWindow(info.rules, trous.has(18) ? 18 : 9);

      // Statut / avantage tarifaire de l adherent sur ce club.
      const avantage = abonne
        ? 'Abonne de ce club (green-fee couvert par ton abonnement)'
        : await golfs.nonMemberAdvantage(
          club.clubId, session.licence, m.isLicenseeBooking,
        ).catch(() => (m.isLicenseeBooking ? 'LICENCIÉ FRMG' : 'LICENCIÉ APP.M'));

      // Prix indicatifs dans la categorie de l adherent (0 -> null = inclus/n.c.).
      const cat: 'member' | 'licensee' | 'visitor' = abonne
        ? 'member' : (m.isLicenseeBooking ? 'licensee' : 'visitor');
      const parcours = info.courses.map((co) => ({
        nom: co.name,
        trous: co.holes === 0 ? '9 ou 18' : String(co.holes),
        index_requis: co.requiredIndex || 0,
        prix_indicatif_mad: { '9': co.prices[cat].h9 || null, '18': co.prices[cat].h18 || null },
      }));

      return {
        club: name,
        abonne,
        avantage,
        trous_possibles: [...trous].sort((a, b) => a - b),
        joueurs_max: info.rules.maxPlayers,
        // Periode COMPLETE, pre-formatee : le modele doit annoncer les DEUX
        // bornes. Sans ce champ il avait tendance a ne citer que la 1re date.
        periode_reservation: `du ${win.minDate} au ${win.maxDate} (toute date de `
          + 'cette periode est ouverte, sous reserve de disponibilite des departs)',
        reservation_a_partir_de: win.minDate,
        reservation_jusqu_au: win.maxDate,
        delai_min_heures: info.rules.minHoursBefore,
        annulation_possible: info.rules.cancellationAllowed,
        parcours,
        note_prix: 'Prix indicatifs en MAD ; le tarif exact se calcule a l ecran '
          + 'de reservation selon la date et l avantage.',
      };
    }

    case 'disponibilites': {
      const club = await resolveClub(session, String(args.club ?? '').trim());
      if (!club) {
        return { erreur: 'Ce club ne fait pas partie de tes clubs reservables. Utilise mes_clubs.' };
      }
      const date = String(args.date ?? '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return { erreur: 'Precise la date (AAAA-MM-JJ) pour verifier les disponibilites.' };
      }
      let info;
      try {
        info = await golfs.clubInfo(club.clubId, todayApiDate(), avpOf(session));
      } catch {
        return { erreur: `Impossible de verifier les disponibilites de ${club.name} pour le moment.` };
      }

      const trousDispo = playableHoles(info.courses);
      let trous: 9 | 18 = Number(args.trous) === 9 ? 9 : 18;
      if (!trousDispo.has(trous)) trous = trousDispo.has(18) ? 18 : 9;

      // La date doit d abord etre reservable (fenetre + jour de la formule).
      const win = bookingWindow(info.rules, trous);
      if (date < win.minDate || date > win.maxDate) {
        return {
          disponible: false,
          raison: `Le ${date} n est pas dans la periode reservable de ${club.name}.`,
          periode_reservation: `du ${win.minDate} au ${win.maxDate}`,
        };
      }
      if (!isDayAllowed(date, m.allowedDays)) {
        return {
          disponible: false,
          raison: `Ta formule ne te permet pas de jouer le ${date}.`,
          jours_autorises: m.allowedDays.length
            ? m.allowedDays.map((d) => JOURS[Number(d)] ?? d) : 'tous les jours',
        };
      }

      // Parcours : le 1er compatible avec le format demande, sinon le 1er.
      const course = info.courses.find((co) => {
        const max = co.holes === 0 ? 18 : co.holes;
        return trous === 9 ? max >= 9 : max >= 18;
      }) ?? info.courses[0];
      if (!course) {
        return { erreur: `Aucun parcours n est configure pour ${club.name}.` };
      }

      const joueurs = Math.min(Math.max(Number(args.joueurs) || 1, 1), info.rules.maxPlayers || 4);

      // Plage horaire : journee complete, ou un moment precis (comme l app).
      const first = info.rules.firstStart || '07:00';
      const last = info.rules.lastStart || '18:00';
      const moment = String(args.moment ?? '');
      const [timeFrom, timeTo] = moment === 'matin' ? [first, '11:00']
        : moment === 'midi' ? ['11:00', '14:00']
          : moment === 'apresmidi' ? ['14:00', last]
            : [first, last];

      let dispo;
      try {
        dispo = await golfs.availability({
          clubId: club.clubId,
          date: toApiDate(date),
          courseOutId: course.outId,
          courseBackId: course.backId,
          players: joueurs,
          holes: trous,
          timeFrom,
          timeTo,
          departuresToShow: 80,
          avp: avpOf(session),
        });
      } catch {
        return { erreur: `Impossible de recuperer les departs de ${club.name} pour le ${date}.` };
      }

      // Un creneau convient s il a assez de places : cote aller, et cote retour
      // aussi pour un 18 trous (le joueur occupe une position dans chaque neuf).
      const libres = dispo.slots
        .filter((s) => (trous === 18
          ? Math.min(s.freeOut, s.freeBack) >= joueurs
          : s.freeOut >= joueurs))
        .map((s) => s.timeOut);

      if (libres.length === 0) {
        return {
          disponible: false,
          club: club.name, date, trous, joueurs,
          raison: dispo.dayMessage || 'Aucun depart libre pour ces criteres.',
        };
      }
      return {
        disponible: true,
        club: club.name, date, trous, joueurs,
        nombre_creneaux: libres.length,
        horaires_libres: libres.slice(0, 12),
        note: dispo.dayNote || undefined,
      };
    }

    case 'preparer_reservation': {
      // On VERIFIE la disponibilite de la date avant d armer le brouillon :
      // club reservable, date dans la fenetre du club, et jour autorise par la
      // formule de l adherent. La route ne cree le brouillon que si ok === true.
      const club = await resolveClub(session, String(args.club ?? '').trim());
      if (!club) {
        return {
          ok: false,
          erreur: 'Ce club ne fait pas partie de tes clubs reservables. '
            + 'Utilise mes_clubs pour la liste exacte.',
        };
      }
      const date = String(args.date ?? '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return {
          ok: false,
          erreur: 'Precise la date souhaitee (jour/mois/annee) pour que je verifie '
            + 'sa disponibilite.',
        };
      }

      let info;
      try {
        info = await golfs.clubInfo(club.clubId, todayApiDate(), avpOf(session));
      } catch {
        return {
          ok: false,
          erreur: `Impossible de verifier les disponibilites de ${club.name} pour le moment.`,
        };
      }

      const trousDispo = playableHoles(info.courses);
      let trous: 9 | 18 = Number(args.trous) === 9 ? 9 : 18;
      if (!trousDispo.has(trous)) trous = trousDispo.has(18) ? 18 : 9;

      const win = bookingWindow(info.rules, trous);
      // 1) Date dans la fenetre de reservation du club ?
      if (date < win.minDate || date > win.maxDate) {
        return {
          ok: false,
          erreur: `Le ${date} n est pas reservable a ${club.name}.`,
          periode_reservation: `du ${win.minDate} au ${win.maxDate}`,
        };
      }
      // 2) Jour autorise par la formule de l adherent ?
      if (!isDayAllowed(date, m.allowedDays)) {
        return {
          ok: false,
          erreur: `Ta formule ne te permet pas de jouer le ${date}.`,
          jours_autorises: m.allowedDays.length
            ? m.allowedDays.map((d) => JOURS[Number(d)] ?? d)
            : 'tous les jours',
        };
      }

      // Date valable : valeurs NORMALISEES ; la route en fait le brouillon.
      return {
        ok: true,
        club: club.name,
        date,
        trous,
        message: `Date disponible : brouillon pret pour ${trous} trous a ${club.name} `
          + `le ${date} (l adherent confirme a l ecran).`,
      };
    }

    default:
      return { error: `Outil inconnu : ${name}` };
  }
}
