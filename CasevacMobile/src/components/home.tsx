/**
 * Home screen building blocks (Home UI v3, 13 Nov 2026).
 *
 * Light, compact, readable under pressure:
 * - every control ≥ 44–48 dp with ≥ 8 dp between neighbours
 * - triage colour always paired with its word; statuses have text + icon
 * - no decoration that carries no information; no animation
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  STAGE_LABEL,
  type CasualtySummary,
  type HomeAlert,
  type TriageCounts,
} from '../services/dashboard/dashboardStats';
import {
  lookupPatientById,
  type ManualIdentification,
} from '../services/identity/manualLookup';
import type { IdentityDirectory } from '../services/identity/types';
import {
  colors,
  fonts,
  layout,
  radius,
  spacing,
  touchTarget,
  triage,
  triageTint,
  typography,
} from '../theme/tokens';
import type { EvacuationStage, TriageCategory } from '../types';
import { formatTime } from '../utils/format';
import { TRIAGE_SHORT } from './dashboard';
import { Icon, type IconName } from './Icon';

/* -------------------------------- Helpers -------------------------------- */

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');

/** "Today, 14:22", "Yesterday, 09:10", or "12 Nov, 08:00". */
export function formatDayTime(iso: string, now: number): string {
  const d = new Date(iso);
  const today = new Date(now);
  const yesterday = new Date(now - 86_400_000);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const day = same(d, today)
    ? 'Today'
    : same(d, yesterday)
    ? 'Yesterday'
    : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return `${day}, ${formatTime(iso)}`;
}

/* --------------------------------- Card --------------------------------- */

