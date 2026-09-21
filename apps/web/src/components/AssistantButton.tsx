import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '@/lib/api';
import { useClubs, useMe } from '@/lib/queries';
import { useBooking } from '@/features/reservation/store';
import { Button } from '@/components/ui';
import { IconClose, IconChevron } from '@/components/icons';
import { useT, useLang } from '@/i18n';
import type { TKey } from '@/i18n/dict';

/**
 * Assistant IA (Gemini), a la place de l ancien bouton d aide.
 *
 * Le front ne parle qu au BFF (/api/assistant) ; la cle Gemini reste cote
 * serveur. L assistant repond a partir des vraies donnees de l adherent et
 * peut PREPARER une reservation (brouillon) que l adherent confirme lui-meme.
 */

interface PrepareAction {
  club?: string;
  date?: string;
  trous?: number;
  joueurs?: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  action?: PrepareAction | null;
}

/**
 * Menu de raccourcis affiche sous le message d accueil : un simple clic envoie
 * la question a l assistant, sans avoir a la taper. Disparait des que la
 * conversation demarre pour ne pas encombrer.
 *
 * Le libelle ET le prompt envoye suivent la langue de l app (promptKey), pour
 * que l assistant reponde dans la meme langue que le bouton clique.
 */
const QUICK_ACTIONS: { labelKey: TKey; promptKey: TKey }[] = [
  { labelKey: 'assistant.qaBook', promptKey: 'assistant.qaBookPrompt' },
  { labelKey: 'assistant.qaAvailability', promptKey: 'assistant.qaAvailabilityPrompt' },
  { labelKey: 'assistant.qaNextDepartures', promptKey: 'assistant.qaNextDeparturesPrompt' },
  { labelKey: 'assistant.qaWherePlay', promptKey: 'assistant.qaWherePlayPrompt' },
  { labelKey: 'assistant.qaCarnets', promptKey: 'assistant.qaCarnetsPrompt' },
  { labelKey: 'assistant.qaNews', promptKey: 'assistant.qaNewsPrompt' },
  { labelKey: 'assistant.qaInfo', promptKey: 'assistant.qaInfoPrompt' },
];

