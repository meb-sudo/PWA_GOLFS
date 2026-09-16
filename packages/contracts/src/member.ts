import { z } from 'zod';
import { wdStr, wdNum, wdBool, wdDate } from './primitives.js';

/** st_Club_Resa_Possible */
export const ClubResaPossible = z.object({
  sClubID: wdStr,
  sClubNom: wdStr,
  sClubRegion: wdStr,
  sJoueur_A_V: wdStr,
  sJoueur_ID_AV: wdStr,
}).passthrough().transform((c) => ({
  clubId: c.sClubID,
  name: c.sClubNom,
  region: c.sClubRegion,
  playerType: c.sJoueur_A_V,
  playerId: c.sJoueur_ID_AV,
}));
export type ClubResaPossible = z.infer<typeof ClubResaPossible>;

/**
 * strucMembre_Login - reponse de MG_LOGIN_MEMBRE.
 *
 * sLogin_Web et sMDP_Web sont volontairement absents de la sortie :
 * la reponse amont les transporte (constat E-06), le BFF ne les
 * propage jamais jusqu au navigateur.
 */
export const MemberRaw = z.object({
  sID: wdStr,
  sPAX_ID: wdStr,
  sSexe: wdStr,
  sTitle: wdStr,
  sNom: wdStr,
  sPrenom: wdStr,
  sCodeLicence: wdStr,
  sMatricule: wdStr,
  sEmail: wdStr,
  sMobile: wdStr,
  xIndex: wdNum,
  sDateNaissance: wdDate,
  sEOLDate: wdDate,
  sMessage: wdStr,
  sType_ALI: wdStr,
  sClub: wdStr,
  sNationality: wdStr,
  sAvantage: wdStr,
  sNumEnregistrement: wdStr,
  sClub_Id: wdStr,
  sMembre_type: wdStr,
  sAdherent_Jr_Autorise: wdStr,
  sMessage_FinAbonnement: wdStr,
  bEst_Resa_Licencie: wdBool.optional().default(false),
  sClub_Membres_Liste_Club_Reservation_Possible: z.array(ClubResaPossible).default([]),
  sList_Autres_Club_Possible_Resa: z.array(ClubResaPossible).default([]),
}).passthrough();

export const Member = MemberRaw.transform((m) => ({
  id: m.sID,
  paxId: m.sPAX_ID,
  licence: m.sCodeLicence,
  registrationNumber: m.sNumEnregistrement,
  title: m.sTitle,
  gender: m.sSexe,
  lastName: m.sNom,
  firstName: m.sPrenom,
  fullName: [m.sPrenom, m.sNom].filter(Boolean).join(' '),
  email: m.sEmail,
  mobile: m.sMobile,
  index: m.xIndex,
  birthDate: m.sDateNaissance,
  membershipEndDate: m.sEOLDate,
  membershipWarning: m.sMessage_FinAbonnement,
  /** A = abonne, L = licencie, V = visiteur */
  memberKind: m.sType_ALI,
  clubName: m.sClub,
  clubId: m.sClub_Id,
  /** MA academie, MC temps complet, MS semainier */
  memberType: m.sMembre_type,
  nationality: m.sNationality,
  advantage: m.sAvantage,
  /**
   * Jours de la semaine autorises par la formule (1 = lundi ... 7 = dimanche).
   * L amont les separe par ";" ("2;3;4;5") ou parfois "," : on accepte les deux,
   * sinon toute la liste reste un seul bloc et AUCUN jour n est reconnu (tous
   * grises a tort).
   */
  allowedDays: m.sAdherent_Jr_Autorise
    .split(/[;,]/).map((d) => d.trim()).filter(Boolean),
  /** Licencie FRMG non abonne utilisant la reservation abonne */
  isLicenseeBooking: m.bEst_Resa_Licencie,
  bookableClubs: m.sClub_Membres_Liste_Club_Reservation_Possible,
  otherBookableClubs: m.sList_Autres_Club_Possible_Resa,
  message: m.sMessage,
}));
export type Member = z.infer<typeof Member>;

/** ST_JOUEURS_CLUB - resultat des recherches de partenaires. */
export const ClubPlayer = z.object({
  sID: wdStr, sPAX_ID: wdStr, sSexe: wdStr, sTitle: wdStr,
  sNom: wdStr, sPrenom: wdStr, sNP: wdStr,
  sCodeLicence: wdStr, sMatricule: wdStr, sEmail: wdStr, sMobile: wdStr,
  xIndex: wdNum, sDateNaissance: wdDate, sEOLDate: wdDate,
  sMessage: wdStr, sType_ALI: wdStr, sNom_Club: wdStr,
  sNationality: wdStr, sAvantage: wdStr, sNumEnregistrement: wdStr,
  sClub_5X: wdStr, sMembre_type: wdStr, sAdherent_Jr_Autorise: wdStr,
}).passthrough().transform((p) => ({
  id: p.sID,
  paxId: p.sPAX_ID,
  licence: p.sCodeLicence,
  registrationNumber: p.sNumEnregistrement,
  title: p.sTitle,
  lastName: p.sNom,
  firstName: p.sPrenom,
  fullName: p.sNP || [p.sPrenom, p.sNom].filter(Boolean).join(' '),
  email: p.sEmail,
  mobile: p.sMobile,
  index: p.xIndex,
  memberKind: p.sType_ALI,
  clubId: p.sClub_5X,
  clubName: p.sNom_Club,
  nationality: p.sNationality,
  advantage: p.sAvantage,
  message: p.sMessage,
}));
export type ClubPlayer = z.infer<typeof ClubPlayer>;

export const ClubPlayerList = z.array(ClubPlayer).transform((rows) =>
  rows.filter((p) => p.licence !== '' || p.fullName !== ''),
);

/** St_Jr_Depart - un joueur tel qu envoye dans une reservation. */
export const DeparturePlayerInput = z.object({
  sClub_5X: z.string(),
  sNum_Licence: z.string().default(''),
  sPAX_ID: z.string().default(''),
  sTitle: z.string().default(''),
  sNom: z.string().default(''),
  sPrenom: z.string().default(''),
  xIndex: z.number().default(0),
  sEmail: z.string().default(''),
  sId_Jr_AV: z.string().default(''),
  sJr_AV: z.string().default(''),
  sAvantage: z.string().default(''),
  sAvantage_MultiCriteres: z.string().default(''),
  sTarif_ID: z.string().default(''),
  sPrestation_ID: z.string().default(''),
  xPrix: z.number().default(0),
  sId_Caddet: z.string().default(''),
  sNomCadet: z.string().default(''),
  sPays: z.string().default(''),
  nPositionA: z.number().default(0),
  nPositionR: z.number().default(0),
});
export type DeparturePlayerInput = z.infer<typeof DeparturePlayerInput>;