export function Card({
  title,
  subtitle,
  action,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
  /** Shown at the right of the header, e.g. a scope toggle. */
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.flex}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.cardSubtitle}>{subtitle}</Text>
          ) : null}
        </View>
        {action ? (
          <Pressable
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${title}: ${action.label}`}
            hitSlop={8}
            style={({ pressed }) => [
              styles.link,
              pressed && styles.linkPressed,
            ]}
          >
            <Text style={styles.linkText}>{action.label}</Text>
            <Icon name="chevronRight" size={16} color={colors.primary} />
          </Pressable>
        ) : null}
        {right}
      </View>
      {children}
    </View>
  );
}

/* ------------------------------ Pill toggle ------------------------------ */

/** Two-or-more option pill bar; the selected option is filled. */
export function PillToggle<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View
      style={styles.toggle}
      accessibilityRole="tablist"
      accessibilityLabel={label}
    >
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            hitSlop={4}
            style={[styles.toggleOption, selected && styles.toggleSelected]}
          >
            <Text
              style={[styles.toggleText, selected && styles.toggleTextSelected]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------ First actions ------------------------------ */

export function ScanCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Scan patient tag"
      accessibilityHint="Opens the camera to read the casualty's wristband QR"
      style={({ pressed }) => [styles.scan, pressed && styles.scanPressed]}
    >
      <View style={styles.scanIcon}>
        <Icon name="scan" size={34} color={colors.onPrimary} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.scanTitle}>Scan QR Tag</Text>
        <Text style={styles.scanSubtitle}>Open or update casualty record</Text>
      </View>
      <View style={styles.scanChevron}>
        <Icon name="chevronRight" size={22} color={colors.onPrimary} />
      </View>
    </Pressable>
  );
}

/**
 * Manual ID search, typed in place. Exact matches on this tablet only;
 * manual entry never verifies the wristband (said in the hint and on the
 * identification screen).
 */
export function IdSearch({
  directory,
  onFound,
  onRegisterNotFound,
}: {
  directory: IdentityDirectory;
  onFound: (result: ManualIdentification) => void;
  /** Offered when the ID is not on this tablet: register the casualty by hand. */
  onRegisterNotFound?: (enteredId: string) => void;
}) {
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [notFoundId, setNotFoundId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const search = async () => {
    if (searching) {
      return;
    }
    setSearching(true);
    try {
      const result = await lookupPatientById(value, directory);
      setNotFoundId(null);
      if (result.ok) {
        setValue('');
        setMessage(null);
        onFound(result);
      } else if (result.reason === 'EMPTY') {
        setMessage('Enter the soldier or casualty ID.');
      } else {
        setMessage(`No patient with ID ${result.enteredId} on this tablet.`);
        setNotFoundId(result.enteredId);
      }
    } finally {
      setSearching(false);
    }
  };

  return (
    <View style={styles.searchBlock}>
      <View style={styles.searchRow}>
        <View
          style={[styles.searchField, message ? styles.searchFieldError : null]}
        >
          <Icon name="search" size={20} color={colors.textSecondary} />
          <TextInput
            value={value}
            onChangeText={text => {
              setValue(text);
              setMessage(null);
              setNotFoundId(null);
            }}
            placeholder="Enter Soldier ID / Casualty ID"
            placeholderTextColor={colors.placeholder}
            accessibilityLabel="Patient or casualty ID"
            accessibilityHint="Looks the ID up on this tablet. Manual entry does not verify the wristband."
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={search}
            editable={!searching}
            style={styles.searchInput}
          />
        </View>
        <Pressable
          onPress={search}
          disabled={searching}
          accessibilityRole="button"
          accessibilityLabel="Find patient"
          accessibilityState={{ disabled: searching, busy: searching }}
          style={({ pressed }) => [
            styles.searchButton,
            pressed && styles.scanPressed,
          ]}
        >
          <Text style={styles.searchButtonText}>
            {searching ? '…' : 'Search'}
          </Text>
        </Pressable>
      </View>
      {message ? (
        <View style={styles.searchMessageRow}>
          <Text
            style={[styles.searchError, styles.flex]}
            accessibilityLiveRegion="polite"
          >
            {message}
          </Text>
          {notFoundId && onRegisterNotFound ? (
            <Pressable
              onPress={() => onRegisterNotFound(notFoundId)}
              accessibilityRole="button"
              accessibilityLabel="Register as new patient"
              hitSlop={8}
              style={({ pressed }) => [
                styles.link,
                pressed && styles.linkPressed,
              ]}
            >
              <Text style={styles.linkText}>Register as new patient</Text>
              <Icon name="chevronRight" size={16} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function RegisterBar({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Register casualty"
      accessibilityHint="For a casualty with no tag or who cannot be identified"
      style={({ pressed }) => [
        styles.register,
        pressed && styles.registerPressed,
      ]}
    >
      <Icon name="userPlus" size={24} color={colors.primary} />
      <Text style={styles.registerText} numberOfLines={1}>
        Register New Casualty
      </Text>
      <View style={styles.flex} />
      <View style={styles.registerPill}>
        <Text style={styles.registerPillText}>No tag / Unidentified</Text>
      </View>
      <Icon name="chevronRight" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

/* --------------------------------- Pills --------------------------------- */

export function TriagePill({ category }: { category: TriageCategory }) {
  const tint = triageTint[category];
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: tint.surface, borderColor: tint.border },
      ]}
      accessible
      accessibilityLabel={`Triage ${triage[category].label}, ${TRIAGE_SHORT[category]}`}
    >
      <View style={[styles.dot, { backgroundColor: triage[category].fill }]} />
      <Text style={[styles.pillText, { color: tint.text }]} numberOfLines={1}>
        {triage[category].label} · {TRIAGE_SHORT[category]}
      </Text>
    </View>
  );
}

const STATUS: Record<
  EvacuationStage,
  { label: string; icon: IconName; surface: string; text: string }
> = {
  AWAITING_PICKUP: {
    label: 'Awaiting pickup',
    icon: 'clock',
    surface: '#FEF5DC',
    text: '#7A5200',
  },
  IN_TRANSFER: {
    label: 'In transfer',
    icon: 'arrowRight',
    surface: '#EAF0FD',
    text: '#1E40AF',
  },
  HANDED_OVER: {
    label: 'Handover complete',
    icon: 'check',
    surface: '#E7F5EC',
    text: '#1E6B35',
  },
  COMPLETED: {
    label: 'Closed',
    icon: 'check',
    surface: '#ECEEF2',
    text: '#3B4652',
  },
};

export function StatusPill({ stage }: { stage: EvacuationStage }) {
  const s = STATUS[stage];
  return (
    <View
      style={[styles.pill, styles.statusPill, { backgroundColor: s.surface }]}
    >
      <Icon name={s.icon} size={14} color={s.text} strokeWidth={2.5} />
      <Text style={[styles.pillText, { color: s.text }]} numberOfLines={1}>
        {s.label}
      </Text>
    </View>
  );
}

const STAGE_ICON: Record<EvacuationStage, IconName> = {
  AWAITING_PICKUP: 'mapPin',
  IN_TRANSFER: 'truck',
  HANDED_OVER: 'hospital',
  COMPLETED: 'check',
};

/* ---------------------------- Active evacuations --------------------------- */

export function EvacuationRows({
  rows,
  onContinue,
  emptyText,
}: {
  rows: CasualtySummary[];
  onContinue: (row: CasualtySummary) => void;
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <Text style={styles.empty}>{emptyText}</Text>;
  }
  return (
    <View>
      {rows.map((r, i) => (
        <View key={r.casualtyId} style={[styles.row, i > 0 && styles.rowLine]}>
          <Text style={[styles.cell, styles.idCell]} numberOfLines={1}>
            {r.casualtyId}
          </Text>
          <Text
            style={[styles.cell, styles.nameCell, !r.name && styles.unknown]}
            numberOfLines={1}
          >
            {r.name ?? 'Unidentified'}
          </Text>
          <View style={styles.triageCell}>
            <TriagePill category={r.triage} />
          </View>
          <View style={styles.stageCell}>
            <Icon
              name={STAGE_ICON[r.stage]}
              size={18}
              color={colors.textSecondary}
            />
            <Text style={styles.stageText} numberOfLines={1}>
              {STAGE_LABEL[r.stage]}
            </Text>
          </View>
          <View style={styles.updatedCell}>
            <Text style={styles.updatedLabel}>Updated</Text>
            <Text style={styles.updatedTime}>{formatTime(r.updatedAt)}</Text>
          </View>
          <Pressable
            onPress={() => onContinue(r)}
            accessibilityRole="button"
            accessibilityLabel={`Continue ${r.casualtyId}`}
            hitSlop={6}
            style={({ pressed }) => [
              styles.continue,
              pressed && styles.registerPressed,
            ]}
          >
            <Text style={styles.continueText}>Continue</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------ Recent records ----------------------------- */

export function RecentRecordRows({
  rows,
  now,
  emptyText,
  compact = false,
}: {
  rows: CasualtySummary[];
  now: number;
  emptyText: string;
  /** Two-line rows for a narrow column (no table header). */
  compact?: boolean;
}) {
  if (rows.length === 0) {
    return <Text style={styles.empty}>{emptyText}</Text>;
  }
  const label = (r: CasualtySummary) =>
    `${r.casualtyId}, ${r.name ?? 'unidentified'}, ${
      r.company
    }, ${formatDayTime(r.updatedAt, now)}, ${STATUS[r.stage].label}`;
  if (compact) {
    return (
      <View>
        {rows.map((r, i) => (
          <View
            key={r.casualtyId}
            style={[styles.compactRow, i > 0 && styles.rowLine]}
            accessible
            accessibilityLabel={label(r)}
          >
            <View style={styles.flex}>
              <Text style={styles.compactTop} numberOfLines={1}>
                <Text style={styles.compactId}>{r.casualtyId}</Text>
                {'  '}
                <Text style={!r.name ? styles.unknown : undefined}>
                  {r.name ?? 'Unidentified'}
                </Text>
              </Text>
              <Text style={styles.compactMeta} numberOfLines={1}>
                {r.company} · {formatDayTime(r.updatedAt, now)}
              </Text>
            </View>
            <View style={styles.compactStatus}>
              <StatusPill stage={r.stage} />
            </View>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View>
      <View style={[styles.row, styles.headRow]}>
        <Text style={[styles.th, styles.idHead]}>Casualty ID</Text>
        <Text style={[styles.th, styles.nameCell]}>Patient</Text>
        <Text style={[styles.th, styles.unitCell]}>Company</Text>
        <Text style={[styles.th, styles.dateCell]}>Date & Time</Text>
        <Text style={[styles.th, styles.statusCell]}>Status</Text>
      </View>
      {rows.map(r => (
        <View
          key={r.casualtyId}
          style={[styles.row, styles.rowLine, styles.recordRow]}
          accessible
          accessibilityLabel={label(r)}
        >
          <Text style={[styles.cell, styles.idCell]} numberOfLines={1}>
            {r.casualtyId}
          </Text>
          <Text
            style={[styles.cell, styles.nameCell, !r.name && styles.unknown]}
            numberOfLines={1}
          >
            {r.name ?? 'Unidentified'}
          </Text>
          <Text style={[styles.cellPlain, styles.unitCell]} numberOfLines={1}>
            {r.company}
          </Text>
          <Text style={[styles.cellPlain, styles.dateCell]} numberOfLines={1}>
            {formatDayTime(r.updatedAt, now)}
          </Text>
          <View style={styles.statusCell}>
            <StatusPill stage={r.stage} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* --------------------------------- Alerts --------------------------------- */

const ALERT_ICON: Record<HomeAlert['id'], IconName> = {
  'red-wait': 'alert',
  handover: 'handover',
  unsynced: 'cloudUp',
  reassess: 'clock',
};

const ALERT_TONE = {
  critical: {
    surface: '#FDEEEE',
    border: '#F5C6C6',
    icon: '#D92D20',
    button: '#B42318',
  },
  warning: {
    surface: '#FFF7E6',
    border: '#F5DDA6',
    icon: '#C2700A',
    button: '#8A5300',
  },
} as const;

export function AlertCards({
  alerts,
  onAction,
}: {
  alerts: HomeAlert[];
  onAction: (alert: HomeAlert) => void;
}) {
  if (alerts.length === 0) {
    return <Text style={styles.empty}>No pending handovers or alerts.</Text>;
  }
  return (
    <View style={styles.alerts}>
      {alerts.map(a => {
        const tone = ALERT_TONE[a.tone];
        return (
          <View
            key={a.id}
            style={[
              styles.alert,
              { backgroundColor: tone.surface, borderColor: tone.border },
            ]}
          >
            <View style={[styles.alertIcon, { backgroundColor: tone.icon }]}>
              <Icon name={ALERT_ICON[a.id]} size={22} color="#FFFFFF" />
            </View>
            <View
              style={styles.flex}
              accessible
              accessibilityRole={a.tone === 'critical' ? 'alert' : 'text'}
              accessibilityLabel={`${a.title}. ${a.detail}`}
            >
              <Text style={styles.alertTitle} numberOfLines={1}>
                {a.title}
              </Text>
              <Text style={styles.alertDetail} numberOfLines={2}>
                {a.detail}
              </Text>
            </View>
            <Pressable
              onPress={() => onAction(a)}
              accessibilityRole="button"
              accessibilityLabel={`${a.title}: ${a.action}`}
              style={({ pressed }) => [
                styles.alertButton,
                { borderColor: tone.button },
                pressed && styles.alertButtonPressed,
              ]}
            >
              <Text
                style={[styles.alertButtonText, { color: tone.button }]}
                numberOfLines={1}
              >
                {a.action}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

/* -------------------------------- Snapshot -------------------------------- */

const SNAPSHOT_WORD: Record<TriageCategory, string> = {
  RED: 'Red',
  YELLOW: 'Yellow',
  GREEN: 'Green',
  BLACK: 'Black',
};

export function SnapshotTiles({
  total,
  counts,
}: {
  total: number;
  counts: TriageCounts;
}) {
  return (
    <View style={styles.tiles}>
      <View
        style={[styles.tile, styles.tileTotal]}
        accessible
        accessibilityLabel={`Total casualties: ${total}`}
      >
        <Text style={styles.tileLabel}>Total{'\n'}Casualties</Text>
        <Text style={styles.tileValue}>{total}</Text>
      </View>
      {(['RED', 'YELLOW', 'GREEN', 'BLACK'] as const).map(c => (
        <View
          key={c}
          style={[
            styles.tile,
            {
              backgroundColor: triageTint[c].surface,
              borderColor: triageTint[c].border,
            },
          ]}
          accessible
          accessibilityLabel={`${SNAPSHOT_WORD[c]}, ${TRIAGE_SHORT[c]}: ${counts[c]}`}
        >
          <Text style={[styles.tileLabel, { color: triageTint[c].text }]}>
            {SNAPSHOT_WORD[c]}
          </Text>
          <Text style={[styles.tileValue, { color: triageTint[c].text }]}>
            {counts[c]}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* --------------------------------- Styles --------------------------------- */

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  empty: { ...typography.caption, color: colors.textSecondary },
  unknown: { fontStyle: 'italic', color: colors.textSecondary },

  /* Card */
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg + 4,
    borderWidth: layout.borderWidth,
    borderColor: colors.divider,
    backgroundColor: colors.background,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  cardTitle: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardSubtitle: { ...typography.helper, color: colors.textSecondary },
  toggle: {
    flexDirection: 'row',
    padding: 3,
    gap: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong,
  },
  toggleOption: {
    minHeight: 40,
    paddingHorizontal: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  toggleSelected: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toggleTextSelected: {
    fontWeight: '700',
    color: colors.onPrimary,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 32,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
  },
  linkPressed: { backgroundColor: colors.primarySurface },
  linkText: { ...typography.caption, fontWeight: '700', color: colors.primary },

  /* Scan */
  scan: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg + 2,
    backgroundColor: colors.primary,
  },
  scanPressed: { backgroundColor: colors.primaryPressed },
  scanIcon: { width: 48, alignItems: 'center' },
  scanTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  scanSubtitle: { ...typography.caption, color: colors.onPrimaryMuted },
  scanChevron: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  /* Search */
  searchBlock: { gap: 6 },
  searchRow: { flexDirection: 'row', gap: spacing.md },
  searchField: {
    flex: 1,
    minWidth: 0,
    height: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: layout.borderWidth,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  searchFieldError: { borderColor: colors.error, borderWidth: 2 },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: touchTarget - 2,
    padding: 0,
    fontSize: 16,
    color: colors.textPrimary,
  },
  searchButton: {
    minWidth: 104,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  searchButtonText: { ...typography.button, color: colors.onPrimary },
  searchMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  searchError: { ...typography.helper, fontWeight: '700', color: colors.error },

  /* Register */
  register: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: layout.borderWidth,
    borderColor: '#D3DEF8',
    backgroundColor: colors.primarySurface,
  },
  registerPressed: { backgroundColor: '#DCE6FB' },
  registerText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.primary,
  },
  registerPill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  registerPillText: { ...typography.helper, color: colors.textSecondary },

  /* Pills */
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: layout.borderWidth,
    maxWidth: '100%',
  },
  statusPill: { borderWidth: 0, paddingHorizontal: spacing.sm + 2 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  pillText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },

  /* Tables */
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowLine: {
    borderTopWidth: layout.borderWidth,
    borderTopColor: colors.divider,
  },
  headRow: { minHeight: 32 },
  compactRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 6,
  },
  compactTop: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  compactId: { fontFamily: fonts.mono, fontSize: 13, fontWeight: '400' },
  compactStatus: { justifyContent: 'center' },
  compactMeta: { ...typography.helper, color: colors.textSecondary },
  recordRow: { minHeight: 46 },
  th: { ...typography.helper, fontWeight: '600', color: colors.textSecondary },
  cell: { ...typography.caption, fontWeight: '700', color: colors.textPrimary },
  cellPlain: { ...typography.caption, color: colors.textPrimary },
  idCell: { flex: 0.95, fontFamily: fonts.mono, fontSize: 13 },
  idHead: { flex: 0.95 },
  nameCell: { flex: 1.3 },
  triageCell: { flex: 1.35 },
  stageCell: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stageText: { ...typography.helper, flexShrink: 1, color: colors.textPrimary },
  updatedCell: { width: 60 },
  updatedLabel: { fontSize: 11, lineHeight: 14, color: colors.textSecondary },
  updatedTime: {
    ...typography.helper,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  unitCell: { flex: 0.85 },
  dateCell: { flex: 1.15 },
  statusCell: { flex: 1.45 },
  continue: {
    minHeight: 40,
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  continueText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },

  /* Alerts */
  alerts: { gap: spacing.sm + 2 },
  alert: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md + 2,
    borderWidth: layout.borderWidth,
  },
  alertIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  alertDetail: { ...typography.helper, color: colors.textSecondary },
  alertButton: {
    minHeight: 44,
    minWidth: 104,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    backgroundColor: colors.background,
  },
  alertButtonPressed: { backgroundColor: colors.surface },
  alertButtonText: { ...typography.caption, fontWeight: '700' },

  /* Snapshot tiles */
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    minWidth: 0,
    minHeight: 84,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md + 2,
    borderWidth: layout.borderWidth,
  },
  tileTotal: {
    flex: 1.3,
    backgroundColor: colors.surface,
    borderColor: colors.divider,
  },
  tileLabel: {
    ...typography.helper,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tileValue: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
