import { z } from 'zod';
import { wdStr, wdNum, wdBool, wdTime, isSentinelClub } from './primitives.js';

/** st_Clubs_Groupe - GET_CLUBS_TEL_GROUPE */
export const GroupClubList = z.array(
  z.object({ sMessage: wdStr, sClub_5X: wdStr, sNom_Club: wdStr }).passthrough(),
).transform((rows) =>
  rows
    .filter((r) => !isSentinelClub(r.sClub_5X, r.sNom_Club))
    .map((r) => ({ clubId: r.sClub_5X, name: r.sNom_Club })),
);
export type GroupClub = z.infer<typeof GroupClubList>[number];

/** STUnTerrain - un parcours du club. */
export const Course = z.object({
  TERRAINS_NOM: wdStr,
  TERRAINS_DISPLAY_ORDER: wdNum,
  TERRAINS_9_18: wdNum,
  TERRAINS_CLUB_5X: wdStr,
  TERRAIN_NUMERO: wdStr,
  TERRAINS_A: wdStr,
  TERRAINS_R: wdStr,
  TERRAINS_xIndexRequis: wdNum,
  TERRAINS_IMAGE: wdStr,
  TERRAINS_DES_FR: wdStr,
  TERRAINS_DES_EN: wdStr,
  TERRAINS_DESCRIPTION_COURTE_FR: wdStr,
  TERRAINS_DESCRIPTION_COURTE_EN: wdStr,
  TERRAINS_DESCRIPTION_LONGUE_FR: wdStr,
  TERRAINS_DESCRIPTION_LONGUE_EN: wdStr,
  TERRAINS_STD_18: wdNum, TERRAINS_STD_9: wdNum,
  TERRAINS_LIC_18: wdNum, TERRAINS_LIC_9: wdNum,
  TERRAINS_INV_18: wdNum, TERRAINS_INV_9: wdNum,
  TERRAINS_ABO_18: wdNum, TERRAINS_ABO_9: wdNum,
  TERRAINS_NET_18: wdNum, TERRAINS_NET_9: wdNum,
}).passthrough().transform((t) => ({
  name: t.TERRAINS_NOM,
  order: t.TERRAINS_DISPLAY_ORDER,
  holes: t.TERRAINS_9_18,
  clubId: t.TERRAINS_CLUB_5X,
  number: t.TERRAIN_NUMERO,
  /** Identifiants aller et retour attendus par API de disponibilite. */
  outId: t.TERRAINS_A,
  backId: t.TERRAINS_R,
  requiredIndex: t.TERRAINS_xIndexRequis,
  image: t.TERRAINS_IMAGE,
  label: { fr: t.TERRAINS_DES_FR, en: t.TERRAINS_DES_EN },
  shortDescription: { fr: t.TERRAINS_DESCRIPTION_COURTE_FR, en: t.TERRAINS_DESCRIPTION_COURTE_EN },
  longDescription: { fr: t.TERRAINS_DESCRIPTION_LONGUE_FR, en: t.TERRAINS_DESCRIPTION_LONGUE_EN },
  prices: {
    standard: { h18: t.TERRAINS_STD_18, h9: t.TERRAINS_STD_9 },
    licensee: { h18: t.TERRAINS_LIC_18, h9: t.TERRAINS_LIC_9 },
    visitor: { h18: t.TERRAINS_INV_18, h9: t.TERRAINS_INV_9 },
    member: { h18: t.TERRAINS_ABO_18, h9: t.TERRAINS_ABO_9 },
    net: { h18: t.TERRAINS_NET_18, h9: t.TERRAINS_NET_9 },
  },
}));
export type Course = z.infer<typeof Course>;

/** st_Country - GET_REF_COUNTRY */
export const CountryList = z.array(
  z.object({ lable: wdStr, id: wdStr, OrdreId: wdStr }).passthrough(),
).transform((rows) => rows.map((c) => ({ code: c.id, label: c.lable })));
export type Country = z.infer<typeof CountryList>[number];

function parseGeo(s: string): { lat: number; lng: number } | null {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(s);
  if (!m) return null;
  return { lat: Number(m[1]), lng: Number(m[2]) };
}

