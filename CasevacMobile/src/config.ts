/**
 * App configuration.
 *
 * SERVER_URL is the CASEVAC admin dashboard reachable from the tablet at base
 * camp. 10.0.2.2 is the Android emulator's alias for the development PC.
 * On a real tablet set it to the dashboard server's LAN address, e.g.
 * 'http://192.168.1.20:3000'. Release builds block plain http unless
 * cleartext traffic is allowed — use https for real deployments.
 */
export const SERVER_URL = 'http://10.0.2.2:3000';

/** How long to wait for the server before falling back to offline sign-in. */
export const SERVER_TIMEOUT_MS = 5000;
