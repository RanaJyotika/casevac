import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing, typography } from '../theme/tokens';
import { Chevron } from './icons';

interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Render the title in a monospace face (for IDs such as EVAC-DEMO-001). */
  monoTitle?: boolean;
  /** Leading icon element. */
  leading?: React.ReactNode;
  /** Element shown next to the title, e.g. a StatusBadge. */
  badge?: React.ReactNode;
  /** Element shown before the chevron, e.g. a count. */
  trailing?: React.ReactNode;
  onPress: () => void;
  /** Hide the bottom divider on the last row of a panel. */
  isLast?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function ListRow({
  title,
  subtitle,
  monoTitle = false,
  leading,
  badge,
  trailing,
  onPress,
  isLast = false,
  accessibilityLabel,
  accessibilityHint,
}: ListRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.row,
        !isLast && styles.divider,
        pressed && styles.pressed,
      ]}
    >
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.body}>
        <View style={styles.titleLine}>
          <Text
            style={[styles.title, monoTitle && styles.mono]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {badge}
        </View>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      <Chevron />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    paddingVertical: spacing.md,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  pressed: {
    backgroundColor: colors.surface,
  },
  leading: {
    width: 24,
    alignItems: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  title: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  mono: {
    fontFamily: fonts.mono,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
