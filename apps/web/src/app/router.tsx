import { lazy, Suspense, useEffect, useState } from 'react';
import {
  createBrowserRouter, Outlet, Navigate, useLocation, useNavigate, RouterProvider,
} from 'react-router-dom';
import { useMe, type AppContext } from '@/lib/queries';
import { api } from '@/lib/api';
import {
  readGrpParam, setCurrentGroup, currentGroupHeader, setManifestForGroup,
  type GroupResolution,
} from '@/lib/group';
import { GroupSelectorScreen } from '@/features/auth/GroupSelectorScreen';
import { InstallBanner } from '@/components/InstallBanner';
import { applyTheme, themeForGroup, defaultTheme, isKnownGroup } from '@/theme/groups';
import { TabBar, AppShell } from '@/components/layout';
import { SkeletonList } from '@/components/ui';

import { LoginScreen } from '@/features/auth/LoginScreen';
import { CodeScreen } from '@/features/auth/CodeScreen';
import { IdentifiersScreen } from '@/features/auth/IdentifiersScreen';
import { HomeScreen } from '@/features/home/HomeScreen';

// Chargement differe des sections secondaires : seul le code de l ecran
// affiche est telecharge, ce qui garde le demarrage rapide sur mobile.
const CriteriaScreen = lazy(() =>
  import('@/features/reservation/CriteriaScreen').then((m) => ({ default: m.CriteriaScreen })));
const SlotsScreen = lazy(() =>
  import('@/features/reservation/SlotsScreen').then((m) => ({ default: m.SlotsScreen })));
const PrestationsScreen = lazy(() =>
  import('@/features/reservation/PrestationsScreen').then((m) => ({ default: m.PrestationsScreen })));
const SummaryScreen = lazy(() =>
  import('@/features/reservation/SummaryScreen').then((m) => ({ default: m.SummaryScreen })));
const ConfirmedScreen = lazy(() =>
  import('@/features/reservation/ConfirmedScreen').then((m) => ({ default: m.ConfirmedScreen })));
const ReservationsScreen = lazy(() =>
  import('@/features/reservations/ReservationsScreen').then((m) => ({ default: m.ReservationsScreen })));
const ReservationDetailScreen = lazy(() =>
  import('@/features/reservations/ReservationDetailScreen').then((m) => ({ default: m.ReservationDetailScreen })));
const CompetitionsScreen = lazy(() =>
  import('@/features/competitions/CompetitionsScreen').then((m) => ({ default: m.CompetitionsScreen })));
const NewsScreen = lazy(() =>
  import('@/features/content/NewsScreens').then((m) => ({ default: m.NewsScreen })));
const NewsDetailScreen = lazy(() =>
  import('@/features/content/NewsScreens').then((m) => ({ default: m.NewsDetailScreen })));
const NotificationsScreen = lazy(() =>
  import('@/features/content/NewsScreens').then((m) => ({ default: m.NotificationsScreen })));
const PaymentScreen = lazy(() =>
  import('@/features/payment/PaymentScreen').then((m) => ({ default: m.PaymentScreen })));
const ProfileScreen = lazy(() =>
  import('@/features/profile/ProfileScreens').then((m) => ({ default: m.ProfileScreen })));
const MemberCardScreen = lazy(() =>
  import('@/features/profile/ProfileScreens').then((m) => ({ default: m.MemberCardScreen })));
const CarnetsScreen = lazy(() =>
  import('@/features/profile/ProfileScreens').then((m) => ({ default: m.CarnetsScreen })));
const MenuScreen = lazy(() =>
  import('@/features/profile/ProfileScreens').then((m) => ({ default: m.MenuScreen })));

function Loading() {
  return (
    <div className="px-4 pt-[calc(1rem+var(--safe-top))]">
      <SkeletonList rows={4} height="h-24" />
    </div>
  );
}

/**
 * Garde d authentification.
 * La session vit dans un cookie httpOnly : l application ne peut pas la
 * lire, elle interroge le BFF. Un 401 renvoie vers la connexion.
 */
function RequireAuth() {
  const location = useLocation();
  const { data, isPending, isError } = useMe();

  // Le theme est decide par le BFF et peut differer du groupe : changer de
  // groupe ne doit pas forcement changer les couleurs.
  useEffect(() => {
    if (data?.theme) applyTheme(themeForGroup(data.theme));
  }, [data?.theme]);

  if (isPending) return <Loading />;
  if (isError || !data) {
    // Sans session on revient a la palette par defaut : une SPA ne rechargeant
    // pas la page, les couleurs du groupe survivraient sinon a la deconnexion.
    applyTheme(defaultTheme);
    return <Navigate to="/connexion" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

/** Ecrans a onglets : accueil, mes departs, actualites, menu. */
function TabbedLayout() {
  return (
    <>
      <AppShell>
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </AppShell>
      <TabBar />
    </>
  );
}

/** Ecrans secondaires : plein ecran, sans barre d onglets. */
function StackLayout() {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg">
      <Suspense fallback={<Loading />}>
        <Outlet />
      </Suspense>
    </div>
  );
}

function PublicLayout() {
  return (
    <Suspense fallback={<Loading />}>
      <Outlet />
    </Suspense>
  );
}

/**
 * Garde le `?grp=` dans l URL a chaque navigation : les redirections et liens
 * internes le perdent sinon. Le groupe reste ainsi toujours visible et
 * partageable dans le lien, et survit a un rechargement.
 */
function GroupUrlKeeper() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const grp = currentGroupHeader();
    if (!grp) return;
    const params = new URLSearchParams(location.search);
    if ((params.get('grp') ?? '').toUpperCase() === grp) return;
    params.set('grp', grp);
    navigate(
      { pathname: location.pathname, search: `?${params.toString()}`, hash: location.hash },
      { replace: true },
    );
  }, [location.pathname, location.search, location.hash, navigate]);
  return null;
}

