import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { configureVapid, sendPushToSubscription } from "../_shared/webpush.ts";

/**
 * The clock behind the project load-in.
 *
 * Runs every hour and works out the Vancouver local hour itself rather than
 * being pinned to a UTC time. A cron fixed at, say, 13:00 UTC is 6am Pacific
 * today and 5am from 1 November, when daylight time ends - which is exactly
 * the drift already sitting in crew-run-nudges-daily.
 *
 * Three moments, all from the client's brief:
 *   17:00  the manager should have tomorrow's list in by 5pm
 *   06:00  the assignee is told what to load, 6-7am
 *   16:00  the assignee's daily log for that job is due by 4pm
 *
 * Nothing is sent twice: crew_notification_log holds (user, type, ref).
 */
Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (authHeader !== `Bearer ${serviceKey}`) return json({ error: "Unauthorized" }, 401);

  const service = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  configureVapid();

  const now = new Date();
  const { day: today, hour } = vancouverParts(now);
  const tomorrow = addDays(today, 1);
  const sent: string[] = [];

  // 5pm: is tomorrow covered? Saturday evening is skipped, because nobody
  // works Sunday and the client asked for no alert that night.
  if (hour === 17 && isWorkDay(tomorrow)) {
    const { data: planned } = await service
      .from("project_load_in").select("id").eq("load_in_date", tomorrow).limit(1);
    if (!planned?.length) {
      const { data: managers } = await service
        .from("profiles").select("id").in("role", ["admin", "manager"]);
      for (const manager of managers ?? []) {
        await notifyOnce(service, manager.id, "load_in_due", `load-in-due:${tomorrow}`, {
          title: "Tomorrow's load-in list is not in yet",
          body: "It was due by 5pm. The crew need it before 6am.",
        }, sent);
      }
    }
  }

  // 6am: tell the assignee what they are loading.
  if (hour === 6) {
    const { data: due } = await service
      .from("project_load_in").select("id,assigned_to,site_id").eq("load_in_date", today).is("completed_at", null);
    for (const loadIn of due ?? []) {
      if (!loadIn.assigned_to) continue;
      await notifyOnce(service, loadIn.assigned_to, "load_in_morning", `load-in-morning:${loadIn.id}`, {
        title: "Your load-in is ready",
        body: "Open Warehouse Wizard to see the list. Loading is 6-7am.",
      }, sent);
    }
  }

  // 4pm: the person who loaded it in owes the daily log for that job.
  if (hour === 16) {
    const { data: loaded } = await service
      .from("project_load_in").select("id,assigned_to,site_id").eq("load_in_date", today).not("assigned_to", "is", null);
    for (const loadIn of loaded ?? []) {
      const { data: log } = await service
        .from("daily_logs").select("id").eq("date", today).eq("site_id", loadIn.site_id)
        .eq("completed_by_user_id", loadIn.assigned_to).limit(1);
      if (log?.length) continue;
      await notifyOnce(service, loadIn.assigned_to!, "load_in_daily_log", `load-in-log:${loadIn.id}`, {
        title: "Daily log due",
        body: "Your daily log for today's job is due by 4pm.",
      }, sent);
    }
  }

  return json({ localDay: today, localHour: hour, sent: sent.length, refs: sent });
});

/** Local day and hour in Vancouver, whatever the server clock is set to. */
function vancouverParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  // "24" turns up at midnight in some runtimes.
  const hour = Number(get("hour")) % 24;
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour };
}

function addDays(dayKey: string, days: number) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day));
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

/** The crew work Monday to Saturday. */
function isWorkDay(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() !== 0;
}

async function notifyOnce(
  service: ReturnType<typeof createClient>,
  userId: string,
  type: string,
  ref: string,
  payload: { title: string; body: string },
  sent: string[],
) {
  const { data: existing } = await service
    .from("crew_notification_log").select("id")
    .eq("user_id", userId).eq("type", type).eq("ref", ref).maybeSingle();
  if (existing) return;

  const { data: subs } = await service
    .from("crew_push_subscription").select("id,endpoint,p256dh,auth").eq("user_id", userId);
  for (const sub of subs ?? []) {
    const result = await sendPushToSubscription(sub, payload);
    if (!result.ok && result.expired) {
      await service.from("crew_push_subscription").delete().eq("id", sub.id);
    }
  }

  // Logged even with no subscription, so the in-app badge can show it and a
  // later push does not repeat what someone has already acted on.
  await service.from("crew_notification_log").insert({ user_id: userId, type, ref });
  sent.push(ref);
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}
