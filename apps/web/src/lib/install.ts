import { useEffect, useReducer } from 'react';

/**
 * Installation de la PWA.
 *
 * - Android/Chrome : l evenement `beforeinstallprompt` est capte tot et mis de
 *   cote ; on declenche le vrai prompt natif au clic.
 * - iOS/Safari : aucun prompt natif possible -> on montre des instructions
 *   (Partager -> Sur l ecran d accueil).
 * - Deja installee (mode standalone) : plus rien a proposer.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
function emit(): void { listeners.forEach((l) => l()); }

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // On empeche la mini-infobar Chrome pour piloter l invite nous-memes.
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    emit();
  });
}

/** L app tourne-t-elle deja en mode installe (standalone) ? */
export function isStandalone(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

/** Appareil iOS (iPhone/iPad, y compris iPadOS qui se fait passer pour Mac). */
export function isIOS(): boolean {
  try {
    const ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  } catch {
    return false;
  }
}

/** Appareil mobile (tactile) ? Sert a adapter le libelle (ecran d accueil vs bureau). */
export function isMobileDevice(): boolean {
  try {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      || navigator.maxTouchPoints > 1;
  } catch {
    return false;
  }
}

/** Declenche le prompt natif (Android). Renvoie l issue. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  await deferred.prompt();
  const choice = await deferred.userChoice;
  deferred = null;
  emit();
  return choice.outcome;
}

export interface InstallState {
  /** Faut-il proposer l installation ? (pas installee, et installable) */
  canInstall: boolean;
  installed: boolean;
  ios: boolean;
  /** Un prompt natif Android est-il disponible ? */
  hasNativePrompt: boolean;
}

/** Etat d installation, reactif aux evenements navigateur. */
export function useInstall(): InstallState {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.add(force);
    return () => { listeners.delete(force); };
  }, []);

  const installed = isStandalone();
  const ios = isIOS();
  // Android : installable si un prompt a ete capte. iOS : toujours "installable"
  // manuellement tant qu on n est pas deja en standalone.
  const canInstall = !installed && (deferred !== null || ios);
  return { canInstall, installed, ios, hasNativePrompt: deferred !== null };
}