export function AssistantButton() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);

  // L assistant n apparait que si le BFF a une cle Gemini configuree.
  useEffect(() => {
    let cancel = false;
    api<{ enabled: boolean }>('/assistant/status')
      .then((r) => { if (!cancel) setEnabled(r.enabled); })
      .catch(() => {});
    return () => { cancel = true; };
  }, []);

  if (!enabled) return null;

  return (
    <>
      {/*
        Conteneur cale sur le MEME cadre que l app (max-w-lg centre) : le bouton
        reste ainsi a l interieur de l app, pas dans la marge de l ecran sur
        tablette/desktop. pointer-events-none sur le cadre pour ne pas bloquer le
        contenu derriere ; pointer-events-auto sur le bouton seul.
      */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+var(--safe-bottom))] z-30 mx-auto flex max-w-lg justify-end px-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Assistant"
          className="pointer-events-auto flex items-center gap-2 rounded-full bg-[var(--color-brand)] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(19,26,21,0.28)] active:scale-[0.97]"
        >
          <SparkIcon />
          Assistant
        </button>
      </div>

      <AnimatePresence>
        {open && <ChatPanel onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const navigate = useNavigate();
  const clubs = useClubs();
  const { data: me } = useMe();
  const firstName = me?.member?.firstName?.trim() || '';
  const setClub = useBooking((s) => s.setClub);
  const setDate = useBooking((s) => s.setDate);
  const setHoles = useBooking((s) => s.setHoles);

  // Le message d accueil n est pas stocke dans la conversation : il est rendu a
  // part (avec le prenom) et n est donc jamais envoye a l API.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  async function send(preset?: string): Promise<void> {
    const text = (preset ?? input).trim();
    if (!text || busy) return;
    const history = [...messages, { role: 'user', text } as ChatMessage];
    setMessages(history);
    setInput('');
    setBusy(true);
    try {
      const payload = history.map((m) => ({ role: m.role, text: m.text }));
      const res = await api<{ reply: string; action: PrepareAction | null }>(
        '/assistant', { method: 'POST', body: { messages: payload, lang } },
      );
      setMessages((prev) => [...prev, { role: 'assistant', text: res.reply, action: res.action }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        text: t('assistant.error'),
      }]);
    } finally {
      setBusy(false);
    }
  }

  /** Applique le brouillon propose : club (si reconnu) + date + trous, puis /reserver. */
  function prepare(action: PrepareAction): void {
    if (action.trous === 9 || action.trous === 18) setHoles(action.trous);
    if (action.date && /^\d{4}-\d{2}-\d{2}$/.test(action.date)) setDate(action.date);
    if (action.club) {
      // Le modele passe normalement le NOM du club, mais il lui arrive de
      // renvoyer son identifiant : on tente donc l egalite d ID d abord, puis
      // le rapprochement par nom (dans les deux sens, casse ignoree).
      const wanted = String(action.club).trim().toLowerCase();
      const list = clubs.data?.clubs ?? [];
      const match = list.find((c) => c.clubId === action.club)
        ?? list.find((c) => {
          const name = c.name.toLowerCase();
          return name.includes(wanted) || wanted.includes(name);
        });
      if (match) {
        setClub({ clubId: match.clubId, name: match.name, playerType: match.playerType, playerId: match.playerId });
      }
    }
    onClose();
    navigate('/reserver');
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-[var(--color-canvas)]"
      role="dialog" aria-modal="true" aria-label="Assistant"
    >
      <header className="flex items-center gap-3 border-b border-[var(--color-line)] px-4 py-3 pt-[calc(0.75rem+var(--safe-top))]">
        <span className="grid size-9 place-items-center rounded-full bg-[var(--color-brand)] text-white">
          <SparkIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">Assistant</p>
          <p className="text-xs text-[var(--color-ink-faint)]">{t('assistant.subtitle')}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={t('common.close')} className="grid size-9 place-items-center rounded-full active:bg-[var(--color-surface-alt)]">
          <IconClose width={20} height={20} />
        </button>
      </header>

      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <div className="flex justify-start">
          <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm">
            {t('assistant.welcome', { name: firstName ? `${firstName} ` : '' })}
          </div>
        </div>
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={[
                'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm',
                m.role === 'user'
                  ? 'bg-[var(--color-brand)] text-white'
                  : 'bg-[var(--color-surface)] border border-[var(--color-line)]',
              ].join(' ')}
            >
              {renderRich(m.text)}
              {m.action && (
                <button
                  type="button"
                  onClick={() => prepare(m.action!)}
                  className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-[var(--color-accent-ink)]"
                >
                  {t('assistant.prepare')} <IconChevron width={15} height={15} />
                </button>
              )}
            </div>
          </div>
        ))}
        {messages.length === 0 && !busy && (
          <div className="flex flex-col items-start gap-2 pt-1">
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.labelKey}
                type="button"
                onClick={() => void send(t(a.promptKey))}
                className="rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-2 text-sm font-medium text-[var(--color-ink)] active:scale-[0.97]"
              >
                {t(a.labelKey)}
              </button>
            ))}
          </div>
        )}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-ink-faint)]">
              {t('assistant.thinking')}
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void send(); }}
        className="flex items-center gap-2 border-t border-[var(--color-line)] px-3 py-3 pb-[calc(0.75rem+var(--safe-bottom))]"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('assistant.placeholder')}
          className="min-w-0 flex-1 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-brand)]"
        />
        <Button type="submit" disabled={!input.trim() || busy}>{t('common.send')}</Button>
      </form>
    </motion.div>
  );
}

/**
 * Rendu minimal du **gras** Markdown que le modele produit souvent, sans
 * librairie ni HTML brut (donc sans risque d injection) : on decoupe le texte
 * sur les segments **...** et on les passe en <strong>. Les retours a la ligne
 * restent geres par `whitespace-pre-wrap` sur la bulle.
 */
function renderRich(text: string) {
  // Puces Markdown en debut de ligne ("* " / "- ") -> "• " (le "* " du gras,
  // colle a son mot, n est pas concerne car il n est pas suivi d un espace).
  const clean = text.replace(/^[ \t]*[*-][ \t]+/gm, '• ');
  return clean.split(/(\*\*[^*]+\*\*)/g).map((seg, i) => {
    const bold = /^\*\*([^*]+)\*\*$/.exec(seg);
    return bold ? <strong key={i}>{bold[1]}</strong> : <span key={i}>{seg}</span>;
  });
}

/** Petite etincelle "IA". */
function SparkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z"
        fill="currentColor"
      />
      <circle cx="18" cy="17" r="1.4" fill="currentColor" />
    </svg>
  );
}
