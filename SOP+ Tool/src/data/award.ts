import type { PointsEvent } from "../types";

export function findExistingSopAward(events: PointsEvent[], sopId: string) {
  return events.find((event) => event.type === "sop_completed" && event.ref === sopId);
}

export function shouldRequestSopAward(events: PointsEvent[], sopId: string) {
  return !findExistingSopAward(events, sopId);
}
