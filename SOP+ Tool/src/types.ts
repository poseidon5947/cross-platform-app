export type Role = "admin" | "manager" | "crew";

export type SopStatus = "assigned" | "in_progress" | "in_review" | "published" | "archived";

export type MediaType = "photo" | "video";

export type NotificationType = "assigned" | "submitted" | "approved" | "changes_requested" | "overdue";

export interface Profile {
  id: string;
  name: string;
  role: Role;
  color: string;
  email?: string;
  crewPlusId?: string;
}

export interface PromptSet {
  id: string;
  name: string;
  prompts: string[];
}

export interface SopCategory {
  id: string;
  name: string;
  sortOrder: number;
  archived: boolean;
  promptSetId: string;
}

export interface SopItem {
  id: string;
  title: string;
  categoryId: string;
  description: string;
  status: SopStatus;
  assignedTo: string;
  createdBy: string;
  requiresPhoto: boolean;
  requiresVideo: boolean;
  dueDate?: string;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  reviewComments?: string;
  pointsAwarded: boolean;
  updatedAt: string;
}

export interface SopStep {
  id: string;
  sopId: string;
  sortOrder: number;
  text: string;
  note: string;
}

export interface SopMedia {
  id: string;
  stepId: string;
  type: MediaType;
  storageKey: string;
  thumbnailUrl: string;
  size: number;
  capturedAt: string;
  syncStatus: "local" | "queued" | "synced";
  localUrl?: string;
}

export interface PointsEvent {
  id: string;
  userId: string;
  type: "sop_completed" | "daily_tasks";
  points: number;
  reason: string;
  ref: string;
  ts: string;
  awardedBy?: string;
}

export interface PointsAward {
  id: string;
  sopId: string;
  crewMemberId: string;
  points: number;
  awardedAt: string;
  externalRef: string;
  status: "sent" | "queued";
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  ts: string;
}

export interface OfflineMediaCommand {
  id: string;
  mediaId: string;
  stepId: string;
  sopId: string;
  fileName: string;
  type: MediaType;
  storageKey: string;
  thumbnailUrl?: string;
  size?: number;
  queuedAt: string;
  status: "queued" | "synced" | "failed";
  error?: string;
  file?: File;
}

export interface PermissionConfig {
  crewLeadCanManageCategories: boolean;
  crewLeadCanAssignWithinCrew: boolean;
  crewLeadCanApprove: boolean;
}

export interface SopState {
  currentUserId: string;
  users: Profile[];
  categories: SopCategory[];
  promptSets: PromptSet[];
  sops: SopItem[];
  steps: SopStep[];
  media: SopMedia[];
  pointsEvents: PointsEvent[];
  pointsAwards: PointsAward[];
  notifications: Notification[];
  offlineMediaQueue: OfflineMediaCommand[];
  permissions: PermissionConfig;
}

export interface SopDraft {
  title: string;
  categoryId: string;
  description: string;
  assignedTo: string;
  createdBy: string;
  requiresPhoto: boolean;
  requiresVideo: boolean;
  dueDate?: string;
}
