/**
 * M02 — Home (CASEVAC_DOCS/SCREEN_SPECIFICATIONS.md)
 * Quickly begin casualty documentation or resume active work.
 * Screens beyond Home are not built yet; their entry points say so honestly.
 */
import React from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AppHeader,
  Chevron,
  GlyphIcon,
  ListRow,
  QrIcon,
  SecondaryButton,
  SectionPanel,
  StatusBadge,
} from '../components';
import {
  MOCK_ACTIVE_EVACUATIONS,
  MOCK_CACHED_IDENTITY_COUNT,
  MOCK_CONNECTIVITY,
} from '../data/mockData';
import {
  colors,
  fonts,
  radius,
  spacing,
  touchTarget,
  typography,
} from '../theme/tokens';
import type { Clinician } from '../types';
import { formatTime, RECORD_STATUS_DISPLAY } from '../utils/format';

interface HomeScreenProps {
  clinician: Clinician;
  onSignOut: () => void;
}

function showComingLater(feature: string, screenId: string) {
  Alert.alert(
    `${feature} — coming later`,
    `Screen ${screenId} is not built yet in this demo build. No data has been changed.`,
  );
}

export function HomeScreen({ clinician, onSignOut }: HomeScreenProps) {
  const evacuations = MOCK_ACTIVE_EVACUATIONS;
  const pendingCount = evacuations.filter(
    e => e.status === 'DIGITAL_TRANSFER_PENDING',
  ).length;

  const confirmSignOut = () => {
    Alert.alert(
      'Sign out?',
      'Records saved on this phone remain available after you sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: onSignOut },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <AppHeader
        eyebrow="CASEVAC"
        title="Medic Dashboard"
        right={
          <StatusBadge
            label={MOCK_CONNECTIVITY === 'offline' ? 'Offline' : 'Online'}
          />
        }
      >
        <View style={styles.clinicianRow}>
          <View style={styles.clinicianText}>
            <Text style={styles.clinicianName} numberOfLines={1}>
              {clinician.rank} {clinician.displayName} · {clinician.team}
            </Text>
            <Text style={styles.clinicianId} numberOfLines={1}>
              {clinician.id}
              {clinician.isDemo ? ' · Demo mode' : ''}
            </Text>
          </View>
          <Pressable
            onPress={confirmSignOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            hitSlop={8}
            style={({ pressed }) => [
              styles.signOut,
              pressed && styles.signOutPressed,
            ]}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </AppHeader>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        {/* Primary action */}
        <View style={styles.actions}>
          <Pressable
            onPress={() => showComingLater('Scan Patient QR', 'M03')}
            accessibilityRole="button"
            accessibilityLabel="Scan Patient QR"
            accessibilityHint="Identify an enrolled casualty"
            style={({ pressed }) => [
              styles.scanButton,
              pressed && styles.scanButtonPressed,
            ]}
          >
            <View style={styles.scanIcon}>
              <QrIcon />
            </View>
            <View style={styles.scanText}>
              <Text style={styles.scanTitle}>Scan Patient QR</Text>
              <Text style={styles.scanSubtitle}>
                Identify an enrolled casualty
              </Text>
            </View>
            <Chevron color={colors.onPrimary} />
          </Pressable>

          <View style={styles.secondaryRow}>
            <SecondaryButton
              title="Enter Patient ID"
              icon={<GlyphIcon glyph="#" />}
              onPress={() => showComingLater('Manual Patient ID', 'M03')}
              style={styles.secondaryButton}
            />
            <SecondaryButton
              title="Unknown Casualty"
              icon={<GlyphIcon glyph="+" />}
              onPress={() => showComingLater('Unknown Casualty', 'M05')}
              style={styles.secondaryButton}
            />
          </View>
        </View>

        {/* Active evacuations */}
        <SectionPanel
          title="Active evacuations"
          meta={`${evacuations.length} on this phone`}
        >
          {evacuations.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No active evacuations.</Text>
            </View>
          ) : (
            evacuations.map((evac, index) => {
              const status = RECORD_STATUS_DISPLAY[evac.status];
              const patientLabel = evac.isUnknownCasualty
                ? `${evac.patientId} (unknown)`
                : evac.patientId;
              const subtitle = `${patientLabel} · Started ${formatTime(
                evac.startedAt,
              )} · ${evac.eventCount} events`;
              return (
                <ListRow
                  key={evac.evacuationId}
                  title={evac.evacuationId}
                  monoTitle
                  subtitle={subtitle}
                  badge={<StatusBadge label={status.label} tone={status.tone} />}
                  onPress={() => showComingLater('Clinical Timeline', 'M12')}
                  isLast={index === evacuations.length - 1}
                  accessibilityLabel={`${evac.evacuationId}, ${subtitle}, status ${status.label}`}
                  accessibilityHint="Opens the clinical timeline"
                />
              );
            })
          )}
        </SectionPanel>

        {/* Records */}
        <SectionPanel title="Records">
          <ListRow
            title="Local Patient Records"
            subtitle={`${MOCK_CACHED_IDENTITY_COUNT} identities available offline`}
            leading={<GlyphIcon glyph="≡" />}
            onPress={() => showComingLater('Local Patient Records', 'M04')}
          />
          <ListRow
            title="Pending Transfer / Sync"
            subtitle={
              pendingCount === 1
                ? '1 incident awaiting digital transfer'
                : `${pendingCount} incidents awaiting digital transfer`
            }
            leading={<GlyphIcon glyph="↻" />}
            trailing={
              pendingCount > 0 ? (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{pendingCount}</Text>
                </View>
              ) : null
            }
            onPress={() => showComingLater('Pending Transfer / Sync', 'M17')}
            isLast
          />
        </SectionPanel>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Demo mode · fictional data only · not connected to a server
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  clinicianRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  clinicianText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  clinicianName: {
    ...typography.label,
    color: colors.textPrimary,
  },
  clinicianId: {
    ...typography.helper,
    fontFamily: fonts.mono,
    color: colors.textSecondary,
  },
  signOut: {
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  signOutPressed: {
    backgroundColor: colors.surface,
  },
  signOutText: {
    ...typography.label,
    color: colors.primary,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    padding: spacing.lg,
    gap: 20,
  },
  actions: {
    gap: 10,
  },
  scanButton: {
    minHeight: 88,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  scanButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  scanIcon: {
    width: 48,
    height: 48,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanText: {
    flex: 1,
    gap: 3,
  },
  scanTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  scanSubtitle: {
    ...typography.caption,
    color: colors.onPrimaryMuted,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
  },
  empty: {
    padding: spacing.lg,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: colors.warningStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  footerText: {
    ...typography.helper,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
