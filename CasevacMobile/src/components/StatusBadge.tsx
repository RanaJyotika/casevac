import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme/tokens';
import type { StatusTone } from '../utils/format';

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
}

const TONES: Record<
  StatusTone,
  { text: string; surface: string; border: string; dot: string }
> = {
  neutral: {
    text: colors.textMuted,
    surface: colors.surface,
    border: colors.border,
    dot: colors.textSecondary,
  },
  success: {
    text: colors.success,
    surface: colors.successSurface,
    border: colors.successBorder,
    dot: colors.success,
  },
  warning: {
    text: colors.warning,
    surface: colors.warningSurface,
    border: colors.warningBorder,
    dot: colors.warningStrong,
  },
  error: {
    text: colors.error,
    surface: colors.errorSurface,
    border: colors.errorBorder,
    dot: colors.error,
  },
};

/**
 * Compact status label. Meaning is always carried by the text,
 * never by colour alone.
 */
export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  const palette = TONES[tone];
  return (
    <View
      accessible
      accessibilityLabel={`Status: ${label}`}
      style={[
        styles.badge,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <View
        style={[styles.dot, { backgroundColor: palette.dot }]}
        importantForAccessibility="no"
      />
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
});
