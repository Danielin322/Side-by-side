/**
 * Light / dark mode choice, saved in localStorage and applied as html[data-theme] (see globals.css).
 * "system" removes the attribute so the site follows the device's appearance setting.
 */
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_STORAGE_KEY = "sbs-theme";

const isTheme = (v: unknown): v is Theme => typeof v === "string" && (THEMES as readonly string[]).includes(v);

export function applyTheme(theme: Theme) {
  const el = document.documentElement;
  if (theme === "system") delete el.dataset.theme;
  else el.dataset.theme = theme;
}

export function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(saved) ? saved : "system";
  } catch {
    return "system";
  }
}

export function saveTheme(theme: Theme) {
  try {
    if (theme === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage blocked (private mode): the choice still applies for this visit.
  }
}

/**
 * Runs in <head> before first paint so a saved choice doesn't flash the other theme.
 * Switching language re-renders <html> and React strips data-theme; the observer puts it back
 * as a microtask, before the browser paints, so there's no flash of the device theme.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var e=document.documentElement,a=function(){var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")e.dataset.theme=t;};a();new MutationObserver(function(){if(!e.dataset.theme)a();}).observe(e,{attributes:true,attributeFilter:["data-theme"]});}catch(_){}})();`;
