import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  usePatientHeaderActions,
  usePatientStrip,
} from '../navigation/patientStripContext';
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from '../theme/tokens';
import { Icon } from './Icon';

/** Below this width the Home / New patient buttons show icons only. */
const ICON_ONLY_BELOW = 700;

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
  const actions = usePatientHeaderActions();
  const { width } = useWindowDimensions();
  const iconOnly = width < ICON_ONLY_BELOW;
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
          {actions ? (
            <View style={styles.actions}>
              {actions.onNew ? (
                <Pressable
                  onPress={actions.onNew}
                  accessibilityRole="button"
                  accessibilityLabel="New patient"
                  accessibilityHint="Start recording the next casualty. This patient stays open."
                  style={({ pressed }) => [
                    styles.action,
                    styles.actionPrimary,
                    pressed && styles.actionPressed,
                  ]}
                >
                  <Text style={styles.actionPlus}>＋</Text>
                  {iconOnly ? null : (
                    <Text style={styles.actionText}>New patient</Text>
                  )}
                </Pressable>
              ) : null}
              <Pressable
                onPress={actions.onHome}
                accessibilityRole="button"
                accessibilityLabel="Home"
                accessibilityHint="Go to Home. This patient stays open."
                style={({ pressed }) => [
                  styles.action,
                  pressed && styles.actionPressed,
                ]}
              >
                <Icon name="hospital" size={20} color={colors.primary} />
                {iconOnly ? null : <Text style={styles.actionText}>Home</Text>}
              </Pressable>
            </View>
          ) : null}
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: touchTarget,
    minWidth: touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  actionPrimary: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionText: {
    ...typography.label,
    fontWeight: '700',
    color: colors.primary,
  },
  actionPlus: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  subRow: {
    paddingHorizontal: 20,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
});
