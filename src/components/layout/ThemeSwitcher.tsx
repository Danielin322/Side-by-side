"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";
import { applyTheme, loadTheme, saveTheme } from "./theme";

const DEVICE_DARK = "(prefers-color-scheme: dark)";

/**
 * iPhone-style switch in the header: off = light, on = dark.
 * Until it's used, the site follows the device; after a flip the choice is remembered in this browser.
 */
export function ThemeSwitcher() {
  const t = useTranslations("topBar.theme");
  // Unknown on the server: the saved choice and the device setting are only readable in the browser.
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    const media = window.matchMedia(DEVICE_DARK);
    const sync = () => {
      const saved = loadTheme();
      // Switching language remounts <html> and drops data-theme, and the head script doesn't re-run, so re-apply it here.
      applyTheme(saved);
      setDark(saved === "system" ? media.matches : saved === "dark");
    };
    sync();
    // With no saved choice, follow the device if its setting changes while the page is open.
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const toggle = () => {
    const next = dark ? "light" : "dark";
    setDark(!dark);
    applyTheme(next);
    saveTheme(next);
  };

  const Icon = dark ? Moon : Sun;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!dark}
      aria-label={t("label")}
      title={t("label")}
      onClick={toggle}
      // Hidden until the browser knows which mode is on, so it never shows the wrong position.
      className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors duration-200 ${
        dark ? "bg-primary" : "bg-line"
      } ${dark === null ? "invisible" : ""}`}
    >
      {/* The knob slides toward the end of the track when on; in Hebrew the end is on the left. */}
      <span
        aria-hidden
        className={`flex size-6 items-center justify-center rounded-full bg-surface shadow-soft transition-transform duration-200 ${
          dark ? "translate-x-6 rtl:-translate-x-6" : "translate-x-0"
        }`}
      >
        <Icon className={`size-3.5 ${dark ? "text-primary" : "text-ink-soft"}`} />
      </span>
    </button>
  );
}
