/**
 * Open patients — one per casualty being evacuated, so a medic can switch
 * between patients without losing their place (or anything typed).
 *
 *   PatientPanel (landscape) — dark navy side panel, ~240 dp, collapsible to
 *     a 72 dp rail. Each patient card: triage-colour stripe, name, ID,
 *     status pill and current step; the active patient is a white card.
 *   PatientStrip (portrait)  — the same navy as a strip of chips directly
 *     under the top bar.
 * Navy (#0F1E3D) sets the patient list apart from the light app content and
 * is not a triage colour. Text always carries the meaning.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { fonts, layout, radius, spacing, triage } from '../theme/tokens';
import type { TriageCategory } from '../types';
import { STATUS_PALETTE } from './evacuationBadges';
import { Icon } from './Icon';

export interface PatientTabView {
  id: string;
  title: string;
  subtitle: string;
  triage: TriageCategory | null;
  /** e.g. "In transit"; null before the assessment is saved. */
  status: string | null;
  statusTone: 'orange' | 'blue' | 'teal' | null;
  /** Where this patient is, e.g. "Step 6+7 · Interventions". */
  step: string;
}

interface Props {
  tabs: PatientTabView[];
  /** 'home' or a tab id. */
  activeId: string;
  canAdd: boolean;
  maxTabs: number;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
}

const NAVY = '#0F1E3D';
const NAVY_CARD = '#18294D';
const NAVY_LINE = '#24345A';
const ON_NAVY = '#FFFFFF';
const ON_NAVY_MUTED = 'rgba(255,255,255,0.72)';
const UNTRIAGED = '#64748B';

const stripeColor = (t: TriageCategory | null) =>
  t ? triage[t].fill : UNTRIAGED;

const tabLabel = (t: PatientTabView) =>
  `Patient tab: ${t.title}, ${t.subtitle}${
    t.triage ? `, triage ${t.triage}` : ''
  }${t.status ? `, ${t.status}` : ''}`;

function initials(title: string): string {
  const m = /^Patient (\d+)$/.exec(title);
  if (m) {
    return `P${m[1]}`;
  }
  const parts = title.split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')
  ).toUpperCase();
}

function StatusPill({ t }: { t: PatientTabView }) {
  if (!t.status || !t.statusTone) {
    return null;
  }
  const p = STATUS_PALETTE[t.statusTone];
  return (
    <View style={[styles.pill, { backgroundColor: p.surface }]}>
      <Text style={[styles.pillText, { color: p.text }]} numberOfLines={1}>
        {t.status}
      </Text>
    </View>
  );
}

/* ------------------------- Landscape side panel ------------------------- */

