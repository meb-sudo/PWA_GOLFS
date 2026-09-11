import { z } from 'zod';
import {
  Member, ClubPlayerList, GroupClubList, ClubInfo, CountryList,
  LegalInfo, AvailabilityList, PrestationList, CaddieList, TariffInfo,
  ApiReply, Tariff, CompetitionClubList, CompetitionReply, NewsList, NotificationList,
  CarnetList, wdStr, toApiShortTime,
  type BookingInput, type CheckPlayersInput, type DeparturePlayerInput,
} from '@golf/contracts';
import { config } from '../config.js';
import { callJson, callBinary, seg, businessError, UpstreamError } from './http.js';

const base = () => config.upstream.golfs;

const MessageOnly = z.object({ sMessage: wdStr }).passthrough();
const StringReply = z.union([z.string(), z.number(), MessageOnly]);

/** Normalise les reponses qui renvoient tantot une chaine, tantot un objet. */
function asMessage(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (v && typeof v === 'object' && 'sMessage' in v) {
    return String((v as { sMessage: unknown }).sMessage ?? '').trim();
  }
  return '';
}

// ---------------------------------------------------------------------------
// Connexion et compte
// ---------------------------------------------------------------------------

/** MG_LOGIN_MEMBRE */
export async function login(licence: string, email: string, group: string) {
  /*
    Une seule analyse. Auparavant la reponse passait par MemberRaw puis par
    Member.parse() : la seconde passe reappliquait ClubResaPossible sur des
    objets deja transformes, dont les champs sClubID/sClubNom n existaient
    plus. wdStr les remplacait par des chaines vides, et la liste des clubs
    reservables arrivait vide.
  */
  const member = await callJson(
    `${base()}/MG_LOGIN_MEMBRE`,
    Member,
    {
      endpoint: 'MG_LOGIN_MEMBRE',
      method: 'POST',
      body: {
        sParam_Num_licence: licence,
        sParam_Email: email,
        sParam_Config_Grp: group,
      },
    },
  );

  const err = businessError(member.message);
  if (err) {
    /*
      Le message de l amont est transmis tel quel, a la demande du client.

      A garder en tete : il precise si la licence existe dans le groupe
      ("LICENCIE [xxx] n est pas Membre dans les clubs de Groupe [yyy]"),
      ce qui permet d enumerer les adherents (constat E-05). La limitation
      de debit sur cette route reste le seul garde-fou.
    */
    throw new UpstreamError(err, 401, 'MG_LOGIN_MEMBRE', member.message);
  }

  // sLogin_Web et sMDP_Web sont presents dans la reponse amont (constat E-06).
  // Member les ignore : ils ne franchissent jamais le BFF.
  return member;
}

/** SEND_AUTH_CODE - renvoie le code genere par l amont, garde cote serveur. */
export async function sendAuthCode(email: string, group: string): Promise<string> {
  const res = await callJson(
    `${base()}/SEND_AUTH_CODE`,
    StringReply,
    {
      endpoint: 'SEND_AUTH_CODE',
      method: 'POST',
      writes: false,
      body: { sParam_Email: email, sAndroid_Ios: 'WEB', sGroupe: group },
    },
  );
  const code = asMessage(res);
  if (!code) {
    throw new UpstreamError(
      'Envoi du code impossible. Reessayez dans un instant.',
      502, 'SEND_AUTH_CODE',
    );
  }
  return code;
}

/** SEND_IDENTIFICATION_MEMBRE_MAIL */
export async function sendIdentifiers(clubId: string, email: string): Promise<string> {
  const res = await callJson(
    `${base()}/SEND_IDENTIFICATION_MEMBRE_MAIL/${seg(clubId)}/${seg(email)}`,
    StringReply,
    { endpoint: 'SEND_IDENTIFICATION_MEMBRE_MAIL', writes: true },
  );
  return asMessage(res);
}

