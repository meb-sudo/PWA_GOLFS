import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import type { Member } from '@golf/contracts';
import { config } from '../config.js';

/**
 * Sessions et codes de validation, cote serveur.
 *
 * Corrige le constat C-02 : dans l application WinDev, SEND_AUTH_CODE
 * renvoie le code au client qui le compare lui-meme. Ici le code ne quitte
 * jamais le serveur ; le navigateur ne recoit qu un verdict.
 *
 * Implementation en memoire, volontairement simple. Pour plusieurs
 * instances de BFF, remplacer par Redis en gardant la meme interface.
 */

export interface PendingAuth {
  licence: string;
  email: string;
  group: string;
  member: Member;
  codeHash: string;
  attempts: number;
  expiresAt: number;
}

export interface Session {
  id: string;
  licence: string;
  email: string;
  group: string;
  member: Member;
  createdAt: number;
  expiresAt: number;
}

const sessions = new Map<string, Session>();
const pending = new Map<string, PendingAuth>();
/** cle = hash(deviceId + licence) -> expiration */
const trustedDevices = new Map<string, number>();

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function sweep(): void {
  const now = Date.now();
  for (const [k, v] of sessions) if (v.expiresAt <= now) sessions.delete(k);
  for (const [k, v] of pending) if (v.expiresAt <= now) pending.delete(k);
  for (const [k, v] of trustedDevices) if (v <= now) trustedDevices.delete(k);
}
setInterval(sweep, 5 * 60 * 1000).unref?.();

// --- authentification en attente de code ------------------------------------

export function startPendingAuth(input: {
  licence: string; email: string; group: string; member: Member; code: string;
}): string {
  const id = randomUUID();
  pending.set(id, {
    licence: input.licence,
    email: input.email,
    group: input.group,
    member: input.member,
    codeHash: hash(input.code.trim()),
    attempts: 0,
    expiresAt: Date.now() + config.authCodeTtlMs,
  });
  return id;
}

export function getPendingAuth(id: string | undefined): PendingAuth | null {
  if (!id) return null;
  const p = pending.get(id);
  if (!p) return null;
  if (p.expiresAt <= Date.now()) {
    pending.delete(id);
    return null;
  }
  return p;
}

export type VerifyOutcome =
  | { ok: true; auth: PendingAuth }
  | { ok: false; reason: 'expired' | 'invalid' | 'too_many_attempts' };

export function verifyPendingAuth(id: string | undefined, code: string): VerifyOutcome {
  const p = getPendingAuth(id);
  if (!p) return { ok: false, reason: 'expired' };

  if (p.attempts >= config.authCodeMaxAttempts) {
    pending.delete(id!);
    return { ok: false, reason: 'too_many_attempts' };
  }

  p.attempts += 1;
  if (!safeEqual(hash(code.trim()), p.codeHash)) {
    return { ok: false, reason: 'invalid' };
  }

  pending.delete(id!);
  return { ok: true, auth: p };
}

export function dropPendingAuth(id: string | undefined): void {
  if (id) pending.delete(id);
}

// --- sessions ---------------------------------------------------------------

export function createSession(input: {
  licence: string; email: string; group: string; member: Member;
}): Session {
  const now = Date.now();
  const session: Session = {
    id: randomUUID(),
    licence: input.licence,
    email: input.email,
    group: input.group,
    member: input.member,
    createdAt: now,
    expiresAt: now + config.sessionTtlMs,
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string | undefined): Session | null {
  if (!id) return null;
  const s = sessions.get(id);
  if (!s) return null;
  if (s.expiresAt <= Date.now()) {
    sessions.delete(id);
    return null;
  }
  return s;
}

export function refreshSession(session: Session): void {
  session.expiresAt = Date.now() + config.sessionTtlMs;
}

export function destroySession(id: string | undefined): void {
  if (id) sessions.delete(id);
}

/** Met a jour la copie du membre en session apres modification du profil. */
export function updateSessionMember(id: string, member: Member): void {
  const s = sessions.get(id);
  if (s) s.member = member;
}

// --- appareils memorises ----------------------------------------------------

export function newDeviceId(): string {
  return randomUUID();
}

export function trustDevice(deviceId: string, licence: string): void {
  trustedDevices.set(hash(`${deviceId}:${licence}`), Date.now() + config.deviceTrustTtlMs);
}

export function isDeviceTrusted(deviceId: string | undefined, licence: string): boolean {
  if (!deviceId) return false;
  const exp = trustedDevices.get(hash(`${deviceId}:${licence}`));
  if (!exp) return false;
  if (exp <= Date.now()) return false;
  return true;
}
