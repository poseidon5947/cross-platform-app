import type { MediaType, Notification, OfflineMediaCommand, PointsAward, PointsEvent, Role, SopDraft, SopItem, SopState, SopStep } from "../types";

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function canManage(role: Role) {
  return role === "admin" || role === "manager";
}

export function canApprove(role: Role, crewLeadCanApprove = false) {
  return role === "admin" || role === "manager" || (role === "crew" && crewLeadCanApprove);
}

export function canCreateSop(role: Role, crewLeadCanAssignWithinCrew = false) {
  return role === "admin" || role === "manager" || (role === "crew" && crewLeadCanAssignWithinCrew);
}

export function canEditSop(role: Role, userId: string, sop: SopItem) {
  return role === "admin" || role === "manager" || sop.status === "published" || sop.assignedTo === userId || sop.createdBy === userId;
}

export function createSop(state: SopState, draft: SopDraft, now = new Date().toISOString()): SopState {
  const sop: SopItem = {
    id: uid("sop"),
    title: draft.title.trim(),
    categoryId: draft.categoryId,
    description: draft.description.trim(),
    status: "assigned",
    assignedTo: draft.assignedTo,
    createdBy: draft.createdBy,
    requiresPhoto: draft.requiresPhoto,
    requiresVideo: draft.requiresVideo,
    dueDate: draft.dueDate || undefined,
    pointsAwarded: false,
    updatedAt: now,
  };
  return {
    ...state,
    sops: [sop, ...state.sops],
    notifications: [
      makeNotification(draft.assignedTo, "assigned", "SOP assigned", `${sop.title} is ready to build.`, now),
      ...state.notifications,
    ],
  };
}

export function addStep(state: SopState, sopId: string, text: string, note = "", now = new Date().toISOString()): SopState {
  const existing = state.steps.filter((step) => step.sopId === sopId);
  const step: SopStep = { id: uid("step"), sopId, sortOrder: existing.length + 1, text: text.trim(), note: note.trim() };
  return touchSop({ ...state, steps: [...state.steps, step] }, sopId, "in_progress", now);
}

export function updateStep(state: SopState, stepId: string, text: string, note: string, now = new Date().toISOString()): SopState {
  const step = state.steps.find((item) => item.id === stepId);
  if (!step) return state;
  return touchSop(
    {
      ...state,
      steps: state.steps.map((item) => (item.id === stepId ? { ...item, text: text.trim(), note: note.trim() } : item)),
    },
    step.sopId,
    "in_progress",
    now,
  );
}

export function deleteStep(state: SopState, stepId: string, now = new Date().toISOString()): SopState {
  const step = state.steps.find((item) => item.id === stepId);
  if (!step) return state;
  const remaining = state.steps
    .filter((item) => item.id !== stepId)
    .map((item) => (item.sopId === step.sopId && item.sortOrder > step.sortOrder ? { ...item, sortOrder: item.sortOrder - 1 } : item));
  return touchSop({ ...state, steps: remaining, media: state.media.filter((item) => item.stepId !== stepId) }, step.sopId, "in_progress", now);
}

export function moveStep(state: SopState, sopId: string, stepId: string, direction: -1 | 1, now = new Date().toISOString()): SopState {
  const steps = state.steps.filter((step) => step.sopId === sopId).sort((a, b) => a.sortOrder - b.sortOrder);
  const index = steps.findIndex((step) => step.id === stepId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= steps.length) return state;
  const current = steps[index];
  const next = steps[nextIndex];
  return touchSop(
    {
      ...state,
      steps: state.steps.map((step) => {
        if (step.id === current.id) return { ...step, sortOrder: next.sortOrder };
        if (step.id === next.id) return { ...step, sortOrder: current.sortOrder };
        return step;
      }),
    },
    sopId,
    "in_progress",
    now,
  );
}

