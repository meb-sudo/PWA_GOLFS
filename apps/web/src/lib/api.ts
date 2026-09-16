/**
 * Client HTTP de la PWA.
 *
 * N appelle que la propre origine de l application, jamais les API amont :
 * c est ce qui rend le probleme CORS sans objet et garde la session dans
 * un cookie httpOnly inaccessible au JavaScript.
 */

import { currentGroupHeader } from './group';

const BASE = import.meta.env.VITE_API_BASE ?? '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isUnauthenticated(): boolean {
    return this.status === 401 && this.code === 'unauthenticated';
  }
  get isOffline(): boolean {
    return this.status === 0;
  }
  get isReadOnly(): boolean {
    return this.code === 'read_only';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  query?: Record<string, string | number | boolean | undefined>;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${BASE}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    const headers: Record<string, string> = {};
    if (opts.body != null) headers['Content-Type'] = 'application/json';
    // Portail multi-groupes : indique au BFF le groupe choisi (avant session).
    const grp = currentGroupHeader();
    if (grp) headers['X-Golf-Group'] = grp;
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET',
      credentials: 'same-origin',
      headers,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch {
    throw new ApiError(
      'Connexion indisponible. Vérifiez votre reseau.',
      0, 'offline',
    );
  }

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    if (!res.ok) {
      throw new ApiError('Une erreur est survenue.', res.status, 'unknown');
    }
    return undefined as T;
  }

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    const message = typeof payload?.message === 'string'
      ? payload.message
      : 'Une erreur est survenue.';
    throw new ApiError(message, res.status, payload?.error ?? 'unknown');
  }

  return payload as T;
}

/**
 * URL d une image servie par le BFF (proxy et cache des visuels amont).
 *
 * Une balise <img> ne peut pas porter l en-tete X-Golf-Group : on transmet donc
 * le groupe via `?grp=` pour que le BFF retrouve la bonne session (cookies par
 * groupe). Sans ca, les logos/cartes echouent des qu on n est pas sur le groupe
 * par defaut.
 */
export function mediaUrl(path: string, query?: Record<string, string>): string {
  const grp = currentGroupHeader();
  return buildUrl(`/media/${path}`, { ...(grp ? { grp } : {}), ...query });
}

/**
 * Telecharge une image du BFF sous le nom donne.
 *
 * On passe par un blob plutot qu un simple lien : la ressource exige le
 * cookie de session (credentials same-origin) et l extension reelle depend
 * du type renvoye par l amont, inconnu a l avance.
 */
export async function downloadMedia(path: string, filename: string): Promise<void> {
  const res = await fetch(mediaUrl(path), { credentials: 'same-origin' });
  if (!res.ok) throw new ApiError('Téléchargement impossible.', res.status, 'download');

  const blob = await res.blob();
  const ext = blob.type.includes('png') ? 'png'
    : blob.type.includes('jpeg') ? 'jpg'
    : (blob.type.split('/')[1] ?? 'img');

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Laisse le temps au navigateur d amorcer le telechargement avant de liberer.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
