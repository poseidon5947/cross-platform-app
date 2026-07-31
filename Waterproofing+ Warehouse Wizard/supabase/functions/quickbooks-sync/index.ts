import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const tokenUrl = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

async function requireAdmin(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = auth.replace("Bearer ", "");
  const { data: userResult, error } = await admin.auth.getUser(token);
  if (error || !userResult.user) throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });
  const { data: profile } = await admin.from("profiles").select("role").eq("id", userResult.user.id).single();
  if (profile?.role !== "admin") throw new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: cors });
  return admin;
}

async function refreshIfNeeded(supabase: any, connection: any) {
  if (new Date(connection.expires_at).getTime() > Date.now() + 60_000) return connection;
  const clientId = Deno.env.get("QBO_CLIENT_ID")!;
  const secret = Deno.env.get("QBO_CLIENT_SECRET")!;
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: connection.refresh_token });
  const resp = await fetch(tokenUrl, { method: "POST", headers: { Authorization: `Basic ${btoa(`${clientId}:${secret}`)}`, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!resp.ok) throw new Error(await resp.text());
  const token = await resp.json();
  const updated = { ...connection, access_token: token.access_token, refresh_token: token.refresh_token ?? connection.refresh_token, expires_at: new Date(Date.now() + Number(token.expires_in ?? 3600) * 1000).toISOString() };
  await supabase.from("integration_connections").update({ access_token: updated.access_token, refresh_token: updated.refresh_token, expires_at: updated.expires_at }).eq("provider", "quickbooks");
  return updated;
}

async function qboQuery(base: string, realmId: string, accessToken: string, query: string) {
  const encoded = encodeURIComponent(query);
  const resp = await fetch(`${base}/v3/company/${realmId}/query?query=${encoded}&minorversion=75`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

function isInProgressProject(project: any) {
  const status = String(project.ProjectStatus ?? project.Status ?? project.status ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  return status === "inprogress";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supabase = await requireAdmin(req);
    const { data: rawConnection, error } = await supabase.from("integration_connections").select("*").eq("provider", "quickbooks").single();
    if (error || !rawConnection) return Response.json({ error: "QuickBooks is not connected." }, { status: 409, headers: cors });
    const connection = await refreshIfNeeded(supabase, rawConnection);
    const base = (Deno.env.get("QBO_ENVIRONMENT") ?? "sandbox") === "production" ? "https://quickbooks.api.intuit.com" : "https://sandbox-quickbooks.api.intuit.com";
    let payload: any[] = [];
    try {
      const projectJson = await qboQuery(base, connection.realm_id, connection.access_token, "select Id,Name,CustomerRef,ProjectStatus,Status from Project");
      const projects = projectJson.QueryResponse?.Project ?? [];
      payload = projects.filter(isInProgressProject).map((project: any) => ({
        name: [project.CustomerRef?.name, project.Name].filter(Boolean).join(" - ") || project.Name,
        address: "",
        qbo_customer_name: project.CustomerRef?.name ?? project.Name,
        qbo_project_id: project.Id,
        qbo_project_name: project.Name,
        source: "quickbooks",
      }));
    } catch {
      const json = await qboQuery(base, connection.realm_id, connection.access_token, "select Id,DisplayName,FullyQualifiedName,ParentRef,Job,Active from Customer where Active = true");
      const customers = json.QueryResponse?.Customer ?? [];
      const parentName = new Map(customers.map((c: any) => [c.Id, c.DisplayName]));
      payload = customers.filter((c: any) => c.Job === true || c.ParentRef).map((project: any) => ({
        name: [parentName.get(project.ParentRef?.value), project.DisplayName].filter(Boolean).join(" - ") || project.DisplayName,
        address: "",
        qbo_customer_name: parentName.get(project.ParentRef?.value) ?? project.FullyQualifiedName?.split(":")[0] ?? project.DisplayName,
        qbo_project_id: project.Id,
        qbo_project_name: project.DisplayName,
        source: "quickbooks",
      }));
    }
    if (payload.length) {
      const { error: upsertError } = await supabase.from("sites").upsert(payload, { onConflict: "qbo_project_id" });
      if (upsertError) throw upsertError;
    }
    await supabase.from("integration_connections").update({ metadata: { ...connection.metadata, last_synced_at: new Date().toISOString(), last_synced_count: payload.length } }).eq("provider", "quickbooks");
    return Response.json({ synced: payload.length }, { headers: cors });
  } catch (err) {
    if (err instanceof Response) return err;
    return Response.json({ error: String(err?.message ?? err) }, { status: 500, headers: cors });
  }
});
