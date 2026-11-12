/**
 * App shell for every screen after Login (UI_DESIGN_GUIDELINES.md §4):
 * 64 dp top bar (app name, page title, connectivity, clinician, Log out)
 * and a persistent left navigation (240 dp; 96 dp compact on narrower windows).
 * Panels run edge to edge; safe-area insets pad their content.
 */
import React from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MOCK_CONNECTIVITY } from '../data/mockData';
import {
  colors,
  fonts,
  layout,
  radius,
  spacing,
  typography,
} from '../theme/tokens';
import type { Clinician } from '../types';
import { BrandMark, GlyphIcon, QrIcon } from './icons';
import { StatusBadge } from './StatusBadge';

export type NavKey =
  | 'home'
  | 'scan'
  | 'casualties'
  | 'evacuations'
  | 'handover'
  | 'track';

interface NavItem {
  key: NavKey;
  label: string;
  shortLabel: string;
  glyph: string | null;
  /** Screens not built yet explain that instead of navigating. */
  available: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    key: 'home',
    label: 'Home',
    shortLabel: 'Home',
    glyph: '⌂',
    available: true,
  },
  {
    key: 'scan',
    label: 'Scan QR',
    shortLabel: 'Scan',
    glyph: null,
    available: true,
  },
  {
    key: 'casualties',
    label: 'Casualties',
    shortLabel: 'Casualties',
    glyph: '+',
    available: false,
  },
  {
    key: 'evacuations',
    label: 'Evacuations',
    shortLabel: 'Evac',
    glyph: '→',
    available: false,
  },
  {
    key: 'handover',
    label: 'Handover',
    shortLabel: 'Handover',
    glyph: '⇄',
    available: false,
  },
  {
    key: 'track',
    label: 'Track Casualty',
    shortLabel: 'Track',
    glyph: '◎',
    available: false,
  },
];