function RootLayout() {
  return (
    <>
      <GroupUrlKeeper />
      <Outlet />
      <InstallBanner />
    </>
  );
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
  {
    element: <PublicLayout />,
    children: [
      { path: '/connexion', element: <LoginScreen /> },
      { path: '/connexion/code', element: <CodeScreen /> },
      { path: '/connexion/identifiants', element: <IdentifiersScreen /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <TabbedLayout />,
        children: [
          { path: '/', element: <HomeScreen /> },
          { path: '/reservations', element: <ReservationsScreen /> },
          { path: '/actualites', element: <NewsScreen /> },
          { path: '/menu', element: <MenuScreen /> },
        ],
      },
      {
        element: <StackLayout />,
        children: [
          { path: '/reserver', element: <CriteriaScreen /> },
          { path: '/reserver/creneaux', element: <SlotsScreen /> },
          { path: '/reserver/prestations', element: <PrestationsScreen /> },
          { path: '/reserver/recapitulatif', element: <SummaryScreen /> },
          { path: '/reserver/confirmee', element: <ConfirmedScreen /> },
          { path: '/paiement', element: <PaymentScreen /> },
          { path: '/reservations/:id', element: <ReservationDetailScreen /> },
          { path: '/competitions', element: <CompetitionsScreen /> },
          { path: '/actualites/:id', element: <NewsDetailScreen /> },
          { path: '/notifications', element: <NotificationsScreen /> },
          { path: '/profil', element: <ProfileScreen /> },
          { path: '/profil/carte', element: <MemberCardScreen /> },
          { path: '/profil/carnets', element: <CarnetsScreen /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

/**
 * Porte d entree du portail multi-groupes.
 *
 * Decide le groupe AVANT de monter l application :
 *  - `?grp=CLUBS_GRP_XXX` connu -> on entre directement ;
 *  - `?grp=ALL` / domaine nu non mappe -> selecteur de groupe ;
 *  - sous-domaine dedie -> on entre avec le groupe du host (via /api/context).
 * Le theme reste celui du BFF (Prestigia), independant du groupe.
 */
function GroupGate() {
  // Resolution du groupe avant de monter l app (voir plus bas).
  const [state, setState] = useState<GroupResolution>({ kind: 'check' });

  // Manifest PWA = celui du groupe resolu (icone + nom a l installation).
  useEffect(() => {
    if (state.kind === 'ready') setManifestForGroup(state.group);
  }, [state]);

  useEffect(() => {
    if (state.kind !== 'check') return;
    let cancel = false;

    (async () => {
      const grp = readGrpParam();
      // ?grp=ALL : choix explicite -> selecteur.
      if (grp === 'ALL') { if (!cancel) setState({ kind: 'selector' }); return; }
      const target = isKnownGroup(grp) ? grp : '';

      // Pas de groupe dans le lien : le site "nu" montre TOUJOURS le selecteur
      // (sauf sous-domaine dedie). On ne retombe pas sur une session par defaut.
      if (!target) {
        const ctx = await api<AppContext>('/context').catch(() => null);
        if (ctx?.hostMapped && ctx.group) {
          setCurrentGroup(ctx.group);
          if (!cancel) setState({ kind: 'ready', group: ctx.group });
        } else if (!cancel) {
          setState({ kind: 'selector' });
        }
        return;
      }

      // Groupe du lien connu : on fixe l en-tete, puis on (re)ouvre la session
      // sur CE groupe avant le montage. Les cookies etant par groupe, chacun a
      // la sienne ; /auth/me la rouvre silencieusement (cookie "se souvenir"),
      // ce qui evite un ecran "sans club" apres un redeploiement.
      setCurrentGroup(target);
      await api('/auth/me').catch(() => null);
      if (!cancel) setState({ kind: 'ready', group: target });
    })();

    return () => { cancel = true; };
  }, [state.kind]);

  if (state.kind === 'check') return <Loading />;
  if (state.kind === 'selector') {
    // Apres un choix, on repasse par la resolution asynchrone (qui gere le
    // logout si on etait connecte a un autre groupe).
    return <GroupSelectorScreen onPicked={() => setState({ kind: 'check' })} />;
  }
  return <RouterProvider router={router} />;
}

export function AppRouter() {
  return <GroupGate />;
}
