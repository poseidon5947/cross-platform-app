import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const authBase = "https://appcenter.intuit.com/connect/oauth2";
const tokenUrl = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

async function requireAdmin(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = auth.replace("Bearer ", "");
  const { data: userResult, error } = await admin.auth.getUser(token);
  if (error || !userResult.user) throw new Response("Unauthorized", { status: 401, headers: cors });
  const { data: profile } = await admin.from("profiles").select("role").eq("id", userResult.user.id).single();
  if (profile?.role !== "admin") throw new Response("Admin only", { status: 403, headers: cors });
  return admin;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const redirectUri = Deno.env.get("QBO_REDIRECT_URI")!;
  const clientId = Deno.env.get("QBO_CLIENT_ID")!;
  const secret = Deno.env.get("QBO_CLIENT_SECRET")!;

  if (url.searchParams.get("code")) {
    const state = url.searchParams.get("state");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: pending } = await supabase.from("integration_connections").select("metadata").eq("provider", "quickbooks").single();
    if (!state || pending?.metadata?.pending_state !== state) return new Response("Invalid OAuth state", { status: 400, headers: cors });
    const body = new URLSearchParams({ grant_type: "authorization_code", code: url.searchParams.get("code")!, redirect_uri: redirectUri });
    const tokenResp = await fetch(tokenUrl, {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${clientId}:${secret}`)}`, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!tokenResp.ok) return new Response(await tokenResp.text(), { status: tokenResp.status, headers: cors });
    const token = await tokenResp.json();
    const expiresAt = new Date(Date.now() + Number(token.expires_in ?? 3600) * 1000).toISOString();
    const { error } = await supabase.from("integration_connections").upsert({
      provider: "quickbooks",
      realm_id: url.searchParams.get("realmId"),
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: expiresAt,
      metadata: { connected_at: new Date().toISOString(), environment: Deno.env.get("QBO_ENVIRONMENT") ?? "sandbox" },
    }, { onConflict: "provider" });
    if (error) return Response.json({ error: error.message }, { status: 500, headers: cors });
    return new Response("<script>window.close()</script><p>QuickBooks connected. You can close this window.</p>", { headers: { ...cors, "Content-Type": "text/html" } });
  }

  try {
    await requireAdmin(req);
    const state = crypto.randomUUID();
    const target = new URL(authBase);
    target.searchParams.set("client_id", clientId);
    target.searchParams.set("redirect_uri", redirectUri);
    target.searchParams.set("response_type", "code");
    target.searchParams.set("scope", "com.intuit.quickbooks.accounting");
    target.searchParams.set("state", state);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await supabase.from("integration_connections").upsert({
      provider: "quickbooks",
      metadata: { pending_state: state, pending_at: new Date().toISOString(), environment: Deno.env.get("QBO_ENVIRONMENT") ?? "sandbox" },
    }, { onConflict: "provider" });
    return Response.json({ authUrl: target.toString() }, { headers: cors });
  } catch (err) {
    if (err instanceof Response) return err;
    return Response.json({ error: String(err?.message ?? err) }, { status: 500, headers: cors });
  }
});
