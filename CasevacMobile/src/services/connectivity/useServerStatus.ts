/**
 * Live reachability of the CASEVAC dashboard server, for status badges.
 *
 * "Online" means the base server answered its health check — the only
 * connection that matters to this app (sign-in, directory download, future
 * sync). Wi-Fi without the server is still "Offline". Checked when a screen
 * opens and every 30 s while it stays open.
 */
import { useEffect, useState } from 'react';
import { getDefaultAuthDeps } from '../auth/signIn';
import type { ServerClient } from '../auth/serverClient';

export type ServerStatus = 'checking' | 'online' | 'offline';

export const SERVER_CHECK_INTERVAL_MS = 30_000;

export function useServerStatus(
  server: Pick<ServerClient, 'isReachable'> = getDefaultAuthDeps().server,
  intervalMs = SERVER_CHECK_INTERVAL_MS,
): ServerStatus {
  const [status, setStatus] = useState<ServerStatus>('checking');

  useEffect(() => {
    let cancelled = false;
    const check = () =>
      server.isReachable().then(
        reachable => {
          if (!cancelled) {
            setStatus(reachable ? 'online' : 'offline');
          }
        },
        () => {
          if (!cancelled) {
            setStatus('offline');
          }
        },
      );
    check();
    const id = setInterval(check, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [server, intervalMs]);

  return status;
}

export const SERVER_STATUS_LABEL: Record<ServerStatus, string> = {
  checking: 'Checking…',
  online: 'Online',
  offline: 'Offline',
};
