import { z } from 'zod';
import { wdStr, wdNum, wdBool, wdDate, wdDateTime } from './primitives.js';

/**
 * STActualite - GET_ACTUALITE_CLUB.
 * bufImage arrive en base64 dans le JSON : on le convertit en data URI
 * cote BFF plutot que de laisser le navigateur s en occuper.
 */
export const NewsList = z.array(
  z.object({
    sAct_Num: wdStr,
    sTitre: wdStr,
    sExtrait: wdStr,
    sArticle: wdStr,
    bufImage: z.unknown().optional(),
    dDate_Ajout: wdDateTime,
    dUpdate: wdDateTime,
    bEst_Archive: wdBool.optional().default(false),
    bNo_Display: wdBool.optional().default(false),
    sMessage: wdStr,
  }).passthrough(),
).transform((rows) =>
  rows
    .filter((n) => n.sAct_Num !== '' && !n.bEst_Archive && !n.bNo_Display)
    .map((n) => ({
      id: n.sAct_Num,
      title: n.sTitre,
      excerpt: n.sExtrait,
      body: n.sArticle,
      image: toDataUri(n.bufImage),
      publishedAt: n.dDate_Ajout,
      updatedAt: n.dUpdate,
    })),
);
export type NewsItem = z.infer<typeof NewsList>[number];

function toDataUri(buf: unknown): string | null {
  if (typeof buf !== 'string' || buf.length < 32) return null;
  if (buf.startsWith('data:')) return buf;
  const clean = buf.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/=]+$/.test(clean)) return null;
  return `data:image/jpeg;base64,${clean}`;
}

/** st_Notif - GET_LIST_NOTIFICATION_LICENCIE */
export const NotificationList = z.array(
  z.object({
    sId: wdStr,
    sTitre: wdStr,
    sContenu: wdStr,
    sAction: wdStr,
    sDateHeure: wdDateTime,
    sMessage: wdStr,
  }).passthrough(),
).transform((rows) =>
  rows
    .filter((n) => n.sId !== '')
    .map((n) => ({
      id: n.sId,
      title: n.sTitre,
      body: n.sContenu,
      /** Nom de fenetre WinDev a ouvrir ; converti en route cote PWA. */
      action: n.sAction,
      sentAt: n.sDateHeure,
    })),
);
export type NotificationItem = z.infer<typeof NotificationList>[number];

/** st_Detaille_carnet - GET_CONSOMMATION_CARNET_TEL_ADHERENT */
export const CarnetList = z.array(
  z.object({
    sNom_carnet: wdStr,
    sNum_carnet: wdStr,
    nNbr_ticket_consomme: wdNum,
    nNbr_ticket_disponible: wdNum,
    nNbr_ticket_de_carnet: wdNum,
    sDate_validite: wdDate,
    bEst_carnet_consomme: wdBool.optional().default(false),
    sId_carnet_prestation: wdStr,
    sMessage: wdStr,
  }).passthrough(),
).transform((rows) =>
  rows
    .filter((c) => c.sNum_carnet !== '')
    .map((c) => ({
      number: c.sNum_carnet,
      name: c.sNom_carnet,
      used: c.nNbr_ticket_consomme,
      remaining: c.nNbr_ticket_disponible,
      total: c.nNbr_ticket_de_carnet,
      validUntil: c.sDate_validite,
      exhausted: c.bEst_carnet_consomme,
      prestationId: c.sId_carnet_prestation,
    })),
);
export type Carnet = z.infer<typeof CarnetList>[number];

/**
 * Correspondance action de notification -> route PWA.
 *
 * NOTIF_ACTION est une cle courte ("COMPETITION", "RESERVATION", "ACTUALITE"...),
 * pas un nom de fenetre. Transpose TEL_FEN_SELON_ACTION_NOTIF de WinDev, en
 * neutralisant les accents ("ACTUALITE" == "ACTUALITÉ").
 */
export function notificationRoute(action: string): string {
  const key = action
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  const map: Record<string, string> = {
    ACTUALITE: '/actualites',
    LICENCE: '/profil/carte',
    MEMBRE: '/profil/carte',
    CARNET: '/profil/carnets',
    NOTIF: '/notifications',
    RESERVATION: '/reservations',
    RESERVER: '/reserver',
    PROFIL: '/profil',
    COMPETITION: '/competitions',
  };
  return map[key] ?? '/notifications';
}