/**
 * St_Infos_Club - GET_ALL_INFOS_CLUB.
 * Appel pivot : porte toute la configuration metier du club.
 */
export const ClubInfo = z.object({
  sClubName: wdStr,
  sClubNameLong: wdStr,
  sClub_EmailReservation: wdStr,
  sClub_SiteWeb: wdStr,
  sClub_Geoloca: wdStr,
  sNum_International: wdStr,
  sBaseClub: wdStr,
  nNBHeureAvant: wdNum,
  nNBJours_Avance: wdNum,
  nMinJour: wdNum,
  nNBMaxPlayer: wdNum,
  n_STANDARD_START_INTERVAL: wdNum,
  n_STANDARD_COURSE_RUN_TIME: wdNum,
  h_STANDARD_COURSE_FIRST_START: wdTime,
  h_STANDARD_COURSE_LAST_START: wdTime,
  nNb_Depart_Show: wdNum,
  nNBJoursAnnulation: wdNum,
  bEst_Annuler_Resa: wdBool,
  sEst_Prest_Cadet: wdStr,
  sNote_Cadet: wdStr,
  bClub_Accept_Paiement_Engline: wdBool,
  LesTerrainsduClub: z.array(Course).default([]),
  TabCountry: CountryList.default([]),
  sMessage: wdStr,
}).passthrough().transform((c) => ({
  shortName: c.sClubName,
  name: c.sClubNameLong || c.sClubName,
  reservationEmail: c.sClub_EmailReservation,
  website: c.sClub_SiteWeb,
  geo: parseGeo(c.sClub_Geoloca),
  phone: c.sNum_International,
  baseId: c.sBaseClub,
  rules: {
    /** Delai minimum en heures avant le depart. */
    minHoursBefore: c.nNBHeureAvant,
    /** Horizon de reservation en jours. */
    maxDaysAhead: c.nNBJours_Avance,
    /** Nombre de jours minimum avant de pouvoir reserver. */
    minDaysBefore: c.nMinJour,
    maxPlayers: c.nNBMaxPlayer || 4,
    startIntervalMinutes: c.n_STANDARD_START_INTERVAL,
    courseRunTimeMinutes: c.n_STANDARD_COURSE_RUN_TIME,
    firstStart: c.h_STANDARD_COURSE_FIRST_START,
    lastStart: c.h_STANDARD_COURSE_LAST_START,
    departuresToShow: c.nNb_Depart_Show,
    cancellationDays: c.nNBJoursAnnulation,
    cancellationAllowed: c.bEst_Annuler_Resa,
    onlinePaymentAccepted: c.bClub_Accept_Paiement_Engline,
  },
  caddies: {
    /** "0" non utilise, "1" utilise non nominatif, "2" nominatif */
    mode: c.sEst_Prest_Cadet || '0',
    note: c.sNote_Cadet,
  },
  courses: [...c.LesTerrainsduClub].sort((a, b) => a.order - b.order),
  countries: c.TabCountry,
  message: c.sMessage,
}));
export type ClubInfo = z.infer<typeof ClubInfo>;

/** St_Mention_LG_Condition - GET_MENTION_LEGALE_TEL_GRP */
export const LegalInfo = z.object({
  sUrl_Mention_Legale: wdStr,
  sUrl_conditon_generale: wdStr,
  sAffiche_Logo: wdStr,
}).passthrough().transform((l) => ({
  // L amont renvoie parfois "#" (ou une valeur vide/sans protocole) quand
  // aucune vraie page n est configuree : on ne garde qu une URL http(s)
  // exploitable, sinon vide -> le bouton correspondant est masque.
  legalNoticeUrl: httpUrlOrEmpty(l.sUrl_Mention_Legale),
  termsUrl: httpUrlOrEmpty(l.sUrl_conditon_generale),
  showLogo: l.sAffiche_Logo.toUpperCase() === 'Y',
}));

function httpUrlOrEmpty(u: string): string {
  const v = u.trim();
  return /^https?:\/\//i.test(v) ? v : '';
}
export type LegalInfo = z.infer<typeof LegalInfo>;