/** CHANGER_EMAIL_ADHERENT */
export async function changeEmail(input: {
  memberId: string; clubId: string; registrationNumber: string; email: string;
}): Promise<string> {
  const res = await callJson(
    `${base()}/CHANGER_EMAIL_ADHERENT`,
    StringReply,
    {
      endpoint: 'CHANGER_EMAIL_ADHERENT',
      method: 'POST',
      writes: true,
      body: {
        sId_Adherent: input.memberId,
        sClub_5X: input.clubId,
        sNmEnregistrement: input.registrationNumber,
        sEmail: input.email,
      },
    },
  );
  return asMessage(res);
}

/** UPDATE_GSM_ADHERENT */
export async function updateMobile(
  memberId: string, clubId: string, mobile: string,
): Promise<string> {
  const res = await callJson(
    `${base()}/UPDATE_GSM_ADHERENT/${seg(memberId)}/${seg(clubId)}/${seg(mobile)}`,
    StringReply,
    { endpoint: 'UPDATE_GSM_ADHERENT', writes: true },
  );
  return asMessage(res);
}

// ---------------------------------------------------------------------------
// Referentiel
// ---------------------------------------------------------------------------

/** GET_CLUBS_TEL_GROUPE */
export function groupClubs(group: string) {
  return callJson(
    `${base()}/GET_CLUBS_TEL_GROUPE/${seg(group)}`,
    GroupClubList,
    { endpoint: 'GET_CLUBS_TEL_GROUPE' },
  );
}

/** GET_ALL_INFOS_CLUB - date au format AAAAMMJJ, avp = A / V / P */
export function clubInfo(clubId: string, date: string, avp: string) {
  return callJson(
    `${base()}/GET_ALL_INFOS_CLUB/${seg(clubId)}/${seg(date)}/${seg(avp)}`,
    ClubInfo,
    { endpoint: 'GET_ALL_INFOS_CLUB' },
  );
}

/** GET_REF_COUNTRY */
export function countries() {
  return callJson(`${base()}/GET_REF_COUNTRY`, CountryList, {
    endpoint: 'GET_REF_COUNTRY',
  });
}

/** GET_MENTION_LEGALE_TEL_GRP */
export function legal(group: string) {
  return callJson(
    `${base()}/GET_MENTION_LEGALE_TEL_GRP/${seg(group)}`,
    LegalInfo,
    { endpoint: 'GET_MENTION_LEGALE_TEL_GRP' },
  );
}

// ---------------------------------------------------------------------------
// Disponibilites, prestations, tarifs, cadets
// ---------------------------------------------------------------------------

/** GET_DISPONIBILITE_DEPART_SELON_AVP - 10 segments positionnels */
export function availability(params: {
  clubId: string; date: string; courseOutId: string; courseBackId: string;
  players: number; holes: 9 | 18; timeFrom: string; timeTo: string;
  departuresToShow: number; avp: string;
}) {
  const path = [
    params.clubId, params.date, params.courseOutId, params.courseBackId,
    params.players, params.holes,
    toApiShortTime(params.timeFrom), toApiShortTime(params.timeTo),
    params.departuresToShow, params.avp,
  ].map(seg).join('/');

  return callJson(
    `${base()}/GET_DISPONIBILITE_DEPART_SELON_AVP/${path}`,
    AvailabilityList,
    { endpoint: 'GET_DISPONIBILITE_DEPART_SELON_AVP' },
  );
}

/**
 * GET_TARIF_TEL_JOUEUR - tarif applicable a un joueur donne.
 *
 * Transposition de RECHERCHE_TARIF : le tarif depend du club, de la
 * prestation ("GF 9 TROUS" ou "GF 18 TROUS"), de la date, de l avantage
 * propre au joueur et du terrain. Deux joueurs d un meme depart peuvent
 * donc payer des prix differents.
 */
export function playerTariff(params: {
  clubId: string; prestation: string; date: string;
  advantage: string; courseNumber: string;
}) {
  const path = [
    params.clubId, params.prestation, params.date,
    params.advantage || '-', params.courseNumber || '-',
  ].map(seg).join('/');
  return callJson(`${base()}/GET_TARIF_TEL_JOUEUR/${path}`, Tariff, {
    endpoint: 'GET_TARIF_TEL_JOUEUR',
  });
}

