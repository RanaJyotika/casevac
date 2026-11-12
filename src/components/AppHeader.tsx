import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme/tokens';

interface AppHeaderProps {
  /** Small upper-case product label, e.g. "CASEVAC". */
  eyebrow: string;
  /** Optional screen title shown below the eyebrow. */
  title?: string;
  /** Element on the right, e.g. connectivity StatusBadge. */
  right?: React.ReactNode;
  /** Optional second row, e.g. signed-in clinician. */
  children?: React.ReactNode;
}

export function AppHeader({ eyebrow, title, right, children }: AppHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.topRow, !title && styles.topRowCompact]}>
        <View style={styles.titles}>
          <Text
            style={[styles.eyebrow, !title && styles.eyebrowStrong]}
            accessibilityRole={title ? undefined : 'header'}
          >
            {eyebrow}
          </Text>
          {title ? (
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
      {children ? <View style={styles.subRow}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: spacing.md,
  },
  topRowCompact: {
    minHeight: 56,
    paddingTop: 0,
    paddingBottom: 0,
  },
  titles: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.textSecondary,
  },
  eyebrowStrong: {
    color: colors.textPrimary,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  subRow: {
    paddingHorizontal: 20,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
});
