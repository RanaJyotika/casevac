/**
 * Minimal icons drawn with plain Views/Text so no icon or SVG dependency
 * is needed. All are decorative; meaning is carried by adjacent text.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/tokens';

const hidden = {
  accessible: false,
  importantForAccessibility: 'no-hide-descendants' as const,
};

export function Chevron({ color = colors.textSecondary }: { color?: string }) {
  return (
    <Text {...hidden} style={[styles.chevron, { color }]}>
      ›
    </Text>
  );
}

/** Medical cross inside a square outline (brand mark). */
export function BrandMark() {
  return (
    <View {...hidden} style={styles.brandBox}>
      <View style={styles.crossVertical} />
      <View style={styles.crossHorizontal} />
    </View>
  );
}

/** Simplified QR glyph: three finder squares in a 2×2 grid. */
export function QrIcon({ color = colors.onPrimary }: { color?: string }) {
  const finder = [styles.qrFinder, { borderColor: color }];
  return (
    <View {...hidden} style={styles.qrGrid}>
      <View style={styles.qrRow}>
        <View style={finder} />
        <View style={finder} />
      </View>
      <View style={styles.qrRow}>
        <View style={finder} />
        <View style={[styles.qrDot, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

/** Small "#"-style glyph used for manual ID entry. */
export function GlyphIcon({
  glyph,
  color = colors.primary,
}: {
  glyph: string;
  color?: string;
}) {
  return (
    <Text {...hidden} style={[styles.glyph, { color }]}>
      {glyph}
    </Text>
  );
}

const styles = StyleSheet.create({
  chevron: {
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '400',
  },
  brandBox: {
    width: 48,
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crossVertical: {
    position: 'absolute',
    width: 8,
    height: 24,
    borderRadius: 1,
    backgroundColor: colors.primary,
  },
  crossHorizontal: {
    position: 'absolute',
    width: 24,
    height: 8,
    borderRadius: 1,
    backgroundColor: colors.primary,
  },
  qrGrid: {
    gap: 4,
  },
  qrRow: {
    flexDirection: 'row',
    gap: 4,
  },
  qrFinder: {
    width: 10,
    height: 10,
    borderWidth: 2,
    borderRadius: 1,
  },
  qrDot: {
    width: 6,
    height: 6,
    margin: 2,
    borderRadius: 1,
  },
  glyph: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
});
