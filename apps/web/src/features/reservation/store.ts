import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DepartureSlot, ClubPlayer, Prestation, Caddie } from '@golf/contracts';

/**
 * Brouillon de reservation.
 *
 * Persiste en sessionStorage : l assistant en cinq etapes survit a un
 * rafraichissement, a une perte de reseau et au retour depuis la page de
 * paiement. L application WinDev repart de zero dans ces trois cas.
 *
 * Aucune donnee d identification n y est stockee : la session vit dans un
 * cookie httpOnly cote BFF.
 */

export interface DraftPlayer {
  /** Identifiant local, stable pendant la saisie. */
  key: string;
  licence: string;
  paxId: string;
  title: string;
  lastName: string;
  firstName: string;
  fullName: string;
  email: string;
  index: number;
  nationality: string;
  advantage: string;
  clubId: string;
  /** Cadet affecte a ce joueur, si le club les gere. */
  caddie: Caddie | null;
  /** Le titulaire du compte, non supprimable. */
  isOwner: boolean;
  /** Tarif resolu pour ce joueur (RECHERCHE_TARIF). */
  price: number;
  tariffId: string;
  prestationId: string;
  multiCriteria: string;
}

export interface DraftPrestation {
  prestation: Prestation;
  quantity: number;
}

/** Tranches de RECHERCHE_DEPART : Matin / Midi / Apres-midi. */
export type TimePeriod = 'matin' | 'midi' | 'apresmidi';

/**
 * Bornes horaires d une tranche, transposees de RECHERCHE_DEPART :
 *   Matin      [premier depart -> 11h00]
 *   Midi       [11h00 -> 14h00]
 *   Apres-midi [14h00 -> dernier depart]
 * firstStart / lastStart sont fournis par la configuration du club.
 */
export function periodBounds(
  period: TimePeriod, firstStart: string, lastStart: string,
): { from: string; to: string } {
  switch (period) {
    case 'matin': return { from: firstStart, to: '11:00' };
    case 'midi': return { from: '11:00', to: '14:00' };
    case 'apresmidi': return { from: '14:00', to: lastStart };
  }
}

interface BookingDraft {
  clubId: string | null;
  clubName: string;
  /** sJoueur_A_V : "A" si abonne du club, sinon visiteur. */
  clubPlayerType: string;
  /** sJoueur_ID_AV : identifiant du joueur dans ce club. */
  clubPlayerId: string;
  /** Avantage tarifaire applique quand on n est pas abonne du club. */
  visitorAdvantage: string;
  /** Date ISO "AAAA-MM-JJ". */
  date: string | null;
  holes: 9 | 18;
  playerCount: number;
  courseOutId: string;
  courseBackId: string;
  courseName: string;
  /** Tranche horaire choisie (RECHERCHE_DEPART, SEL_Horaire_DP). */
  period: TimePeriod;
  timeFrom: string;
  timeTo: string;
  slot: DepartureSlot | null;
  players: DraftPlayer[];
  prestations: DraftPrestation[];
  note: string;
  payOnline: boolean;
}

interface BookingStore extends BookingDraft {
  setClub: (club: {
    clubId: string; name: string;
    playerType: string; playerId: string;
  }) => void;
  setVisitorAdvantage: (advantage: string) => void;
  setPeriod: (
    period: TimePeriod, firstStart: string, lastStart: string,
    /** Heure minimum reservable ("HH:MM"), pour ne pas viser un depart passe. */
    minTime?: string,
  ) => void;
  setDate: (iso: string) => void;
  setHoles: (h: 9 | 18) => void;
  setPlayerCount: (n: number) => void;
  setCourse: (outId: string, backId: string, name: string) => void;
  setTimeWindow: (from: string, to: string) => void;
  selectSlot: (slot: DepartureSlot | null) => void;
  addPlayer: (player: ClubPlayer) => void;
  /**
   * Ajoute un invite saisi a la main (FEN_AJOUT_JOUEUR, cellule CELL_INVITE).
   * Joueur visiteur sans licence ; l avantage tarifaire est porte par
   * l appelant ("INVITÉ ABONNÉ" si le titulaire est abonne du club).
   */
  addGuest: (guest: {
    civility: string; lastName: string; firstName: string;
    email: string; index: number; country: string; advantage: string;
  }) => void;
  addOwner: (
    owner: Omit<DraftPlayer,
      'key' | 'caddie' | 'isOwner' | 'price' | 'tariffId' | 'prestationId' | 'multiCriteria'>,
  ) => void;
  removePlayer: (key: string) => void;
  setCaddie: (key: string, caddie: Caddie | null) => void;
  setPlayerTariff: (key: string, tarif: {
    price: number; tariffId: string; prestationId: string; multiCriteria: string;
  }) => void;
  setPrestationQuantity: (prestation: Prestation, quantity: number) => void;
  setNote: (note: string) => void;
  setPayOnline: (value: boolean) => void;
  total: () => number;
  reset: () => void;
  /** Remet a zero tout sauf le club et la date, apres changement de criteres. */
  resetSelection: () => void;
}

