/**
 * Sweeping radar for the login brand panel.
 *
 * Drawn with react-native-svg (the app has no WebGL). Rings, spokes and a
 * fading sweep match the React Bits radar, tinted with the Jeevan primary blue.
 * Decorative only — it does not receive touches or sit in the accessibility tree.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { colors } from '../theme/tokens';

const VB = 400;
const CX = 200;
const CY = 200;
const RADIUS = 168;

const RINGS = [0.28, 0.5, 0.72, 1];
const SPOKES = [0, 45, 90, 135];
const TICKS = 36;
/** Trail wedges behind the sweep arm, widest first. Degrees, then opacity. */
const TRAIL: { span: number; opacity: number }[] = [
  { span: 72, opacity: 0.06 },
  { span: 44, opacity: 0.12 },
  { span: 22, opacity: 0.22 },
  { span: 8, opacity: 0.4 },
];

const BLIPS = [
  { x: 268, y: 158, r: 5, opacity: 0.9 },
  { x: 124, y: 246, r: 4, opacity: 0.55 },
  { x: 228, y: 286, r: 3.5, opacity: 0.4 },
  { x: 150, y: 132, r: 3, opacity: 0.35 },
];

function polar(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CX + radius * Math.cos(rad),
    y: CY + radius * Math.sin(rad),
  };
}

/** Pie slice from `from` to `to` degrees, 0° at 12 o'clock, clockwise. */
function wedge(from: number, to: number, radius: number) {
  const start = polar(from, radius);
  const end = polar(to, radius);
  const large = to - from > 180 ? 1 : 0;
  return `M ${CX} ${CY} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 1 ${end.x} ${end.y} Z`;
}

interface RadarBackdropProps {
  /** Faster sweep while sign-in is in progress. */
  active?: boolean;
}

export function RadarBackdrop({ active = false }: RadarBackdropProps) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Jest's act() waits for scheduled updates; an infinite loop never settles.
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: active ? 1800 : 5200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, spin]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const blipOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 1],
  });

  const size = Math.max(box.width, box.height) * 1.15;
  const frame = {
    position: 'absolute' as const,
    width: size,
    height: size,
    left: (box.width - size) / 2,
    top: (box.height - size) / 2,
  };

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setBox(prev =>
          prev.width === width && prev.height === height
            ? prev
            : { width, height },
        );
      }}
    >
      {size > 0 ? (
        <>
          <Svg
            width={size}
            height={size}
            viewBox={`0 0 ${VB} ${VB}`}
            style={frame}
          >
            <Circle
              cx={CX}
              cy={CY}
              r={RADIUS}
              fill={colors.primary}
              fillOpacity={0.06}
            />
            {RINGS.map(scale => (
              <Circle
                key={scale}
                cx={CX}
                cy={CY}
                r={RADIUS * scale}
                stroke={colors.primary}
                strokeOpacity={scale === 1 ? 0.55 : 0.28}
                strokeWidth={scale === 1 ? 2 : 1.25}
                fill="none"
              />
            ))}
            {SPOKES.map(angle => {
              const end = polar(angle, RADIUS);
              return (
                <Line
                  key={angle}
                  x1={CX}
                  y1={CY}
                  x2={end.x}
                  y2={end.y}
                  stroke={colors.primary}
                  strokeOpacity={angle % 90 === 0 ? 0.28 : 0.14}
                  strokeWidth={1}
                />
              );
            })}
            {Array.from({ length: TICKS }, (_, index) => {
              const major = index % 9 === 0;
              const angle = index * (360 / TICKS);
              const inner = polar(angle, RADIUS - (major ? 14 : 8));
              const outer = polar(angle, RADIUS);
              return (
                <Line
                  key={index}
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke={colors.primary}
                  strokeOpacity={major ? 0.55 : 0.28}
                  strokeWidth={major ? 2 : 1}
                />
              );
            })}
            <Circle cx={CX} cy={CY} r={5} fill={colors.primary} />
            <Circle
              cx={CX}
              cy={CY}
              r={12}
              stroke={colors.primary}
              strokeOpacity={0.45}
              strokeWidth={1.5}
              fill="none"
            />
          </Svg>
          <Animated.View style={[frame, { transform: [{ rotate }] }]}>
            <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
              {TRAIL.map(part => (
                <Path
                  key={part.span}
                  d={wedge(-part.span, 0, RADIUS)}
                  fill={colors.primary}
                  fillOpacity={part.opacity}
                />
              ))}
              <Line
                x1={CX}
                y1={CY}
                x2={CX}
                y2={CY - RADIUS}
                stroke={colors.primary}
                strokeWidth={2.5}
              />
            </Svg>
          </Animated.View>
          <Animated.View style={[frame, { opacity: blipOpacity }]}>
            <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
              {BLIPS.map(blip => (
                <Circle
                  key={`${blip.x}-${blip.y}`}
                  cx={blip.x}
                  cy={blip.y}
                  r={blip.r}
                  fill={colors.primary}
                  fillOpacity={blip.opacity}
                />
              ))}
            </Svg>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}
