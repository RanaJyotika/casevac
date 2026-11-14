import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePatientStrip } from '../navigation/patientStripContext';
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from '../theme/tokens';

interface AppHeaderProps {
  /** Small upper-case product label, e.g. "CASEVAC". */
  eyebrow: string;
  /** Optional screen title shown below the eyebrow. */
  title?: string;
  /** Element on the right, e.g. connectivity StatusBadge. */
  right?: React.ReactNode;
  /** Optional second row, e.g. signed-in clinician. */
  children?: React.ReactNode;
  /** Shows a Back control (48 dp) when provided. */
  onBack?: () => void;
}

export function AppHeader({
  eyebrow,
  title,
  right,
  children,
  onBack,
}: AppHeaderProps) {
  const strip = usePatientStrip();
  return (
    <>
      <View style={styles.container}>
        <View style={[styles.topRow, !title && styles.topRowCompact]}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={4}
              style={({ pressed }) => [
                styles.back,
                pressed && styles.backPressed,
              ]}
            >
              <Text style={styles.backText}>‹</Text>
            </Pressable>
          ) : null}
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
      {/* Portrait: open patients, directly under the top bar. */}
      {strip}
    </>
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
  back: {
    width: touchTarget,
    height: touchTarget,
    marginLeft: -spacing.md,
    marginRight: -spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  backPressed: {
    backgroundColor: colors.surface,
  },
  backText: {
    fontSize: 32,
    lineHeight: 36,
    color: colors.textPrimary,
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
