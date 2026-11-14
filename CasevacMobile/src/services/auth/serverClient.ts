/**
 * HTTP client for the dashboard's mobile endpoints (admin-dashboard/src/app/api/mobile/).
 * Every call has a timeout; "unreachable" means the tablet should work offline.
 */
import { Platform } from 'react-native';
import { SERVER_TIMEOUT_MS, SERVER_URL } from '../../config';
import type { RawProvisioning } from '../identity/provisioningStore';
import type { MobileProfile, ServerSignInError } from './types';

export type ServerSignInResult =
  | {
      kind: 'ok';
      profile: MobileProfile;
      firstLogin: boolean;
      /** Patient directory + trusted QR key for offline scanning. */
      provisioning?: RawProvisioning;
    }
  | { kind: 'rejected'; error: ServerSignInError; message: string }
  | { kind: 'unreachable' };

export interface OfflineLoginReport {
  accountId: string;
  count: number;
  lastAt: string | null;
}

export interface SyncItem {
  accountId: string;
  userId: string;
  offlineLogins?: { count: number; lastAt: string | null };
}

export interface ServerClient {
  isReachable(): Promise<boolean>;
  signIn(
    userId: string,
    password: string,
    offlineLogins: OfflineLoginReport[],
  ): Promise<ServerSignInResult>;
  /** Returns null when the server cannot be reached. */
  sync(
    items: SyncItem[],
  ): Promise<{ accountId: string; status: 'VALID' | 'REVOKED' }[] | null>;
}

function deviceLabel(): string {
  const c = (Platform.constants ?? {}) as { Brand?: string; Model?: string };
  const model = [c.Brand, c.Model].filter(Boolean).join(' ');
  return `${model || 'Tablet'} (${Platform.OS} ${String(Platform.Version)})`;
}

async function request(
  path: string,
  init: RequestInit,
  baseUrl: string,
  timeoutMs: number,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } catch {
    return null; // offline, DNS failure, refused, timed out …
  } finally {
    clearTimeout(timer);
  }
}

const KNOWN_ERRORS: ServerSignInError[] = [
  'INVALID_CREDENTIALS',
  'ACCOUNT_DISABLED',
  'RATE_LIMITED',
  'BAD_REQUEST',
];

export function createServerClient(
  baseUrl = SERVER_URL,
  timeoutMs = SERVER_TIMEOUT_MS,
): ServerClient {
  const json = (body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return {
    async isReachable() {
      const res = await request(
        '/api/mobile/health',
        { method: 'GET' },
        baseUrl,
        timeoutMs,
      );
      return !!res && res.ok;
    },

    async signIn(userId, password, offlineLogins) {
      const res = await request(
        '/api/mobile/auth/login',
        json({ userId, password, device: deviceLabel(), offlineLogins }),
        baseUrl,
        timeoutMs,
      );
      if (!res) {
        return { kind: 'unreachable' };
      }
      let body: Record<string, unknown> = {};
      try {
        body = await res.json();
      } catch {
        // A proxy or captive portal answered instead of the dashboard.
        return { kind: 'unreachable' };
      }
      if (res.ok && body.ok === true && body.profile) {
        return {
          kind: 'ok',
          profile: body.profile as MobileProfile,
          firstLogin: body.firstLogin === true,
          provisioning:
            body.provisioning && typeof body.provisioning === 'object'
              ? (body.provisioning as RawProvisioning)
              : undefined,
        };
      }
      const error = body.error as ServerSignInError;
      if (!KNOWN_ERRORS.includes(error)) {
        return { kind: 'unreachable' };
      }
      return {
        kind: 'rejected',
        error,
        message:
          typeof body.message === 'string'
            ? body.message
            : 'Sign-in was refused by the server.',
      };
    },

    async sync(items) {
      const res = await request(
        '/api/mobile/auth/sync',
        json({ device: deviceLabel(), accounts: items }),
        baseUrl,
        timeoutMs,
      );
      if (!res || !res.ok) {
        return null;
      }
      try {
        const body = (await res.json()) as {
          accounts?: { accountId: string; status: 'VALID' | 'REVOKED' }[];
        };
        return Array.isArray(body.accounts) ? body.accounts : null;
      } catch {
        return null;
      }
    },
  };
}
