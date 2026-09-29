import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase";

/**
 * Crew+ and SOP+ stay shut to everyone but admin until the client opens them.
 *
 * The flag lives in crew_config so it can be flipped the moment they are ready
 * without waiting on a deploy. It defaults to shut: if the column is not there
 * yet, or the read fails, the app stays closed. Opening up is a deliberate
 * act, never something a network error can do by accident.
 */
export function useLaunchGate(column: "crew_plus_live" | "sop_plus_live") {
  const [live, setLive] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const client = supabase;
    if (!client) {
      // No backend configured - this is the local demo, so nothing to gate.
      setLive(true);
      return;
    }
    client.from("crew_config").select(column).eq("id", "crew-config").maybeSingle()
      .then(({ data, error }: { data: Record<string, unknown> | null; error: unknown }) => {
        if (cancelled) return;
        setLive(!error && Boolean(data?.[column]));
      }, () => {
        if (!cancelled) setLive(false);
      });
    return () => { cancelled = true; };
  }, [column]);
  return live;
}

export function NotOpenYet({ app }: { app: string }) {
  return <div className="login"><section className="panel card">
    <h1>{app} is not open yet</h1>
    <p>It is being set up and will be switched on shortly. Warehouse Wizard is ready to use in the meantime.</p>
  </section></div>;
}
