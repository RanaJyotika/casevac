/**
 * M02 — Home: command dashboard (SCREEN_SPECIFICATIONS.md, UI_DESIGN_GUIDELINES.md §5).
 *
 *   Quick actions  — Scan Patient QR · Enter Patient ID · Temporary Evacuation
 *   Summary cards  — Total, RED, YELLOW, GREEN, BLACK, Active, Pending handover, Completed
 *   Charts         — casualties by company (stacked) · by triage category
 *   Activity       — recent casualty table · evacuation flow
 *
 * Figures come from the DEMO dataset until evacuation records are stored on
 * the tablet; the screen says so. Nothing is labelled as live or force-wide.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  AppShell,
  ChartCard,
  CompanyStackedBarChart,
  EvacuationFlow,
  GlyphIcon,
  ManualPatientIdDialog,
  QrIcon,
  QuickActionTile,
  RecentActivityTable,
  StatusBadge,
  SummaryCard,
  TriageBarChart,
  TriageLegend,
  type NavKey,
} from '../components';
import { loadDashboardData, type DashboardData } from '../data/demoCasualties';
import { computeDashboardStats } from '../services/dashboard/dashboardStats';
import { getBundledIdentityDirectory } from '../services/identity/bundledDemoProvisioning';
import type { ManualIdentification } from '../services/identity/manualLookup';
import type { IdentityDirectory } from '../services/identity/types';
import { colors, layout, spacing, typography } from '../theme/tokens';
import type { Clinician } from '../types';
import { formatTime } from '../utils/format';

interface HomeScreenProps {
  clinician: Clinician;
  onScanPatient: () => void;
  onPatientIdentified: (result: ManualIdentification) => void;
  onSignOut: () => void;
  /** Injected in tests; defaults to the bundled demo directory. */
  directory?: IdentityDirectory;
}

