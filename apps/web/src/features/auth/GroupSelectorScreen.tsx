import { groupList, themeForGroup } from '@/theme/groups';
import { chooseGroup } from '@/lib/group';

/**
 * Selecteur de groupe (portail multi-groupes).
 *
 * Affiche quand aucun groupe n est resolu depuis l URL ni le sous-domaine
 * (`?grp=ALL` ou domaine nu). Le clic fixe le groupe (`?grp=`) et entre dans
 * l application (ecran de connexion du groupe choisi).
 */
export function GroupSelectorScreen({ onPicked }: { onPicked: () => void }) {
  const groups = groupList();

  function pick(id: string): void {
    chooseGroup(id);
    onPicked();
  }

  return (
    <div className="min-h-dvh bg-[var(--color-canvas)]">
      <div className="mx-auto w-full max-w-lg px-5 pt-[calc(2rem+var(--safe-top))] pb-[calc(2rem+var(--safe-bottom))]">
        <header className="mb-7">
          <p className="text-[0.7rem] font-semibold tracking-[0.16em] text-[var(--color-ink-faint)] uppercase">
            Espace membres
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Choisissez votre groupe
          </h1>
          <p className="mt-1.5 text-sm text-[var(--color-ink-soft)]">
            Sélectionnez le groupe de golf dont vous êtes adhérent.
          </p>
        </header>

        <ul className="grid grid-cols-2 gap-3">
          {groups.map((g) => {
            const t = themeForGroup(g.id);
            return (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => pick(g.id)}
                  className="flex h-full w-full flex-col items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-center transition-transform active:scale-[0.98]"
                >
                  <span
                    className="grid h-16 w-full place-items-center rounded-xl"
                    style={{ backgroundColor: `${t.brand}12` }}
                  >
                    {g.logo ? (
                      <img
                        src={g.logo}
                        alt=""
                        className="max-h-10 max-w-[82%] object-contain"
                      />
                    ) : (
                      <span className="text-lg font-semibold" style={{ color: t.brand }}>
                        {g.label.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="text-sm leading-tight font-medium">{g.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