/** GET_LIST_PRESTATION_RESA_ENLIGNE */
export function prestations(clubId: string, fromAvp: string) {
  return callJson(
    `${base()}/GET_LIST_PRESTATION_RESA_ENLIGNE/${seg(clubId)}/${seg(fromAvp)}`,
    PrestationList,
    { endpoint: 'GET_LIST_PRESTATION_RESA_ENLIGNE' },
  );
}

/** GET_LIST_CADETS */
export function caddies(clubId: string, date: string) {
  return callJson(
    `${base()}/GET_LIST_CADETS/${seg(clubId)}/${seg(date)}`,
    CaddieList,
    { endpoint: 'GET_LIST_CADETS' },
  );
}

/** GET_TARIFS */
export function tariffs(clubId: string, prestation: string, date: string) {
  return callJson(
    `${base()}/GET_TARIFS`,
    TariffInfo,
    {
      endpoint: 'GET_TARIFS',
      method: 'POST',
      body: {
        sParam_Prestation: prestation,
        sParam_Club_5X: clubId,
        sParam_Date: date,
      },
    },
  );
}

/**
 * GET_TARIF_NON_MEMBRE - avantage tarifaire d un joueur non abonne du club.
 *
 * Le troisieme segment est un booleen. WinDev le rend en 0/1 via
 * ChaineConstruit ; envoyer "true"/"false" ne serait pas reconnu.
 *
 * En cas d echec, WinDev ne laisse pas l avantage vide : il retombe sur
 * "LICENCIÉ FRMG" ou "LICENCIÉ APP.M" selon que l adherent utilise ou non
 * la reservation en tant que licencie.
 */
export async function nonMemberAdvantage(
  clubId: string, licence: string, isLicensee: boolean,
): Promise<string> {
  const repli = isLicensee ? 'LICENCIÉ FRMG' : 'LICENCIÉ APP.M';
  try {
    const res = await callJson(
      `${base()}/GET_TARIF_NON_MEMBRE/${seg(clubId)}/${seg(licence)}/${seg(isLicensee ? 1 : 0)}`,
      StringReply,
      { endpoint: 'GET_TARIF_NON_MEMBRE' },
    );
    return asMessage(res) || repli;
  } catch {
    return repli;
  }
}

// ---------------------------------------------------------------------------
// Joueurs
// ---------------------------------------------------------------------------

/** GET_Joueurs_Club */
export function searchClubPlayers(clubId: string, lastName: string, firstName: string) {
  return callJson(
    `${base()}/GET_Joueurs_Club/${seg(clubId)}/${seg(lastName || '*')}/${seg(firstName || '*')}`,
    ClubPlayerList,
    { endpoint: 'GET_Joueurs_Club' },
  );
}

/** GET_JOUEURS_LICENCIE */
export function searchLicensees(
  clubId: string, licence: string, lastName: string, firstName: string,
) {
  return callJson(
    `${base()}/GET_JOUEURS_LICENCIE/${seg(clubId)}/${seg(licence || '*')}/${seg(lastName || '*')}/${seg(firstName || '*')}`,
    ClubPlayerList,
    { endpoint: 'GET_JOUEURS_LICENCIE' },
  );
}

/** JOUEURS_AUTORISE_TO_RESERVE */
export async function checkPlayers(input: CheckPlayersInput): Promise<string> {
  const res = await callJson(
    `${base()}/JOUEURS_AUTORISE_TO_RESERVE`,
    StringReply,
    { endpoint: 'JOUEURS_AUTORISE_TO_RESERVE', method: 'POST', body: input },
  );
  return asMessage(res);
}

/** GET_LIST_PLAYERS_RESA */
export function reservationPlayers(clubId: string, reservationId: string) {
  return callJson(
    `${base()}/GET_LIST_PLAYERS_RESA/${seg(clubId)}/${seg(reservationId)}`,
    z.array(z.record(z.unknown())),
    { endpoint: 'GET_LIST_PLAYERS_RESA' },
  );
}

