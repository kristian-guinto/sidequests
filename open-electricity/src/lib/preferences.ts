import { TimeRange, ViewMode, PaletteMode } from "./types";

export const PREFERENCE_KEYS = {
  RANGE: "opennem_range",
  VIEW_MODE: "opennem_view_mode",
  PALETTE_MODE: "opennem_palette_mode",
} as const;

export function getStoredPreference<T extends string>(
  key: string,
  validValues: readonly T[],
  fallback: T
): T {
  if (typeof window === "undefined") return fallback;
  try {
    const item = localStorage.getItem(key);
    if (item && (validValues as readonly string[]).includes(item)) {
      return item as T;
    }
  } catch (e) {
    console.warn(`Error reading localStorage key "${key}":`, e);
  }
  return fallback;
}

export function setStoredPreference(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`Error writing localStorage key "${key}":`, e);
  }
}

