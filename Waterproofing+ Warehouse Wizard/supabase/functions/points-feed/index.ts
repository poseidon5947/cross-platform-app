import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const url = new URL(req.url);
  const since = url.searchParams.get("since") ?? "1970-01-01T00:00:00.000Z";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await supabase
    .from("points_events")
    .select("id,user_id,type,points,reason,ref,ts,profiles(name,email,role)")
    .gte("ts", since)
    .order("ts", { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ events: data, contract: "warehouse_wizard.points_events.v1" });
});
