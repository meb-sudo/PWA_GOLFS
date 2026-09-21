import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sessionOf } from '../session/plugin.js';
import type { Session } from '../session/store.js';
import {
  callGemini, geminiEnabled, type GeminiContent, type GeminiPart,
} from '../assistant/gemini.js';
import { toolDeclarations, runTool } from '../assistant/tools.js';

const JOURS_SEM = [
  'dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi',
];

/** Consignes de l assistant : role, ton, contexte adherent, garde-fous. */
function systemPrompt(s: Session, lang: 'fr' | 'en'): string {
  const m = s.member;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const weekday = JOURS_SEM[now.getDay()];
  return [
    "Tu es l'assistant du golf, integre a l'application de reservation des membres.",
    // Langue de REPONSE : regle FORTE placee en tete ET rappelee en fin de
    // prompt, car le reste des consignes est en francais et biaise le modele.
    'CRITICAL LANGUAGE RULE (overrides everything else): write your ENTIRE reply '
      + 'in the SAME language as the member’s LAST message. If that message is in '
      + 'English, reply 100% in English and translate any French wording coming '
      + 'from the tools (e.g. "tous les jours" -> "every day"). If it is in French, '
      + 'reply 100% in French using "tu" (tutoiement). If the message is truly '
      + `ambiguous (e.g. only a club name), use ${lang === 'en' ? 'English' : 'French'}. `
      + 'Never mix the two languages. Keep it brief, clear, warm and professional.',
    `Nous sommes le ${weekday} ${today}. Adherent connecte : ${m.fullName} `
      + `(licence ${m.licence}), club principal ${m.clubName}.`,
    "Sers-toi des OUTILS pour repondre a partir des VRAIES donnees "
      + '(reservations, carnets, actualites, clubs, infos membre). '
      + "N'invente JAMAIS un chiffre, un tarif, une date, un club ou une "
      + "actualite : appelle l'outil, ou dis clairement que tu n'as pas l'info.",
    'Si un outil renvoie un champ "erreur", dis que tu n as pas pu recuperer '
      + "l'information et propose de reessayer -- ne conclus PAS que l'adherent "
      + "n'a rien (aucune reservation, aucun carnet...).",
    'Pour toute question sur un club precis (trous 9/18, dates ouvertes, nombre '
      + 'de joueurs maximum, avantage, tarif indicatif, annulation), utilise '
      + "l'outil infos_club.",
    "Pour savoir s'il reste de la PLACE / des horaires libres un jour precis "
      + '(departs disponibles), utilise disponibilites. Si des creneaux existent, '
      + "cite quelques horaires libres et propose d'en preparer un ; s'il n'y en a "
      + 'pas, explique-le (raison fournie) et propose une autre date.',
    'Quand on te demande les DATES ou la PERIODE de reservation d un club, donne '
      + 'la periode COMPLETE renvoyee par infos_club (champ periode_reservation : '
      + 'du <debut> AU <fin>) -- jamais une seule date. Ne confonds pas cette '
      + 'periode avec une date de brouillon en cours de conversation.',
    'Les tarifs donnes par infos_club sont INDICATIFS (en MAD) : precise que le '
      + "prix exact se calcule a l'ecran de reservation. N'invente jamais un prix "
      + "qui n'est pas renvoye par l'outil.",
    'RESERVATION : quand l adherent veut jouer, appelle preparer_reservation. '
      + 'Regles des parametres :',
    ' - club : le NOM exact du club (ex. "Akenza"), JAMAIS un identifiant '
      + 'numerique. Si le club n est pas precise, prends son club principal par '
      + 'son nom.',
    ' - date : format AAAA-MM-JJ, calculee a partir d aujourd hui (demain, '
      + 'vendredi prochain, dans 3 jours...). La date que tu ANNONCES dans ta '
      + 'phrase doit etre EXACTEMENT celle passee a l outil.',
    ' - trous : 9 ou 18 (18 par defaut). Ne demande PAS le nombre de joueurs : '
      + "l'adherent ajoute ses joueurs lui-meme a l'ecran.",
    " L'adherent peut reserver dans TOUS les clubs listes par mes_clubs, qu'il y "
      + 'soit ABONNE ou simple VISITEUR. Etre visiteur (non abonne) n empeche '
      + 'JAMAIS de reserver : dans ce cas il joue avec un avantage tarifaire, '
      + 'c est normal -- prepare la reservation comme d habitude.',
    ' Ne refuse un club QUE s il est absent de mes_clubs (club hors reseau). '
      + 'Dans le doute, appelle mes_clubs pour verifier AVANT de refuser ; '
      + 'ne suppose jamais qu un club est indisponible.',
    'preparer_reservation VERIFIE la date (fenetre du club + jours autorises par '
      + 'la formule). Si elle renvoie ok=false, la reservation N EST PAS preparee : '
      + "explique la raison a l'adherent (periode_reservation ou jours_autorises "
      + "fournis) et propose-lui une date valable. Ne dis JAMAIS que c'est pret "
      + 'dans ce cas.',
    "Quand ok=true, precise que l'adherent doit CONFIRMER lui-meme a l'ecran "
      + "(rien n'est reserve automatiquement).",
    'GARDE-FOU ABSOLU : tu ne reserves pas, tu n annules pas et tu ne paies '
      + "JAMAIS toi-meme. Ces actions restent a l'adherent.",
    'Reste dans ton domaine (golf, reservations, compte). Pour une question hors '
      + 'sujet, recentre gentiment en une phrase.',
    // Rappel final de la regle de langue (le modele suit mieux la derniere consigne).
    'FINAL REMINDER: your reply MUST be entirely in the language of the member’s '
      + 'last message (English if they wrote English, French if they wrote French). '
      + 'Do not default to French when the member wrote in English.',
  ].join('\n');
}