const empty: BookingDraft = {
  clubId: null,
  clubName: '',
  clubPlayerType: '',
  clubPlayerId: '',
  visitorAdvantage: '',
  date: null,
  holes: 18,
  playerCount: 1,
  courseOutId: '',
  courseBackId: '',
  courseName: '',
  period: 'matin',
  timeFrom: '00:00',
  timeTo: '23:59',
  slot: null,
  players: [],
  prestations: [],
  note: '',
  payOnline: false,
};

let counter = 0;
const nextKey = () => `p${(counter += 1)}`;

/**
 * Cle de comparaison d un joueur par son nom : minuscule, espaces reduits,
 * jetons tries. Ainsi "BARET WILLIAM", "William Baret" et un nom saisi dans
 * un seul champ donnent la meme cle -> on detecte le meme joueur.
 */
export const nameKey = (fullName: string): string =>
  fullName.trim().toLowerCase().split(/\s+/).filter(Boolean).sort().join(' ');

export const useBooking = create<BookingStore>()(
  persist<BookingStore, [], [], Partial<BookingStore>>(
    (set, get) => ({
      ...empty,

      /*
        Chaque setter sort sans rien faire quand la valeur ne change pas.
        Sans ce garde, un appel redondant produit tout de meme un nouvel etat,
        donc un rendu, donc une nouvelle execution des effets qui rappellent
        le setter : la boucle est immediate.
      */
      setClub: (club) => {
        const s = get();
        if (s.clubId === club.clubId) return;
        // Changer de club invalide le reste : parcours, creneau, joueurs.
        set({
          ...empty,
          clubId: club.clubId,
          clubName: club.name,
          clubPlayerType: club.playerType,
          clubPlayerId: club.playerId,
          date: s.date,
        });
      },
      setVisitorAdvantage: (visitorAdvantage) => {
        if (get().visitorAdvantage === visitorAdvantage) return;
        set({ visitorAdvantage });
      },
      setDate: (date) => {
        if (get().date === date) return;
        set({ date, slot: null });
      },
      setHoles: (holes) => {
        if (get().holes === holes) return;
        set({ holes, slot: null });
      },
      /**
       * Conserve pour la recherche de creneaux, mais aligne sur la liste :
       * le nombre de joueurs n est plus choisi, il se deduit du depart.
       */
      setPlayerCount: (playerCount) => {
        if (get().playerCount === playerCount) return;
        set({ playerCount, slot: null });
      },
      setCourse: (courseOutId, courseBackId, courseName) => {
        const s = get();
        if (s.courseOutId === courseOutId && s.courseBackId === courseBackId) return;
        set({ courseOutId, courseBackId, courseName, slot: null });
      },
      setTimeWindow: (timeFrom, timeTo) => {
        const s = get();
        if (s.timeFrom === timeFrom && s.timeTo === timeTo) return;
        set({ timeFrom, timeTo, slot: null });
      },
      setPeriod: (period, firstStart, lastStart, minTime) => {
        const bornes = periodBounds(period, firstStart, lastStart);
        // On ne cherche jamais avant l heure minimum reservable (aujourd hui).
        const from = minTime && minTime > bornes.from ? minTime : bornes.from;
        const to = bornes.to;
        const s = get();
        if (s.period === period && s.timeFrom === from && s.timeTo === to) return;
        set({ period, timeFrom: from, timeTo: to, slot: null });
      },
      selectSlot: (slot) => set({ slot }),

      addOwner: (owner) => set((s) => {
        if (s.players.some((p) => p.isOwner)) return s;
        return {
          players: [
            {
              ...owner, key: nextKey(), caddie: null, isOwner: true,
              price: 0, tariffId: '', prestationId: '', multiCriteria: '',
            },
            ...s.players,
          ],
        };
      }),

      addPlayer: (player) => set((s) => {
        // Capacite d un depart : 4 joueurs (max WinDev). La limite fine du
        // club (maxPlayers) est appliquee cote UI, avant l ouverture de la feuille.
        if (s.players.length >= 4) return s;
        // Doublon : par licence, mais aussi par nom+prenom -- un invite
        // (sans licence) portant deja ce nom doit bloquer l ajout du membre.
        const already = s.players.some(
          (p) => (p.licence !== '' && p.licence === player.licence)
            || nameKey(p.fullName) === nameKey(player.fullName),
        );
        if (already) return s;
        return {
          players: [...s.players, {
            key: nextKey(),
            licence: player.licence,
            paxId: player.paxId,
            title: player.title,
            lastName: player.lastName,
            firstName: player.firstName,
            fullName: player.fullName,
            email: player.email,
            index: player.index,
            nationality: player.nationality,
            advantage: player.advantage,
            clubId: player.clubId,
            caddie: null,
            isOwner: false,
            price: 0, tariffId: '', prestationId: '', multiCriteria: '',
          }],
        };
      }),

      addGuest: (guest) => set((s) => {
        // Capacite d un depart : 4 joueurs (max WinDev). La limite fine du
        // club (maxPlayers) est appliquee cote UI, avant l ouverture de la feuille.
        if (s.players.length >= 4) return s;
        const fullName = `${guest.lastName} ${guest.firstName}`.trim();
        // Filet anti-doublon : un invite n a pas de licence, on compare le nom.
        if (s.players.some((p) => nameKey(p.fullName) === nameKey(fullName))) return s;
        return {
          players: [...s.players, {
            key: nextKey(),
            licence: '',
            paxId: '',
            title: guest.civility,
            lastName: guest.lastName,
            firstName: guest.firstName,
            fullName,
            email: guest.email,
            index: guest.index,
            nationality: guest.country,
            advantage: guest.advantage,
            clubId: s.clubId ?? '',
            caddie: null,
            isOwner: false,
            price: 0, tariffId: '', prestationId: '', multiCriteria: '',
          }],
        };
      }),

      removePlayer: (key) => set((s) => ({
        players: s.players.filter((p) => p.key !== key || p.isOwner),
      })),

      setCaddie: (key, caddie) => set((s) => ({
        players: s.players.map((p) => (p.key === key ? { ...p, caddie } : p)),
      })),

      // Evite un rendu quand le tarif renvoye est identique au precedent.
      setPlayerTariff: (key, tarif) => set((s) => {
        const joueur = s.players.find((p) => p.key === key);
        if (!joueur || (joueur.price === tarif.price
          && joueur.tariffId === tarif.tariffId
          && joueur.prestationId === tarif.prestationId)) return s;
        return {
          players: s.players.map((p) => (p.key === key ? { ...p, ...tarif } : p)),
        };
      }),

      setPrestationQuantity: (prestation, quantity) => set((s) => {
        const rest = s.prestations.filter((p) => p.prestation.id !== prestation.id);
        return quantity <= 0 ? { prestations: rest }
          : { prestations: [...rest, { prestation, quantity }] };
      }),

      setNote: (note) => set({ note }),
      setPayOnline: (payOnline) => set({ payOnline }),

      total: () => get().prestations.reduce(
        (sum, p) => sum + p.prestation.price * p.quantity, 0,
      ),

      reset: () => set({ ...empty }),
      resetSelection: () => set({
        slot: null, players: [], prestations: [], note: '', payOnline: false,
      }),
    }),
    {
      name: 'golf-booking-draft',
      storage: {
        getItem: (name) => {
          try {
            const raw = sessionStorage.getItem(name);
            return raw ? JSON.parse(raw) : null;
          } catch { return null; }
        },
        setItem: (name, value) => {
          try { sessionStorage.setItem(name, JSON.stringify(value)); } catch { /* quota */ }
        },
        removeItem: (name) => {
          try { sessionStorage.removeItem(name); } catch { /* ignore */ }
        },
      },
      // Seules les donnees du brouillon sont persistees, jamais les actions.
      partialize: (s): Partial<BookingStore> => ({
        clubId: s.clubId, clubName: s.clubName,
        clubPlayerType: s.clubPlayerType, clubPlayerId: s.clubPlayerId,
        visitorAdvantage: s.visitorAdvantage,
        date: s.date, holes: s.holes,
        playerCount: s.playerCount, courseOutId: s.courseOutId,
        courseBackId: s.courseBackId, courseName: s.courseName,
        period: s.period, timeFrom: s.timeFrom, timeTo: s.timeTo, slot: s.slot,
        players: s.players, prestations: s.prestations,
        note: s.note, payOnline: s.payOnline,
      }),
      // A la rehydratation, on dedoublonne les joueurs : par licence pour les
      // membres/licencies, par nom+prenom pour les invites (sans licence).
      // Resorbe aussi les doublons crees avant l ajout du garde.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<BookingStore>;
        const merged = { ...current, ...p };
        const licencesVues = new Set<string>();
        const nomsVus = new Set<string>();
        merged.players = (merged.players ?? []).filter((pl) => {
          const nk = nameKey(pl.fullName);
          const lk = pl.licence ? `l:${pl.licence}` : '';
          if ((lk && licencesVues.has(lk)) || nomsVus.has(nk)) return false;
          if (lk) licencesVues.add(lk);
          nomsVus.add(nk);
          return true;
        });
        return merged;
      },
    },
  ),
);
