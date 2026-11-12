/**
 * CASEVAC design tokens.
 * Source: CASEVAC_DOCS/UI_DESIGN_GUIDELINES.md §2–3.
 * Formal, minimal, clinical. Never rely on colour alone to convey status.
 */
import { Platform } from 'react-native';

export const colors = {
  // Surfaces
  background: '#FFFFFF',
  surface: '#F7F8FA',
  border: '#D3D9DF',
  divider: '#E6EAEE',

  // Text
  textPrimary: '#1C2630',
  textSecondary: '#5D6772',
  textMuted: '#4A535D',
  placeholder: '#7A848F',

  // Primary action (restrained blue accent)
  primary: '#244B66',
  primaryPressed: '#1A3A50',
  primaryDisabled: '#8FA3B2',
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
  sm: 4,
  md: 6,
  lg: 8,
  pill: 999,
} as const;

/** Minimum practical tap target (48 × 48 dp). */
export const touchTarget = 48;

export const fonts = {
  mono: Platform.select({ android: 'monospace', ios: 'Menlo', default: 'monospace' }),
} as const;

export const typography = {
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' as const },
  heading: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 22 },
  bodySmall: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500' as const },
  caption: { fontSize: 13, lineHeight: 18 },
  helper: { fontSize: 12, lineHeight: 16 },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700' as const,
    letterSpacing: 1.4,
  },
  sectionTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700' as const,
    letterSpacing: 1,
  },
} as const;
