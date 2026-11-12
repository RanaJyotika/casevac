import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

type NoticeTone = 'warning' | 'error';

interface NoticeProps {
  title: string;
  message: string;
  tone?: NoticeTone;
}

const TONES: Record<NoticeTone, { text: string; surface: string; border: string }> =
  {
    warning: {
      text: colors.warning,
      surface: colors.warningSurface,
      border: colors.warningBorder,
    },
    error: {
      text: colors.error,
      surface: colors.errorSurface,
      border: colors.errorBorder,
    },
  };

/** Inline banner for demo-mode warnings and actionable errors. */
export function Notice({ title, message, tone = 'warning' }: NoticeProps) {
  const palette = TONES[tone];
  return (
    <View
      accessible
      accessibilityRole={tone === 'error' ? 'alert' : 'summary'}
      accessibilityLabel={`${title}. ${message}`}
      style={[
        styles.container,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <View style={[styles.marker, { borderColor: palette.text }]}>
        <Text style={[styles.markerText, { color: palette.text }]}>!</Text>
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
        <Text style={[styles.message, { color: palette.text }]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: spacing.md,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  marker: {
    width: 18,
    height: 18,
    marginTop: 1,
    borderWidth: 1.5,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  message: {
    ...typography.caption,
  },
});