// ---------------------------------------------------------------------------
// Reservations (ecriture)
// ---------------------------------------------------------------------------

/** ENREGISTRER_RESA_ABONNE */
export function createBooking(input: BookingInput) {
  return callJson(`${base()}/ENREGISTRER_RESA_ABONNE`, ApiReply, {
    endpoint: 'ENREGISTRER_RESA_ABONNE',
    method: 'POST',
    writes: true,
    body: input,
  });
}

/** ANNULE_RESERVATION */
export async function cancelBooking(input: {
  clubId: string; reservationId: string; note: string; email: string; players: string;
}): Promise<string> {
  const res = await callJson(`${base()}/ANNULE_RESERVATION`, StringReply, {
    endpoint: 'ANNULE_RESERVATION',
    method: 'POST',
    writes: true,
    body: {
      sClub_5X: input.clubId,
      sNote: input.note,
      sNum_Resa: input.reservationId,
      sEmail: input.email,
      sJoueurs: input.players,
    },
  });
  return asMessage(res);
}

/** CHANGER_HORAIRE_DEPART */
export async function changeDepartureTime(input: {
  clubId: string; newTime: string; courseOutId: string; courseBackId: string;
  reservationId: string; holes: number; oldTime: string; date: string;
}): Promise<string> {
  const res = await callJson(`${base()}/CHANGER_HORAIRE_DEPART`, StringReply, {
    endpoint: 'CHANGER_HORAIRE_DEPART',
    method: 'POST',
    writes: true,
    body: {
      sClub_5X: input.clubId,
      sNew_Heure: toApiShortTime(input.newTime),
      sTerrain_A: input.courseOutId,
      sTerrain_R: input.courseBackId,
      sNum_Dossier: input.reservationId,
      nNbr_Trous: input.holes,
      sOld_Heure: toApiShortTime(input.oldTime),
      sDate_Resa: input.date,
    },
  });
  return asMessage(res);
}

/** AJOUTER_NOUVEAU_JR_DEPART */
export async function addPlayerToBooking(input: {
  clubId: string; reservationId: string; courseOutId: string; courseBackId: string;
  players: DeparturePlayerInput[];
}): Promise<string> {
  const res = await callJson(`${base()}/AJOUTER_NOUVEAU_JR_DEPART`, StringReply, {
    endpoint: 'AJOUTER_NOUVEAU_JR_DEPART',
    method: 'POST',
    writes: true,
    body: {
      sClub_5X: input.clubId,
      sNum_Dossier: input.reservationId,
      sTerrain_A: input.courseOutId,
      sTerrain_R: input.courseBackId,
      tabJoueur_Resa: input.players,
    },
  });
  return asMessage(res);
}

/**
 * DELETE_JOUEUR_FROM_RESA.
 * L amont expose une suppression sur un GET (constat M-09) ; le BFF ne
 * l expose que derriere un DELETE cote PWA.
 */
export async function removePlayerFromBooking(
  clubId: string, departureIdName: string, reservationId: string,
): Promise<string> {
  const res = await callJson(
    `${base()}/DELETE_JOUEUR_FROM_RESA/${seg(clubId)}/${seg(departureIdName)}/${seg(reservationId)}`,
    StringReply,
    { endpoint: 'DELETE_JOUEUR_FROM_RESA', writes: true },
  );
  return asMessage(res);
}

// ---------------------------------------------------------------------------
// Competitions
// ---------------------------------------------------------------------------

/** GET_COMPETITION_TEL_GROUPE_JOUEUR */
export function competitions(licence: string, group: string, date: string) {
  return callJson(
    `${base()}/GET_COMPETITION_TEL_GROUPE_JOUEUR/${seg(licence)}/${seg(group)}/${seg(date)}`,
    CompetitionClubList,
    { endpoint: 'GET_COMPETITION_TEL_GROUPE_JOUEUR' },
  );
}

