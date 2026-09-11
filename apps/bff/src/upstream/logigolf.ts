import {
  ReservationList, ReservationDetail, ReservationPlayerList,
} from '@golf/contracts';
import { config } from '../config.js';
import { callJson, callBinary, seg } from './http.js';

/**
 * Second backend : la liste et le detail des reservations vivent sur
 * rest.logigolf.com, pas sur golfs.ma.
 */
const base = () => config.upstream.logigolf;

/** GOLFS_MG_GET_ALL_RESERVATIONS_POST */
export function reservations(input: {
  licence: string; affiliationClubId: string; fromDate: string;
}) {
  return callJson(
    `${base()}/GOLFS_MG_GET_ALL_RESERVATIONS_POST`,
    ReservationList,
    {
      endpoint: 'GOLFS_MG_GET_ALL_RESERVATIONS_POST',
      method: 'POST',
      body: {
        sNum_Licence: input.licence,
        sClub_5X_Affiliation: input.affiliationClubId,
        sParam_Date: input.fromDate,
      },
    },
  );
}

/** GOLFS_MG_GET_RESERVATION_DETAIL */
export function reservationDetail(reservationId: string, clubId: string) {
  return callJson(
    `${base()}/GOLFS_MG_GET_RESERVATION_DETAIL/${seg(reservationId)}/${seg(clubId)}`,
    ReservationDetail,
    { endpoint: 'GOLFS_MG_GET_RESERVATION_DETAIL' },
  );
}

export { ReservationPlayerList, callBinary };
