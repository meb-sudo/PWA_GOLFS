import { z } from 'zod';
import { wdStr, wdNum, wdBool, wdDate, wdDateTime } from './primitives.js';

/** St_List_Doc - un document joint a une competition. */
export const CompetitionDoc = z.object({
  sNom_Doc: wdStr, sLien_Doc: wdStr, sMessage: wdStr,
}).passthrough().transform((d) => ({ name: d.sNom_Doc, url: d.sLien_Doc }));
export type CompetitionDoc = z.infer<typeof CompetitionDoc>;

/**
 * St_List_Serie_Cup - une serie de competition.
 * L amont renvoie une ligne par serie, en repetant les champs de la
 * competition ; on regroupe cote BFF pour obtenir une hierarchie propre.
 */
export const SerieRow = z.object({
  sMessage: wdStr,
  sCup_Nom: wdStr,
  sCup_id: wdStr,
  sCup_Export_id: wdStr,
  sDate_Debut: wdDate,
  sDate_Fin: wdDate,
  sDate_Verif_Index: wdDate,
  sDH_Debut_Inscription: wdDateTime,
  sDH_Fin_Inscription: wdDateTime,
  nNombreTour: wdStr,
  sType: wdStr,
  bCup_To_Prepaid: wdBool.optional().default(false),
  sId_Serie_Inscrit: wdStr.optional().default(''),
  sSerie_Id: wdStr,
  sSerie_Nom: wdStr,
  sFormule: wdStr,
  sTerrain_Nom: wdStr,
  sNbr_Trous: wdStr,
  sRepere: wdStr,
  bComp_Valable: wdBool.optional().default(false),
  bEst_Inscrit: wdBool.optional().default(false),
  bEst_Inscription_Paye: wdBool.optional().default(false),
  sPaiement_Num_Dossier: wdStr.optional().default(''),
  sDetail_Paiement: wdStr.optional().default(''),
  TabList_Doc: z.array(CompetitionDoc).default([]),
}).passthrough();

/** st_Competition_Club_Grp - GET_COMPETITION_TEL_GROUPE_JOUEUR */
export const CompetitionClubList = z.array(
  z.object({
    sClub_5X: wdStr,
    sClubNom: wdStr,
    sClubRegion: wdStr,
    sMessage: wdStr,
    TabSerieCup: z.array(SerieRow).default([]),
  }).passthrough(),
).transform((clubs) =>
  clubs
    .filter((c) => c.sClub_5X !== '' && c.sClub_5X !== '0')
    .map((c) => {
      const byCup = new Map<string, {
        id: string; name: string; exportId: string;
        startDate: string; endDate: string; indexCheckDate: string;
        registrationOpensAt: string; registrationClosesAt: string;
        rounds: string; type: string; prepaymentRequired: boolean;
        registeredSerieId: string;
        documents: CompetitionDoc[];
        series: Array<{
          id: string; name: string; formula: string; courseName: string;
          holes: string; tee: string; eligible: boolean; registered: boolean;
          paid: boolean; paymentFolder: string; paymentDetail: string;
        }>;
      }>();

      for (const row of c.TabSerieCup) {
        if (row.sCup_id === '') continue;
        let cup = byCup.get(row.sCup_id);
        if (!cup) {
          cup = {
            id: row.sCup_id,
            name: row.sCup_Nom,
            exportId: row.sCup_Export_id,
            startDate: row.sDate_Debut,
            endDate: row.sDate_Fin,
            indexCheckDate: row.sDate_Verif_Index,
            registrationOpensAt: row.sDH_Debut_Inscription,
            registrationClosesAt: row.sDH_Fin_Inscription,
            rounds: row.nNombreTour,
            type: row.sType,
            prepaymentRequired: row.bCup_To_Prepaid,
            registeredSerieId: row.sId_Serie_Inscrit,
            documents: row.TabList_Doc,
            series: [],
          };
          byCup.set(row.sCup_id, cup);
        }
        if (row.sSerie_Id !== '') {
          cup.series.push({
            id: row.sSerie_Id,
            name: row.sSerie_Nom,
            formula: row.sFormule,
            courseName: row.sTerrain_Nom,
            holes: row.sNbr_Trous,
            tee: row.sRepere,
            eligible: row.bComp_Valable,
            registered: row.bEst_Inscrit,
            paid: row.bEst_Inscription_Paye,
            paymentFolder: row.sPaiement_Num_Dossier,
            paymentDetail: row.sDetail_Paiement,
          });
        }
      }

      return {
        clubId: c.sClub_5X,
        clubName: c.sClubNom,
        region: c.sClubRegion,
        competitions: [...byCup.values()],
      };
    })
    .filter((c) => c.competitions.length > 0),
);
export type CompetitionClub = z.infer<typeof CompetitionClubList>[number];
export type Competition = CompetitionClub['competitions'][number];

/** st_Save_Cup - corps de ENREGISTRER_JOUEUR_SERIE_COMP_POST */
export const CompetitionRegisterInput = z.object({
  competitionClubId: z.string().min(1),
  competitionId: z.string().min(1),
  serieId: z.string().min(1),
});
export type CompetitionRegisterInput = z.infer<typeof CompetitionRegisterInput>;

export const CompetitionUnregisterInput = CompetitionRegisterInput.extend({
  reason: z.string().min(1, 'Un motif est requis'),
});
export type CompetitionUnregisterInput = z.infer<typeof CompetitionUnregisterInput>;

/** Reponse commune aux appels competition. */
export const CompetitionReply = z.object({
  sMessage: wdStr,
  sInfo: wdStr.optional().default(''),
  sLienPaiement: wdStr.optional().default(''),
}).passthrough().transform((r) => ({
  message: r.sMessage,
  info: r.sInfo,
  paymentUrl: r.sLienPaiement,
}));

export const CompetitionCount = wdNum;
