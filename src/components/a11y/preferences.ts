/** Accessibility preferences, saved in localStorage and applied as data-* attributes on <html>. */
export type A11yPrefs = {
  /** 0 = smaller, 1 = default, 2-3 = larger. Matches html[data-text-scale] in globals.css. */
  textScale: number;
  contrast: boolean;
  motion: boolean;
};

export const A11Y_STORAGE_KEY = "sbs-a11y";
export const DEFAULT_PREFS: A11yPrefs = { textScale: 1, contrast: false, motion: false };
export const MIN_TEXT_SCALE = 0;
export const MAX_TEXT_SCALE = 3;

export function applyPrefs(prefs: A11yPrefs) {
  const el = document.documentElement;
  el.dataset.textScale = String(prefs.textScale);
  if (prefs.contrast) el.dataset.contrast = "high";
  else delete el.dataset.contrast;
  if (prefs.motion) el.dataset.motion = "reduce";
  else delete el.dataset.motion;
}

export function loadPrefs(): A11yPrefs {
  try {
    const raw = localStorage.getItem(A11Y_STORAGE_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: A11yPrefs) {
  try {
    localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage blocked (private mode): preferences still apply for this visit.
  }
}

/** Runs in <head> before first paint so saved preferences don't flash. */
export const A11Y_INIT_SCRIPT = `try{var p=JSON.parse(localStorage.getItem("${A11Y_STORAGE_KEY}")||"{}"),e=document.documentElement;if(typeof p.textScale==="number")e.dataset.textScale=String(p.textScale);if(p.contrast)e.dataset.contrast="high";if(p.motion)e.dataset.motion="reduce";}catch(_){}`;
