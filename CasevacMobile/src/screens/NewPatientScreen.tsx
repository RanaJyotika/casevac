/**
 * First screen of a new patient tab (＋): identify the next casualty —
 * scan their wristband, search their ID, or register them by hand. The tab
 * then follows the usual flow (Patient Identification → Start Evacuation …).
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { APP_BRAND } from '../brand';
import { AppHeader, IdSearch, RegisterBar, ScanCard } from '../components';
import { getActiveIdentityDirectory } from '../services/identity/provisioningStore';
import type { ManualIdentification } from '../services/identity/manualLookup';
import type { IdentityDirectory } from '../services/identity/types';
import type { FieldLink } from '../services/patients/fieldRegistry';
import { colors, layout, radius, spacing, typography } from '../theme/tokens';

export function NewPatientScreen({
  number,
  onBack,
  onScanPatient,
  onPatientIdentified,
  onRegisterPatient,
  directory,
}: {
  /** "Patient N" — the tab's number. */
  number: number;
  onBack: () => void;
  onScanPatient: () => void;
  onPatientIdentified: (result: ManualIdentification) => void;
  onRegisterPatient: (link: FieldLink) => void;
  directory?: IdentityDirectory;
}) {
  const patients = useMemo(
    () => directory ?? getActiveIdentityDirectory(),
    [directory],
  );
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <AppHeader
        eyebrow={APP_BRAND}
        title={`New Patient (Patient ${number})`}
        onBack={onBack}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.lead}>
          Identify the casualty for this tab. Your other patients stay open in
          their own tabs.
        </Text>
        <View style={styles.card}>
          <ScanCard onPress={onScanPatient} />
          <IdSearch
            directory={patients}
            onFound={onPatientIdentified}
            onRegisterNotFound={enteredId => onRegisterPatient({ enteredId })}
          />
          <RegisterBar onPress={() => onRegisterPatient({})} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1, backgroundColor: '#F3F5F8' },
  content: { padding: spacing.lg, gap: spacing.lg },
  lead: { ...typography.body, color: colors.textSecondary },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg + 4,
    borderWidth: layout.borderWidth,
    borderColor: colors.divider,
    backgroundColor: colors.background,
  },
});
