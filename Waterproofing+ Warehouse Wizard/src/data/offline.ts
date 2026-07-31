import type { OfflineCommand } from "../types";

export interface OfflineServer {
  logMaterials(command: OfflineCommand & { type: "log_materials" }): Promise<void>;
  completeTask(command: OfflineCommand & { type: "complete_task" }): Promise<void>;
  saveTruckLog(command: OfflineCommand & { type: "truck_log" }): Promise<void>;
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
    } catch {
      remaining.push(command);
    }
  }
  return remaining;
}
