/**
 * Login station: the medical post the medic signs in at. Picked on the login
 * screen; credentials issued on the dashboard for one station only work there
 * (admin-dashboard/src/lib/domain/types.ts → LoginStation).
 */
export const LOGIN_STATIONS = [
  { value: 'RAP', label: 'RAP', meaning: 'Regimental Aid Post' },
  { value: 'ADS', label: 'ADS', meaning: 'Advanced Dressing Station' },
] as const;
export type LoginStation = (typeof LOGIN_STATIONS)[number]['value'];

/** Selected by default on the login screen. */
export const DEFAULT_STATION: LoginStation = 'RAP';

export const STATION_MEANING = Object.fromEntries(
  LOGIN_STATIONS.map(s => [s.value, s.meaning]),
) as Record<LoginStation, string>;

export function isLoginStation(value: unknown): value is LoginStation {
  return LOGIN_STATIONS.some(s => s.value === value);
}

/** Shown when the credentials belong to the other station. */
export function wrongStationMessage(issued: LoginStation): string {
  return `This user ID is issued for ${issued} (${STATION_MEANING[issued]}). Select ${issued} as the login station, or ask your unit registrar to issue a login for this station.`;
}