export function attachMedia(state: SopState, stepId: string, type: MediaType, fileName: string, online: boolean, now = new Date().toISOString()): SopState {
  const step = state.steps.find((item) => item.id === stepId);
  if (!step) return state;
  const mediaId = uid("media");
  const storageKey = `sop/${step.sopId}/${stepId}/${mediaId}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  const media = {
    id: mediaId,
    stepId,
    type,
    storageKey,
    thumbnailUrl: type === "photo" ? storageKey : "",
    size: 0,
    capturedAt: now,
    syncStatus: online ? "synced" : "queued",
  } as const;
  const command: OfflineMediaCommand = { id: uid("upload"), mediaId, stepId, sopId: step.sopId, fileName, type, storageKey, queuedAt: now, status: "queued" };
  return touchSop(
    {
      ...state,
      media: [...state.media, media],
      offlineMediaQueue: online ? state.offlineMediaQueue : [...state.offlineMediaQueue, command],
    },
    step.sopId,
    "in_progress",
    now,
  );
}

export function attachUploadedMedia(state: SopState, stepId: string, type: MediaType, fileName: string, storageKey: string, thumbnailUrl: string, size: number, now = new Date().toISOString(), mediaId = uid("media")): SopState {
  const step = state.steps.find((item) => item.id === stepId);
  if (!step) return state;
  const existing = state.media.find((item) => item.id === mediaId);
  const synced = {
    id: mediaId,
    stepId,
    type,
    storageKey,
    thumbnailUrl: thumbnailUrl || (type === "photo" ? storageKey : ""),
    size,
    capturedAt: existing?.capturedAt ?? now,
    syncStatus: "synced" as const,
  };
  return touchSop(
    {
      ...state,
      media: existing ? state.media.map((item) => (item.id === mediaId ? synced : item)) : [...state.media, synced],
      offlineMediaQueue: state.offlineMediaQueue.filter((command) => command.mediaId !== mediaId),
    },
    step.sopId,
    "in_progress",
    now,
  );
}

export function drainOfflineMediaQueue(state: SopState): SopState {
  return {
    ...state,
    media: state.media.map((media) => (media.syncStatus === "queued" ? { ...media, syncStatus: "synced" } : media)),
    offlineMediaQueue: state.offlineMediaQueue.map((command) => ({ ...command, status: "synced" })),
  };
}

export function submitForReview(state: SopState, sopId: string, managerId: string, now = new Date().toISOString()): SopState {
  return {
    ...touchSop(state, sopId, "in_review", now, { submittedAt: now, reviewComments: "" }),
    notifications: [makeNotification(managerId, "submitted", "SOP ready for review", sopTitle(state, sopId), now), ...state.notifications],
  };
}

export function requestChanges(state: SopState, sopId: string, comments: string, assigneeId: string, now = new Date().toISOString()): SopState {
  return {
    ...touchSop(state, sopId, "in_progress", now, { reviewComments: comments }),
    notifications: [makeNotification(assigneeId, "changes_requested", "Changes requested", comments, now), ...state.notifications],
  };
}

export function approveSop(state: SopState, sopId: string, approverId: string, now = new Date().toISOString()): SopState {
  const sop = state.sops.find((item) => item.id === sopId);
  if (!sop) return state;
  const alreadyAwarded = sop.pointsAwarded || state.pointsEvents.some((event) => event.type === "sop_completed" && event.ref === sopId);
  const approvedState = touchSop(state, sopId, "published", now, {
    approvedAt: now,
    approvedBy: approverId,
    pointsAwarded: true,
  });
  if (alreadyAwarded) return approvedState;
  const event: PointsEvent = {
    id: uid("pe"),
    userId: sop.createdBy,
    type: "sop_completed",
    points: 20,
    reason: `SOP approved: ${sop.title}`,
    ref: sopId,
    ts: now,
    awardedBy: approverId,
  };
  const award: PointsAward = {
    id: uid("award"),
    sopId,
    crewMemberId: sop.createdBy,
    points: 20,
    awardedAt: now,
    externalRef: sopId,
    status: "sent",
  };
  return {
    ...approvedState,
    pointsEvents: [event, ...approvedState.pointsEvents],
    pointsAwards: [award, ...approvedState.pointsAwards],
    notifications: [makeNotification(sop.assignedTo, "approved", "+20 points awarded", `${sop.title} is published.`, now), ...approvedState.notifications],
  };
}

export function sopPointsForUser(state: SopState, userId: string) {
  return state.pointsEvents.filter((event) => event.userId === userId && event.type === "sop_completed").reduce((sum, event) => sum + event.points, 0);
}

function touchSop(state: SopState, sopId: string, status: SopItem["status"], now: string, patch: Partial<SopItem> = {}): SopState {
  return {
    ...state,
    sops: state.sops.map((sop) =>
      sop.id === sopId
        ? {
            ...sop,
            status: sop.status === "published" && status === "in_progress" ? "published" : status,
            updatedAt: now,
            ...patch,
          }
        : sop,
    ),
  };
}

function makeNotification(userId: string, type: Notification["type"], title: string, body: string, ts: string): Notification {
  return { id: uid("note"), userId, type, title, body, read: false, ts };
}

function sopTitle(state: SopState, sopId: string) {
  return state.sops.find((sop) => sop.id === sopId)?.title ?? "SOP";
}
