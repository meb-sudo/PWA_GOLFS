import {
  useQuery, useMutation, useQueryClient, type UseQueryOptions,
} from '@tanstack/react-query';
import type {
  Member, ClubInfo, Availability, Prestation, Caddie, ClubPlayer,
  Reservation, ReservationDetail, CompetitionClub, NewsItem,
  NotificationItem, Carnet, Country, LegalInfo, BookingInput,
} from '@golf/contracts';
import { api } from './api.js';

export const keys = {
  context: ['context'] as const,
  me: ['me'] as const,
  clubs: ['clubs'] as const,
  clubInfo: (club: string, date: string) => ['clubInfo', club, date] as const,
  availability: (club: string, q: Record<string, unknown>) =>
    ['availability', club, q] as const,
  prestations: (club: string) => ['prestations', club] as const,
  caddies: (club: string, date: string) => ['caddies', club, date] as const,
  reservations: ['reservations'] as const,
  reservation: (id: string, club: string) => ['reservation', id, club] as const,
  competitions: (date: string) => ['competitions', date] as const,
  news: (club?: string) => ['news', club ?? 'home'] as const,
  notifications: ['notifications'] as const,
  carnets: (club?: string) => ['carnets', club ?? 'home'] as const,
  countries: ['countries'] as const,
  legal: ['legal'] as const,
};

// --- session ---------------------------------------------------------------

export interface MeResponse {
  member: Member;
  group: string;
  /** Palette a appliquer : peut differer du groupe. */
  theme: string;
}

export function useMe(options?: Partial<UseQueryOptions<MeResponse>>) {
  return useQuery({
    queryKey: keys.me,
    queryFn: () => api<MeResponse>('/auth/me'),
    retry: false,
    staleTime: 5 * 60_000,
    ...options,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ status: string }>('/auth/logout', { method: 'POST' }),
    onSuccess: () => qc.clear(),
  });
}

// --- referentiel -----------------------------------------------------------

export interface ClubRow {
  clubId: string;
  name: string;
  region: string;
  /** sJoueur_A_V : A = abonne sur ce club, sinon visiteur. */
  playerType: string;
  /** sJoueur_ID_AV : identifiant du joueur dans ce club. */
  playerId: string;
  /** Abonne du club : reservation couverte par l abonnement. */
  isMember: boolean;
  bookable: boolean;
  /** "group" = club du groupe, "other" = club hors groupe. */
  scope: 'group' | 'other';
}

export function useClubs() {
  return useQuery({
    queryKey: keys.clubs,
    queryFn: () => api<{ clubs: ClubRow[]; homeClubId: string }>('/clubs'),
    staleTime: 10 * 60_000,
  });
}

export function useClubInfo(clubId: string | undefined, date: string) {
  return useQuery({
    queryKey: keys.clubInfo(clubId ?? '', date),
    queryFn: () => api<ClubInfo>(`/clubs/${clubId}/info`, { query: { date } }),
    enabled: Boolean(clubId),
    staleTime: 5 * 60_000,
  });
}

export function useCountries() {
  return useQuery({
    queryKey: keys.countries,
    queryFn: () => api<Country[]>('/reference/countries'),
    staleTime: 24 * 60 * 60_000,
  });
}

/** Meteo (prevision) du jour de jeu pour un club. */
export interface DayWeather {
  date: string;
  code: number;
  condition: string;
  icon: string;
  tempMax: number;
  tempMin: number;
  rainProbability: number;
  windMax: number;
}

/**
 * Photo du club (data URI) pour la page "Les clubs" uniquement.
 * Appelle un endpoint dedie (mode V cote amont) ; ne change rien ailleurs.
 */
export function useClubPhoto(clubId: string | undefined) {
  return useQuery({
    queryKey: ['club-photo', clubId ?? ''],
    queryFn: () => api<{ image: string | null }>(`/clubs/${clubId}/photo`),
    enabled: Boolean(clubId),
    staleTime: 30 * 60_000,
    retry: false,
  });
}