interface AppShellProps {
  title: string;
  clinician: Clinician;
  active: NavKey;
  onNavigate: (key: NavKey) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export function AppShell({
  title,
  clinician,
  active,
  onNavigate,
  onLogout,
  children,
}: AppShellProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < layout.navCollapseBelow;
  const navWidth =
    (compact ? layout.sidebarCompactWidth : layout.sidebarWidth) + insets.left;

  const select = (item: NavItem) => {
    if (item.key === active) {
      return;
    }
    if (!item.available) {
      Alert.alert(
        `${item.label} — coming later`,
        'This module is not built yet in this demo build. No data has been changed.',
      );
      return;
    }
    onNavigate(item.key);
  };

  return (
    <View style={styles.root}>
      {/* Top bar */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top,
            height: layout.topBarHeight + insets.top,
            paddingRight: insets.right + layout.contentPadding,
          },
        ]}
      >
        <View
          style={[styles.brand, { width: navWidth, paddingLeft: insets.left }]}
        >
          <BrandMark />
          {compact ? null : <Text style={styles.brandName}>JEEVAN</Text>}
        </View>
        <Text
          style={styles.pageTitle}
          accessibilityRole="header"
          numberOfLines={1}
        >
          {title}
        </Text>
        <View style={styles.topRight}>
          <StatusBadge
            label={MOCK_CONNECTIVITY === 'offline' ? 'Offline' : 'Online'}
          />
          <View style={styles.clinician}>
            <Text style={styles.clinicianName} numberOfLines={1}>
              {clinician.rank} {clinician.displayName} · {clinician.team}
            </Text>
            <Text style={styles.clinicianId} numberOfLines={1}>
              {clinician.id}
              {clinician.isDemo ? ' · Demo mode' : ''}
            </Text>
          </View>
          <Pressable
            onPress={onLogout}
            accessibilityRole="button"
            accessibilityLabel="Log out"
            style={({ pressed }) => [
              styles.logout,
              pressed && styles.logoutPressed,
            ]}
          >
            <Text style={styles.logoutText} numberOfLines={1}>
              Log out
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.body}>
        {/* Side navigation */}
        <View
          style={[
            styles.sideNav,
            {
              width: navWidth,
              paddingLeft: insets.left,
              paddingBottom: insets.bottom + spacing.md,
            },
          ]}
          accessibilityRole="menu"
        >
          {NAV_ITEMS.map(item => {
            const selected = item.key === active;
            const iconColor = selected ? colors.primary : colors.textSecondary;
            return (
              <Pressable
                key={item.key}
                onPress={() => select(item)}
                accessibilityRole="menuitem"
                accessibilityLabel={item.label}
                accessibilityState={{ selected }}
                accessibilityHint={item.available ? undefined : 'Not built yet'}
                style={({ pressed }) => [
                  styles.navItem,
                  compact && styles.navItemCompact,
                  selected && styles.navItemSelected,
                  pressed && !selected && styles.navItemPressed,
                ]}
              >
                {selected ? <View style={styles.navIndicator} /> : null}
                <View style={styles.navIcon}>
                  {item.glyph ? (
                    <GlyphIcon glyph={item.glyph} color={iconColor} />
                  ) : (
                    <QrIcon color={iconColor} />
                  )}
                </View>
                <Text
                  style={[
                    compact ? styles.navLabelCompact : styles.navLabel,
                    selected && styles.navLabelSelected,
                    !item.available && styles.navLabelUnavailable,
                  ]}
                  numberOfLines={2}
                >
                  {compact ? item.shortLabel : item.label}
                </Text>
                {!compact && !item.available ? (
                  <Text style={styles.soon}>Soon</Text>
                ) : null}
              </Pressable>
            );
          })}
          <View style={styles.flex} />
          {compact ? null : (
            <Text style={styles.navFooter}>
              Demo build · fictional data only
            </Text>
          )}
        </View>

        {/* Main content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={[
            styles.contentInner,
            {
              paddingRight: insets.right + layout.contentPadding,
              paddingBottom: insets.bottom + layout.contentPadding,
            },
          ]}
        >
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderBottomWidth: layout.borderWidth,
    borderBottomColor: colors.border,
  },
  brand: {
    height: layout.topBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    borderRightWidth: layout.borderWidth,
    borderRightColor: colors.border,
  },
  brandName: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: 2.5,
    color: colors.textPrimary,
  },
  pageTitle: {
    ...typography.title,
    flex: 1,
    paddingHorizontal: layout.contentPadding,
    color: colors.textPrimary,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  clinician: {
    maxWidth: 260,
    gap: 1,
  },
  clinicianName: {
    ...typography.label,
    color: colors.textPrimary,
  },
  clinicianId: {
    ...typography.helper,
    fontFamily: fonts.mono,
    color: colors.textSecondary,
  },
  logout: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderWidth: layout.borderWidth,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
  },
  logoutPressed: {
    backgroundColor: colors.surface,
  },
  logoutText: {
    ...typography.label,
    fontWeight: '600',
    color: colors.primary,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  sideNav: {
    paddingTop: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRightWidth: layout.borderWidth,
    borderRightColor: colors.border,
  },
  navItem: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  navItemCompact: {
    minHeight: 68,
    flexDirection: 'column',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  navItemSelected: {
    backgroundColor: colors.primarySurface,
  },
  navItemPressed: {
    backgroundColor: colors.surfaceStrong,
  },
  navIndicator: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  navIcon: {
    width: 28,
    alignItems: 'center',
  },
  navLabel: {
    ...typography.label,
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
  },
  navLabelCompact: {
    ...typography.helper,
    color: colors.textPrimary,
  },
  navLabelSelected: {
    fontWeight: '700',
    color: colors.primary,
  },
  navLabelUnavailable: {
    color: colors.textSecondary,
  },
  soon: {
    ...typography.helper,
    color: colors.textSecondary,
    paddingHorizontal: 6,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  navFooter: {
    ...typography.helper,
    color: colors.textSecondary,
    paddingHorizontal: spacing.xl,
  },
  content: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  contentInner: {
    paddingTop: layout.contentPadding,
    paddingLeft: layout.contentPadding,
    gap: layout.gutter,
  },
});