export async function assistantRoutes(app: FastifyInstance): Promise<void> {
  /** Le front interroge ceci pour afficher (ou non) le bouton Assistant. */
  app.get('/api/assistant/status', async () => ({ enabled: geminiEnabled() }));

  app.post('/api/assistant', {
    onRequest: [app.requireSession],
    config: { rateLimit: { max: 60, timeWindow: '5 minutes' } },
  }, async (req, reply) => {
    if (!geminiEnabled()) {
      return reply.code(503).send({ error: 'disabled', message: 'Assistant indisponible.' });
    }
    const parsed = z.object({
      messages: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        text: z.string().min(1).max(2000),
      })).min(1).max(30),
      // Langue de reponse souhaitee (front). Optionnel : francais par defaut.
      lang: z.enum(['fr', 'en']).optional(),
    }).safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_input', message: 'Message invalide.' });
    }

    const session = sessionOf(req);
    const system = systemPrompt(session, parsed.data.lang ?? 'fr');
    const contents: GeminiContent[] = parsed.data.messages.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

    let action: Record<string, unknown> | null = null;
    let replyText = '';

    // Boucle outil : le modele peut demander plusieurs lectures avant de repondre.
    for (let step = 0; step < 5; step += 1) {
      let res;
      try {
        res = await callGemini({ system, contents, tools: toolDeclarations });
      } catch (err) {
        req.log.warn({ err }, 'assistant: appel Gemini echoue');
        return reply.code(502).send({
          error: 'assistant_error',
          message: 'L assistant est momentanement indisponible. Reessayez.',
        });
      }

      const calls = res.parts.filter((p) => p.functionCall);
      const text = res.parts.map((p) => p.text ?? '').join('').trim();

      if (calls.length === 0) { replyText = text; break; }
      if (text) replyText = text; // filet si le modele s arrete apres les outils

      // On rejoue le tour du modele tel quel (signatures de reflexion incluses).
      contents.push({ role: 'model', parts: res.parts });

      const responseParts: GeminiPart[] = [];
      for (const p of calls) {
        const fc = p.functionCall!;
        const result = await runTool(session, fc.name, fc.args ?? {});
        // Le brouillon n est arme QUE si preparer_reservation a valide la date
        // (result.ok). Sinon on laisse action a null : le modele relaie l erreur.
        if (fc.name === 'preparer_reservation') {
          const r = result as {
            ok?: boolean; club?: string; date?: string; trous?: number;
          };
          action = r.ok ? { club: r.club, date: r.date, trous: r.trous } : null;
        }
        responseParts.push({
          functionResponse: { name: fc.name, response: result as Record<string, unknown> },
        });
      }
      contents.push({ role: 'user', parts: responseParts });
    }

    return {
      reply: replyText || 'Je n ai pas de reponse pour le moment. Peux-tu reformuler ?',
      action,
    };
  });
}
