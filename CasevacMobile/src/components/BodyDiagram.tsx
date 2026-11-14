/**
 * Location of injury — front and back body diagram, side by side.
 *
 * Editable (onChange given): tap a body area to mark it, tap again to clear
 * it; each marked area is listed below with its code and meaning
 * ("THR-F — Right thigh (front)") and can be removed there too.
 * Read only (no onChange): shows what was marked, e.g. on the receiving
 * tablet after a QR / Bluetooth handover.
 *
 * R / L beside each figure are the casualty's own right and left.
 */
import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Body from 'react-native-body-highlighter';
import {
  codeForTap,
  describeInjuryCode,
  highlightedParts,
  toggleInjuryCode,
  type BodyView,
} from '../services/evacuation/injuryLocations';
import { colors, radius, spacing, typography } from '../theme/tokens';

interface BodyDiagramProps {
  /** Marked location codes, e.g. ["THR-F", "HD-B"]. */
  value: readonly string[];
  /** Omit for a read-only diagram. */
  onChange?: (codes: string[]) => void;
}

/** The library draws each figure 200 × 400 at scale 1. */
const FIGURE_WIDTH = 200;
const MARKED = colors.error;
const UNMARKED = '#D3D9E0';

function Figure({
  view,
  value,
  scale,
  onTap,
}: {
  view: BodyView;
  value: readonly string[];
  scale: number;
  onTap?: (code: string) => void;
}) {
  // Front: the casualty faces us, so their right is on our left.
  const [leftMark, rightMark] = view === 'F' ? ['R', 'L'] : ['L', 'R'];
  const parts = highlightedParts(value, view).map(p => ({
    ...p,
    styles: { fill: MARKED },
  }));
  return (
    <View style={styles.figure}>
      <Text style={styles.viewTitle}>{view === 'F' ? 'FRONT' : 'BACK'}</Text>
      <View style={styles.figureRow}>
        <Text style={styles.sideMark}>{leftMark}</Text>
        <View
          accessible={!onTap}
          accessibilityLabel={`Body diagram, ${
            view === 'F' ? 'front' : 'back'
          }`}
        >
          <Body
            data={parts}
            side={view === 'F' ? 'front' : 'back'}
            gender="male"
            scale={scale}
            border={colors.borderStrong}
            defaultFill={UNMARKED}
            defaultStroke="#FFFFFF"
            defaultStrokeWidth={2}
            onBodyPartPress={
              onTap
                ? (part, screen) => {
                    const code = codeForTap(view, part.slug, screen);
                    if (code) {
                      onTap(code);
                    }
                  }
                : undefined
            }
          />
        </View>
        <Text style={styles.sideMark}>{rightMark}</Text>
      </View>
    </View>
  );
}

export function BodyDiagram({ value, onChange }: BodyDiagramProps) {
  const [width, setWidth] = useState(0);
  const editable = Boolean(onChange);
  const tap = onChange
    ? (code: string) => onChange(toggleInjuryCode(value, code))
    : undefined;

  // Two figures plus their R/L marks side by side; fit them to the space.
  const perFigure = width ? (width - spacing.lg) / 2 - 56 : FIGURE_WIDTH;
  const scale = Math.max(0.6, Math.min(1.4, perFigure / FIGURE_WIDTH));

  return (
    <View style={styles.wrap}>
      {editable ? (
        <Text style={styles.hint}>
          Tap each injured area. Tap it again to clear it. R and L are the
          casualty’s right and left.
        </Text>
      ) : null}
      <View
        style={styles.figures}
        onLayout={(e: LayoutChangeEvent) =>
          setWidth(e.nativeEvent.layout.width)
        }
      >
        <Figure view="F" value={value} scale={scale} onTap={tap} />
        <Figure view="B" value={value} scale={scale} onTap={tap} />
      </View>

      {value.length ? (
        <View style={styles.list}>
          {value.map(code => {
            const meaning = describeInjuryCode(code);
            return (
              <View
                key={code}
                style={styles.item}
                accessible={!editable}
                accessibilityLabel={`${code}: ${
                  meaning ?? 'not recognised on this tablet'
                }`}
              >
                <Text style={styles.code}>{code}</Text>
                <Text style={[styles.meaning, !meaning && styles.unknown]}>
                  {meaning ?? 'Location code not recognised on this tablet'}
                </Text>
                {tap ? (
                  <Pressable
                    onPress={() => tap(code)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${meaning ?? code}`}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.remove,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.removeText}>✕</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.empty}>
          {editable ? 'No injury marked yet.' : 'Not recorded'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  hint: { ...typography.helper, color: colors.textSecondary },
  figures: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.background,
  },
  figure: { alignItems: 'center', gap: spacing.sm },
  figureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  viewTitle: {
    ...typography.label,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.textMuted,
  },
  sideMark: {
    width: 24,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  list: { gap: spacing.sm },
  item: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.errorSurface,
  },
  code: {
    minWidth: 64,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.error,
  },
  meaning: { ...typography.body, flex: 1, color: colors.textPrimary },
  unknown: { fontStyle: 'italic', color: colors.textSecondary },
  remove: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  pressed: { backgroundColor: colors.surface },
  removeText: { fontSize: 20, fontWeight: '700', color: colors.error },
  empty: { ...typography.helper, color: colors.textSecondary },
});
