/**
 * App shell for the signed-in screens (Home UI v3, 13 Nov 2026).
 *
 * One compact top bar, no side navigation:
 *   CASEVAC / <page>   ·   connectivity + queued records · last sync · clock · medic
 * The medic chip is a button: it opens the account menu (Log out).
 * Panels run edge to edge; safe-area insets pad their content.
 */
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePatientStrip } from '../navigation/patientStripContext';
import { APP_BRAND } from '../brand';
import { colors, layout, radius, spacing, typography } from '../theme/tokens';
import type { Clinician } from '../types';
import { formatTime } from '../utils/format';
import { Icon } from './Icon';

export interface ShellStatus {
  online: boolean;
  /** Records on this tablet not yet sent to the server. */
  queued: number;
  /** Last successful sync; null = never synced. */
  lastSyncedAt: string | null;
}

interface AppShellProps {
  title: string;
  clinician: Clinician;
  status: ShellStatus;
  /** Opens the account menu (log out). */
  onAccount: () => void;
  children: React.ReactNode;
}

/** Below this window width the top bar drops secondary text. */
const COMPACT_BELOW = 1000;

function initials(name: string): string {
  const parts = name
    .replace(/[^A-Za-z ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return (parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '');
}

function useClock(intervalMs = 15_000): string {
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date().toISOString()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return formatTime(now);
}

export function AppShell({
  title,
  clinician,
  status,
  onAccount,
  children,
}: AppShellProps) {
  const insets = useSafeAreaInsets();
  const strip = usePatientStrip();
  const { width } = useWindowDimensions();
  const compact = width < COMPACT_BELOW;
  const clock = useClock();

  const emergency = clinician.signInMode === 'emergency';
  const name = [clinician.rank, clinician.displayName]
    .filter(Boolean)
    .join(' ');
  const role = emergency
    ? 'EMERGENCY ACCESS · unverified'
    : `${clinician.roleLabel ?? 'Medic'}${clinician.isDemo ? ' · Demo' : ''}${
        clinician.signInMode === 'offline' ? ' · Offline sign-in' : ''
      }`;

  const connectivity = status.online ? 'Online' : 'Offline';
  const queued = compact
    ? `${status.queued} queued`
    : `${status.queued} ${status.queued === 1 ? 'record' : 'records'} queued`;
  const synced = status.lastSyncedAt
    ? `Synced ${formatTime(status.lastSyncedAt)}`
    : 'Not synced yet';

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top,
            height: layout.topBarHeight + insets.top,
            paddingLeft: insets.left + spacing.lg,
            paddingRight: insets.right + spacing.lg,
          },
        ]}
      >
        <View style={styles.titleRow}>
          <Text style={styles.brand}>{APP_BRAND}</Text>
          <Text style={styles.slash}>/</Text>
          <Text
            style={styles.page}
            accessibilityRole="header"
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>

        <View style={styles.flex} />

        <View
          style={[styles.chip, !status.online && styles.chipOffline]}
          accessible
          accessibilityLabel={`${connectivity}. ${status.queued} records queued. ${synced}.`}
        >
          <Icon
            name={status.online ? 'cloudUp' : 'cloudOff'}
            size={16}
            color={status.online ? colors.success : '#9A5B00'}
          />
          <Text
            style={[styles.chipText, !status.online && styles.chipTextOffline]}
            numberOfLines={1}
          >
            {connectivity}
            {status.queued > 0 ? ` · ${queued}` : ''}
          </Text>
        </View>

        {compact ? null : (
          <>
            <View style={styles.divider} />
            <Text style={styles.meta} numberOfLines={1}>
              {synced}
            </Text>
          </>
        )}

        <View
          style={styles.clock}
          accessible
          accessibilityLabel={`Time ${clock}`}
        >
          <Icon name="clock" size={18} color={colors.textSecondary} />
          <Text style={styles.clockText}>{clock}</Text>
        </View>

        <Pressable
          onPress={onAccount}
          accessibilityRole="button"
          accessibilityLabel="Account and log out"
          accessibilityHint={`Signed in as ${name || clinician.id}`}
          style={({ pressed }) => [
            styles.profile,
            pressed && styles.profilePressed,
          ]}
        >
          <View style={[styles.avatar, emergency && styles.avatarEmergency]}>
            <Text
              style={[styles.avatarText, emergency && styles.avatarTextLight]}
            >
              {emergency ? '!' : initials(clinician.displayName)}
            </Text>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.name} numberOfLines={1}>
              {name || clinician.id}
            </Text>
            <Text
              style={[styles.role, emergency && styles.roleEmergency]}
              numberOfLines={1}
            >
              {role}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Portrait: open patients, directly under the top bar. */}
      {strip}

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentInner,
          {
            paddingLeft: insets.left + spacing.lg,
            paddingRight: insets.right + spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
          },
        ]}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.background,
    borderBottomWidth: layout.borderWidth,
    borderBottomColor: colors.divider,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  brand: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.textPrimary,
  },
  slash: {
    fontSize: 18,
    color: colors.border,
  },
  page: {
    ...typography.label,
    fontSize: 17,
    color: colors.textSecondary,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: layout.borderWidth,
    borderColor: colors.successBorder,
    backgroundColor: colors.successSurface,
    flexShrink: 1,
  },
  chipOffline: {
    borderColor: '#F2D49B',
    backgroundColor: '#FFF6E5',
  },
  chipText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.success,
  },
  chipTextOffline: {
    color: '#7A4A00',
  },
  divider: {
    width: 1,
    height: 22,
    backgroundColor: colors.divider,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  clock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clockText: {
    ...typography.label,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    maxWidth: 260,
  },
  profilePressed: {
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySurface,
  },
  avatarEmergency: {
    backgroundColor: colors.error,
  },
  avatarText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  avatarTextLight: {
    color: colors.onPrimary,
  },
  profileText: {
    flexShrink: 1,
  },
  name: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  role: {
    ...typography.helper,
    color: colors.textSecondary,
  },
  roleEmergency: {
    color: colors.error,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    backgroundColor: '#F3F5F8',
  },
  contentInner: {
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
});