/** ENREGISTRER_JOUEUR_SERIE_COMP_POST */
export function registerCompetition(input: {
  competitionClubId: string; playerClubId: string; licence: string;
  competitionId: string; serieId: string; avp: string;
}) {
  return callJson(
    `${base()}/ENREGISTRER_JOUEUR_SERIE_COMP_POST`,
    CompetitionReply,
    {
      endpoint: 'ENREGISTRER_JOUEUR_SERIE_COMP_POST',
      method: 'POST',
      writes: true,
      body: {
        sClub_5X_Cup: input.competitionClubId,
        sClub_5X_Joueur: input.playerClubId,
        sNum_Licence: input.licence,
        sCompetition_ID: input.competitionId,
        sSerie_ID: input.serieId,
        sA_V: input.avp,
      },
    },
  );
}

/** ANNULER_JOUEUR_SERIE_COMP - segments + motif dans le corps */
export async function unregisterCompetition(input: {
  clubId: string; licence: string; competitionId: string;
  serieId: string; reason: string;
}): Promise<string> {
  const path = [input.clubId, input.licence, input.competitionId, input.serieId]
    .map(seg).join('/');
  const res = await callJson(
    `${base()}/ANNULER_JOUEUR_SERIE_COMP/${path}`,
    StringReply,
    {
      endpoint: 'ANNULER_JOUEUR_SERIE_COMP',
      method: 'POST',
      writes: true,
      body: { Motif: input.reason },
    },
  );
  return asMessage(res);
}

// ---------------------------------------------------------------------------
// Contenus
// ---------------------------------------------------------------------------

/** GET_ACTUALITE_CLUB - since = date/heure de derniere synchro */
export function news(clubId: string, since: string) {
  return callJson(
    `${base()}/GET_ACTUALITE_CLUB/${seg(clubId)}/${seg(since)}`,
    NewsList,
    { endpoint: 'GET_ACTUALITE_CLUB' },
  );
}

/**
 * GET_LIST_NOTIFICATION_LICENCIE
 * 3e segment = PLATEFORME (ANDROID | IOS), et non une date-heure. Le canal
 * "WEB" ne renvoie rien cote amont ; on interroge donc ANDROID (contenu
 * identique a IOS) pour recuperer les notifications de l adherent.
 */
export function notifications(licence: string, group: string, platform: string) {
  return callJson(
    `${base()}/GET_LIST_NOTIFICATION_LICENCIE/${seg(licence)}/${seg(group)}/${seg(platform)}`,
    NotificationList,
    { endpoint: 'GET_LIST_NOTIFICATION_LICENCIE' },
  );
}

/** GET_CONSOMMATION_CARNET_TEL_ADHERENT */
export function carnets(clubId: string, licence: string) {
  return callJson(
    `${base()}/GET_CONSOMMATION_CARNET_TEL_ADHERENT/${seg(clubId)}/${seg(licence)}`,
    CarnetList,
    { endpoint: 'GET_CONSOMMATION_CARNET_TEL_ADHERENT' },
  );
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/** GET_BADGE_ABONNEMENT_CLUB - carte de membre */
export function memberBadge(clubId: string, licence: string) {
  return callBinary(
    `${base()}/GET_BADGE_ABONNEMENT_CLUB/${seg(clubId)}/${seg(licence)}`,
    { endpoint: 'GET_BADGE_ABONNEMENT_CLUB' },
  );
}

/** Logo du club, servi par images.golfs.ma */
export function clubLogo(clubId: string) {
  return callBinary(
    `${config.upstream.images}/CLUBS_LOGOS/${seg(clubId)}_128.png`,
    { endpoint: 'CLUB_LOGO' },
  );
}

/** SET_TOKEN_AUTH - conserve pour la compatibilite avec les apps natives */
export async function setPushToken(input: {
  licence: string; token: string; platform: string; group: string;
}): Promise<string> {
  const res = await callJson(`${base()}/SET_TOKEN_AUTH`, StringReply, {
    endpoint: 'SET_TOKEN_AUTH',
    method: 'POST',
    writes: true,
    body: {
      sParam_Num_Licence: input.licence,
      sParam_TOKEN: input.token,
      sParam_Android_IOS: input.platform,
      sGroupe: input.group,
    },
  });
  return asMessage(res);
}
