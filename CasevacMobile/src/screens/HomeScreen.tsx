/**
 * M02 — Home (Home UI v3, 13 Nov 2026).
 *
 * Landscape (two columns)
 *   left  — Scan QR Tag · ID search · Register New Casualty
 *           Continue Active Evacuations (this medic, not yet handed over)
 *           Operational Snapshot: My Casualties / All on Tablet toggle,
 *           count tiles, triage donut and casualties by company
 *   right — Pending Handovers & Alerts (derived from the records)
 *           My Recent Records (created by this medic; compact rows)
 * Portrait (one column): actions, alerts, active evacuations, snapshot,
 * recent records — so the critical items stay near the top.
 *
 * Figures come only from the evacuation records saved on this tablet
 * (assessment + interventions & triage) — no demo casualties. An empty tablet
 * shows empty lists and zero counts. The top bar still marks a demo sign-in
 * account ("· Demo" under the medic).
 * Screens that do not exist yet (evacuation record, handover, sync) explain
 * that when opened — nothing pretends to work.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  AlertCards,
  AppShell,
  Card,
  CompanyBars,
  EvacuationRows,
  IdSearch,
  InjuryBars,
  PillToggle,
  RecentRecordRows,
  Icon,
  RegisterBar,
  ScanCard,
  SecondaryButton,
  SnapshotTiles,
  TriageDonut,
} from '../components';
import {
  loadDashboardData,
  type DashboardData,
} from '../services/dashboard/localDashboard';
import { useServerStatus } from '../services/connectivity/useServerStatus';
import {
  activeEvacuationsBy,
  computeAlerts,
  computeDashboardStats,
  recordsBy,
  type HomeAlert,
} from '../services/dashboard/dashboardStats';
import { getActiveIdentityDirectory } from '../services/identity/provisioningStore';
import type { ManualIdentification } from '../services/identity/manualLookup';
import type { IdentityDirectory } from '../services/identity/types';
import type { FieldLink } from '../services/patients/fieldRegistry';
import { colors, radius, spacing } from '../theme/tokens';
import type { Clinician } from '../types';

interface HomeScreenProps {
  clinician: Clinician;
  onScanPatient: () => void;
  onPatientIdentified: (result: ManualIdentification) => void;
  /** Opens Register New Patient (optionally carrying a typed ID not found). */
  onRegisterPatient: (link: FieldLink) => void;
  /** Receive a casualty record from another tablet (QR / Bluetooth). */
  onReceivePatient: () => void;
  /** Reopen an evacuation (in its patient tab) at its next unsaved step. */
  onContinueEvacuation: (assessmentId: string) => void;
  onSignOut: () => void;
  /** Injected in tests; defaults to the directory downloaded at sign-in. */
  directory?: IdentityDirectory;
}

/** Two columns when the content area is at least this wide. */
const TWO_COLUMN_MIN = 960;
const ACTIVE_ROWS = 4;

type SnapshotScope = 'mine' | 'tablet';
const RECENT_ROWS = 5;

const comingNext = (title: string, what: string) =>
  Alert.alert(
    `${title} — coming next`,
    `${what} is built in the next phase. No data has been changed.`,
  );

