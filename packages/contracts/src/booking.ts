import { z } from 'zod';
import { wdStr, wdNum, wdBool, wdTime, fromApiTime } from './primitives.js';
import { DeparturePlayerInput } from './member.js';

/** St_Dispo_Depart - un creneau, avec les positions libres aller et retour. */
export const DepartureSlot = z.object({
  // Conserve la chaine d origine ("07:30:00.000") : c est cette structure
  // exacte qui repart dans UnDepartChoisis a l enregistrement. On derive les
  // heures d affichage sans ecraser l original.
  hHeure_Start_A: wdStr,
  bPosition1_A: wdBool, bPosition2_A: wdBool,
  bPosition3_A: wdBool, bPosition4_A: wdBool,
  hHeure_Start_R: wdStr,
  bPosition1_R: wdBool, bPosition2_R: wdBool,
  bPosition3_R: wdBool, bPosition4_R: wdBool,
}).passthrough().transform((d) => {
  const out = [d.bPosition1_A, d.bPosition2_A, d.bPosition3_A, d.bPosition4_A];
  const back = [d.bPosition1_R, d.bPosition2_R, d.bPosition3_R, d.bPosition4_R];
  return {
    /** Heure aller au format "HH:MM", pour l affichage. */
    timeOut: fromApiTime(d.hHeure_Start_A) ?? d.hHeure_Start_A,
    timeBack: fromApiTime(d.hHeure_Start_R) ?? d.hHeure_Start_R,
    /** true = position libre. Index 0 a 3. */
    positionsOut: out,
    positionsBack: back,
    freeOut: out.filter(Boolean).length,
    freeBack: back.filter(Boolean).length,
    // Structure d origine, renvoyee telle quelle a ENREGISTRER_RESA_ABONNE.
    raw: {
      hHeure_Start_A: d.hHeure_Start_A,
      bPosition1_A: d.bPosition1_A, bPosition2_A: d.bPosition2_A,
      bPosition3_A: d.bPosition3_A, bPosition4_A: d.bPosition4_A,
      hHeure_Start_R: d.hHeure_Start_R,
      bPosition1_R: d.bPosition1_R, bPosition2_R: d.bPosition2_R,
      bPosition3_R: d.bPosition3_R, bPosition4_R: d.bPosition4_R,
    },
  };
});
export type DepartureSlot = z.infer<typeof DepartureSlot>;

/** st_Dispo_Depart_Show - GET_DISPONIBILITE_DEPART_SELON_AVP */
export const AvailabilityList = z.array(
  z.object({
    nNbr_Depart_Show: wdNum,
    nJoueurs: wdNum,
    sNote_Day: wdStr,
    TabDepart_Dispo: z.array(DepartureSlot).default([]),
    sMessage: wdStr,
  }).passthrough(),
).transform((groups) => {
  const note = groups.find((g) => g.sNote_Day)?.sNote_Day ?? '';
  const slots = groups.flatMap((g) => g.TabDepart_Dispo);
  return {
    dayNote: note,
    playersRequested: groups[0]?.nJoueurs ?? 0,
    slots,
  };
});
export type Availability = z.infer<typeof AvailabilityList>;

/** St_Prestation - GET_LIST_PRESTATION_RESA_ENLIGNE */
export const PrestationList = z.array(
  z.object({
    sNom_famille: wdStr,
    sNom_Prestation_FR: wdStr,
    sNom_Prestation_EN: wdStr,
    sId_Prestation: wdStr,
    sId_Tarification: wdStr,
    xPrix: wdNum,
    s9_18Trous: wdStr,
    nMax_Pres_Jour: wdNum,
    nMax_Pres_Resa: wdNum,
    sMessage: wdStr,
  }).passthrough(),
).transform((rows) =>
  rows
    .filter((p) => p.sId_Prestation !== '')
    .map((p) => ({
      id: p.sId_Prestation,
      pricingId: p.sId_Tarification,
      family: p.sNom_famille,
      label: { fr: p.sNom_Prestation_FR, en: p.sNom_Prestation_EN },
      name: p.sNom_Prestation_FR || p.sNom_Prestation_EN,
      price: p.xPrix,
      holes: p.s9_18Trous,
      maxPerDay: p.nMax_Pres_Jour,
      maxPerBooking: p.nMax_Pres_Resa,
    })),
);
export type Prestation = z.infer<typeof PrestationList>[number];

/**
 * La prestation s applique-t-elle au nombre de trous choisi ?
 *
 * Transpose Contient(s9_18Trous, nbTrous, MotComplet) : le champ liste les
 * trous couverts, separes par ";" ("9;", "18;", "9;18;27"). Le rapprochement
 * doit etre exact ("9" ne doit pas matcher "18" ni "27").
 */
export function prestationMatchesHoles(holesField: string, holes: number): boolean {
  return holesField
    .split(';')
    .map((t) => t.trim())
    .filter(Boolean)
    .includes(String(holes));
}

/** st_Cadet - GET_LIST_CADETS */
export const CaddieList = z.array(
  z.object({
    sId_Cadet: wdStr, sNom_Cadet: wdStr, sMat_Cadet: wdStr, sMessage: wdStr,
  }).passthrough(),
).transform((rows) =>
  rows
    .filter((c) => c.sId_Cadet !== '')
    .map((c) => ({ id: c.sId_Cadet, name: c.sNom_Cadet, badge: c.sMat_Cadet })),
);
export type Caddie = z.infer<typeof CaddieList>[number];

