import webpush from "npm:web-push@3.6.7";

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export function configureVapid() {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:ops@vanislecoatings.com";
  if (!publicKey || !privateKey) throw new Error("VAPID keys are not configured");
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export async function sendPushToSubscription(row: PushSubscriptionRow, payload: { title: string; body: string; url?: string }) {
  const subscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true as const };
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    return { ok: false as const, expired: statusCode === 404 || statusCode === 410 };
  }
}