export function HomeScreen({
  clinician,
  onScanPatient,
  onPatientIdentified,
  onRegisterPatient,
  onReceivePatient,
  onContinueEvacuation,
  onSignOut,
  directory,
}: HomeScreenProps) {
  const { width } = useWindowDimensions();
  const twoColumns = width - spacing.lg * 2 >= TWO_COLUMN_MIN;

  const [data, setData] = useState<DashboardData | null>(null);
  const serverStatus = useServerStatus();
  const [scope, setScope] = useState<SnapshotScope>('tablet');
  const identityDirectory = useMemo(
    () => directory ?? getActiveIdentityDirectory(),
    [directory],
  );

  useEffect(() => {
    let cancelled = false;
    loadDashboardData()
      .then(result => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const now = data ? new Date(data.loadedAt).getTime() : Date.now();
  const mine = useMemo(
    () => (data ? recordsBy(data.casualties, clinician.id) : []),
    [data, clinician.id],
  );
  const active = useMemo(
    () => (data ? activeEvacuationsBy(data.casualties, clinician.id) : []),
    [data, clinician.id],
  );
  const stats = useMemo(
    () =>
      data
        ? computeDashboardStats(scope === 'mine' ? mine : data.casualties)
        : null,
    [data, scope, mine],
  );
  const alerts = useMemo(
    () => (data ? computeAlerts(data.casualties, now, data.sync.queued) : []),
    [data, now],
  );

  const openAccount = () => {
    Alert.alert(
      'Log out?',
      'Records saved on this tablet remain available after you sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: onSignOut },
      ],
    );
  };

  const onAlertAction = (alert: HomeAlert) => {
    if (alert.id === 'unsynced') {
      Alert.alert(
        'Sync not available yet',
        'Sync with the base server is built in a later phase. All records stay saved on this tablet.',
      );
    } else if (alert.id === 'reassess') {
      comingNext('Reassessment', 'The reassessment screen');
    } else {
      comingNext('Handover', 'The handover screen');
    }
  };

  const medicName =
    [clinician.rank, clinician.displayName].filter(Boolean).join(' ') ||
    clinician.id;

  const actions = (
    <View style={styles.actionsCard}>
      <ScanCard onPress={onScanPatient} />
      <IdSearch
        directory={identityDirectory}
        onFound={onPatientIdentified}
        onRegisterNotFound={enteredId => onRegisterPatient({ enteredId })}
      />
      <RegisterBar onPress={() => onRegisterPatient({})} />
      <SecondaryButton
        title="Receive patient from another tablet"
        icon={<Icon name="handover" size={20} color={colors.primary} />}
        onPress={onReceivePatient}
        accessibilityHint="Scan the QR or accept a Bluetooth transfer from the previous team's tablet"
      />
    </View>
  );

  const alertsCard = (
    <Card title="Pending Handovers & Alerts">
      <AlertCards alerts={alerts} onAction={onAlertAction} />
    </Card>
  );

  const activeCard = (
    <Card
      title="Continue Active Evacuations"
      action={{
        label: `View all (${active.length})`,
        onPress: () => comingNext('Evacuations', 'The evacuations list'),
      }}
    >
      <EvacuationRows
        rows={active.slice(0, ACTIVE_ROWS)}
        onContinue={row =>
          row.assessmentId
            ? onContinueEvacuation(row.assessmentId)
            : comingNext('Continue evacuation', 'Continuing this record')
        }
        emptyText="No active evacuations. Scan a tag to start one."
      />
    </Card>
  );

  const recentCard = (
    <Card
      title="My Recent Records"
      subtitle={`Created by ${medicName}`}
      action={{
        label: `View all (${mine.length})`,
        onPress: () => comingNext('My records', 'The full records list'),
      }}
    >
      <RecentRecordRows
        rows={mine.slice(0, RECENT_ROWS)}
        now={now}
        compact={twoColumns}
        emptyText="You have not recorded any casualties yet."
      />
    </Card>
  );

  const snapshotCard = stats ? (
    <Card
      title="Operational Snapshot"
      subtitle={
        scope === 'mine' ? 'Recorded by you' : 'Local records on this tablet'
      }
      right={
        <PillToggle<SnapshotScope>
          label="Snapshot scope"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'mine', label: 'My Casualties' },
            { value: 'tablet', label: 'All on Tablet' },
          ]}
        />
      }
    >
      <SnapshotTiles total={stats.total} counts={stats.byTriage} />
      <View style={styles.donutBox}>
        <TriageDonut counts={stats.byTriage} />
      </View>
      <View style={styles.donutBox}>
        <InjuryBars data={stats.byInjury} />
      </View>
      <View style={styles.donutBox}>
        <CompanyBars data={stats.byCompany} />
      </View>
    </Card>
  ) : null;

  return (
    <AppShell
      title="Home"
      clinician={clinician}
      status={{
        online: serverStatus === 'online',
        queued: data?.sync.queued ?? 0,
        lastSyncedAt: data?.sync.lastSyncedAt ?? null,
      }}
      onAccount={openAccount}
    >
      {twoColumns ? (
        <View style={styles.columns}>
          <View style={styles.left}>
            {actions}
            {activeCard}
            {snapshotCard}
          </View>
          <View style={styles.right}>
            {alertsCard}
            {recentCard}
          </View>
        </View>
      ) : (
        <View style={styles.stack}>
          {actions}
          {alertsCard}
          {activeCard}
          {snapshotCard}
          {recentCard}
        </View>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  left: {
    flex: 1.45,
    minWidth: 0,
    gap: spacing.lg,
  },
  right: {
    flex: 1,
    minWidth: 0,
    gap: spacing.lg,
  },
  stack: {
    gap: spacing.lg,
  },
  actionsCard: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg + 4,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.background,
  },
  donutBox: {
    padding: spacing.lg,
    borderRadius: radius.lg + 2,
    borderWidth: 1,
    borderColor: colors.divider,
  },
});
