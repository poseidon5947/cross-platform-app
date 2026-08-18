import { useEffect, useState } from "react";

export type ThemePreference = "auto" | "light" | "dark";
const STORAGE_KEY = "theme-preference";

function applyTheme(preference: ThemePreference) {
  if (preference === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = preference;
}

export function useThemePreference() {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const initial = stored === "light" || stored === "dark" ? stored : "auto";
    applyTheme(initial);
    return initial;
  });
  useEffect(() => { applyTheme(preference); localStorage.setItem(STORAGE_KEY, preference); }, [preference]);
  return [preference, setPreference] as const;
}

export function ThemeControl({ value, onChange }: { value: ThemePreference; onChange: (value: ThemePreference) => void }) {
  return <div className="theme-control" aria-label="Color theme">{(["auto", "light", "dark"] as const).map((option) => <button key={option} className={value === option ? "on" : ""} aria-pressed={value === option} title={`${option[0].toUpperCase()}${option.slice(1)} theme`} onClick={() => onChange(option)}><span aria-hidden="true">{option === "auto" ? "A" : option === "light" ? "☀" : "☾"}</span><small>{option}</small></button>)}</div>;
}
