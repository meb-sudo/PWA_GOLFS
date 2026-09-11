import { config } from '../config.js';
import { callBinary, seg } from './http.js';

/** FRMG_GET_BADGE_PHOTO - photo du badge licencie, backend FRMG. */
export function licenceBadge(licence: string) {
  return callBinary(
    `${config.upstream.frmg}/FRMG_GET_BADGE_PHOTO/${seg(licence)}`,
    { endpoint: 'FRMG_GET_BADGE_PHOTO' },
  );
}
