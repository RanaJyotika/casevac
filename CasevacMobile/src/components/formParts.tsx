/**
 * Building blocks shared by the clinical forms (assessment, interventions):
 * a collapsible lettered section and a large single-choice answer row.
 * Targets are ≥ 48 dp for gloved use; every choice carries a text label.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  colors,
  layout,
  radius,
  spacing,
  triage,
  triageTint,
  typography,
} from '../theme/tokens';
import {
  TRIAGE_ORDER,
  TRIAGE_PRIORITY,
} from '../services/evacuation/interventions';
import type { TriageCategory } from '../types';
import { Icon } from './Icon';

export function FormSection({
  letter,
  title,
  open,
  onToggle,
  children,
}: {
  letter: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${letter}. ${title}`}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.sectionHead, pressed && styles.pressed]}
      >
        <View style={styles.letter}>
          <Text style={styles.letterText}>{letter}</Text>
        </View>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
        <View style={open ? styles.chevronOpen : undefined}>
          <Icon name="chevronDown" size={22} color={colors.textSecondary} />
        </View>
      </Pressable>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

/**
 * A question answered with one of a few labelled choices (Yes / No / N/A).
 * Tapping the selected answer again clears it (question left unanswered).
 * Each choice is announced as "<question>: <answer>".
 */
export function ChoiceQuestion<T extends string>({
  label,
  value,
  options,
  onChange,
  error,
}: {
  label: string;
  value: T | null;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T | null) => void;
  error?: string;
}) {
  return (
    <View style={styles.question}>
      <Text style={styles.questionLabel}>{label}</Text>
      <View
        style={styles.answers}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
      >
        {options.map(option => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(selected ? null : option.value)}
              accessibilityRole="radio"
              accessibilityLabel={`${label}: ${option.label}`}
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.answer,
                selected && styles.answerOn,
                pressed && !selected && styles.pressed,
              ]}
            >
              <Text
                style={[styles.answerText, selected && styles.answerTextOn]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

/**
 * Four large triage cards (colour + priority number + word + meaning).
 * Each is announced as "Priority 1, RED, Critical".
 */
export function TriageCards({
  label,
  value,
  onChange,
  wide,
}: {
  label: string;
  value: TriageCategory | null;
  onChange: (value: TriageCategory) => void;
  wide: boolean;
}) {
  return (
    <View
      style={[styles.triageGrid, wide && styles.triageGridWide]}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      {TRIAGE_ORDER.map(category => {
        const selected = value === category;
        const t = triage[category];
        return (
          <Pressable
            key={category}
            onPress={() => onChange(category)}
            accessibilityRole="radio"
            accessibilityLabel={`Priority ${TRIAGE_PRIORITY[category]}, ${t.label}, ${t.meaning}`}
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.triageCard,
              selected && {
                borderColor: t.fill,
                backgroundColor: triageTint[category].surface,
              },
              pressed && !selected && styles.pressed,
            ]}
          >
            <View style={[styles.priority, { backgroundColor: t.fill }]}>
              <Text style={[styles.priorityText, { color: t.onFill }]}>
                {TRIAGE_PRIORITY[category]}
              </Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.triageLabel}>{t.label}</Text>
              <Text style={styles.triageMeaning}>{t.meaning}</Text>
            </View>
            {selected ? (
              <Icon name="check" size={22} color={colors.textPrimary} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export const YES_NO = [
  { value: 'YES', label: 'Yes' },
  { value: 'NO', label: 'No' },
] as const;

export const YES_NO_NA = [
  { value: 'YES', label: 'Yes' },
  { value: 'NO', label: 'No' },
  { value: 'NA', label: 'N/A' },
] as const;

const styles = StyleSheet.create({
  pressed: { backgroundColor: colors.surface },
  flex: { flex: 1, minWidth: 0 },

  triageGrid: { gap: spacing.sm },
  triageGridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  triageCard: {
    flexBasis: '45%',
    flexGrow: 1,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: colors.divider,
    backgroundColor: colors.background,
  },
  priority: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityText: { fontSize: 20, fontWeight: '800' },
  triageLabel: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  triageMeaning: { ...typography.caption, color: colors.textSecondary },

  section: {
    borderRadius: radius.lg + 4,
    borderWidth: layout.borderWidth,
    borderColor: colors.divider,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  sectionHead: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  letter: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  letterText: { fontSize: 16, fontWeight: '800', color: colors.onPrimary },
  sectionTitle: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  sectionBody: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: layout.borderWidth,
    borderTopColor: colors.divider,
  },

  question: { gap: spacing.sm },
  questionLabel: { ...typography.label, color: colors.textPrimary },
  answers: { flexDirection: 'row', gap: spacing.sm },
  answer: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
  },
  answerOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  answerText: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  answerTextOn: { color: colors.onPrimary },
  error: { ...typography.helper, fontWeight: '700', color: colors.error },
});
