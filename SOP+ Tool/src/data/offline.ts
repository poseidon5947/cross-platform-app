import { attachUploadedMedia } from "../domain/sop";
import type { OfflineMediaCommand, SopState } from "../types";

export interface MediaUploadServer {
  upload(command: OfflineMediaCommand): Promise<{ storageKey: string; thumbnailUrl: string; size: number }>;
}

export async function drainRemoteMediaQueue(state: SopState, server: MediaUploadServer) {
  let next = state;
  const remaining: OfflineMediaCommand[] = [];
  const seen = new Set<string>();

  for (const command of state.offlineMediaQueue) {
    if (!["queued", "failed"].includes(command.status) || seen.has(command.id)) continue;
    seen.add(command.id);
    try {
      const result = await server.upload(command);
      next = attachUploadedMedia(next, command.stepId, command.type, command.fileName, result.storageKey, result.thumbnailUrl, result.size, command.queuedAt, command.mediaId);
    } catch (error) {
      remaining.push({ ...command, status: "failed", error: error instanceof Error ? error.message : "Upload failed" });
    }
  }

  return {
    ...next,
    offlineMediaQueue: remaining,
  };
}
