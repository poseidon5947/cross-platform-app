import { supabase } from "../integrations/supabase";
import type { PointsAward, PointsEvent, Profile, PromptSet, SopCategory, SopItem, SopMedia, SopState, SopStep } from "../types";

function requireClient() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await requireClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  const { error } = await requireClient().auth.signOut();
  if (error) throw error;
}

export async function getCurrentSession() {
  const { data, error } = await requireClient().auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function loadProfile(userId: string) {
  const { data, error } = await requireClient().from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return profileFromRow(data);
}

export async function loadRemoteState(currentUserId: string): Promise<SopState> {
  const [users, categories, promptSets, sops, steps, media, pointsEvents, awards] = await Promise.all([
    read("profiles", profileFromRow, "name"),
    read("sop_category", categoryFromRow, "sort_order"),
    read("prompt_set", promptSetFromRow, "name"),
    read("sop", sopFromRow, "updated_at"),
    read("sop_step", stepFromRow, "sort_order"),
    read("sop_media", mediaFromRow, "captured_at"),
    read("points_events", pointsFromRow, "ts"),
    read("points_award", awardFromRow, "awarded_at"),
  ]);
  return {
    currentUserId,
    users,
    categories,
    promptSets,
    sops,
    steps,
    media,
    pointsEvents,
    pointsAwards: awards,
    notifications: [],
    offlineMediaQueue: [],
    permissions: {
      crewLeadCanManageCategories: false,
      crewLeadCanAssignWithinCrew: true,
      crewLeadCanApprove: false,
    },
  };
}

export async function persistState(previous: SopState, next: SopState) {
  const client = requireClient();
  const changedSops = next.sops.filter((sop) => JSON.stringify(previous.sops.find((item) => item.id === sop.id)) !== JSON.stringify(sop));
  const changedSteps = next.steps.filter((step) => JSON.stringify(previous.steps.find((item) => item.id === step.id)) !== JSON.stringify(step));
  const changedMedia = next.media.filter((media) => media.syncStatus === "synced" && JSON.stringify(previous.media.find((item) => item.id === media.id)) !== JSON.stringify(media));

  if (changedSops.length) {
    const { error } = await client.from("sop").upsert(changedSops.map(sopToRow));
    if (error) throw error;
  }
  if (changedSteps.length) {
    const { error } = await client.from("sop_step").upsert(changedSteps.map(stepToRow));
    if (error) throw error;
  }
  if (changedMedia.length) {
    const { error } = await client.from("sop_media").upsert(changedMedia.map(mediaToRow));
    if (error) throw error;
  }
}

export async function awardSopPoints(sop: SopItem, awardedBy: string) {
  const { data, error } = await requireClient().functions.invoke("award-points", {
    body: {
      kind: "sop_completed",
      crewMemberId: sop.createdBy,
      sopId: sop.id,
      reason: `SOP approved: ${sop.title}`,
      awardedBy,
    },
  });
  if (error) throw error;
  return data as { eventId: string; awardedAt: string; alreadyAwarded: boolean };
}

export async function recordPointsAward(sop: SopItem, result: { eventId: string; awardedAt: string }) {
  const { error } = await requireClient().from("points_award").upsert({
    sop_id: sop.id,
    crew_member_id: sop.createdBy,
    points: 20,
    awarded_at: result.awardedAt,
    external_ref: result.eventId,
    status: "sent",
  }, { onConflict: "sop_id" });
  if (error) throw error;
}

export async function uploadMediaFile(stepId: string, sopId: string, file: File) {
  const type = file.type.startsWith("video/") ? "video" : "photo";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storageKey = `sop/${sopId}/${stepId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await requireClient().storage.from("sop-media").upload(storageKey, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const thumbnailUrl = type === "photo" ? await signedUrl(storageKey) : "";
  return { type, storageKey, thumbnailUrl, size: file.size };
}

export async function signedUrl(storageKey: string) {
  const { data, error } = await requireClient().storage.from("sop-media").createSignedUrl(storageKey, 60 * 60);
  if (error) return "";
  return data.signedUrl;
}

async function read<T>(table: string, mapper: (row: any) => T, order: string) {
  const { data, error } = await requireClient().from(table).select("*").order(order, { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapper);
}

const profileFromRow = (row: any): Profile => ({
  id: row.id,
  name: row.name ?? row.email ?? "Team member",
  email: row.email ?? undefined,
  role: row.role,
  color: row.color ?? "#14A2A4",
  crewPlusId: row.crew_plus_id ?? undefined,
});

const categoryFromRow = (row: any): SopCategory => ({
  id: row.id,
  name: row.name,
  sortOrder: Number(row.sort_order ?? 0),
  archived: row.archived ?? false,
  promptSetId: row.prompt_set_id,
});

const promptSetFromRow = (row: any): PromptSet => ({ id: row.id, name: row.name, prompts: Array.isArray(row.prompts) ? row.prompts : [] });

const sopFromRow = (row: any): SopItem => ({
  id: row.id,
  title: row.title,
  categoryId: row.category_id,
  description: row.description ?? "",
  status: row.status,
  assignedTo: row.assigned_to ?? "",
  createdBy: row.created_by,
  requiresPhoto: row.requires_photo ?? false,
  requiresVideo: row.requires_video ?? false,
  dueDate: row.due_date ?? undefined,
  submittedAt: row.submitted_at ?? undefined,
  approvedAt: row.approved_at ?? undefined,
  approvedBy: row.approved_by ?? undefined,
  reviewComments: row.review_comments ?? undefined,
  pointsAwarded: row.points_awarded ?? false,
  updatedAt: row.updated_at,
});

const stepFromRow = (row: any): SopStep => ({ id: row.id, sopId: row.sop_id, sortOrder: Number(row.sort_order ?? 0), text: row.text ?? "", note: row.note ?? "" });

const mediaFromRow = (row: any): SopMedia => ({
  id: row.id,
  stepId: row.step_id,
  type: row.type,
  storageKey: row.storage_key,
  thumbnailUrl: row.thumbnail_url ?? "",
  size: Number(row.size ?? 0),
  capturedAt: row.captured_at,
  syncStatus: "synced",
});

const pointsFromRow = (row: any): PointsEvent => ({
  id: row.id,
  userId: row.user_id,
  type: row.type,
  points: Number(row.points ?? 0),
  reason: row.reason,
  ref: row.ref,
  ts: row.ts,
});

const awardFromRow = (row: any): PointsAward => ({
  id: row.id,
  sopId: row.sop_id,
  crewMemberId: row.crew_member_id,
  points: Number(row.points ?? 20),
  awardedAt: row.awarded_at,
  externalRef: row.external_ref,
  status: row.status,
});

const sopToRow = (sop: SopItem) => ({
  id: sop.id,
  title: sop.title,
  category_id: sop.categoryId,
  description: sop.description,
  status: sop.status,
  assigned_to: sop.assignedTo || null,
  created_by: sop.createdBy,
  requires_photo: sop.requiresPhoto,
  requires_video: sop.requiresVideo,
  due_date: sop.dueDate ?? null,
  submitted_at: sop.submittedAt ?? null,
  approved_at: sop.approvedAt ?? null,
  approved_by: sop.approvedBy ?? null,
  review_comments: sop.reviewComments ?? null,
  points_awarded: sop.pointsAwarded,
  updated_at: sop.updatedAt,
});

const stepToRow = (step: SopStep) => ({ id: step.id, sop_id: step.sopId, sort_order: step.sortOrder, text: step.text, note: step.note });

const mediaToRow = (media: SopMedia) => ({
  id: media.id,
  step_id: media.stepId,
  type: media.type,
  storage_key: media.storageKey,
  thumbnail_url: media.thumbnailUrl,
  size: media.size,
  captured_at: media.capturedAt,
});
