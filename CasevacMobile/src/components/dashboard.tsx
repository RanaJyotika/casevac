/**
 * Home dashboard building blocks (UI_DESIGN_GUIDELINES.md §9–10).
 * Charts are drawn with plain Views: no chart dependency, no animation,
 * every value printed as a number, triage colour always paired with its label.
 */
import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import {
  STAGE_LABEL,
  STAGE_ORDER,
  TRIAGE_ORDER,
  type CasualtySummary,
  type CompanyBreakdown,
  type TriageCounts,
} from '../services/dashboard/dashboardStats';
import {
  colors,
  fonts,
  layout,
  radius,
  spacing,
  triage,
  typography,
} from '../theme/tokens';
import type { EvacuationStage, TriageCategory } from '../types';
import { formatTime } from '../utils/format';
import { Chevron } from './icons';

/* ----------------------------- Quick action ----------------------------- */

interface QuickActionTileProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  variant?: 'primary' | 'secondary';
  onPress: () => void;
  accessibilityHint?: string;
}

export function QuickActionTile({
  title,
  subtitle,
  icon,
  variant = 'secondary',
  onPress,
  accessibilityHint,
}: QuickActionTileProps) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint ?? subtitle}
      style={({ pressed }) => [
        styles.tile,
        primary ? styles.tilePrimary : styles.tileSecondary,
        pressed &&
          (primary ? styles.tilePrimaryPressed : styles.tileSecondaryPressed),
      ]}
    >
      <View style={[styles.tileIcon, primary && styles.tileIconPrimary]}>
        {icon}
      </View>
      <View style={styles.tileText}>
        <Text
          style={[styles.tileTitle, primary && styles.onPrimary]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={[styles.tileSubtitle, primary && styles.onPrimaryMuted]}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      </View>
      <Chevron color={primary ? colors.onPrimary : colors.textSecondary} />
    </Pressable>
  );
}

/* ----------------------------- Summary card ----------------------------- */

interface SummaryCardProps {
  label: string;
  value: number;
  /** Triage cards show the category colour bar, label and meaning. */
  category?: TriageCategory;
  style?: StyleProp<ViewStyle>;
}

export function SummaryCard({
  label,
  value,
  category,
  style,
}: SummaryCardProps) {
  const t = category ? triage[category] : null;
  return (
    <View
      style={[styles.card, style]}
      accessible
      accessibilityLabel={`${t ? `${t.label}, ${label}` : label}: ${value}`}
    >
      {t ? (
        <View style={[styles.cardStrip, { backgroundColor: t.fill }]} />
      ) : null}
      <Text style={styles.cardValue}>{value}</Text>
      {t ? (
        <Text style={styles.cardLabel} numberOfLines={2}>
          {t.label}
          <Text style={styles.cardCaption}>{`\n${label}`}</Text>
        </Text>
      ) : (
        <Text style={styles.cardLabel} numberOfLines={2}>
          {label}
        </Text>
      )}
    </View>
  );
}

/* ------------------------------ Chart card ------------------------------ */

interface ChartCardProps {
  title: string;
  meta?: string;
  /** Shown on the right of the header instead of `meta` (e.g. a legend). */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function ChartCard({
  title,
  meta,
  headerRight,
  children,
  style,
}: ChartCardProps) {
  return (
    <View style={[styles.chartCard, style]}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle} accessibilityRole="header">
          {title}
        </Text>
        {headerRight ??
          (meta ? <Text style={styles.chartMeta}>{meta}</Text> : null)}
      </View>
      {children}
    </View>
  );
}

/* ----------------------------- Triage badge ----------------------------- */

export function TriageBadge({ category }: { category: TriageCategory }) {
  const t = triage[category];
  return (
    <View
      style={[styles.triageBadge, { backgroundColor: t.fill }]}
      accessible
      accessibilityLabel={`Triage ${t.label}, ${t.meaning}`}
    >
      <Text style={[styles.triageBadgeText, { color: t.onFill }]}>
        {t.label}
      </Text>
    </View>
  );
}

export function TriageLegend() {
  return (
    <View style={styles.legend} accessibilityRole="text">
      {TRIAGE_ORDER.map(c => (
        <View key={c} style={styles.legendItem}>
          <View
            style={[styles.legendSwatch, { backgroundColor: triage[c].fill }]}
          />
          <Text style={styles.legendText}>{triage[c].label}</Text>
        </View>
      ))}
    </View>
  );
}

/* ---------------------- Company stacked bar chart ----------------------- */

