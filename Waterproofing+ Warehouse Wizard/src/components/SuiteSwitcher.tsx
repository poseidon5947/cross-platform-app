const links = [
  { id: "crew", label: "Crew+", url: import.meta.env.VITE_CREW_URL },
  { id: "warehouse", label: "Warehouse", url: import.meta.env.VITE_WAREHOUSE_URL },
  { id: "sop", label: "SOP+", url: import.meta.env.VITE_SOP_URL },
] as const;

/**
 * Crew+ and SOP+ are not open to the crew yet - both are held shut by
 * `crew_config.crew_plus_live` / `sop_plus_live`, so a crew member who followed
 * either link landed on "not open yet". The client asked for the two links to be
 * hidden rather than shown-and-refused, so a crew member sees only the app they
 * are actually meant to be in.
 *
 * `showOtherApps` is passed in rather than read from the role here: this module
 * is imported by App.tsx, so importing `canManage` back out of it would be a
 * cycle. Keeping the role test at the call site also keeps it in one place.
 */
export function SuiteSwitcher({ current, showOtherApps = true }: {
  current: "crew" | "warehouse" | "sop";
  showOtherApps?: boolean;
}) {
  const visible = showOtherApps ? links : links.filter((link) => link.id === current);
  return <div className="suite-switcher"><small>Van Isle Suite</small><div>{visible.map((link) => link.id === current ? <span className="active" aria-current="page" key={link.id}>{link.label}</span> : <a key={link.id} href={link.url || "#"}>{link.label}</a>)}</div></div>;
}
