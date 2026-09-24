import type { AppState, OfflineCommand, Transaction } from "../types";
import { applyTransactions, applyTruckLog, id } from "../domain/business";

export interface OfflineServer {
  logMaterials(command: OfflineCommand & { type: "log_materials" }): Promise<void>;
  completeTask(command: OfflineCommand & { type: "complete_task" }): Promise<void>;
  saveTruckLog(command: OfflineCommand & { type: "truck_log" }): Promise<void>;
  saveDailyLog(command: OfflineCommand & { type: "daily_log" }): Promise<void>;
}

export async function drainOfflineQueue(queue: OfflineCommand[], server: OfflineServer) {
  const remaining: OfflineCommand[] = [];
  const seen = new Set<string>();
  for (const command of queue) {
    if (seen.has(command.id)) continue;
    seen.add(command.id);
    try {
      if (command.type === "log_materials") await server.logMaterials(command);
      if (command.type === "complete_task") await server.completeTask(command);
      if (command.type === "truck_log") await server.saveTruckLog(command);
      if (command.type === "daily_log") await server.saveDailyLog(command);
    } catch (error) {
      const lastError = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : String(error);
      remaining.push({ ...command, lastError });
    }
  }
  return remaining;
}

/**
 * Lay the queue back over a fresh copy of server state.
 *
 * Server state never knows about work that has not been sent, so replacing
 * local state with it - on a background refetch, or when a reload falls back to
 * the last synced copy - made queued work vanish from the screen while the
 * header still said "1 pending sync". The ticked box went blank and the stock
 * count jumped back up, which reads as "it did not save" to the person holding
 * the phone. Everything below is idempotent: a command whose rows the server
 * already has (it was sent, but the queue has not drained yet) changes nothing.
 */
export function applyQueuedCommands(base: AppState, queue: OfflineCommand[]): AppState {
  let state = base;
  for (const command of queue) {
    if (command.type === "log_materials") {
      const known = new Set(state.transactions.map((tx) => tx.id));
      const dated: Transaction[] = command.transactions
        .map((tx, index) => ({ ...tx, id: command.rowIds?.[index] ?? id("tx"), ts: command.queuedAt }))
        .filter((tx) => !known.has(tx.id));
      if (!dated.length) continue;
      state = { ...state, transactions: [...dated, ...state.transactions], materials: applyTransactions(state.materials, dated) };
    } else if (command.type === "complete_task") {
      const done = state.taskCompletions.some(
        (row) => row.userId === command.userId && row.taskId === command.taskId && row.periodKey === command.periodKey,
      );
      if (done) continue;
      state = {
        ...state,
        taskCompletions: [
          ...state.taskCompletions,
          { id: id("tc"), userId: command.userId, taskId: command.taskId, periodKey: command.periodKey, completedAt: command.queuedAt },
        ],
      };
    } else if (command.type === "truck_log") {
      if (command.rowId && state.truckLogs.some((row) => row.id === command.rowId)) continue;
      const applied = applyTruckLog(state, { ...command.log, id: command.rowId ?? id("tl"), ts: command.queuedAt });
      state = { ...state, trucks: applied.trucks, truckLogs: applied.truckLogs, taskCompletions: applied.taskCompletions, pointsEvents: applied.pointsEvents, streaks: applied.streaks };
    } else if (command.type === "daily_log") {
      if (state.dailyLogs.some((row) => row.id === command.log.id)) continue;
      state = {
        ...state,
        dailyLogs: [command.log, ...state.dailyLogs],
        crewPoolPoints: state.crewPoolPoints + command.poolDelta,
        pointsEvents: command.event && !state.pointsEvents.some((row) => row.id === command.event!.id)
          ? [command.event, ...state.pointsEvents]
          : state.pointsEvents,
      };
    }
  }
  return state;
}
