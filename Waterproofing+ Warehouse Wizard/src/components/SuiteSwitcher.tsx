const links = [
  { id: "crew", label: "Crew+", url: import.meta.env.VITE_CREW_URL },
  { id: "warehouse", label: "Warehouse", url: import.meta.env.VITE_WAREHOUSE_URL },
  { id: "sop", label: "SOP+", url: import.meta.env.VITE_SOP_URL },
] as const;
export function SuiteSwitcher({ current }: { current: "crew" | "warehouse" | "sop" }) { return <div className="suite-switcher"><small>Van Isle Suite</small><div>{links.map((link) => link.id === current ? <span className="active" aria-current="page" key={link.id}>{link.label}</span> : <a key={link.id} href={link.url || "#"}>{link.label}</a>)}</div></div>; }
