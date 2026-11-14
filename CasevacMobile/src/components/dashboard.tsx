/**
 * Home charts (UI_DESIGN_GUIDELINES.md §9–10): triage donut (react-native-svg)
 * and casualties by company (plain Views). No animation; every value printed
 * as a number; triage colour always paired with its word.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import {
  TRIAGE_ORDER,
  type CompanyBreakdown,
  type TriageCounts,
} from '../services/dashboard/dashboardStats';
import { colors, spacing, triage, typography } from '../theme/tokens';
import type { TriageCategory } from '../types';

/** Short meanings used on Home (pills, tiles and the donut legend). */
export const TRIAGE_SHORT: Record<TriageCategory, string> = {
  RED: 'Critical',
  YELLOW: 'Serious',
  GREEN: 'Minor',
  BLACK: 'Expectant',
};

const WORD: Record<TriageCategory, string> = {
  RED: 'Red',
  YELLOW: 'Yellow',
  GREEN: 'Green',
  BLACK: 'Black',
};

/**
 * Triage distribution: donut (total in the centre) beside a legend that
 * prints each colour's word, meaning, count and share.
 */
export function TriageDonut({
  counts,
  size = 156,
}: {
  counts: TriageCounts;
  size?: number;
}) {
  const total = TRIAGE_ORDER.reduce((sum, c) => sum + counts[c], 0);
  const stroke = 26;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const centre = size / 2;
  const present = TRIAGE_ORDER.filter(c => counts[c] > 0);
  // A thin gap between segments keeps adjacent colours distinct.
  const gap = present.length > 1 ? 2 : 0;

  let offset = 0;
  const segments = present.map(c => {
    const length = (circumference * counts[c]) / total;
    const segment = { c, length, offset };
    offset += length;
    return segment;
  });

  const pct = (n: number) =>
    total === 0 ? '0%' : `${Math.round((n / total) * 100)}%`;
  const summary = TRIAGE_ORDER.map(c => `${triage[c].label} ${counts[c]}`).join(
    ', ',
  );

  return (
    <View style={styles.body}>
      <View
        style={[styles.donut, { width: size, height: size }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${total} casualties by triage colour: ${summary}`}
      >
        <Svg width={size} height={size}>
          <G rotation={-90} origin={`${centre}, ${centre}`}>
            <Circle
              cx={centre}
              cy={centre}
              r={r}
              stroke={colors.surfaceStrong}
              strokeWidth={stroke}
              fill="none"
            />
            {segments.map(s => (
              <Circle
                key={s.c}
                cx={centre}
                cy={centre}
                r={r}
                stroke={triage[s.c].fill}
                strokeWidth={stroke}
                strokeDasharray={`${Math.max(
                  s.length - gap,
                  0,
                )} ${circumference}`}
                strokeDashoffset={-s.offset}
                fill="none"
              />
            ))}
          </G>
        </Svg>
        <View style={styles.centre} pointerEvents="none">
          <Text style={styles.total}>{total}</Text>
          <Text style={styles.caption}>Total</Text>
        </View>
      </View>
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Triage Distribution</Text>
        {TRIAGE_ORDER.map(c => (
          <View key={c} style={styles.row}>
            <View
              style={[styles.swatch, { backgroundColor: triage[c].fill }]}
            />
            <Text style={styles.label} numberOfLines={1}>
              {WORD[c]} ({TRIAGE_SHORT[c]})
            </Text>
            <Text style={styles.count}>{counts[c]}</Text>
            <Text style={styles.pct}>({pct(counts[c])})</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Casualties by company: one row per company, stacked triage segments with
 * each count printed inside, total on the right. Bars share one scale.
 */
export function CompanyBars({ data }: { data: CompanyBreakdown[] }) {
  const max = Math.max(1, ...data.map(d => d.total));
  return (
    <View style={styles.bars}>
      <View style={styles.barsHead}>
        <Text style={styles.legendTitle}>Casualties by Company</Text>
        <View style={styles.barsLegend}>
          {TRIAGE_ORDER.map(c => (
            <View key={c} style={styles.barsLegendItem}>
              <View
                style={[
                  styles.barsLegendSwatch,
                  { backgroundColor: triage[c].fill },
                ]}
              />
              <Text style={styles.barsLegendText}>{WORD[c]}</Text>
            </View>
          ))}
        </View>
      </View>
      {data.map(d => (
        <View
          key={d.company}
          style={styles.barRow}
          accessible
          accessibilityLabel={`${d.company} company: ${
            d.total
          } casualties. ${TRIAGE_ORDER.map(
            c => `${triage[c].label} ${d.counts[c]}`,
          ).join(', ')}`}
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
                      style={[styles.segmentText, { color: triage[c].onFill }]}
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
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bars: {
    gap: spacing.sm,
  },
  barsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: 2,
  },
  barsLegend: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  barsLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  barsLegendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  barsLegendText: {
    ...typography.helper,
    color: colors.textSecondary,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 28,
  },
  barLabel: {
    ...typography.caption,
    width: 64,
    color: colors.textPrimary,
  },
  barTrack: {
    flex: 1,
    height: 24,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 6,
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
    ...typography.caption,
    width: 28,
    textAlign: 'right',
    fontWeight: '700',
    color: colors.textPrimary,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  donut: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centre: {
    position: 'absolute',
    alignItems: 'center',
  },
  total: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  caption: {
    ...typography.helper,
    color: colors.textSecondary,
  },
  legend: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  legendTitle: {
    ...typography.label,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  label: {
    ...typography.caption,
    flex: 1,
    color: colors.textPrimary,
  },
  count: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  pct: {
    ...typography.helper,
    width: 46,
    textAlign: 'right',
    color: colors.textSecondary,
  },
});
