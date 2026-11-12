import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

interface SectionPanelProps {
  title: string;
  /** Optional supporting text on the right of the title, e.g. a count. */
  meta?: string;
  children: React.ReactNode;
}

/** Titled, restrained bordered group (e.g. a list of rows). */
export function SectionPanel({ title, meta, children }: SectionPanelProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {title.toUpperCase()}
        </Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      <View style={styles.panel}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.textMuted,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  panel: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
});
