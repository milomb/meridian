import { useSettingsStore } from '../store/settingsStore';
import { THEMES, ThemeColors } from './themes';

// Static reference for non-component code (always dark)
export const colors = THEMES.dusk;

// Hook for components — returns live theme colors
export function useColors(): ThemeColors {
  const theme = useSettingsStore((s) => s.theme);
  return THEMES[theme] ?? THEMES.dusk;
}

// Resolve color for any category (built-in or custom)
export function getCategoryColor(
  category: string,
  customCategories: { id: string; name: string; color: string }[],
  c: ThemeColors
): string {
  if (category in c.categories) return c.categories[category];
  const custom = customCategories.find((x) => x.name === category);
  return custom?.color ?? c.primary;
}

export function getCategoryBg(
  category: string,
  customCategories: { id: string; name: string; bg: string }[],
  c: ThemeColors
): string {
  if (category in c.categoryBg) return c.categoryBg[category];
  const custom = customCategories.find((x) => x.name === category);
  return custom?.bg ?? c.primaryFaint;
}

export type Category = string;
