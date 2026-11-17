/**
 * Minimal icons drawn with plain Views/Text so no icon or SVG dependency
 * is needed. All are decorative; meaning is carried by adjacent text.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
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

/** Medical cross in a filled square (brand mark). */
export function BrandMark() {
  return (
    <View {...hidden} style={styles.brandBox}>
      <View style={styles.crossVertical} />
      <View style={styles.crossHorizontal} />
    </View>
  );
}

/** Caduceus used next to "Medic Login". Decorative. */
export function CaduceusMark({
  size = 36,
  color = colors.primary,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path
        d="M16 3v26"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <Path
        d="M16 5.5c-3.2 0-6 1.6-7.4 3.8 2.2-.7 4.7-.6 7.4.4 2.7-1 5.2-1.1 7.4-.4C22 7.1 19.2 5.5 16 5.5Z"
        fill={color}
      />
      <Path
        d="M9.2 8.6c-2.4 1.2-3.8 3.2-3.8 5.4 0 2.6 2.2 3.8 5 2.6"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path
        d="M22.8 8.6c2.4 1.2 3.8 3.2 3.8 5.4 0 2.6-2.2 3.8-5 2.6"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path
        d="M10.8 16.2c-3 1.5-4.2 4-2.6 6.2 1.8 2.4 5.6 1.6 8-1.4"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path
        d="M21.2 16.2c3 1.5 4.2 4 2.6 6.2-1.8 2.4-5.6 1.6-8-1.4"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Circle cx={16} cy={5} r={1.6} fill={color} />
    </Svg>
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
    width: 52,
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crossVertical: {
    position: 'absolute',
    width: 8,
    height: 26,
    borderRadius: 2,
    backgroundColor: colors.onPrimary,
  },
  crossHorizontal: {
    position: 'absolute',
    width: 26,
    height: 8,
    borderRadius: 2,
    backgroundColor: colors.onPrimary,
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