/** Coordonnees GPS des clubs du groupe (carte de l accueil). */
export interface ClubGeo {
  clubId: string; name: string; lat: number; lng: number; home: boolean;
}
export function useClubsGeo() {
  return useQuery({
    queryKey: ['clubs-geo'],
    queryFn: () => api<{ clubs: ClubGeo[] }>('/clubs/geo'),
    staleTime: 30 * 60_000,
    retry: false,
  });
}

/** Prevision meteo d un club a une date ISO. Silencieuse si indisponible. */
export function useWeather(clubId: string | undefined | null, date: string | null) {
  return useQuery({
    queryKey: ['weather', clubId ?? '', date ?? ''],
    queryFn: () => api<{ weather: DayWeather | null }>(
      `/clubs/${clubId}/weather`, { query: { date: date! } },
    ),
    enabled: Boolean(clubId && date),
    staleTime: 30 * 60_000,
    retry: false,
  });
}

export function useLegal() {
  return useQuery({
    queryKey: keys.legal,
    queryFn: () => api<LegalInfo>('/legal'),
    staleTime: 60 * 60_000,
  });
}

// --- reservation -----------------------------------------------------------

export interface AvailabilityParams {
  [key: string]: string | number;
  date: string; courseOutId: string; courseBackId: string;
  players: number; holes: 9 | 18; timeFrom: string; timeTo: string;
  departuresToShow: number;
}

export function useAvailability(clubId: string | undefined, params: AvailabilityParams | null) {
  return useQuery({
    queryKey: keys.availability(clubId ?? '', params ?? {}),
    queryFn: () => api<Availability>(`/clubs/${clubId}/availability`, {
      query: params ?? undefined,
    }),
    enabled: Boolean(clubId && params),
    // Les creneaux bougent en continu : jamais de donnee perimee affichee.
    staleTime: 0,
    gcTime: 60_000,
  });
}

export function usePrestations(clubId: string | undefined) {
  return useQuery({
    queryKey: keys.prestations(clubId ?? ''),
    queryFn: () => api<Prestation[]>(`/clubs/${clubId}/prestations`),
    enabled: Boolean(clubId),
    staleTime: 5 * 60_000,
  });
}

export function useCaddies(clubId: string | undefined, date: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.caddies(clubId ?? '', date),
    queryFn: () => api<Caddie[]>(`/clubs/${clubId}/caddies`, { query: { date } }),
    enabled: Boolean(clubId) && enabled,
    staleTime: 5 * 60_000,
  });
}

export function usePlayerSearch(clubId: string | undefined) {
  return useMutation({
    mutationFn: (input: {
      lastName: string; firstName: string; licence?: string; scope: 'club' | 'licensees';
    }) =>
      api<{ players: ClubPlayer[] }>(`/clubs/${clubId}/players/search`, {
        method: 'POST', body: input,
      }),
  });
}

export function useCheckPlayers() {
  return useMutation({
    mutationFn: (body: unknown) =>
      api<{ status: string }>('/booking/check-players', { method: 'POST', body }),
  });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BookingInput) =>
      api<{ status: string; reference: string; paymentUrl: string | null }>(
        '/booking', { method: 'POST', body },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.reservations }),
  });
}

// --- mes reservations ------------------------------------------------------

export function useReservations() {
  return useQuery({
    queryKey: keys.reservations,
    queryFn: () => api<{ reservations: Reservation[] }>('/reservations'),
    staleTime: 60_000,
  });
}

export function useReservation(id: string | undefined, clubId: string | undefined) {
  return useQuery({
    queryKey: keys.reservation(id ?? '', clubId ?? ''),
    queryFn: () => api<{
      reservation: Reservation;
      detail: ReservationDetail;
      players: Array<{ departureIdName: string; fullName: string; licence: string }>;
    }>(`/reservations/${id}`, { query: { club: clubId } }),
    enabled: Boolean(id && clubId),
  });
}

export function useCancelReservation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { note: string }) =>
      api<{ status: string }>(`/reservations/${id}/cancel`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.reservations }),
  });
}

export function useChangeTime(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) =>
      api<{ status: string }>(`/reservations/${id}/time`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.reservations }),
  });
}

export function useAddPlayers(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) =>
      api<{ status: string }>(`/reservations/${id}/players`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.reservations }),
  });
}

