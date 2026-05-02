/**
 * モバイルアプリのデザイントークン
 * Web globals.css のカラー/余白とブランド一貫性を保つ
 */

export const colors = {
  // Brand
  brand: "#1E3A8A",
  primary: "#3366FF",
  primaryDark: "#1E40AF",
  primarySoft: "#DBE7FF",

  // Surfaces
  bg: "#F4F6FB",
  surface: "#FFFFFF",
  surfaceMuted: "#F8FAFC",
  surfaceHover: "#F1F5F9",
  border: "#E5E7EB",
  borderStrong: "#D1D5DB",

  // Text
  text: "#0F172A",
  textStrong: "#020617",
  textLight: "#475569",
  textMuted: "#64748B",
  textDisabled: "#94A3B8",
  white: "#FFFFFF",

  // Semantic
  danger: "#DC2626",
  dangerBg: "#FEF2F2",
  dangerBorder: "#FECACA",
  warning: "#D97706",
  warningBg: "#FFFBEB",
  warningBorder: "#FCD34D",
  warningText: "#92400E",
  success: "#059669",
  successBg: "#ECFDF5",
  successBorder: "#A7F3D0",
  successText: "#065F46",
  info: "#0EA5E9",
  infoBg: "#F0F9FF",
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

/**
 * Noto Sans JP のウェイト別ファミリー名。
 * @expo-google-fonts/noto-sans-jp が提供するキー名と一致させる。
 */
export const fonts = {
  regular: "NotoSansJP_400Regular",
  medium: "NotoSansJP_500Medium",
  semibold: "NotoSansJP_600SemiBold",
  bold: "NotoSansJP_700Bold",
} as const;

export const typography = {
  display: { fontFamily: fonts.bold, fontSize: 28, letterSpacing: -0.4, lineHeight: 34 },
  title: { fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.2, lineHeight: 26 },
  subtitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  captionStrong: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 },
  // numbers / KPI
  kpi: { fontFamily: fonts.bold, fontSize: 32, letterSpacing: -0.5, lineHeight: 36 },
  // section labels (uppercase)
  overline: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase" as const,
    lineHeight: 14,
  },
} as const;

export const shadows = {
  card: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardLifted: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
} as const;

// 最小タップ領域（Apple HIG / Material 推奨）
export const TOUCH_MIN = 44;
