export type Role = "admin" | "manager" | "crew";
export type Category =
  | "waterproofing"
  | "drainage"
  | "caulking"
  | "insulation"
  | "crack_injection"
  | "traffic_coatings"
  | "termination_fasteners"
  | "consumables"
  | "ppe"
  | "shop";
export type ServiceId = "wp" | "ins" | "inj" | "trf" | "veh";
export type TxType = "use" | "deliver" | "loss" | "receive" | "return" | "adjust";
export type ToolStatus = "in" | "out";
export type ToolCondition = "good" | "repair" | "damaged";
export type TaskFrequency = "daily" | "weekly" | "monthly";
export type PointsEventType =
  | "daily_100"
  | "daily_100_reversal"
  | "streak_bonus"
  | "manual_adjust"
  | "sop_completed"
  | "crew_habit_ritual"
  | "crew_review_completed"
  | "crew_kpi_hit"
  | "crew_feedback"
  | "crew_certs_current"
  | "crew_google_review"
  | "crew_compliment"
  | "crew_safety_milestone"
  | "crew_peer_recognition"
  | "redeem";

export interface Material {
  id: string;
  name: string;
  category: Category;
  unit: string;
  step: 0.25 | 0.5 | 1;
  pack: string;
  unitsPerPallet: number;
  cost: number;
  qty: number;
  reorderPoint: number;
  bin: string;
}

export interface ImportReport {
  imported: number;
  skipped: Array<{ row: number; reason: string }>;
  materials: Material[];
}

export interface Site {
  id: string;
  name: string;
  address: string;
  qboCustomerName?: string;
  qboProjectId?: string;
  qboProjectName?: string;
  source: "manual" | "quickbooks";
}

export interface Service {
  id: ServiceId;
  name: string;
  short: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  color: string;
  points: number;
}

export interface Transaction {
  id: string;
  materialId: string;
  qty: number;
  type: TxType;
  siteId?: string;
  serviceId?: ServiceId;
  userId: string;
  note?: string;
  ts: string;
}

export interface ToolItem {
  id: string;
  name: string;
  serviceId: ServiceId;
  battery: boolean;
  status: ToolStatus;
  condition: ToolCondition;
  lastCharged?: string | null;
  note?: string;
  outBy?: string;
  outJob?: string;
  outService?: ServiceId;
  outTs?: string;
}

export interface Truck {
  id: string;
  name: string;
  km: number;
  lastServiced: string;
  lastOil: number;
}

export interface TruckLog {
  id: string;
  truckId: string;
  ts: string;
  km: number;
  driverId: string;
  siteId: string;
  serviceId: ServiceId;
  oilChecked: boolean;
  fuelTopped: boolean;
  gasStation?: string;
  totalCost?: number;
  receiptPhotoName?: string;
  exteriorWash?: boolean;
  repairs?: string;
  notes?: string;
}

export interface TruckTask {
  id: string;
  text: string;
  serviceId: ServiceId;
  freq: TaskFrequency;
  timeOfDay?: "start" | "end" | "job_start" | "job_completion" | "pack_list";
  requiredForDailyPoints?: boolean;
}

export interface TaskCompletion {
  id: string;
  userId: string;
  taskId: string;
  periodKey: string;
  completedAt: string;
}

export interface PointsEvent {
  id: string;
  userId: string;
  type: PointsEventType;
  points: number;
  reason: string;
  ref: string;
  ts: string;
}

export interface Streak {
  userId: string;
  count: number;
  last: string | null;
  awardedOn: string | null;
}

export interface AppState {
  materials: Material[];
  sites: Site[];
  services: Service[];
  users: User[];
  transactions: Transaction[];
  tools: ToolItem[];
  trucks: Truck[];
  truckLogs: TruckLog[];
  truckTasks: TruckTask[];
  taskCompletions: TaskCompletion[];
  pointsEvents: PointsEvent[];
  streaks: Streak[];
  currentUserId: string;
  offlineQueue: OfflineCommand[];
}

export type OfflineCommand =
  | { id: string; type: "log_materials"; transactions: Omit<Transaction, "id" | "ts">[]; queuedAt: string }
  | { id: string; type: "complete_task"; userId: string; taskId: string; periodKey: string; queuedAt: string }
  | { id: string; type: "truck_log"; log: Omit<TruckLog, "id" | "ts">; autoTaskIds: string[]; pointsEvents?: PointsEvent[]; streak?: Streak; queuedAt: string };
