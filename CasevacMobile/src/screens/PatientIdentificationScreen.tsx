/**
 * M04 — Patient Identification (CASEVAC_DOCS/SCREEN_SPECIFICATIONS.md)
 *
 * Shown after a wristband credential's signature has been verified, or
 * after a Patient ID was entered manually (wristband NOT verified).
 * Separates the facts the medic must not confuse:
 *   1. the credential is genuine (signature),
 *   2. it is not revoked as far as this phone knows (directory date),
 *   3. whether identity details are available offline.
 * Never invents details that are not in the local directory.
 */
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AppHeader,
  Notice,
  PrimaryButton,
  SecondaryButton,
  SectionPanel,
  StatusBadge,
} from '../components';
import { MOCK_CONNECTIVITY } from '../data/mockData';
import type { ManualIdentification } from '../services/identity/manualLookup';
import type { PatientIdentity } from '../services/identity/types';
import type { VerifiedIdentification } from '../services/qr/identifyPatient';
import { colors, fonts, spacing, typography } from '../theme/tokens';
import { formatDateTime } from '../utils/format';

interface PatientIdentificationScreenProps {
  result: VerifiedIdentification | ManualIdentification;
  onBack: () => void;
  onScanAnother: () => void;
}

const BLOOD_LABEL: Record<PatientIdentity['bloodGroup'], string> = {
  UNKNOWN: 'Unknown',
  A: 'A',
  B: 'B',
  AB: 'AB',
  O: 'O',
};
const RH_LABEL: Record<PatientIdentity['rhFactor'], string> = {
  UNKNOWN: 'Rh unknown',
  POSITIVE: 'Rh positive',
  NEGATIVE: 'Rh negative',
};

function DetailRow({
  label,
  value,
  mono,
  isLast,
}: {
  label: string;
  value: string;
  mono?: boolean;
  isLast?: boolean;
}) {
  return (
    <View
      style={[styles.row, isLast && styles.rowLast]}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && styles.mono]} selectable>
        {value}
      </Text>
    </View>
  );
}

export function PatientIdentificationScreen({
  result,
  onBack,
  onScanAnother,
}: PatientIdentificationScreenProps) {
  const manual = result.method === 'MANUAL';
  const patient = manual
    ? result.patient
    : result.lookup.status === 'FOUND'
    ? result.lookup.patient
    : null;
  const permanentPatientId = manual
    ? result.patient.patientId
    : result.claims.patientId;
  const directoryDate = result.directoryGeneratedAt
    ? formatDateTime(result.directoryGeneratedAt)
    : null;

  const startEvacuation = () =>
    Alert.alert(
      'Start New Evacuation — coming next',
      'Evacuation records (M06) are built in the next phase. No data has been changed.',
    );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <AppHeader
        eyebrow="CASEVAC"
        title="Patient Identification"
        onBack={onBack}
        right={
          <StatusBadge
            label={MOCK_CONNECTIVITY === 'offline' ? 'Offline' : 'Online'}
          />
        }
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.badges}>
          {manual ? (
            <>
              <StatusBadge label="Identified by manual ID" tone="warning" />
              <StatusBadge label="Wristband not verified" tone="warning" />
            </>
          ) : (
            <StatusBadge label="Credential verified" tone="success" />
          )}
          {patient ? (
            <StatusBadge label="Identity found on this tablet" tone="success" />
          ) : (
            <StatusBadge label="Details unavailable offline" tone="warning" />
          )}
        </View>

        {manual ? (
          <Notice
            tone="warning"
            title="Manual identification — wristband not verified"
            message={`This patient was found from the Patient ID typed in (${result.enteredId}). Confirm that the casualty is this person before recording care.`}
          />
        ) : null}

        {patient ? null : (
          <Notice
            tone="warning"
            title="Credential Verified — Patient Details Unavailable Offline"
            message="The wristband signature is genuine, but this phone has no identity record for it. Confirm the casualty's identity by other means; do not guess."
          />
        )}

        <SectionPanel title="Patient">
          <DetailRow
            label="Patient ID"
            value={patient ? patient.displayId : 'Not available offline'}
            mono={!!patient}
          />
          <DetailRow
            label="Name"
            value={
              patient
                ? [patient.rank, patient.fullName].filter(Boolean).join(' ')
                : 'Not available offline'
            }
          />
          <DetailRow
            label="Unit"
            value={
              patient ? patient.unit || 'Not recorded' : 'Not available offline'
            }
          />
          <DetailRow
            label="Blood group"
            value={
              patient
                ? `${BLOOD_LABEL[patient.bloodGroup]} · ${
                    RH_LABEL[patient.rhFactor]
                  }`
                : 'Not available offline'
            }
          />
          <DetailRow
            label="Permanent patient ID"
            value={permanentPatientId}
            mono
            isLast
          />
        </SectionPanel>

        {result.method === 'MANUAL' ? (
          <SectionPanel title="Identification">
            <DetailRow label="Method" value="Manual Patient ID entry" />
            <DetailRow label="Entered ID" value={result.enteredId} mono />
            <DetailRow label="Wristband" value="Not scanned — not verified" />
            <DetailRow
              label="Identity lookup"
              value={`Found in local directory (demo provisioning)${
                directoryDate ? `, updated ${directoryDate}` : ''
              }`}
              isLast
            />
          </SectionPanel>
        ) : (
          <SectionPanel title="Wristband credential">
            <DetailRow
              label="Signature"
              value={`Valid — issued by ${result.issuer} (key ${result.claims.keyId})`}
            />
            <DetailRow
              label="Credential"
              value={`Version ${
                result.claims.credentialVersion
              }, issued ${formatDateTime(
                new Date(result.claims.issuedAt * 1000).toISOString(),
              )}`}
            />
            <DetailRow
              label="Revocation check"
              value={
                result.lookup.status === 'CREDENTIAL_NOT_IN_DIRECTORY'
                  ? 'Unknown — credential not in this tablet’s directory'
                  : `Not revoked as of ${
                      directoryDate ?? 'directory date unknown'
                    }`
              }
            />
            <DetailRow
              label="Identity lookup"
              value={
                result.lookup.status === 'FOUND'
                  ? 'Found in local directory (demo provisioning)'
                  : result.lookup.status === 'PATIENT_DETAILS_UNAVAILABLE'
                  ? 'Credential listed, patient details not provisioned'
                  : 'Not found in local directory'
              }
              isLast
            />
          </SectionPanel>
        )}

        <SectionPanel title="Evacuations on this tablet">
          <Text style={styles.panelText}>
            No evacuation records for this patient on this tablet. Local
            evacuation storage is added in the next phase.
          </Text>
        </SectionPanel>

        <Text style={styles.reminder}>
          {manual
            ? 'Manual entry identifies a record, not the casualty. Confirm identity before recording care.'
            : 'A valid signature proves the registrar issued this wristband. Confirm that the casualty is the person wearing it.'}
        </Text>

        <View style={styles.actions}>
          <PrimaryButton
            title="Start New Evacuation"
            onPress={startEvacuation}
            accessibilityHint="Coming in the next phase"
          />
          <SecondaryButton
            title="Scan Another Patient"
            onPress={onScanAnother}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  row: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: 2,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    ...typography.helper,
    color: colors.textSecondary,
  },
  rowValue: {
    ...typography.body,
    color: colors.textPrimary,
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: 14,
  },
  panelText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    padding: spacing.lg,
  },
  reminder: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  actions: {
    gap: spacing.md,
  },
});