export function CompanyStackedBarChart({ data }: { data: CompanyBreakdown[] }) {
  const max = Math.max(1, ...data.map(d => d.total));
  return (
    <View style={styles.chartBody}>
      {data.map(d => {
        const breakdown = TRIAGE_ORDER.map(
          c => `${triage[c].label} ${d.counts[c]}`,
        ).join(', ');
        return (
          <View
            key={d.company}
            style={styles.barRow}
            accessible
            accessibilityLabel={`${d.company} company: ${d.total} casualties. ${breakdown}`}
          >
            <Text style={styles.barLabel} numberOfLines={1}>
              {d.company}
            </Text>
            <View style={styles.barTrack}>
              {d.total > 0 ? (
                <View style={[styles.barFill, { flex: d.total }]}>
                  {TRIAGE_ORDER.filter(c => d.counts[c] > 0).map(c => (
                    <View
                      key={c}
                      style={[
                        styles.segment,
                        { flex: d.counts[c], backgroundColor: triage[c].fill },
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          { color: triage[c].onFill },
                        ]}
                        numberOfLines={1}
                      >
                        {d.counts[c]}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {max - d.total > 0 ? (
                <View style={{ flex: max - d.total }} />
              ) : null}
            </View>
            <Text style={styles.barTotal}>{d.total}</Text>
          </View>
        );
      })}
    </View>
  );
}

/* ------------------------ Triage horizontal bars ------------------------ */

export function TriageBarChart({ counts }: { counts: TriageCounts }) {
  const max = Math.max(1, ...TRIAGE_ORDER.map(c => counts[c]));
  return (
    <View style={styles.chartBody}>
      {TRIAGE_ORDER.map(c => {
        const t = triage[c];
        return (
          <View
            key={c}
            style={styles.triageRow}
            accessible
            accessibilityLabel={`${t.label}, ${t.meaning}: ${counts[c]}`}
          >
            <View style={styles.triageLabelCol}>
              <Text style={styles.triageLabel}>{t.label}</Text>
              <Text style={styles.triageMeaning} numberOfLines={1}>
                {t.meaning}
              </Text>
            </View>
            <View style={styles.barTrack}>
              {counts[c] > 0 ? (
                <View
                  style={[
                    styles.triageFill,
                    { flex: counts[c], backgroundColor: t.fill },
                  ]}
                />
              ) : null}
              {max - counts[c] > 0 ? (
                <View style={{ flex: max - counts[c] }} />
              ) : null}
            </View>
            <Text style={styles.barTotal}>{counts[c]}</Text>
          </View>
        );
      })}
    </View>
  );
}

/* --------------------------- Evacuation flow ---------------------------- */

export function EvacuationFlow({
  byStage,
}: {
  byStage: Record<EvacuationStage, number>;
}) {
  return (
    <View style={styles.flow}>
      {STAGE_ORDER.map((stage, index) => (
        <React.Fragment key={stage}>
          {index > 0 ? (
            <Text style={styles.flowArrow} importantForAccessibility="no">
              ↓
            </Text>
          ) : null}
          <View
            style={[
              styles.flowStep,
              stage === 'COMPLETED' && styles.flowStepDone,
            ]}
            accessible
            accessibilityLabel={`Step ${index + 1}, ${STAGE_LABEL[stage]}: ${
              byStage[stage]
            }`}
          >
            <Text style={styles.flowIndex}>{index + 1}</Text>
            <Text style={styles.flowLabel} numberOfLines={1}>
              {STAGE_LABEL[stage]}
            </Text>
            <Text style={styles.flowValue}>{byStage[stage]}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

/* ------------------------ Recent activity table ------------------------- */

const COLUMNS = [
  { key: 'id', title: 'Casualty ID', flex: 1.25 },
  { key: 'name', title: 'Name', flex: 1.6 },
  { key: 'company', title: 'Company', flex: 1 },
  { key: 'triage', title: 'Triage', flex: 1 },
  { key: 'status', title: 'Status', flex: 1.25 },
  { key: 'time', title: 'Updated', flex: 0.8 },
] as const;

export function RecentActivityTable({ rows }: { rows: CasualtySummary[] }) {
  if (rows.length === 0) {
    return (
      <Text style={styles.empty}>No casualty activity on this tablet yet.</Text>
    );
  }
  return (
    <View style={styles.table}>
      <View style={[styles.tableRow, styles.tableHead]}>
        {COLUMNS.map(col => (
          <Text
            key={col.key}
            style={[styles.th, { flex: col.flex }]}
            numberOfLines={1}
          >
            {col.title}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View
          key={r.casualtyId}
          style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}
          accessible
          accessibilityLabel={`${r.casualtyId}, ${
            r.name ?? 'unidentified, temporary record'
          }, ${r.company} company, triage ${r.triage}, ${
            STAGE_LABEL[r.stage]
          }, updated ${formatTime(r.updatedAt)}`}
        >
          <Text
            style={[styles.td, styles.mono, { flex: COLUMNS[0].flex }]}
            numberOfLines={1}
          >
            {r.casualtyId}
          </Text>
          <Text
            style={[
              styles.td,
              !r.name && styles.tdMuted,
              { flex: COLUMNS[1].flex },
            ]}
            numberOfLines={1}
          >
            {r.name ?? 'Unidentified'}
          </Text>
          <Text
            style={[styles.td, { flex: COLUMNS[2].flex }]}
            numberOfLines={1}
          >
            {r.company}
          </Text>
          <View style={{ flex: COLUMNS[3].flex }}>
            <TriageBadge category={r.triage} />
          </View>
          <Text
            style={[styles.td, { flex: COLUMNS[4].flex }]}
            numberOfLines={2}
          >
            {STAGE_LABEL[r.stage]}
          </Text>
          <Text style={[styles.td, styles.mono, { flex: COLUMNS[5].flex }]}>
            {formatTime(r.updatedAt)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* -------------------------------- Styles -------------------------------- */

const styles = StyleSheet.create({
  /* Quick action tile */
  tile: {
    flex: 1,
    minWidth: 220,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: layout.cardPadding,
    borderRadius: radius.lg,
    borderWidth: layout.borderWidth,
  },
  tilePrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tilePrimaryPressed: {
    backgroundColor: colors.primaryPressed,
  },
  tileSecondary: {
    backgroundColor: colors.background,
    borderColor: colors.borderStrong,
  },
  tileSecondaryPressed: {
    backgroundColor: colors.surfaceStrong,
  },
  tileIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  tileIconPrimary: {
    borderColor: 'rgba(255,255,255,0.55)',
  },
  tileText: {
    flex: 1,
    gap: 2,
  },
  tileTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tileSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  onPrimary: {
    color: colors.onPrimary,
  },
  onPrimaryMuted: {
    color: colors.onPrimaryMuted,
  },

  /* Summary card */
  card: {
    flex: 1,
    minWidth: 104,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md + 2,
    paddingBottom: spacing.md,
    gap: 0,
    backgroundColor: colors.background,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  cardStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
  },
  cardLabel: {
    ...typography.label,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardValue: {
    ...typography.cardValue,
    color: colors.textPrimary,
  },
  cardCaption: {
    ...typography.label,
    fontWeight: '400',
    color: colors.textSecondary,
  },

  /* Chart card */
  chartCard: {
    padding: layout.cardPadding,
    gap: spacing.md,
    backgroundColor: colors.background,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  chartTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  chartMeta: {
    ...typography.helper,
    color: colors.textSecondary,
  },
  chartBody: {
    gap: 6,
  },

  /* Bars */
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 28,
  },
  barLabel: {
    ...typography.table,
    width: 72,
    color: colors.textPrimary,
  },
  barTrack: {
    flex: 1,
    height: 24,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    flexDirection: 'row',
    gap: 1,
  },
  segment: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  segmentText: {
    ...typography.helper,
    fontWeight: '700',
  },
  barTotal: {
    ...typography.table,
    width: 32,
    textAlign: 'right',
    fontWeight: '700',
    color: colors.textPrimary,
  },
  triageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 42,
  },
  triageFill: {
    borderRadius: 3,
  },
  triageLabelCol: {
    width: 128,
  },
  triageLabel: {
    ...typography.table,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  triageMeaning: {
    ...typography.helper,
    color: colors.textSecondary,
  },

  /* Legend */
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  legendText: {
    ...typography.helper,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  /* Triage badge */
  triageBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  triageBadgeText: {
    ...typography.helper,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  /* Evacuation flow */
  flow: {
    gap: 2,
  },
  flowStep: {
    minHeight: layout.tableRowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  flowStepDone: {
    backgroundColor: colors.successSurface,
    borderColor: colors.successBorder,
  },
  flowIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: layout.borderWidth,
    borderColor: colors.borderStrong,
    textAlign: 'center',
    textAlignVertical: 'center',
    ...typography.helper,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  flowLabel: {
    ...typography.table,
    flex: 1,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  flowValue: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  flowArrow: {
    marginLeft: spacing.md + 6,
    fontSize: 14,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  /* Table */
  table: {
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  tableRow: {
    minHeight: layout.tableRowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: layout.borderWidth,
    borderTopColor: colors.divider,
  },
  tableHead: {
    minHeight: 40,
    borderTopWidth: 0,
    backgroundColor: colors.surface,
  },
  tableRowAlt: {
    backgroundColor: '#FAFBFC',
  },
  th: {
    ...typography.helper,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  td: {
    ...typography.table,
    color: colors.textPrimary,
  },
  tdMuted: {
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: 14,
  },
  empty: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
