import type { ZodTypeAny, z } from 'zod';
import { config } from '../config.js';

/**
 * Client des API amont.
 *
 * Absorbe les conventions WinDev pour que le reste du BFF, et donc la PWA,
 * n ait jamais a les connaitre :
 *   - HTTPS force (constat C-04 : le port 80 amont sert en clair)
 *   - sMessage traduit en vraie erreur (constat : 200 systematique)
 *   - messages internes jamais propages (constat M-08)
 *   - encodage strict des segments d URL positionnels
 */

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly endpoint: string,
    readonly upstreamMessage?: string,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

export class ReadOnlyError extends Error {
  constructor(readonly endpoint: string) {
    super(
      'Le BFF est en mode lecture seule : cet appel modifierait des donnees reelles. ' +
        'Passez READ_ONLY=false une fois un environnement de recette confirmé.',
    );
    this.name = 'ReadOnlyError';
  }
}

/** Encode un segment de chemin. Les parametres sont positionnels cote amont. */
export function seg(value: string | number): string {
  return encodeURIComponent(String(value));
}

function assertHttps(url: string): string {
  if (url.startsWith('http://')) {
    // Ne jamais laisser partir un appel en clair, meme si la config le demande.
    return `https://${url.slice('http://'.length)}`;
  }
  return url;
}

interface CallOptions {
  /** Nom lisible de l endpoint, utilise dans les journaux et les erreurs. */
  endpoint: string;
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  /** Marque l appel comme ecrivant : bloque si READ_ONLY est actif. */
  writes?: boolean;
  signal?: AbortSignal;
}

async function rawCall(url: string, opts: CallOptions): Promise<Response> {
  if (opts.writes && config.readOnly) throw new ReadOnlyError(opts.endpoint);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.upstreamTimeoutMs);
  if (opts.signal) {
    opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    return await fetch(assertHttps(url), {
      method: opts.method ?? 'GET',
      headers: opts.body != null ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new UpstreamError(
        'Le service de réservation ne repond pas. Reessayez dans un instant.',
        504, opts.endpoint,
      );
    }
    throw new UpstreamError(
      'Le service de réservation est injoignable.',
      502, opts.endpoint,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Appel JSON valide par un schema Zod. */
export async function callJson<S extends ZodTypeAny>(
  url: string,
  schema: S,
  opts: CallOptions,
): Promise<z.infer<S>> {
  const res = await rawCall(url, opts);

  if (!res.ok) {
    throw new UpstreamError(
      'Le service de réservation a renvoye une reponse inattendue.',
      res.status === 404 ? 502 : 502,
      opts.endpoint,
    );
  }

  const text = await res.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new UpstreamError(
      'Reponse illisible du service de réservation.',
      502, opts.endpoint,
    );
  }

  // L amont signale ses erreurs applicatives dans le corps, en HTTP 200.
  const fault = extractFault(payload);
  if (fault) {
    throw new UpstreamError(
      'Le service de réservation a rejete la demande.',
      502, opts.endpoint, fault,
    );
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new UpstreamError(
      'Reponse inattendue du service de réservation.',
      502, opts.endpoint, parsed.error.issues[0]?.message,
    );
  }
  return parsed.data;
}

/** Appel binaire (images : badges, logos). */
export async function callBinary(
  url: string,
  opts: CallOptions,
): Promise<{ body: Buffer; contentType: string } | null> {
  const res = await rawCall(url, opts);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) return null;
  return {
    body: buf,
    contentType: res.headers.get('content-type') ?? 'image/png',
  };
}

/**
 * Detecte les erreurs WinDev renvoyees en HTTP 200.
 * Ne remonte jamais le detail : il expose le moteur et les requetes internes.
 */
function extractFault(payload: unknown): string | null {
  if (payload && typeof payload === 'object' && 'fault' in payload) {
    const f = (payload as { fault?: { faultstring?: string } }).fault;
    return f?.faultstring ?? 'fault';
  }
  return null;
}

/**
 * Verifie le champ sMessage des reponses amont.
 * Renvoie le message si c est une erreur metier a montrer a l utilisateur.
 */
export function businessError(message: string | undefined | null): string | null {
  if (!message) return null;
  const m = message.trim();
  if (m === '' || m.toUpperCase() === 'OK') return null;
  // Les messages de panne reseau amont ne sont pas des erreurs metier.
  if (/votre connexion est trop lente/i.test(m)) return null;
  if (/ERREUR EXECUTE REQ|Dump de l erreur|\.dll/i.test(m)) return null;
  return m;
}
