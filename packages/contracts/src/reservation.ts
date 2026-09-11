import { z } from 'zod';
import { wdStr, wdNum, wdBool, wdDate, wdDateTime, wdTime, wdShortTime } from './primitives.js';

/** ST_Liste_Reseravation - GOLFS_MG_GET_ALL_RESERVATIONS_POST */
export const ReservationList = z.array(
  z.object({
    sNum_Club_Resa: wdStr,
    sClub_Resa_5X: wdStr,
    sClubNom: wdStr,
    dDate: wdDate,
    hHeure: wdTime,
    sParcoursNom: wdStr,
    sParcours_Terrain_A: wdStr,
    sParcours_Terrain_R: wdStr,
    nNb_Trous: wdNum,
    nNb_Joueurs: wdNum,
    sMessage: wdStr,
    sNumDossier: wdStr,
    sDateDossier: wdDate,
    nNBDeparts: wdNum,
    sNote: wdStr,
    sMadeByLibelle: wdStr.optional(),
    sCreationBy: wdStr,
    sStatut: wdStr,
    sMadeByAVP: wdStr,
    sMadeByID: wdStr,
    sMode: wdStr,
    sEst_PlayerMaster: wdStr,
    sTotal_Resa: wdStr,
    nBr_Jour_AnnulationResa: wdNum,
    nNBMaxPlayer: wdNum,
    sDate_Creation: wdDateTime,
    b_Est_a_Payer_Enligne: wdBool.optional().default(false),
    sLien_Paiement: wdStr.optional().default(''),
  }).passthrough(),
).transform((rows) =>
  rows
    .filter((r) => r.sNumDossier !== '')
    .map((r) => ({
      id: r.sNumDossier,
      clubReservationNumber: r.sNum_Club_Resa,
      clubId: r.sClub_Resa_5X,
      clubName: r.sClubNom,
      date: r.dDate,
      time: r.hHeure,
      courseName: r.sParcoursNom,
      courseOutId: r.sParcours_Terrain_A,
      courseBackId: r.sParcours_Terrain_R,
      holes: r.nNb_Trous,
      players: r.nNb_Joueurs,
      departures: r.nNBDeparts,
      note: r.sNote,
      /** CA = confirme abonne, OP = option, ... */
      status: r.sStatut,
      mode: r.sMode,
      createdBy: r.sCreationBy,
      createdAt: r.sDate_Creation,
      bookedByLabel: r.sMadeByLibelle ?? '',
      bookedByType: r.sMadeByAVP,
      /** Y = le joueur connecte est le createur de la reservation */
      isOwner: r.sEst_PlayerMaster.toUpperCase() === 'Y',
      total: r.sTotal_Resa,
      cancellationDays: r.nBr_Jour_AnnulationResa,
      maxPlayers: r.nNBMaxPlayer,
      awaitingPayment: r.b_Est_a_Payer_Enligne,
      paymentUrl: r.sLien_Paiement,
      message: r.sMessage,
    })),
);
export type Reservation = z.infer<typeof ReservationList>[number];

/** ST_Reservation_Player - un joueur dans le detail d une reservation. */
export const ReservationPlayer = z.object({
  sDeparts_ID: wdStr,
  sHeure_Start: wdShortTime,
  sAV: wdStr,
  sAV_ID: wdStr,
  sNom_Prenom: wdStr,
  xIndex: wdNum,
  sTarif_ID: wdStr,
  sPrestation_ID: wdStr,
  sPrestation_Nom: wdStr,
  sImputation_ID: wdStr,
  xPrix: wdNum,
  sAvantage: wdStr,
  sEmail: wdStr,
  sId_Cadet: wdStr,
  sNom_Cadet: wdStr,
  sMessage: wdStr,
  sDeparts_ID_NOM: wdStr,
}).passthrough().transform((p) => ({
  departureId: p.sDeparts_ID,
  departureIdName: p.sDeparts_ID_NOM,
  startTime: p.sHeure_Start,
  playerType: p.sAV,
  playerId: p.sAV_ID,
  fullName: p.sNom_Prenom,
  index: p.xIndex,
  tariffId: p.sTarif_ID,
  prestationId: p.sPrestation_ID,
  prestationName: p.sPrestation_Nom,
  price: p.xPrix,
  advantage: p.sAvantage,
  email: p.sEmail,
  caddieId: p.sId_Cadet,
  caddieName: p.sNom_Cadet,
}));
export type ReservationPlayer = z.infer<typeof ReservationPlayer>;

/** ST_Prestation_Resa - une prestation dans le detail. */
export const ReservationPrestation = z.object({
  sId_Resa_Presation: wdStr,
  sId_Prestation: wdStr,
  sID_Tarif: wdStr,
  sPrix: wdNum,
  nQte: wdNum,
  sNom_Prestation: wdStr,
  sMessage: wdStr,
}).passthrough().transform((p) => ({
  id: p.sId_Resa_Presation,
  prestationId: p.sId_Prestation,
  tariffId: p.sID_Tarif,
  price: p.sPrix,
  quantity: p.nQte,
  name: p.sNom_Prestation,
}));
export type ReservationPrestation = z.infer<typeof ReservationPrestation>;

/** st_Detail_Reservation - GOLFS_MG_GET_RESERVATION_DETAIL */
export const ReservationDetail = z.object({
  tabPlayers: z.array(ReservationPlayer).default([]),
  tabPrestation: z.array(ReservationPrestation).default([]),
  sMessage: wdStr,
}).passthrough().transform((d) => ({
  players: d.tabPlayers,
  prestations: d.tabPrestation,
  message: d.sMessage,
}));
export type ReservationDetail = z.infer<typeof ReservationDetail>;

/** st_Players - GET_LIST_PLAYERS_RESA */
export const ReservationPlayerList = z.array(
  z.object({
    sID_DepartNom: wdStr,
    sNom_Prenom: wdStr,
    sIndex: wdStr,
    sPrix: wdStr,
    sEmail: wdStr,
    sAvantage: wdStr,
    sCode_Licence: wdStr,
    sTerrain_A: wdStr,
    sTerrain_R: wdStr,
    sMessage: wdStr,
  }).passthrough(),
).transform((rows) =>
  rows
    .filter((p) => p.sID_DepartNom !== '')
    .map((p) => ({
      departureIdName: p.sID_DepartNom,
      fullName: p.sNom_Prenom,
      index: p.sIndex,
      price: p.sPrix,
      email: p.sEmail,
      advantage: p.sAvantage,
      licence: p.sCode_Licence,
      courseOutId: p.sTerrain_A,
      courseBackId: p.sTerrain_R,
    })),
);

// ---------------------------------------------------------------------------
// Entrees
// ---------------------------------------------------------------------------

/** st_Annule_Resa */
export const CancelInput = z.object({
  note: z.string().min(1, 'Un motif est requis'),
});
export type CancelInput = z.infer<typeof CancelInput>;

/** st_change_Horaire_Depart */
export const ChangeTimeInput = z.object({
  clubId: z.string().min(1),
  newTime: z.string().regex(/^\d{2}:\d{2}$/),
  oldTime: z.string().regex(/^\d{2}:\d{2}$/),
  courseOutId: z.string(),
  courseBackId: z.string().default(''),
  holes: z.union([z.literal(9), z.literal(18)]),
  date: z.string().regex(/^\d{8}$/),
});
export type ChangeTimeInput = z.infer<typeof ChangeTimeInput>;