export function PatientPanel({
  tabs,
  activeId,
  canAdd,
  maxTabs,
  onSelect,
  onClose,
  onNew,
  collapsed,
  onToggleCollapsed,
}: Props & { collapsed: boolean; onToggleCollapsed: () => void }) {
  const homeActive = activeId === 'home';
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView
      edges={['bottom', 'left']}
      style={[styles.panel, collapsed && styles.panelCollapsed]}
    >
      {/* The Android status bar stays white across the whole screen, so its
          dark clock and icons remain readable above the navy panel. */}
      <View style={[styles.statusBarBand, { height: insets.top }]} />
      <View style={[styles.panelHead, collapsed && styles.panelHeadCollapsed]}>
        {collapsed ? null : (
          <Text style={styles.panelTitle}>
            PATIENTS{'  '}
            <Text style={styles.panelCount}>
              {tabs.length}/{maxTabs}
            </Text>
          </Text>
        )}
        <Pressable
          onPress={onToggleCollapsed}
          accessibilityRole="button"
          accessibilityLabel={
            collapsed ? 'Expand patient panel' : 'Collapse patient panel'
          }
          hitSlop={6}
          style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
        >
          <Text style={styles.toggleText}>{collapsed ? '»' : '«'}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.panelList,
          collapsed && styles.panelListCollapsed,
        ]}
      >
        <Pressable
          onPress={() => onSelect('home')}
          accessibilityRole="tab"
          accessibilityLabel="Home tab"
          accessibilityState={{ selected: homeActive }}
          style={({ pressed }) => [
            collapsed ? styles.railItem : styles.homeItem,
            homeActive && styles.activeBg,
            pressed && !homeActive && styles.pressed,
          ]}
        >
          <Icon name="hospital" size={22} color={homeActive ? NAVY : ON_NAVY} />
          {collapsed ? null : (
            <Text style={[styles.homeText, homeActive && styles.onActive]}>
              Home
            </Text>
          )}
        </Pressable>

        <View style={styles.separator} />

        {tabs.length === 0 && !collapsed ? (
          <Text style={styles.empty}>
            No patients open. Start Evacuation or ＋ New patient opens one here.
          </Text>
        ) : null}

        {tabs.map(t => {
          const active = activeId === t.id;
          if (collapsed) {
            const tone = t.statusTone ? STATUS_PALETTE[t.statusTone] : null;
            return (
              <Pressable
                key={t.id}
                onPress={() => onSelect(t.id)}
                accessibilityRole="tab"
                accessibilityLabel={tabLabel(t)}
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.railItem,
                  pressed && !active && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.avatar,
                    { borderColor: stripeColor(t.triage) },
                    active && styles.activeBg,
                  ]}
                >
                  <Text style={[styles.avatarText, active && styles.onActive]}>
                    {initials(t.title)}
                  </Text>
                  {tone ? (
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor: tone.surface,
                          borderColor: tone.text,
                        },
                      ]}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          }
          return (
            <View key={t.id} style={[styles.card, active && styles.activeBg]}>
              <View
                style={[
                  styles.stripe,
                  { backgroundColor: stripeColor(t.triage) },
                ]}
              />
              <Pressable
                onPress={() => onSelect(t.id)}
                accessibilityRole="tab"
                accessibilityLabel={tabLabel(t)}
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.cardMain,
                  pressed && !active && styles.pressed,
                ]}
              >
                <Text
                  style={[styles.cardTitle, active && styles.onActive]}
                  numberOfLines={1}
                >
                  {t.title}
                </Text>
                <Text
                  style={[styles.cardId, active && styles.onActiveMuted]}
                  numberOfLines={1}
                >
                  {t.subtitle}
                </Text>
                <View style={styles.cardMeta}>
                  {t.triage ? (
                    <Text
                      style={[styles.cardTriage, active && styles.onActive]}
                    >
                      ● {t.triage}
                    </Text>
                  ) : null}
                  <StatusPill t={t} />
                </View>
                <Text
                  style={[styles.cardStep, active && styles.onActiveMuted]}
                  numberOfLines={1}
                >
                  {t.step}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onClose(t.id)}
                accessibilityRole="button"
                accessibilityLabel={`Close patient tab ${t.title}`}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.close,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[styles.closeText, active && styles.onActiveMuted]}
                >
                  ✕
                </Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <Pressable
        onPress={onNew}
        accessibilityRole="button"
        accessibilityLabel="New patient tab"
        accessibilityHint={
          canAdd
            ? 'Start evacuating another patient in a new tab'
            : 'Close a patient tab first'
        }
        style={({ pressed }) => [
          collapsed ? styles.addRound : styles.add,
          !canAdd && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.addText}>
          {collapsed ? '＋' : '＋  New patient'}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

/* --------------------- Portrait strip (under top bar) --------------------- */

export function PatientStrip({
  tabs,
  activeId,
  canAdd,
  onSelect,
  onClose,
  onNew,
}: Props) {
  const homeActive = activeId === 'home';
  return (
    <View style={styles.strip}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripRow}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => onSelect('home')}
          accessibilityRole="tab"
          accessibilityLabel="Home tab"
          accessibilityState={{ selected: homeActive }}
          style={({ pressed }) => [
            styles.chip,
            styles.chipHome,
            homeActive && styles.activeBg,
            pressed && !homeActive && styles.pressed,
          ]}
        >
          <Icon name="hospital" size={18} color={homeActive ? NAVY : ON_NAVY} />
        </Pressable>
        {tabs.map(t => {
          const active = activeId === t.id;
          return (
            <View key={t.id} style={[styles.chip, active && styles.activeBg]}>
              <Pressable
                onPress={() => onSelect(t.id)}
                accessibilityRole="tab"
                accessibilityLabel={tabLabel(t)}
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.chipMain,
                  pressed && !active && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.chipDot,
                    { backgroundColor: stripeColor(t.triage) },
                  ]}
                />
                <Text
                  style={[styles.chipTitle, active && styles.onActive]}
                  numberOfLines={1}
                >
                  {t.title}
                </Text>
                <StatusPill t={t} />
              </Pressable>
              <Pressable
                onPress={() => onClose(t.id)}
                accessibilityRole="button"
                accessibilityLabel={`Close patient tab ${t.title}`}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.chipClose,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[styles.closeText, active && styles.onActiveMuted]}
                >
                  ✕
                </Text>
              </Pressable>
            </View>
          );
        })}
        <Pressable
          onPress={onNew}
          accessibilityRole="button"
          accessibilityLabel="New patient tab"
          accessibilityHint={
            canAdd
              ? 'Start evacuating another patient in a new tab'
              : 'Close a patient tab first'
          }
          style={({ pressed }) => [
            styles.chip,
            styles.chipAdd,
            !canAdd && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.addText}>＋</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  activeBg: { backgroundColor: ON_NAVY },
  onActive: { color: NAVY },
  onActiveMuted: { color: '#3B4652' },

  /* Panel */
  panel: { width: 232, backgroundColor: NAVY },
  panelCollapsed: { width: 76 },
  statusBarBand: { backgroundColor: '#FFFFFF' },
  panelHead: {
    // Same height as the app's top bar, so the two lines meet.
    height: layout.topBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: NAVY_LINE,
  },
  panelHeadCollapsed: { justifyContent: 'center', paddingLeft: spacing.xs },
  panelTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: ON_NAVY_MUTED,
  },
  panelCount: { fontWeight: '600', letterSpacing: 0, color: ON_NAVY_MUTED },
  toggle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  toggleText: { fontSize: 22, fontWeight: '700', color: ON_NAVY },
  panelList: { gap: spacing.sm, padding: spacing.sm },
  panelListCollapsed: { alignItems: 'center', paddingHorizontal: 0 },
  homeItem: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  homeText: { fontSize: 16, fontWeight: '700', color: ON_NAVY },
  separator: { height: 1, backgroundColor: NAVY_LINE, marginVertical: 2 },
  empty: {
    fontSize: 13,
    lineHeight: 18,
    color: ON_NAVY_MUTED,
    paddingHorizontal: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    borderRadius: radius.md,
    backgroundColor: NAVY_CARD,
    overflow: 'hidden',
  },
  stripe: {
    width: 7,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.35)',
  },
  cardMain: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    paddingVertical: spacing.sm + 2,
    paddingLeft: spacing.md,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: ON_NAVY },
  cardId: { fontFamily: fonts.mono, fontSize: 13, color: ON_NAVY_MUTED },
  cardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  cardTriage: { fontSize: 12, fontWeight: '800', color: ON_NAVY },
  cardStep: { fontSize: 12, color: ON_NAVY_MUTED },
  close: { width: 40, alignItems: 'center', paddingTop: spacing.sm },
  closeText: { fontSize: 15, fontWeight: '700', color: ON_NAVY_MUTED },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  pillText: { fontSize: 11, lineHeight: 15, fontWeight: '800' },
  add: {
    minHeight: 52,
    margin: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: ON_NAVY,
  },
  addRound: {
    width: 52,
    height: 52,
    margin: spacing.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    borderWidth: 2,
    borderColor: ON_NAVY,
  },
  addText: { fontSize: 17, fontWeight: '800', color: ON_NAVY },

  /* Collapsed rail */
  railItem: {
    width: 60,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NAVY_CARD,
  },
  avatarText: { fontSize: 15, fontWeight: '800', color: ON_NAVY },
  statusDot: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },

  /* Portrait strip */
  strip: { backgroundColor: NAVY },
  stripRow: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  chip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    backgroundColor: NAVY_CARD,
  },
  chipHome: { width: 52, justifyContent: 'center' },
  chipAdd: { width: 52, justifyContent: 'center' },
  chipMain: {
    maxWidth: 240,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: spacing.md,
  },
  chipDot: { width: 10, height: 10, borderRadius: 5 },
  chipTitle: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: ON_NAVY },
  chipClose: {
    width: 36,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
