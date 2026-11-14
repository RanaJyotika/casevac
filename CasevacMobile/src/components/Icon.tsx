/**
 * Line icons (24 × 24, 2 px stroke) drawn with react-native-svg.
 * Decorative by default — the control that holds an icon carries the label.
 */
import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme/tokens';

export type IconName =
  | 'scan'
  | 'search'
  | 'userPlus'
  | 'chevronRight'
  | 'handover'
  | 'cloudUp'
  | 'cloudOff'
  | 'clock'
  | 'check'
  | 'arrowRight'
  | 'mapPin'
  | 'truck'
  | 'alert'
  | 'hospital'
  | 'user'
  | 'droplet'
  | 'ambulance'
  | 'calendar'
  | 'chevronDown';

const PATHS: Record<IconName, React.ReactNode> = {
  scan: (
    <>
      <Path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <Rect x={7.5} y={7.5} width={3.5} height={3.5} />
      <Rect x={13} y={7.5} width={3.5} height={3.5} />
      <Rect x={7.5} y={13} width={3.5} height={3.5} />
      <Path d="M13 13h3.5v3.5" />
    </>
  ),
  search: (
    <>
      <Circle cx={11} cy={11} r={7} />
      <Path d="m20 20-3.5-3.5" />
    </>
  ),
  userPlus: (
    <>
      <Circle cx={9} cy={8} r={4} />
      <Path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7M19 8v6M16 11h6" />
    </>
  ),
  chevronRight: <Path d="m9 18 6-6-6-6" />,
  handover: <Path d="M17 3l4 4-4 4M3 7h18M7 21l-4-4 4-4M21 17H3" />,
  cloudUp: (
    <>
      <Path d="M17.5 19H8a5 5 0 1 1 1.1-9.9A6 6 0 0 1 20 11a4 4 0 0 1-2.5 8z" />
      <Path d="M12 16.5v-5M9.5 14 12 11.5l2.5 2.5" />
    </>
  ),
  cloudOff: (
    <>
      <Path d="M3 3l18 18" />
      <Path d="M8.6 5.3A6 6 0 0 1 20 11a4 4 0 0 1-.9 7.5M15 19H8a5 5 0 0 1-2.4-9.4" />
    </>
  ),
  clock: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 7v5l3 2" />
    </>
  ),
  check: <Path d="M20 6 9 17l-5-5" />,
  arrowRight: <Path d="M5 12h14M13 6l6 6-6 6" />,
  mapPin: (
    <>
      <Path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
      <Circle cx={12} cy={10} r={2.5} />
    </>
  ),
  truck: (
    <>
      <Path d="M2 6h12v10H2zM14 10h4l3 3v3h-7" />
      <Circle cx={6} cy={18} r={2} />
      <Circle cx={17} cy={18} r={2} />
    </>
  ),
  alert: (
    <Path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" />
  ),
  user: (
    <>
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </>
  ),
  droplet: <Path d="M12 2.7 6.3 9.1a8 8 0 1 0 11.4 0L12 2.7z" />,
  ambulance: (
    <>
      <Path d="M2 7h11v10H2zM13 11h4.5L21 14v3h-8" />
      <Path d="M7.5 9.5v4M5.5 11.5h4" />
      <Circle cx={6} cy={18} r={2} />
      <Circle cx={17} cy={18} r={2} />
    </>
  ),
  calendar: (
    <>
      <Rect x={3} y={5} width={18} height={16} rx={2} />
      <Path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  chevronDown: <Path d="m6 9 6 6 6-6" />,
  hospital: (
    <>
      <Rect x={3} y={3} width={18} height={18} rx={2} />
      <Path d="M9 7v10M15 7v10M9 12h6" />
    </>
  ),
};

export function Icon({
  name,
  size = 22,
  color = colors.textPrimary,
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {PATHS[name]}
    </Svg>
  );
}
