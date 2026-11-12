/**
 * Jeevan (CASEVAC) design tokens — tablet-first, landscape-only.
 * Source: CASEVAC_DOCS/UI_DESIGN_GUIDELINES.md (layout system v1, 12 Nov 2026).
 *
 * Sizes are density-independent (dp / sp). The client's "px" figures map to
 * dp at the 1280 × 800 dp baseline (a 1920 × 1200 px tablet at 1.5× density).
 * Formal, minimal, clinical. Never rely on colour alone to convey status.
 */
import { Platform } from 'react-native';

export const colors = {
  // Surfaces
  background: '#FFFFFF',
  surface: '#F4F6F8',
  surfaceStrong: '#E9EDF1',
  /** Card / section outline — clearly visible on white. */
  border: '#C3CAD2',
  /** Input and control outline (≥ 3:1 against white). */
  borderStrong: '#8C96A0',
  divider: '#E1E6EB',

  // Text
  textPrimary: '#1C2630',
  textSecondary: '#4F5A66',
  textMuted: '#4A535D',
  placeholder: '#6E7883',

  // Primary action (restrained blue accent)
  primary: '#244B66',
  primaryPressed: '#1A3A50',
  primaryDisabled: '#8FA3B2',
  /** Selected navigation item background. */
  primarySurface: '#E3ECF3',
  onPrimary: '#FFFFFF',
  onPrimaryMuted: '#D9E4EC',

  // Status tones (text / surface / border)
  error: '#AA3030',
  errorSurface: '#FBEFEF',
  errorBorder: '#E5BDBD',

  success: '#1F6641',
  successSurface: '#EEF6F1',
  successBorder: '#B9D5C4',

  warning: '#7A4F12',
  warningStrong: '#8B5B15',
  warningSurface: '#FBF6EC',
  warningBorder: '#E2CFA6',
} as const;

/**
 * Triage categories. Always pair the colour with its text label and count
 * (e.g. "RED (12)"); `onFill` is the readable text colour on the fill.
 */
export const triage = {
  RED: {
    fill: '#C62828',
    onFill: '#FFFFFF',
    label: 'RED',
    meaning: 'Critical',
  },
  YELLOW: {
    fill: '#F2B705',
    onFill: '#1C2630',
    label: 'YELLOW',
    meaning: 'Delayed / moderate',
  },
  GREEN: {
    fill: '#2E7D32',
    onFill: '#FFFFFF',
    label: 'GREEN',
    meaning: 'Minor / stable',
  },
  BLACK: {
    fill: '#1C1C1C',
    onFill: '#FFFFFF',
    label: 'BLACK',
    meaning: 'Deceased / expectant',
  },
} as const;

/** Base spacing scale: 4, 8, 12, 16, 24, 32 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  /** Cards and section boxes. */
  lg: 10,
  pill: 999,
} as const;

/** Minimum practical tap target (48 × 48 dp). */
export const touchTarget = 48;

/** Tablet layout system v1 (UI_DESIGN_GUIDELINES.md §4). */
export const layout = {
  topBarHeight: 64,
  sidebarWidth: 240,
  /** Icon-and-label sidebar used when the window is narrower than navCollapseBelow. */
  sidebarCompactWidth: 96,
  navCollapseBelow: 1200,
  contentPadding: 24,
  /** Gap between cards / sections. */
  gutter: 16,
  /** Inner padding of cards and section boxes. */
  cardPadding: 16,
  inputHeight: 52,
  buttonHeight: 56,
  tableRowHeight: 48,
  borderWidth: 1,
  /** Below this window width, split layouts stack vertically (fallback only). */
  splitBreakpoint: 900,
} as const;

export const fonts = {
  mono: Platform.select({
    android: 'monospace',
    ios: 'Menlo',
    default: 'monospace',
  }),
} as const;

/**
 * Type scale (client spec): page title 24–28, section heading 18–22,
 * card value 24–32, labels 14–16, input/button 16–18, table 14–15,
 * helper 12–13 (avoid smaller).
 */
export const typography = {
  /** App / page title. */
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700' as const },
  /** Section heading. */
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const },
  /** Dashboard card value. */
  cardValue: { fontSize: 30, lineHeight: 36, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 22 },
  bodySmall: { fontSize: 15, lineHeight: 21 },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '500' as const },
  input: { fontSize: 17, lineHeight: 22 },
  button: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
  /** Table text and metadata. */
  table: { fontSize: 15, lineHeight: 20 },
  caption: { fontSize: 14, lineHeight: 19 },
  helper: { fontSize: 13, lineHeight: 17 },
  eyebrow: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700' as const,
    letterSpacing: 1.4,
  },
  sectionTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700' as const,
    letterSpacing: 1,
  },
} as const;