export function HomeScreen({
  clinician,
  onScanPatient,
  onPatientIdentified,
  onSignOut,
  directory,
}: HomeScreenProps) {
  const { width } = useWindowDimensions();
  const navWidth =
    width < layout.navCollapseBelow
      ? layout.sidebarCompactWidth
      : layout.sidebarWidth;
  const contentWidth = width - navWidth - layout.contentPadding * 2;
  const cardsInOneRow = contentWidth >= 900;
  const sideBySide = contentWidth >= 720;

  const [data, setData] = useState<DashboardData | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const identityDirectory = useMemo(
    () => directory ?? getBundledIdentityDirectory(),
    [directory],
  );

  useEffect(() => {
    let cancelled = false;
    loadDashboardData().then(result => {
      if (!cancelled) {
        setData(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(
    () => (data ? computeDashboardStats(data.casualties, 5) : null),
    [data],
  );

  const confirmLogout = () => {
    Alert.alert(
      'Log out?',
      'Records saved on this tablet remain available after you sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: onSignOut },
      ],
    );
  };

  const startTemporaryEvacuation = () => {
    setManualOpen(false);
    Alert.alert(
      'Temporary evacuation — coming next',
      'For a casualty with no wristband, or whose ID is destroyed or unreadable. It will create a temporary casualty ID and start the evacuation immediately; an authorised user can link it to the real identity later.\n\nIt needs evacuation storage on this tablet, which is built in the next phase. No data has been changed.',
    );
  };

  const navigate = (key: NavKey) => {
    if (key === 'scan') {
      onScanPatient();
    }
  };

  const dataNote = data
    ? `${
        data.source === 'DEMO' ? 'Demo data — fictional' : 'On this tablet'
      } · updated ${formatTime(data.loadedAt)}`
    : 'Loading…';

  return (
    <AppShell
      title="Home"
      clinician={clinician}
      active="home"
      onNavigate={navigate}
      onLogout={confirmLogout}
    >
      {/* Quick actions */}
      <View style={styles.row}>
        <QuickActionTile
          variant="primary"
          title="Scan Patient QR"
          subtitle="Read the casualty's wristband"
          icon={<QrIcon />}
          onPress={onScanPatient}
        />
        <QuickActionTile
          title="Enter Patient ID"
          subtitle="Wristband damaged or unreadable"
          icon={<GlyphIcon glyph="#" />}
          onPress={() => setManualOpen(true)}
        />
        <QuickActionTile
          title="Temporary Evacuation"
          subtitle="No ID — anonymous record"
          icon={<GlyphIcon glyph="+" />}
          onPress={startTemporaryEvacuation}
        />
      </View>

      {/* Overview header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          CASUALTY OVERVIEW
        </Text>
        <View style={styles.sectionMeta}>
          {data?.source === 'DEMO' ? (
            <StatusBadge label="Demo data" tone="warning" />
          ) : null}
          <Text style={styles.metaText}>{dataNote}</Text>
        </View>
      </View>

      {stats ? (
        <>
          {/* Summary cards */}
          <View style={[styles.cards, !cardsInOneRow && styles.cardsWrap]}>
            {[
              <SummaryCard
                key="total"
                label="Total casualties"
                value={stats.total}
              />,
              <SummaryCard
                key="red"
                label="Critical"
                category="RED"
                value={stats.byTriage.RED}
              />,
              <SummaryCard
                key="yellow"
                label="Moderate"
                category="YELLOW"
                value={stats.byTriage.YELLOW}
              />,
              <SummaryCard
                key="green"
                label="Stable"
                category="GREEN"
                value={stats.byTriage.GREEN}
              />,
              <SummaryCard
                key="black"
                label="Deceased"
                category="BLACK"
                value={stats.byTriage.BLACK}
              />,
              <SummaryCard
                key="active"
                label="Active evacuations"
                value={stats.activeEvacuations}
              />,
              <SummaryCard
                key="pending"
                label="Pending handover"
                value={stats.pendingHandover}
              />,
              <SummaryCard
                key="done"
                label="Completed"
                value={stats.completedEvacuations}
              />,
            ].map(card => (
              <View
                key={card.key}
                style={cardsInOneRow ? styles.cardCellRow : styles.cardCellWrap}
              >
                {card}
              </View>
            ))}
          </View>

          {/* Charts */}
          <View style={[styles.row, !sideBySide && styles.stack]}>
            <ChartCard
              title="Casualties by company"
              headerRight={<TriageLegend />}
              style={sideBySide ? styles.wide : undefined}
            >
              <CompanyStackedBarChart data={stats.byCompany} />
            </ChartCard>
            <ChartCard
              title="Casualties by category"
              meta={`${stats.total} total`}
              style={sideBySide ? styles.narrow : undefined}
            >
              <TriageBarChart counts={stats.byTriage} />
            </ChartCard>
          </View>

          {/* Activity and flow */}
          <View style={[styles.row, !sideBySide && styles.stack]}>
            <ChartCard
              title="Recent casualty activity"
              meta="Latest updates first"
              style={sideBySide ? styles.wide : undefined}
            >
              <RecentActivityTable rows={stats.recent} />
            </ChartCard>
            <ChartCard
              title="Evacuation status"
              meta="Provisional stages"
              style={sideBySide ? styles.narrow : undefined}
            >
              <EvacuationFlow byStage={stats.byStage} />
              <Text style={styles.flowNote}>
                Stage counts are operational status, not proof of digital record
                transfer.
              </Text>
            </ChartCard>
          </View>
        </>
      ) : (
        <Text style={styles.metaText}>Loading dashboard…</Text>
      )}

      <ManualPatientIdDialog
        visible={manualOpen}
        directory={identityDirectory}
        onCancel={() => setManualOpen(false)}
        onFound={result => {
          setManualOpen(false);
          onPatientIdentified(result);
        }}
        onStartTemporary={startTemporaryEvacuation}
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: layout.gutter,
  },
  stack: {
    flexDirection: 'column',
  },
  wide: {
    flex: 3,
  },
  narrow: {
    flex: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.textMuted,
  },
  sectionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaText: {
    ...typography.helper,
    color: colors.textSecondary,
  },
  cards: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cardsWrap: {
    flexWrap: 'wrap',
  },
  cardCellRow: {
    flex: 1,
  },
  cardCellWrap: {
    flexBasis: '23%',
    flexGrow: 1,
  },
  flowNote: {
    ...typography.helper,
    color: colors.textSecondary,
  },
});
