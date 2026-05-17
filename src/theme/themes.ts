export type ThemeKey = 'dusk' | 'midnight' | 'slate' | 'light';

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  primary: string;
  primaryDim: string;
  primaryFaint: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  error: string;
  success: string;
  warning: string;
  categories: Record<string, string>;
  categoryBg: Record<string, string>;
  isDark: boolean;
}

const BUILT_IN_CATEGORIES: Record<string, string> = {
  work: '#5B8FD4',
  training: '#6DB87A',
  personal: '#D4A574',
  rest: '#9B8FD4',
  nutrition: '#D47A5B',
  learning: '#5BD4C8',
};

const CATEGORY_BG_DARK: Record<string, string> = {
  work: '#1A2A3A',
  training: '#1A2A1E',
  personal: '#2A1E10',
  rest: '#231E2A',
  nutrition: '#2A1E18',
  learning: '#1A2A2A',
};

const CATEGORY_BG_LIGHT: Record<string, string> = {
  work: '#EBF0FA',
  training: '#E8F5EB',
  personal: '#FAF0E8',
  rest: '#F0EDFA',
  nutrition: '#FAF0EB',
  learning: '#E8FAF8',
};

export const THEMES: Record<ThemeKey, ThemeColors> = {
  dusk: {
    bg: '#0D0C0B',
    surface: '#1A1917',
    surfaceAlt: '#242220',
    border: '#2A2825',
    primary: '#D4A574',
    primaryDim: '#A67C52',
    primaryFaint: '#3A2A1A',
    text: '#F0EDE8',
    textSecondary: '#8A857E',
    textMuted: '#4A4540',
    error: '#E05C5C',
    success: '#6DB87A',
    warning: '#D4A574',
    categories: BUILT_IN_CATEGORIES,
    categoryBg: CATEGORY_BG_DARK,
    isDark: true,
  },
  midnight: {
    bg: '#080C14',
    surface: '#111827',
    surfaceAlt: '#1C2433',
    border: '#243040',
    primary: '#6B9FE4',
    primaryDim: '#4A78BF',
    primaryFaint: '#1A2840',
    text: '#E8EDF5',
    textSecondary: '#7A8FA8',
    textMuted: '#3A4A5E',
    error: '#E05C5C',
    success: '#6DB87A',
    warning: '#D4A574',
    categories: BUILT_IN_CATEGORIES,
    categoryBg: CATEGORY_BG_DARK,
    isDark: true,
  },
  slate: {
    bg: '#0F1117',
    surface: '#1C1F28',
    surfaceAlt: '#262932',
    border: '#30333E',
    primary: '#A78BFA',
    primaryDim: '#7C5FD4',
    primaryFaint: '#2A1F40',
    text: '#E8E8F0',
    textSecondary: '#7E7E90',
    textMuted: '#404050',
    error: '#E05C5C',
    success: '#6DB87A',
    warning: '#D4A574',
    categories: BUILT_IN_CATEGORIES,
    categoryBg: CATEGORY_BG_DARK,
    isDark: true,
  },
  light: {
    bg: '#F7F6F4',
    surface: '#FFFFFF',
    surfaceAlt: '#F0EEE8',
    border: '#E2DED8',
    primary: '#B07840',
    primaryDim: '#8A5A28',
    primaryFaint: '#FAF0E0',
    text: '#1A1917',
    textSecondary: '#6A6560',
    textMuted: '#B0ADA8',
    error: '#C04040',
    success: '#4A8A56',
    warning: '#B07840',
    categories: BUILT_IN_CATEGORIES,
    categoryBg: CATEGORY_BG_LIGHT,
    isDark: false,
  },
};

export const THEME_NAMES: Record<ThemeKey, string> = {
  dusk: 'Dusk',
  midnight: 'Midnight',
  slate: 'Slate',
  light: 'Light',
};
