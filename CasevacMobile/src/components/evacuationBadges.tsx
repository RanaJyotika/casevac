/**
 * Evacuation status and transfer badges — one colour and one icon per
 * meaning, used everywhere a status appears (Home, patient history, reports).
 *
 * Deliberately NOT the triage colours (red / yellow / green / black), so a
 * status is never mistaken for a triage priority:
 *   orange  Not handed over        clock
 *   blue    In transit             truck
 *   teal    Handed over            check
 *   purple  transfer to / from another tablet (filled = confirmed,
 *           outline = sent, not yet confirmed)
 *   grey    not yet sent
 * Text always carries the meaning; colour and icon only support it.
 * All text/background pairs meet 4.5:1 contrast.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing } from '../theme/tokens';
import { Icon, type IconName } from './Icon';

export const STATUS_PALETTE = {
  orange: { surface: '#FFEDD5', border: '#FDBA74', text: '#9A3412' },
  blue: { surface: '#EAF0FD', border: '#BFD0F8', text: '#1E40AF' },
  teal: { surface: '#DDF3F1', border: '#99D6CF', text: '#0B5F5A' },
  purple: { surface: '#F1EAFE', border: '#CDB8F6', text: '#5B21B6' },
  purpleOutline: { surface: '#FFFFFF', border: '#7C3AED', text: '#5B21B6' },
  grey: { surface: '#ECEEF2', border: '#CDD3DB', text: '#3B4652' },
} as const;

export type EvacuationBadgeKind =
  | 'NOT_HANDED_OVER'
  | 'IN_TRANSIT'
  | 'HANDED_OVER'
  | 'RECEIVED_BY'
  | 'SENT_UNCONFIRMED'
  | 'NOT_SENT'
  | 'RECEIVED_FROM';

const KINDS: Record<
  EvacuationBadgeKind,
  { label: string; icon: IconName; palette: keyof typeof STATUS_PALETTE }
> = {
  NOT_HANDED_OVER: {
    label: 'Not handed over',
    icon: 'clock',
    palette: 'orange',
  },
  IN_TRANSIT: {
    label: 'In transit · not handed over',
    icon: 'truck',
    palette: 'blue',
  },
  HANDED_OVER: { label: 'Handed over', icon: 'check', palette: 'teal' },
  RECEIVED_BY: {
    label: 'Received by next team',
    icon: 'check',
    palette: 'purple',
  },
  SENT_UNCONFIRMED: {
    label: 'Sent to next team — not confirmed',
    icon: 'alert',
    palette: 'purpleOutline',
  },
  NOT_SENT: {
    label: 'Not yet sent to next team',
    icon: 'handover',
    palette: 'grey',
  },
  RECEIVED_FROM: {
    label: 'Received from another tablet',
    icon: 'handover',
    palette: 'purple',
  },
};

export function EvacuationBadge({
  kind,
  label,
}: {
  kind: EvacuationBadgeKind;
  /** Overrides the default text, e.g. "Received by MED-00045". */
  label?: string;
}) {
  const k = KINDS[kind];
  const p = STATUS_PALETTE[k.palette];
  const text = label ?? k.label;
  return (
    <View
      accessible
      accessibilityLabel={`Status: ${text}`}
      style={[
        styles.badge,
        { backgroundColor: p.surface, borderColor: p.border },
      ]}
    >
      <Icon name={k.icon} size={14} color={p.text} strokeWidth={2.5} />
      <Text style={[styles.text, { color: p.text }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    maxWidth: '100%',
  },
  text: { fontSize: 13, lineHeight: 17, fontWeight: '700', flexShrink: 1 },
});
