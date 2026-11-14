/**
 * Plain-language messages for identification failures
 * (CASEVAC_DOCS/UI_DESIGN_GUIDELINES.md §7 "truth over polish").
 */
import { formatDateTime } from '../../utils/format';
import type { FailedIdentification } from './identifyPatient';

export interface FailureMessage {
  title: string;
  message: string;
}

export function describeFailure(result: FailedIdentification): FailureMessage {
  switch (result.failure) {
    case 'NOT_CASEVAC':
      return {
        title: 'Unrecognised QR code',
        message:
          'This is not a Jeewan patient wristband. No patient has been identified.',
      };
    case 'LEGACY_UNSIGNED':
      return {
        title: 'Unsigned wristband',
        message:
          'This wristband uses the old unsigned format and cannot be verified. Ask the registrar to reissue it. Use Unknown Casualty if care cannot wait.',
      };
    case 'UNSUPPORTED_VERSION':
      return {
        title: 'Unsupported QR version',
        message:
          'This wristband uses a format this app does not support. Update the Jeewan app.',
      };
    case 'MALFORMED':
      return {
        title: 'QR read error',
        message:
          'The code could not be read as a valid Jeewan credential. Rescan; if it keeps failing, the wristband may be damaged.',
      };
    case 'UNKNOWN_ISSUER_KEY':
      return {
        title: 'Unknown issuer',
        message: `This wristband was signed with key "${
          result.keyId ?? 'unknown'
        }", which this phone does not trust. It may be from another system, or this phone needs re-provisioning.`,
      };
    case 'INVALID_SIGNATURE':
      return {
        title: 'Invalid QR signature',
        message:
          'The signature does not match the wristband contents. It may be forged or altered. Do not use it to identify the casualty.',
      };
    case 'CREDENTIAL_REVOKED':
      return {
        title: 'Revoked credential',
        message: `The registrar revoked this wristband${
          result.revokedAt ? ` on ${formatDateTime(result.revokedAt)}` : ''
        }. Do not use it to identify the casualty.`,
      };
    case 'CREDENTIAL_REPLACED':
      return {
        title: 'Replaced credential',
        message: `This wristband was replaced by a newer one${
          result.revokedAt ? ` on ${formatDateTime(result.revokedAt)}` : ''
        }. Look for the current wristband or verify identity manually.`,
      };
    case 'RECORD_MISMATCH':
      return {
        title: 'Patient record mismatch',
        message:
          'The wristband and the local identity record disagree. Records will not be merged. Verify identity manually.',
      };
  }
}