export function useRemovePlayer(id: string, clubId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (departureIdName: string) =>
      api<{ status: string }>(
        `/reservations/${id}/players/${encodeURIComponent(departureIdName)}`,
        { method: 'DELETE', query: { club: clubId } },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.reservations }),
  });
}

// --- competitions ----------------------------------------------------------

export function useCompetitions(date: string) {
  return useQuery({
    queryKey: keys.competitions(date),
    queryFn: () => api<{ clubs: CompetitionClub[] }>('/competitions', { query: { date } }),
    staleTime: 5 * 60_000,
  });
}

export function useRegisterCompetition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { competitionClubId: string; competitionId: string; serieId: string }) =>
      api<{ status: string; paymentUrl: string | null }>(
        '/competitions/register', { method: 'POST', body },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competitions'] }),
  });
}

export function useUnregisterCompetition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      competitionClubId: string; competitionId: string; serieId: string; reason: string;
    }) => api<{ status: string }>('/competitions/unregister', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competitions'] }),
  });
}

// --- contenus --------------------------------------------------------------

export function useNews(clubId?: string) {
  return useQuery({
    queryKey: keys.news(clubId),
    queryFn: () => api<{ news: NewsItem[] }>('/news', { query: { club: clubId } }),
    staleTime: 5 * 60_000,
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: keys.notifications,
    queryFn: () => api<{ notifications: NotificationItem[] }>('/notifications'),
    staleTime: 60_000,
  });
}

export function useCarnets(clubId?: string) {
  return useQuery({
    queryKey: keys.carnets(clubId),
    queryFn: () => api<{ carnets: Carnet[] }>('/carnets', { query: { club: clubId } }),
    staleTime: 5 * 60_000,
  });
}

// --- profil ----------------------------------------------------------------

export function useUpdateEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string }) =>
      api<{ status: string; email: string }>('/profile/email', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.me }),
  });
}

export function useUpdateMobile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { mobile: string }) =>
      api<{ status: string; mobile: string }>('/profile/mobile', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.me }),
  });
}

/**
 * Nom lisible d un club a partir de son identifiant.
 *
 * strucMembre_Login.sClub porte l identifiant ("50034"), pas un libelle :
 * on va chercher le vrai nom dans la liste des clubs du groupe.
 */
export function useClubName(clubId: string | undefined): string {
  const { data } = useClubs();
  if (!clubId) return '';
  const match = data?.clubs.find((c) => c.clubId === clubId);
  return match?.name ?? '';
}

export interface AppContext {
  group: string;
  theme: string;
  /** Le host est-il un sous-domaine dedie a un groupe ? (portail vs direct) */
  hostMapped?: boolean;
}

const CONTEXT_CACHE = 'golf-brand';

/** Dernier contexte connu, pour afficher la marque sans attendre le reseau. */
function readCachedContext(): AppContext | undefined {
  try {
    const raw = localStorage.getItem(CONTEXT_CACHE);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as AppContext;
    return parsed.group ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function writeCachedContext(ctx: AppContext): void {
  try {
    localStorage.setItem(CONTEXT_CACHE, JSON.stringify(ctx));
  } catch {
    // Navigation privee ou quota : la marque sera simplement rechargee.
  }
}

/**
 * Contexte de marque, disponible sans session.
 *
 * Utilise par la page de connexion, qui ne peut pas appeler /auth/me.
 * Le dernier contexte connu sert de valeur initiale : le logo s affiche
 * immediatement et survit a une indisponibilite passagere du BFF, au lieu
 * de retomber sur l icone generique.
 */
export function useAppContext() {
  return useQuery({
    queryKey: keys.context,
    queryFn: async () => {
      const ctx = await api<AppContext>('/context');
      writeCachedContext(ctx);
      return ctx;
    },
    placeholderData: readCachedContext,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

/**
 * Clubs du groupe courant, sans session (route publique /api/group-clubs).
 * Utilise par "Mes identifiants" : selection auto si un seul club, sinon menu
 * par nom dont la valeur reste le numero de club.
 */
export function useGroupClubs() {
  return useQuery({
    queryKey: ['group-clubs'],
    queryFn: () => api<{ clubs: Array<{ clubId: string; name: string }> }>('/group-clubs'),
    staleTime: 10 * 60_000,
  });
}
