import { readGroupFromPath } from '@/lib/group';
import { themeForGroup } from '@/theme/groups';

/**
 * Splash de demarrage INTERNE a l app.
 *
 * Le fond utilise `--color-brand`, c est-a-dire le theme REELLEMENT applique
 * (defaut + override choisi par l adherent) : contrairement au splash natif
 * Android (fige au moment de l install par le manifeste), celui-ci suit la
 * couleur choisie par l utilisateur, et marche aussi dans le navigateur.
 *
 * Affiche uniquement aux instants de boot (resolution du groupe + reouverture
 * de session, garde d auth initiale) -- pas pendant les navigations internes,
 * qui gardent le squelette. Isole : un seul composant.
 */
export function SplashScreen() {
  const group = readGroupFromPath();
  const logo = group ? themeForGroup(group).logo : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-brand)] px-8">
      {logo ? (
        // Les logos sont concus pour un fond clair -> tuile blanche, comme le
        // splash natif et l ecran de connexion.
        <span className="inline-flex items-center justify-center rounded-3xl bg-white p-6 shadow-lg">
          <img
            src={logo}
            alt=""
            className="max-h-24 w-auto max-w-[60vw] object-contain"
          />
        </span>
      ) : (
        <span className="size-16 rounded-2xl bg-white/12" />
      )}
    </div>
  );
}
