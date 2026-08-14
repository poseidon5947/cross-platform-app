import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { configureVapid, sendPushToSubscription } from "../_shared/webpush.ts";

// Scheduled worker (invoked by pg_cron via pg_net). Not user-facing — auth is
// a bearer match against the service role key, same as other cron-only
// entrypoints in this suite.
Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (authHeader !== `Bearer ${serviceKey}`) return json({ error: "Unauthorized" }, 401);

  const service = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  configureVapid();

  const today = new Date().toISOString().slice(0, 10);
  const year = today.slice(0, 4);
  const sent: string[] = [];

  const { data: profiles, error: profilesError } = await service
    .from("profiles")
    .select("id,name,role,employment_type,hire_date,new_hire_until,access_upgraded_at");
  if (profilesError) return json({ error: profilesError.message }, 500);

  const admins = (profiles ?? []).filter((p) => p.role === "admin");

  // 1. New hire access reviews due — notify admins, once per person per day until resolved.
  const dueNewHires = (profiles ?? []).filter((p) => p.new_hire_until && today >= p.new_hire_until && !p.access_upgraded_at);
  for (const hire of dueNewHires) {
    for (const admin of admins) {
      await notifyOnce(service, admin.id, "new_hire_review", `new-hire-review:${hire.id}:${today}`, {
        title: "New hire access review due",
        body: `${hire.name} has passed three days — review and grant full access if it's a fit.`,
      }, sent);
    }
  }

  // 2. Bonus program — admin review notice (Nov 16-30, once per year).
  if (today >= `${year}-11-16` && today <= `${year}-11-30`) {
    for (const admin of admins) {
      await notifyOnce(service, admin.id, "bonus_admin_notice", `bonus-admin-notice:${year}`, {
        title: "Bonus program reviews due",
        body: "Performance reviews for qualifying employees should be completed before November 30.",
      }, sent);
    }
  }

  // 3. Bonus program — employee notice (Oct 31-Nov 30, 6+ months tenure, excludes temp/seasonal).
  if (today >= `${year}-10-31` && today <= `${year}-11-30`) {
    const sixMonthsAgo = new Date(`${today}T00:00:00Z`);
    sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 6);
    const cutoff = sixMonthsAgo.toISOString().slice(0, 10);
    const eligible = (profiles ?? []).filter((p) =>
      p.hire_date && p.hire_date <= cutoff && p.employment_type !== "temp" && p.employment_type !== "seasonal"
    );
    for (const employee of eligible) {
      await notifyOnce(service, employee.id, "bonus_employee_notice", `bonus-employee-notice:${employee.id}:${year}`, {
        title: "Bonus program review this November",
        body: "Your performance will be reviewed and scored for the bonus program this November.",
      }, sent);
    }
  }

  return json({ sent: sent.length, refs: sent });
});

async function notifyOnce(
  service: ReturnType<typeof createClient>,
  userId: string,
  type: string,
  ref: string,
  payload: { title: string; body: string },
  sent: string[],
) {
  const { data: existing } = await service
    .from("crew_notification_log")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .eq("ref", ref)
    .maybeSingle();
  if (existing) return;

  const { data: subs } = await service.from("crew_push_subscription").select("id,endpoint,p256dh,auth").eq("user_id", userId);
  for (const sub of subs ?? []) {
    const result = await sendPushToSubscription(sub, payload);
    if (!result.ok && result.expired) {
      await service.from("crew_push_subscription").delete().eq("id", sub.id);
    }
  }

  await service.from("crew_notification_log").insert({ user_id: userId, type, ref });
  sent.push(ref);
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}
