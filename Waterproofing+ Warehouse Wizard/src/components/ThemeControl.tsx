import { useEffect, useState } from "react";

export type ThemePreference = "auto" | "light" | "dark";
const STORAGE_KEY = "theme-preference";

function resolved(preference: ThemePreference) {
  return preference === "auto" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : preference;
}

export function useThemePreference(onResolvedChange: (theme: "light" | "dark") => void) {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "auto";
  });
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { const next = resolved(preference); document.documentElement.dataset.theme = next; onResolvedChange(next); };
    apply();
    localStorage.setItem(STORAGE_KEY, preference);
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preference, onResolvedChange]);
  return [preference, setPreference] as const;
}

export function ThemeControl({ value, onChange }: { value: ThemePreference; onChange: (value: ThemePreference) => void }) {
  return <div className="theme-control" aria-label="Color theme">{(["auto", "light", "dark"] as const).map((option) => <button key={option} className={value === option ? "on" : ""} aria-pressed={value === option} title={`${option[0].toUpperCase()}${option.slice(1)} theme`} onClick={() => onChange(option)}><span aria-hidden="true">{option === "auto" ? "A" : option === "light" ? "☀" : "☾"}</span><small>{option}</small></button>)}</div>;
}