/** St_Tarifs - une ligne de tarif renvoyee par GET_TARIFS */
export const Tariff = z.object({
  sMessage: wdStr,
  ID_Tarif: wdNum,
  ID_Prestation: wdNum,
  ID_Tarification: wdNum,
  Prix: wdNum,
  Tarif_Type: wdStr,
  Libelle: wdStr.optional(),
  Est_Tarif_Standard: wdBool.optional().default(false),
  Est_Tarif_Avantage: wdBool.optional().default(false),
  Est_Tarif_Multicritere: wdBool.optional().default(false),
  Tarif_AV_Lib: wdStr.optional(),
}).passthrough().transform((t) => ({
  tariffId: String(t.ID_Tarif),
  prestationId: String(t.ID_Prestation),
  pricingId: String(t.ID_Tarification),
  price: t.Prix,
  /** P periode, S jour de semaine, H horaire, A avantage, D standard, G age */
  type: t.Tarif_Type,
  label: t.Libelle ?? '',
  isStandard: t.Est_Tarif_Standard,
  isAdvantage: t.Est_Tarif_Avantage,
  isMultiCriteria: t.Est_Tarif_Multicritere,
  advantageLabel: t.Tarif_AV_Lib ?? '',
}));
export type Tariff = z.infer<typeof Tariff>;

/** st_InfoTarif - reponse de GET_TARIFS */
export const TariffInfo = z.object({
  sMessage: wdStr,
  sPrestation_Designation: wdStr,
  Tab_Tarif: z.array(Tariff).default([]),
}).passthrough().transform((t) => ({
  prestationLabel: t.sPrestation_Designation,
  tariffs: t.Tab_Tarif,
  message: t.sMessage,
}));
export type TariffInfo = z.infer<typeof TariffInfo>;

// ---------------------------------------------------------------------------
// Entrees : ce que la PWA envoie au BFF pour construire une reservation
// ---------------------------------------------------------------------------

/**
 * Criteres de recherche de departs.
 *
 * Les valeurs arrivent en parametres d URL, donc en chaines : chaque nombre
 * est coerce. holes en particulier attend 9 ou 18, pas "9"/"18".
 */
export const AvailabilityQuery = z.object({
  date: z.string().regex(/^\d{8}$/, 'Date attendue au format AAAAMMJJ'),
  courseOutId: z.string().min(1, 'Parcours non selectionne'),
  courseBackId: z.string().default(''),
  players: z.coerce.number().int().min(1).max(4),
  holes: z.coerce.number().int().refine(
    (v): v is 9 | 18 => v === 9 || v === 18,
    'Nombre de trous invalide',
  ),
  timeFrom: z.string().regex(/^\d{2}:\d{2}$/).default('00:00'),
  timeTo: z.string().regex(/^\d{2}:\d{2}$/).default('23:59'),
  departuresToShow: z.coerce.number().int().min(0).default(0),
});
export type AvailabilityQuery = z.infer<typeof AvailabilityQuery>;

export const ChosenPrestation = z.object({
  sNom_Prestation_FR: z.string(),
  sId_Prestation: z.string(),
  sId_Tarification: z.string(),
  nQte: z.number().int().min(1),
  xPrix: z.number(),
  xPrix_TT: z.number(),
});
export type ChosenPrestation = z.infer<typeof ChosenPrestation>;

/** st_SET_RESA_AB - corps de ENREGISTRER_RESA_ABONNE */
export const BookingInput = z.object({
  sParam_Club_5X: z.string().min(1),
  nBr_Joueur: z.number().int().min(1).max(4),
  sTerrain_ID_A: z.string(),
  sTerrain_ID_R: z.string().default(''),
  sHeure_Min: z.string(),
  sHeure_Max: z.string(),
  nbr_Depart_Show: z.number().int().default(0),
  sDate_Resa: z.string().regex(/^\d{8}$/),
  nParam_NBTrous: z.union([z.literal(9), z.literal(18)]),
  hParam_Heure: z.string(),
  sParamNote: z.string().default(''),
  sAndroid_Ios: z.string().default('WEB'),
  UnDepartChoisis: z.record(z.unknown()),
  tabJoueur_Resa: z.array(DeparturePlayerInput).min(1),
  TabPrest_Choisis: z.array(ChosenPrestation).default([]),
  bEst_Resa_Payer_EnLigne: z.boolean().default(false),
  xMontant_Resa: z.number().default(0),
});
export type BookingInput = z.infer<typeof BookingInput>;

/** st_Check_Players - corps de JOUEURS_AUTORISE_TO_RESERVE */
export const CheckPlayersInput = z.object({
  sDate: z.string().regex(/^\d{8}$/),
  sClub_5X: z.string().min(1),
  TABJoueursDepart: z.array(DeparturePlayerInput).min(1),
});
export type CheckPlayersInput = z.infer<typeof CheckPlayersInput>;

/** st_Reponse - message, info, lien de paiement */
export const ApiReply = z.object({
  sMessage: wdStr,
  sInfo: wdStr.optional().default(''),
  sLienPaiement: wdStr.optional().default(''),
}).passthrough().transform((r) => ({
  message: r.sMessage,
  info: r.sInfo,
  paymentUrl: r.sLienPaiement,
}));
export type ApiReply = z.infer<typeof ApiReply>;
