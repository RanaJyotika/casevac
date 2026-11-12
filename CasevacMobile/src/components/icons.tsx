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

/** Person outline (head + shoulders) for user ID fields. */
export function UserIcon({ color = colors.textSecondary }: { color?: string }) {
  return (
    <View {...hidden} style={styles.iconBox}>
      <View style={[styles.userHead, { borderColor: color }]} />
      <View style={[styles.userBody, { borderColor: color }]} />
    </View>
  );
}

/** Padlock outline for password fields. */
export function LockIcon({ color = colors.textSecondary }: { color?: string }) {
  return (
    <View {...hidden} style={styles.iconBox}>
      <View style={[styles.lockShackle, { borderColor: color }]} />
      <View style={[styles.lockBody, { borderColor: color }]}>
        <View style={[styles.lockKeyhole, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

/** Eye outline; struck through when `crossed` (password hidden). */
export function EyeIcon({
  crossed = false,
  color = colors.textSecondary,
}: {
  crossed?: boolean;
  color?: string;
}) {
  return (
    <View {...hidden} style={styles.iconBox}>
      <View style={[styles.eyeOutline, { borderColor: color }]}>
        <View style={[styles.eyePupil, { backgroundColor: color }]} />
      </View>
      {crossed ? (
        <View style={[styles.eyeSlash, { backgroundColor: color }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  iconBox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userHead: {
    width: 9,
    height: 9,
    borderWidth: 1.75,
    borderRadius: 5,
  },
  userBody: {
    width: 16,
    height: 7,
    marginTop: 2,
    borderWidth: 1.75,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  lockShackle: {
    width: 10,
    height: 8,
    borderWidth: 1.75,
    borderBottomWidth: 0,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  lockBody: {
    width: 16,
    height: 11,
    borderWidth: 1.75,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockKeyhole: {
    width: 2.5,
    height: 4,
    borderRadius: 1,
  },
  eyeOutline: {
    width: 20,
    height: 12,
    borderWidth: 1.75,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyePupil: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  eyeSlash: {
    position: 'absolute',
    width: 22,
    height: 1.75,
    transform: [{ rotate: '-35deg' }],
  },
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
