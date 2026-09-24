import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

/**
 * Read side of the points ledger, for the HR app to consume.
 *
 * This ran with the service role key and NO caller check at all, and the function
 * is deployed with verify_jwt off, so the gateway did not check either: an
 * unauthenticated GET returned every points event joined to profiles(name, email,
 * role). Anyone who knew the URL - which is just the project ref - could read the
 * staff list with company email addresses, and the whole points ledger with it.
 *
 * The caller is identified now and must be a manager or admin, the same bar
 * award-points applies to reading other people's data. Email is no longer joined;
 * user_id identifies a person and the feed never needed an address.
 *
 * A caller must be a signed-in manager or admin. There is deliberately no
 * service-key bypass: this project carries both legacy JWT keys and newer
 * sb_secret_ ones, so string-matching whatever Supabase injects is a guess, and
 * trusting a role claim off an unverified JWT would be worse than the hole this
 * replaces. Nothing calls this machine-to-machine today - Crew+ reads
 * points_events directly through RLS - so if an external consumer is needed later
 * it should get a real service account rather than an implicit key match.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return Response.json({ error: "GET required" }, { status: 405, headers: cors });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return Response.json({ error: "Unauthorized" }, { status: 401, headers: cors });
  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: cors });

  const { data: caller, error: callerError } = await service
    .from("profiles").select("role").eq("id", userData.user.id).single();
  if (callerError || !caller) return Response.json({ error: "Unauthorized" }, { status: 401, headers: cors });
  if (caller.role !== "admin" && caller.role !== "manager") {
    return Response.json({ error: "This feed is manager/admin only" }, { status: 403, headers: cors });
  }

  const since = new URL(req.url).searchParams.get("since") ?? "1970-01-01T00:00:00.000Z";
  const { data, error } = await service
    .from("points_events")
    .select("id,user_id,type,points,reason,ref,ts,profiles(name,role)")
    .gte("ts", since)
    .order("ts", { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500, headers: cors });
  return Response.json({ events: data, contract: "warehouse_wizard.points_events.v1" }, { headers: cors });
});
