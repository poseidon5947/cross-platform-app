import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { configureVapid, sendPushToSubscription } from "../_shared/webpush.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Client-callable: a signed-in user can push to their own subscriptions
// (e.g. a "send me a test notification" confirmation); admins can push to
// anyone. Not used by the scheduled nudge worker — that's run-nudges, which
// authenticates as the service role directly.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const body = await req.json().catch(() => ({}));
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

  const { data: caller } = await service.from("profiles").select("id,role").eq("id", userData.user.id).single();
  const targetUserId = String(body.userId || userData.user.id);
  if (targetUserId !== userData.user.id && caller?.role !== "admin") return json({ error: "Can only push to yourself unless admin" }, 403);

  const title = String(body.title || "Crew+ notification");
  const text = String(body.body || "");
  if (!text) return json({ error: "body is required" }, 400);

  configureVapid();
  const { data: subs, error } = await service.from("crew_push_subscription").select("id,endpoint,p256dh,auth").eq("user_id", targetUserId);
  if (error) return json({ error: error.message }, 500);
  if (!subs?.length) return json({ error: "No push subscriptions for this user" }, 404);

  let delivered = 0;
  for (const sub of subs) {
    const result = await sendPushToSubscription(sub, { title, body: text });
    if (result.ok) delivered += 1;
    else if (result.expired) await service.from("crew_push_subscription").delete().eq("id", sub.id);
  }

  return json({ delivered, of: subs.length });
});

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: cors });
}
