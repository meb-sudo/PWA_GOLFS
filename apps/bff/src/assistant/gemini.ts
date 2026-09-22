import { config } from '../config.js';

/**
 * Client minimal de l API Gemini (generateContent), cote serveur uniquement.
 *
 * La cle vit dans la config (secret) et n atteint jamais le front. On expose
 * juste ce dont l assistant a besoin : envoyer une conversation + des outils
 * (function calling) et recevoir soit du texte, soit un appel d outil.
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  /** Signature interne des modeles "thinking" : on la reexpedie telle quelle. */
  thoughtSignature?: string;
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

/** Declaration d un outil (schema JSON des parametres). */
export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

export interface GeminiResult {
  parts: GeminiPart[];
}

/** L assistant est-il configure (cle presente) ? */
export function geminiEnabled(): boolean {
  return config.gemini.apiKey.length > 0;
}

/** Un appel a Gemini generateContent, avec outils optionnels. */
export async function callGemini(input: {
  system: string;
  contents: GeminiContent[];
  tools?: FunctionDeclaration[];
}): Promise<GeminiResult> {
  if (!geminiEnabled()) throw new Error('gemini_disabled');

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: input.system }] },
    contents: input.contents,
    generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
  };
  if (input.tools?.length) {
    body.tools = [{ functionDeclarations: input.tools }];
  }

  // Modele principal + replis : si Google renvoie 503/429 (surcharge) on tente
  // le modele suivant, transparent pour l adherent.
  const models = [config.gemini.model, ...config.gemini.fallbacks];
  let lastErr: Error = new Error('Gemini indisponible.');

  for (const model of models) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(
        `${BASE}/${model}:generateContent?key=${encodeURIComponent(config.gemini.apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );
      const json = (await res.json().catch(() => null)) as {
        candidates?: { content?: { parts?: GeminiPart[] } }[];
        error?: { message?: string };
      } | null;
      if (res.ok) {
        return { parts: json?.candidates?.[0]?.content?.parts ?? [] };
      }
      lastErr = new Error(json?.error?.message ?? `Gemini a repondu ${res.status}.`);
      // 503 (surcharge) / 429 (quota) / 500 / 404 (modele indispo) : on essaie
      // le modele suivant. 400/401/403 sont definitifs (memes pour tous) : stop.
      const retryable = res.status === 503 || res.status === 429
        || res.status === 500 || res.status === 404;
      if (!retryable) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}
